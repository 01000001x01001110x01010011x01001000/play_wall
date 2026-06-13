use base64::{engine::general_purpose, Engine as _};
use std::path::Path;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Decode the PNG the frontend generated, save it under the app's data dir,
/// and set it as the desktop wallpaper. The frontend calls this from the
/// "Set as desktop wallpaper" button.
#[tauri::command]
fn set_wallpaper(app: tauri::AppHandle, png_base64: String) -> Result<(), String> {
    let bytes = general_purpose::STANDARD
        .decode(png_base64.trim())
        .map_err(|e| format!("bad image data: {e}"))?;

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // Remove wallpapers we wrote earlier — macOS caches by path, so a fresh,
    // unique filename each time guarantees the desktop actually refreshes.
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with("wallpaper-") {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = dir.join(format!("wallpaper-{ts}.png"));
    std::fs::write(&path, &bytes).map_err(|e| format!("couldn't save image: {e}"))?;

    set_desktop_wallpaper(&path)
}

#[cfg(target_os = "macos")]
fn set_desktop_wallpaper(path: &Path) -> Result<(), String> {
    // Set the picture on every desktop (all displays) in the current Space.
    let script = format!(
        "tell application \"System Events\" to tell every desktop to set picture to \"{}\"",
        path.display()
    );
    let status = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .status()
        .map_err(|e| format!("couldn't run osascript: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("osascript failed to set the wallpaper".into())
    }
}

#[cfg(not(target_os = "macos"))]
fn set_desktop_wallpaper(_path: &Path) -> Result<(), String> {
    Err("Setting the wallpaper is only implemented on macOS so far.".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Tray-only app on macOS: no Dock icon, lives in the menu bar.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let open = MenuItem::with_id(app, "open", "Open PlayWall", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("PlayWall")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_wallpaper])
        .on_window_event(|window, event| {
            // closing the window just hides it; the app stays in the tray
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
