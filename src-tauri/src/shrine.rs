use std::fs;
use std::path::{Path, PathBuf};

fn shrine_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE").expect("USERPROFILE");
    Path::new(&home).join(".shrine")
}

pub fn config_path(name: &str) -> PathBuf {
    shrine_dir().join(name)
}

pub fn reliquary_dir() -> PathBuf {
    shrine_dir().join("reliquary")
}

/// Where the ledger lives. Default: ~/.shrine/ledger.md.
/// Point it somewhere meaningful (e.g. your Claude memory directory) via
/// ~/.shrine/config.json: {"ledgerPath": "C:\\...\\shrine-ledger.md"}
pub fn ledger_path() -> PathBuf {
    let cfg = config_path("config.json");
    if let Ok(s) = fs::read_to_string(&cfg) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
            if let Some(p) = v["ledgerPath"].as_str() {
                return PathBuf::from(p);
            }
        }
    }
    config_path("ledger.md")
}

/// Move the offered file into the reliquary. Never deletes; never copies-and-leaves.
/// This runs BEFORE the keeper is ever summoned — the gift is safe first.
#[tauri::command]
pub fn move_to_reliquary(src: String) -> Result<String, String> {
    let src = PathBuf::from(src);
    let name = src
        .file_name()
        .ok_or("no filename")?
        .to_string_lossy()
        .to_string();
    let now = chrono::Local::now();
    let dir = reliquary_dir()
        .join(now.format("%Y").to_string())
        .join(format!("{}--{}", now.format("%m-%d"), name));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut dest = dir.join(&name);
    let mut i = 1;
    while dest.exists() {
        dest = dir.join(format!("{}-{}", i, name));
        i += 1;
    }
    // fs::rename fails across drives; fall back to copy+remove
    if fs::rename(&src, &dest).is_err() {
        fs::copy(&src, &dest).map_err(|e| e.to_string())?;
        fs::remove_file(&src).map_err(|e| e.to_string())?;
    }
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn append_ledger(entry: String) -> Result<(), String> {
    let p = ledger_path();
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if !p.exists() {
        fs::write(
            &p,
            "# Shrine ledger — offerings received at the desktop shrine\n\n",
        )
        .map_err(|e| e.to_string())?;
    }
    let mut cur = fs::read_to_string(&p).map_err(|e| e.to_string())?;
    cur.push('\n');
    cur.push_str(&entry);
    fs::write(&p, cur).map_err(|e| e.to_string())
}

/// Read/write small state files inside ~/.shrine (garden.json, pending.json, config.json).
#[tauri::command]
pub fn read_text(path: String) -> Result<String, String> {
    fs::read_to_string(config_path(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text(path: String, content: String) -> Result<(), String> {
    fs::create_dir_all(shrine_dir()).map_err(|e| e.to_string())?;
    fs::write(config_path(&path), content).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reliquary_move_roundtrip() {
        let tmp = std::env::temp_dir().join("shrine_test_gift.txt");
        std::fs::write(&tmp, "hello").unwrap();
        let dest = move_to_reliquary(tmp.to_string_lossy().to_string()).unwrap();
        assert!(std::path::Path::new(&dest).exists());
        assert!(!tmp.exists());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "hello");
        std::fs::remove_file(&dest).ok();
    }
}
