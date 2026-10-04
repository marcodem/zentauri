pub mod db;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct HeadingItem {
    pub level: u32,
    pub text: String,
    pub line: usize,
}


#[tauri::command]
fn parse_outline(content: &str) -> Vec<HeadingItem> {
    use pulldown_cmark::{Event, HeadingLevel, Parser, Tag, TagEnd};

    let mut headings = Vec::new();
    let mut current_heading_level: Option<u32> = None;
    let mut current_heading_text = String::new();
    let mut current_heading_offset = 0;

    let parser = Parser::new(content).into_offset_iter();

    for (event, range) in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                let lvl = match level {
                    HeadingLevel::H1 => 1,
                    HeadingLevel::H2 => 2,
                    HeadingLevel::H3 => 3,
                    HeadingLevel::H4 => 4,
                    HeadingLevel::H5 => 5,
                    HeadingLevel::H6 => 6,
                };
                current_heading_level = Some(lvl);
                current_heading_text.clear();
                current_heading_offset = range.start;
            }
            Event::Text(text) | Event::Code(text) if current_heading_level.is_some() => {
                current_heading_text.push_str(&text);
            }
            Event::End(TagEnd::Heading(_)) => {
                if let Some(lvl) = current_heading_level.take() {
                    let line_number = content[..current_heading_offset.min(content.len())]
                        .bytes()
                        .filter(|&b| b == b'\n')
                        .count()
                        + 1;

                    headings.push(HeadingItem {
                        level: lvl,
                        text: current_heading_text.trim().to_string(),
                        line: line_number,
                    });
                }
            }
            _ => {}
        }
    }

    headings
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct FileItemNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub modified_at: u64,
    pub size_bytes: u64,
    pub title: Option<String>,
    pub tags: Option<Vec<String>>,
    pub iast: Option<String>,
    pub devanagari: Option<String>,
}

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

static KNOWN_WORKSPACES: LazyLock<Mutex<HashSet<PathBuf>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

fn register_workspace_root(path: &Path) {
    if let Ok(mut set) = KNOWN_WORKSPACES.lock() {
        set.insert(path.to_path_buf());
    }
}

fn is_system_or_user_root(path: &Path) -> bool {
    let norm = path.to_string_lossy().replace('\\', "/");
    let norm_lower = norm.trim_end_matches('/').to_lowercase();

    if norm_lower.is_empty() || norm_lower == "/" || (norm_lower.len() == 2 && norm_lower.ends_with(':')) {
        return true;
    }

    let top_system = [
        "/applications", "/system", "/library", "/volumes", "/private", "/usr", "/bin", "/etc", "/var",
    ];
    if top_system.contains(&norm_lower.as_str()) {
        return true;
    }

    let parts: Vec<&str> = norm_lower.split('/').filter(|s| !s.is_empty()).collect();
    if parts.first() == Some(&"volumes") && parts.len() <= 2 {
        return true;
    }
    if (parts.first() == Some(&"users") || parts.first() == Some(&"home")) && parts.len() <= 2 {
        return true;
    }
    if (parts.first() == Some(&"users") || parts.first() == Some(&"home")) && parts.len() == 3 {
        let leaf = parts[2];
        if leaf == "desktop" || leaf == "schreibtisch" || leaf == "downloads" {
            return true;
        }
    }

    false
}

fn find_workspace_root(start_path: &str) -> PathBuf {
    let p = Path::new(start_path);
    if is_system_or_user_root(p) {
        return p.to_path_buf();
    }
    
    // First, check if start_path is under any already-registered workspace root
    if let Ok(set) = KNOWN_WORKSPACES.lock() {
        for root in set.iter() {
            if p.starts_with(root) {
                return root.clone();
            }
        }
    }

    // Next, check ancestors for .zentauri or .git
    let mut current = p.to_path_buf();
    loop {
        if is_system_or_user_root(&current) {
            break;
        }
        if current.join(".zentauri").exists() || current.join(".git").exists() {
            register_workspace_root(&current);
            return current;
        }
        if let Some(parent) = current.parent() {
            if parent == current {
                break;
            }
            current = parent.to_path_buf();
        } else {
            break;
        }
    }

    // Default to start_path and register it as workspace root
    register_workspace_root(p);
    p.to_path_buf()
}

#[tauri::command]
async fn read_workspace_tree(app: tauri::AppHandle, path: String, sort_mode: String) -> Result<Vec<FileItemNode>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = find_workspace_root(&path);
        if is_system_or_user_root(&root) {
            return Err("Cannot access or index system or volume root as a workspace".to_string());
        }
        let _ = app.fs_scope().allow_directory(&root, true);
        let root_str = root.to_string_lossy().to_string();
        let mut conn = db::init_db(&root_str).map_err(|e| e.to_string())?;
        
        // If root or database is empty, index workspace incrementally
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
            .unwrap_or(0);

        if count == 0 || root_str == path {
            db::index_workspace(&mut conn, &root_str).map_err(|e| e.to_string())?;
        } else {
            let _ = db::sync_directory(&mut conn, &path);
        }
        
        let mut nodes = db::read_workspace_tree_db(&conn, &path, &sort_mode).map_err(|e| e.to_string())?;

        // Fallback: If empty and querying a subfolder, index root and re-query
        if nodes.is_empty() && root_str != path {
            db::index_workspace(&mut conn, &root_str).map_err(|e| e.to_string())?;
            nodes = db::read_workspace_tree_db(&conn, &path, &sort_mode).map_err(|e| e.to_string())?;
        }
        
        Ok(nodes)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn search_workspace(path: String, query: String) -> Result<Vec<FileItemNode>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = find_workspace_root(&path);
        if is_system_or_user_root(&root) {
            return Err("Cannot access or search system or volume root as a workspace".to_string());
        }
        let conn = db::init_db(&root.to_string_lossy()).map_err(|e| e.to_string())?;
        db::search_files_db(&conn, &query, &path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_knowledge_graph(path: String) -> Result<db::GraphData, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = find_workspace_root(&path);
        if is_system_or_user_root(&root) {
            return Err("Cannot access or index system or volume root as a workspace".to_string());
        }
        let root_str = root.to_string_lossy().to_string();
        let mut conn = db::init_db(&root_str).map_err(|e| e.to_string())?;
        db::index_workspace(&mut conn, &root_str).map_err(|e| e.to_string())?;
        db::get_graph_data_db(&conn).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn move_file_item(source_path: &str, target_dir_path: &str) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let source = Path::new(source_path);
    if !source.exists() {
        return Err("Source file does not exist".to_string());
    }
    let target_dir = Path::new(target_dir_path);
    if !target_dir.is_dir() {
        return Err("Target directory does not exist".to_string());
    }
    if is_system_or_user_root(source) || is_system_or_user_root(target_dir) {
        return Err("Cannot move items in or out of system or volume root directories".to_string());
    }

    let file_name = source
        .file_name()
        .ok_or_else(|| "Invalid source path".to_string())?;

    let destination = target_dir.join(file_name);

    if source == destination {
        return Ok(destination.to_string_lossy().to_string());
    }

    if destination.exists() {
        return Err(format!(
            "A file or folder named '{}' already exists in the target destination",
            file_name.to_string_lossy()
        ));
    }

    if let Err(e) = fs::rename(&source, &destination) {
        // Cross-device fallback (EXDEV)
        if source.is_file() {
            fs::copy(&source, &destination)
                .map_err(|copy_err| format!("Failed to move file across devices: {}", copy_err))?;
            let _ = fs::remove_file(&source);
        } else {
            return Err(format!("Failed to move folder: {}", e));
        }
    }

    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn duplicate_file_item(source_path: &str) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let source = Path::new(source_path);
    if !source.exists() || !source.is_file() {
        return Err("Source file does not exist".to_string());
    }

    let parent = source.parent().ok_or_else(|| "Invalid parent dir".to_string())?;
    let stem = source.file_stem().unwrap_or_default().to_string_lossy();
    let ext = source.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default();

    let mut counter = 1;
    let destination = loop {
        let suffix = if counter == 1 {
            "_copy".to_string()
        } else {
            format!("_copy_{}", counter)
        };
        let new_name = if ext.is_empty() {
            format!("{}{}", stem, suffix)
        } else {
            format!("{}{}.{}", stem, suffix, ext)
        };
        let dest = parent.join(new_name);
        if !dest.exists() {
            break dest;
        }
        counter += 1;
    };

    fs::copy(&source, &destination).map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_file_item(path: &str) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let target = Path::new(path);
    if !target.exists() {
        return Ok(());
    }
    if is_system_or_user_root(target) {
        return Err("Cannot delete system or root directories".to_string());
    }

    let root = find_workspace_root(path);
    let root_str = root.to_string_lossy().to_string();

    // 1. Delete on filesystem
    if target.is_dir() {
        fs::remove_dir_all(target).map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_file(target).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    // 2. Clean up SQLite database (item itself + any descendants if it was a folder)
    if let Ok(mut conn) = db::init_db(&root_str) {
        if let Ok(tx) = conn.transaction() {
            let _ = tx.execute(
                "DELETE FROM files WHERE path = ?1 OR path LIKE (?1 || '/%')",
                rusqlite::params![path],
            );
            let _ = tx.execute(
                "DELETE FROM markdown_metadata WHERE file_path = ?1 OR file_path LIKE (?1 || '/%')",
                rusqlite::params![path],
            );
            let _ = tx.execute(
                "DELETE FROM markdown_links WHERE source_path = ?1 OR source_path LIKE (?1 || '/%')",
                rusqlite::params![path],
            );
            let _ = tx.commit();
        }
    }

    Ok(())
}

#[tauri::command]
fn reveal_in_explorer(path: &str) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "macos")]
    {
        let path = path.to_string();
        std::thread::spawn(move || {
            let _ = Command::new("open").arg("-R").arg(&path).status();
        });
    }

    #[cfg(target_os = "windows")]
    {
        let arg = format!("/select,{}", path);
        std::thread::spawn(move || {
            let _ = Command::new("explorer").arg(&arg).status();
        });
    }

    #[cfg(target_os = "linux")]
    {
        let parent = std::path::Path::new(path).parent().unwrap_or(std::path::Path::new(path)).to_path_buf();
        std::thread::spawn(move || {
            let _ = Command::new("xdg-open").arg("--").arg(&parent).status();
        });
    }

    Ok(())
}

use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::tray::TrayIconBuilder;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_fs::FsExt;

#[derive(Default)]
pub struct PendingOpenFiles(pub Arc<Mutex<Vec<String>>>);

#[derive(Default)]
pub struct WorkspaceWatcher(pub Arc<Mutex<Option<RecommendedWatcher>>>);

#[tauri::command]
fn watch_workspaces(
    app: tauri::AppHandle,
    state: State<'_, WorkspaceWatcher>,
    paths: Vec<String>,
) -> Result<(), String> {
    let mut watcher_guard = state.0.lock().map_err(|e| e.to_string())?;

    // Drop previous watcher if any
    *watcher_guard = None;

    if paths.is_empty() {
        return Ok(());
    }

    let app_handle = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let filtered_paths: Vec<String> = event
                    .paths
                    .into_iter()
                    .filter_map(|p| {
                        let s = p.to_string_lossy().to_string();
                        if s.contains("/.git/")
                            || s.ends_with("/.git")
                            || s.contains("/.DS_Store")
                            || s.contains("/node_modules/")
                            || s.contains("/.zentauri/")
                            || s.contains("/target/")
                        {
                            None
                        } else {
                            Some(s)
                        }
                    })
                    .collect();

                if !filtered_paths.is_empty() {
                    let _ = app_handle.emit(
                        "workspace-fs-changed",
                        serde_json::json!({
                            "kind": format!("{:?}", event.kind),
                            "paths": filtered_paths
                        }),
                    );
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    for p_str in paths {
        let path = std::path::Path::new(&p_str);
        if path.exists() && path.is_dir() {
            let _ = watcher.watch(path, RecursiveMode::Recursive);
        }
    }

    *watcher_guard = Some(watcher);
    Ok(())
}

#[tauri::command]
fn get_pending_open_files(state: State<'_, PendingOpenFiles>) -> Vec<String> {
    let mut files = state.0.lock().unwrap();
    let result = files.clone();
    files.clear();
    result
}

fn get_valid_cwd() -> Option<PathBuf> {
    let mut cwd = std::env::current_dir().ok()?;
    if cwd.file_name().map(|n| n == "src-tauri").unwrap_or(false) {
        if let Some(parent) = cwd.parent() {
            cwd = parent.to_path_buf();
        }
    }
    if is_system_or_user_root(&cwd) {
        return None;
    }
    Some(cwd)
}

#[tauri::command]
fn get_app_cwd() -> Option<String> {
    get_valid_cwd().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn is_directory_path(path: &str) -> bool {
    std::path::Path::new(path).is_dir()
}

#[derive(serde::Serialize)]
pub struct CustomStylesheetResult {
    pub content: String,
    pub path: String,
}

#[tauri::command]
fn load_custom_stylesheet(app: tauri::AppHandle) -> Result<CustomStylesheetResult, String> {
    use std::fs;
    
    let app_config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !app_config_dir.exists() {
        fs::create_dir_all(&app_config_dir).map_err(|e| e.to_string())?;
    }
    
    let custom_css_path = app_config_dir.join("custom.css");
    
    if !custom_css_path.exists() {
        let template = "/* Zentauri Custom Stylesheet Template */\n/* Hier kannst du Fonts, Farben und Layout-Details anpassen. */\n\n/* Beispiel: Schriftart für den gesamten Editor ändern */\n/*\nbody, input, button, select, textarea {\n  font-family: 'Arial', sans-serif !important;\n}\n*/\n\n/* Beispiel: Eigene Syntax-Elemente wie die Grammar-Box umfärben */\n/*\n.vp-doc .custom-block.grammar-box,\n.grammar-box {\n  background-color: #f0f8ff !important; /* Hellblau */\n  border-left-color: #0369a1 !important; /* Dunkelblauer Rand */\n}\n*/\n\n/* Beispiel: Farben überschreiben */\n/*\n:root {\n  --app-bg: #fafafa !important;\n}\n*/\n";
        fs::write(&custom_css_path, template).map_err(|e| e.to_string())?;
    }
    
    let content = fs::read_to_string(&custom_css_path).map_err(|e| e.to_string())?;
    Ok(CustomStylesheetResult {
        content,
        path: custom_css_path.to_string_lossy().to_string(),
    })
}

pub fn is_protected_system_destination(path: &std::path::Path) -> bool {
    let norm = path.to_string_lossy().replace('\\', "/");
    let norm_lower = norm.trim_end_matches('/').to_lowercase();

    if norm_lower.is_empty() || norm_lower == "/" || (norm_lower.len() == 2 && norm_lower.ends_with(':')) {
        return true;
    }

    let parts: Vec<&str> = norm_lower.split('/').filter(|s| !s.is_empty()).collect();
    if parts.is_empty() {
        return true;
    }

    // Direct root file, e.g. /evil.pdf
    if parts.len() == 1 {
        return true;
    }

    let first = parts[0];

    // Protected top-level system paths where users should not write PDFs
    let system_roots = [
        "system", "bin", "sbin", "usr", "etc", "dev", "proc", "sys", "opt", "library", "applications",
    ];
    if system_roots.contains(&first) {
        return true;
    }

    // For /private: /private/etc, /private/var/root, etc. are protected, but /private/var/folders or /private/tmp are temp areas
    if first == "private" {
        if parts.len() >= 2 {
            let second = parts[1];
            if second == "etc" || (second == "var" && parts.len() >= 3 && parts[2] == "root") {
                return true;
            }
            if second != "tmp" && second != "var" {
                return true;
            }
        } else {
            return true;
        }
    }

    // For /var: /var/folders and /var/tmp are temp areas; all other /var subdirs (like /var/root, /var/log, /var/db, /var/run) are protected
    if first == "var" {
        if parts.len() >= 2 {
            let second = parts[1];
            if second != "folders" && second != "tmp" {
                return true;
            }
        } else {
            return true;
        }
    }

    // User roots: cannot write directly to /Users or /home or /Users/username (without subfolder)
    if first == "users" || first == "home" {
        if parts.len() <= 2 {
            return true;
        }
    }

    // Volume roots: cannot write directly to /Volumes
    if first == "volumes" && parts.len() <= 1 {
        return true;
    }

    false
}

pub fn validate_export_destination(destination_path: &str) -> Result<std::path::PathBuf, String> {
    if destination_path.contains('\0') {
        return Err("Invalid destination path: contains null byte".to_string());
    }
    if !destination_path.to_lowercase().ends_with(".pdf") {
        return Err("Destination path must have a .pdf extension".to_string());
    }
    let dest_path = std::path::Path::new(destination_path);
    if is_protected_system_destination(dest_path) {
        return Err("Cannot write PDF to protected system or root directory".to_string());
    }

    // Guard against sensitive configuration directories
    for component in dest_path.components() {
        let s = component.as_os_str().to_string_lossy();
        if s == ".ssh" || s == ".gnupg" || s == ".bashrc" || s == ".zshrc" || s == ".profile" {
            return Err("Access to sensitive directory or file denied".to_string());
        }
    }

    if let Some(parent) = dest_path.parent() {
        if !parent.as_os_str().is_empty() {
            if !parent.exists() {
                return Err("Destination directory does not exist".to_string());
            }
            if let Ok(canon_parent) = parent.canonicalize() {
                if is_protected_system_destination(&canon_parent) {
                    return Err("Cannot write to protected system directory".to_string());
                }
            } else if is_protected_system_destination(parent) {
                return Err("Cannot write to protected system directory".to_string());
            }
        }
    }

    if dest_path.exists() {
        if let Ok(canon) = dest_path.canonicalize() {
            if is_protected_system_destination(&canon) {
                return Err("Cannot overwrite protected system path".to_string());
            }
        }
    }

    Ok(dest_path.to_path_buf())
}

#[tauri::command]
async fn export_pdf(typst_markup: String, destination_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::fs;
        use typst_as_lib::TypstEngine;

        let dest_path = validate_export_destination(&destination_path)?;

        // Build the engine with system and embedded fonts and the provided markup
        let engine = TypstEngine::builder()
            .search_fonts_with(typst_as_lib::typst_kit_options::TypstKitFontOptions::default())
            .main_file(typst_markup)
            .build();

        // Compile it
        let doc = engine
            .compile()
            .output
            .map_err(|e| format!("Typst compilation failed: {:?}", e))?;

        let options = typst_pdf::PdfOptions::default();
        let pdf = typst_pdf::pdf(&doc, &options)
            .map_err(|e| format!("PDF generation failed: {:?}", e))?;
            
        fs::write(&dest_path, pdf).map_err(|e| format!("Failed to write PDF: {}", e))?;
        
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn resolve_file_arg(arg: &str, cwd: Option<&std::path::Path>) -> Option<std::path::PathBuf> {
    if arg.starts_with('-')
        || arg.starts_with("http://")
        || arg.starts_with("https://")
        || arg.starts_with("tauri://")
    {
        return None;
    }

    let path = std::path::Path::new(arg);
    let abs_path = if path.is_absolute() {
        path.to_path_buf()
    } else if let Some(base) = cwd {
        base.join(path)
    } else if let Ok(current) = std::env::current_dir() {
        current.join(path)
    } else {
        path.to_path_buf()
    };

    Some(abs_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(PendingOpenFiles::default())
        .manage(WorkspaceWatcher::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let cwd_path = std::path::Path::new(&cwd);
            for arg in argv.iter().skip(1) {
                if let Some(abs_path) = resolve_file_arg(arg, Some(cwd_path)) {
                    let path_str = abs_path.to_string_lossy().to_string();
                    let _ = app.fs_scope().allow_file(&abs_path);
                    let _ = app.emit("open-file-path", &path_str);
                    if let Some(state) = app.try_state::<PendingOpenFiles>() {
                        state.0.lock().unwrap().push(path_str);
                    }
                }
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            greet,
            parse_outline,
            read_workspace_tree,
            move_file_item,
            duplicate_file_item,
            delete_file_item,
            reveal_in_explorer,
            get_pending_open_files,
            load_custom_stylesheet,
            export_pdf,
            search_workspace,
            get_knowledge_graph,
            get_app_cwd,
            is_directory_path,
            watch_workspaces
        ])
        .setup(|app| {
            // Process initial CLI args on launch
            let pending_state = app.state::<PendingOpenFiles>();
            if let Ok(cwd) = std::env::current_dir() {
                for arg in std::env::args().skip(1) {
                    if let Some(abs_path) = resolve_file_arg(&arg, Some(&cwd)) {
                        let path_str = abs_path.to_string_lossy().to_string();
                        let _ = app.fs_scope().allow_file(&abs_path);
                        pending_state.0.lock().unwrap().push(path_str);
                    }
                }
            }

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
                    &MenuItem::with_id(app, "close_folder", "Close Folder", true, Some("CmdOrCtrl+Shift+W"))?,
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
            let about_metadata = tauri::menu::AboutMetadata {
                name: Some("ZenTauri".to_string()),
                version: Some(app.package_info().version.to_string()),
                short_version: Some(format!("Build {}", env!("ZENTAURI_BUILD_COUNT"))),
                ..Default::default()
            };

            #[cfg(target_os = "macos")]
            let app_menu = Submenu::with_items(app, "Zentauri", true, &[
                &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
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
                    "new_file" | "new_folder" | "open_file" | "open_folder" | "close_folder" | "save" | "save_as" | "print" => {
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                #[cfg(target_os = "macos")]
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Opened { urls } => {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    let path_str = path.to_string_lossy().to_string();
                    let _ = app_handle.fs_scope().allow_file(&path);
                    let _ = app_handle.emit("open-file-path", &path_str);
                    if let Some(state) = app_handle.try_state::<PendingOpenFiles>() {
                        state.0.lock().unwrap().push(path_str);
                    }
                }
            }
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    });
}
