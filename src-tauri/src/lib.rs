mod export_file;
mod secure_store;

/// Apply real macOS window vibrancy (NSVisualEffect) behind the webview so the
/// translucent sidebar/title-bar reveal the desktop blur — the signature Mac
/// material. No-op on Windows/Linux, where the CSS `.material` fallback is used
/// instead. Presentation only: does not touch the window/OAuth lifecycle.
#[cfg(target_os = "macos")]
fn apply_window_vibrancy(app: &tauri::App) {
    use tauri::Manager;
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

    if let Some(window) = app.get_webview_window("main") {
        // `Sidebar` reads as the standard translucent sidebar material; the
        // opaque content column paints over it so only the chrome shows blur.
        let _ = apply_vibrancy(
            &window,
            NSVisualEffectMaterial::Sidebar,
            Some(NSVisualEffectState::Active),
            None,
        );
    }
}

#[cfg(not(target_os = "macos"))]
fn apply_window_vibrancy(_app: &tauri::App) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .setup(|app| {
            // Auto-update stack. `updater` exposes check/download/install to the
            // frontend; `process` exposes `relaunch()` so the app can restart
            // into the freshly installed version. Desktop-only.
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            apply_window_vibrancy(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            export_file::save_export_to_downloads,
            secure_store::secure_get,
            secure_store::secure_set,
            secure_store::secure_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
