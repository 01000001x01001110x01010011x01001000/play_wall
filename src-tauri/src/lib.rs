use base64::{engine::general_purpose, Engine as _};
use std::path::Path;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder,
};

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Called by the floating desktop icon when clicked.
#[tauri::command]
fn show_main(app: tauri::AppHandle) {
    show_main_window(&app);
}

/// Size of the floating-icon window. It's larger than the icon glyph so the
/// icon can sense the cursor approaching (the proximity reveal) before the
/// pointer is directly over it.
const ICON_WINDOW: f64 = 150.0;
const ICON_MARGIN: f64 = 28.0;

/// Create the small transparent always-on-top window that hosts the desktop
/// play icon, positioned at the bottom-right of the primary display.
fn create_icon_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    let win = WebviewWindowBuilder::new(app, "icon", WebviewUrl::App("index.html#icon".into()))
        .title("PlayWall")
        .inner_size(ICON_WINDOW, ICON_WINDOW)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .build()?;

    if let Ok(Some(monitor)) = win.primary_monitor() {
        let scale = monitor.scale_factor();
        let screen = monitor.size().to_logical::<f64>(scale);
        let x = screen.width - ICON_WINDOW - ICON_MARGIN;
        let y = screen.height - ICON_WINDOW - ICON_MARGIN;
        let _ = win.set_size(LogicalSize::new(ICON_WINDOW, ICON_WINDOW));
        let _ = win.set_position(LogicalPosition::new(x, y));
    }
    Ok(())
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

            create_icon_window(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_wallpaper, show_main])
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
