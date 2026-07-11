mod keeper;
mod shrine;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // a second launch just visits the existing shrine
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            shrine::move_to_reliquary,
            shrine::append_ledger,
            shrine::read_text,
            shrine::write_text,
            keeper::summon_keeper,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let visit = MenuItem::with_id(app, "visit", "Visit shrine", true, None::<&str>)?;
            let sit = MenuItem::with_id(app, "sit", "Sit on desktop (toggle top-most)", true, None::<&str>)?;
            let quiet = MenuItem::with_id(app, "quiet", "Quiet the shrine", true, None::<&str>)?;
            let reliquary = MenuItem::with_id(app, "reliquary", "Open reliquary", true, None::<&str>)?;
            let ledger = MenuItem::with_id(app, "ledger", "Open ledger", true, None::<&str>)?;
            let leave = MenuItem::with_id(app, "leave", "Leave", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&visit, &sit, &quiet, &reliquary, &ledger, &leave])?;

            TrayIconBuilder::with_id("shrine-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("the shrine is here")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    let win = app.get_webview_window("main");
                    match event.id.as_ref() {
                        "visit" => {
                            if let Some(w) = win {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "sit" => {
                            if let Some(w) = win {
                                let on_top = w.is_always_on_top().unwrap_or(true);
                                let _ = w.set_always_on_top(!on_top);
                            }
                        }
                        "quiet" => {
                            let _ = app.emit("shrine://quiet", ());
                        }
                        "reliquary" => {
                            let dir = shrine::reliquary_dir();
                            let _ = std::fs::create_dir_all(&dir);
                            let _ = std::process::Command::new("explorer").arg(&dir).spawn();
                        }
                        "ledger" => {
                            let p = shrine::ledger_path();
                            let _ = std::process::Command::new("cmd")
                                .args(["/C", "start", "", p.to_string_lossy().as_ref()])
                                .spawn();
                        }
                        "leave" => app.exit(0),
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
