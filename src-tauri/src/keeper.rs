use std::process::Command;

use crate::shrine::ledger_path;

const PROMPT: &str = include_str!("../../keeper/PROMPT.md");

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct KeeperVerdict {
    pub responses: Vec<String>,
    pub ledger_written: bool,
}

const VOCAB: [&str; 6] = [
    "bow-lingered",
    "candles-brighter",
    "incense-thick",
    "god-eyes-glow",
    "firefly",
    "bell",
];

/// Summon the shrine-keeper: a headless sonnet agent that reads the offering,
/// appends the ledger itself, and returns its chosen responses.
#[tauri::command]
pub async fn summon_keeper(
    offering_path: String,
    offering_name: String,
) -> Result<KeeperVerdict, String> {
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    let ledger = ledger_path().to_string_lossy().to_string();
    let prompt = PROMPT
        .replace("{OFFERING_PATH}", &offering_path)
        .replace("{OFFERING_NAME}", &offering_name)
        .replace("{LEDGER_PATH}", &ledger)
        .replace("{DATE}", &date);

    let ledger_dir = dir_of(&ledger);
    let offering_dir = dir_of(&offering_path);

    let out = tauri::async_runtime::spawn_blocking(move || {
        // claude is claude.cmd on Windows; go through cmd so PATH resolution works
        Command::new("cmd")
            .args([
                "/C",
                "claude",
                "-p",
                &prompt,
                "--model",
                "sonnet",
                "--allowedTools",
                "Read,Edit,Write",
                "--add-dir",
                &ledger_dir,
                "--add-dir",
                &offering_dir,
            ])
            .output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    let text = String::from_utf8_lossy(&out.stdout);
    // the final line should be the JSON verdict; scan from the end
    for line in text.lines().rev() {
        let l = line.trim();
        if l.starts_with('{') {
            if let Ok(mut v) = serde_json::from_str::<KeeperVerdict>(l) {
                v.responses.retain(|r| VOCAB.contains(&r.as_str()));
                v.responses.truncate(2);
                return Ok(v);
            }
        }
    }
    Err(format!(
        "keeper returned no verdict: {}",
        text.chars().take(400).collect::<String>()
    ))
}

fn dir_of(p: &str) -> String {
    std::path::Path::new(p)
        .parent()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_default()
}
