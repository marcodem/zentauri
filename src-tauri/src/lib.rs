// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use tauri::Manager;
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            // -- Build File Menu --
            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &MenuItem::with_id(app, "new_file", "New File", true, Some("CmdOrCtrl+N"))?,
                    &MenuItem::with_id(app, "new_folder", "New Folder", true, Some("CmdOrCtrl+Shift+N"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "open_file", "Open File...", true, Some("CmdOrCtrl+O"))?,
                    &MenuItem::with_id(app, "open_folder", "Open Folder...", true, Some("CmdOrCtrl+Shift+O"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?,
                    &MenuItem::with_id(app, "save_as", "Save As...", true, Some("CmdOrCtrl+Shift+S"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "print", "Print...", true, Some("CmdOrCtrl+P"))?,
                    &PredefinedMenuItem::separator(app)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::quit(app, Some("Quit"))?,
                    #[cfg(target_os = "macos")]
                    &PredefinedMenuItem::close_window(app, Some("Close Window"))?,
                ],
            )?;

            // -- Build Edit Menu --
            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;

            // -- Build View Menu --
            let view_menu = Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &PredefinedMenuItem::fullscreen(app, None)?,
                ],
            )?;

            // -- Build Window Menu --
            let window_menu = Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                ],
            )?;

            // -- Combine into App Menu --
            let mut menu_items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = vec![];

            #[cfg(target_os = "macos")]
            let app_menu = Submenu::with_items(app, "Zentauri", true, &[
                &PredefinedMenuItem::about(app, None, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::show_all(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ])?;

            #[cfg(target_os = "macos")]
            menu_items.push(&app_menu);

            menu_items.push(&file_menu);
            menu_items.push(&edit_menu);
            menu_items.push(&view_menu);
            menu_items.push(&window_menu);

            let menu = Menu::with_items(app, &menu_items)?;
            app.set_menu(menu)?;

            // -- Handle Menu Events --
            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                match id {
                    "new_file" | "new_folder" | "open_file" | "open_folder" | "save" | "save_as" | "print" => {
                        let _ = app_handle.emit("menu-event", id);
                    }
                    _ => {}
                }
            });

            // -- Build Tray Menu --
            let tray_menu = Menu::with_items(app, &[
                &MenuItem::with_id(app, "show", "Show Zentauri", true, None::<String>)?,
                &MenuItem::with_id(app, "hide", "Hide Window", true, None::<String>)?,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(app, "quit_tray", "Quit", true, None::<String>)?,
            ])?;

            // -- Create Tray Icon --
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(true)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = if window.is_visible().unwrap_or(false) {
                                window.hide()
                            } else {
                                window.show()
                            };
                        }
                    }
                })
                .on_menu_event(|app_handle, event| {
                    let id = event.id().0.as_str();
                    match id {
                        "show" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit_tray" => {
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
