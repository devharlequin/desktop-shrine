use std::process::Command;

use crate::shrine::{config_path, ledger_path};

fn keeper_log(msg: &str) {
    let p = config_path("keeper.log");
    let line = format!("[{}] {}\n", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"), msg);
    let prev = std::fs::read_to_string(&p).unwrap_or_default();
    let _ = std::fs::write(&p, prev + &line);
}

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

    let out = tauri::async_runtime::spawn_blocking(move || -> std::io::Result<std::process::Output> {
        use std::io::Write;
        // claude is claude.cmd on Windows; go through cmd so PATH resolution works.
        // The prompt goes via STDIN — multi-line args do not survive the shell.
        let mut cmd = Command::new("cmd");
        // strip session env a parent Claude Code instance would leak into the child
        for (k, _) in std::env::vars() {
            let ku = k.to_uppercase();
            if ku.starts_with("ANTHROPIC_") || ku.starts_with("CLAUDE") {
                cmd.env_remove(&k);
            }
        }
        cmd.args([
            "/C",
            "claude",
            "-p",
            "--model",
            "sonnet",
            "--allowedTools",
            "Read,Edit,Write",
            "--add-dir",
            &ledger_dir,
            "--add-dir",
            &offering_dir,
        ]);
        // a GUI app's cwd is wherever it was launched from; give the keeper a stable home
        if let Ok(home) = std::env::var("USERPROFILE") {
            cmd.current_dir(home);
        }
        cmd.stdin(std::process::Stdio::piped());
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());
        let mut child = cmd.spawn()?;
        child.stdin.take().unwrap().write_all(prompt.as_bytes())?;
        child.wait_with_output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    if !out.status.success() {
        let err = format!(
            "keeper exit {:?}: {} | {}",
            out.status.code(),
            String::from_utf8_lossy(&out.stderr).chars().take(300).collect::<String>(),
            String::from_utf8_lossy(&out.stdout).chars().take(300).collect::<String>(),
        );
        keeper_log(&err);
        return Err(err);
    }
    let text = String::from_utf8_lossy(&out.stdout);
    // the final line should be the JSON verdict; scan from the end
    for line in text.lines().rev() {
        let l = line.trim();
        if l.starts_with('{') {
            if let Ok(mut v) = serde_json::from_str::<KeeperVerdict>(l) {
                v.responses.retain(|r| VOCAB.contains(&r.as_str()));
                v.responses.truncate(2);
                keeper_log(&format!("offering \"{}\" received: {:?}", offering_name, v.responses));
                return Ok(v);
            }
        }
    }
    let err = format!(
        "keeper returned no verdict: {}",
        text.chars().take(400).collect::<String>()
    );
    keeper_log(&err);
    Err(err)
}

fn dir_of(p: &str) -> String {
    std::path::Path::new(p)
        .parent()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_default()
}
