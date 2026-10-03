use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::Path;
use regex::Regex;

use crate::FileItemNode;

pub fn init_db(workspace_path: &str) -> Result<Connection> {
    let workspace = Path::new(workspace_path);
    let zentauri_dir = workspace.join(".zentauri");
    
    if !zentauri_dir.exists() {
        if let Err(e) = fs::create_dir_all(&zentauri_dir) {
            eprintln!("Failed to create .zentauri directory: {}", e);
        }
    }
    
    let db_path = zentauri_dir.join("index.db");
    let conn = Connection::open(db_path)?;

    // Check schema compatibility: if parent_path column is missing, recreate files tables
    let has_parent_col: bool = conn
        .prepare("PRAGMA table_info(files)")
        .and_then(|mut stmt| {
            let cols = stmt.query_map([], |row| row.get::<_, String>(1))?;
            let mut found = false;
            for col in cols.flatten() {
                if col == "parent_path" {
                    found = true;
                    break;
                }
            }
            Ok(found)
        })
        .unwrap_or(false);

    if !has_parent_col {
        let _ = conn.execute("DROP TABLE IF EXISTS markdown_links", []);
        let _ = conn.execute("DROP TABLE IF EXISTS markdown_metadata", []);
        let _ = conn.execute("DROP TABLE IF EXISTS files", []);
    }
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY,
            path TEXT NOT NULL UNIQUE,
            parent_path TEXT NOT NULL,
            name TEXT NOT NULL,
            is_directory BOOLEAN NOT NULL,
            modified_at INTEGER NOT NULL,
            size_bytes INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_path)",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS markdown_metadata (
            file_path TEXT PRIMARY KEY,
            title TEXT,
            tags TEXT,
            iast TEXT,
            devanagari TEXT,
            FOREIGN KEY(file_path) REFERENCES files(path) ON DELETE CASCADE
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS markdown_links (
            source_path TEXT NOT NULL,
            target_name TEXT NOT NULL,
            FOREIGN KEY(source_path) REFERENCES files(path) ON DELETE CASCADE
        )",
        [],
    )?;
    
    Ok(conn)
}

#[derive(serde::Deserialize, Default, Debug)]
struct Frontmatter {
    title: Option<String>,
    tags: Option<Vec<String>>,
    iast: Option<String>,
    devanagari: Option<String>,
}

fn extract_metadata(content: &str) -> Frontmatter {
    let mut fm = Frontmatter::default();
    
    if content.starts_with("---\n") || content.starts_with("---\r\n") {
        if let Some(end_idx) = content[4..].find("\n---") {
            let yaml_str = &content[4..4+end_idx];
            if let Ok(parsed) = serde_yaml::from_str::<Frontmatter>(yaml_str) {
                fm = parsed;
            }
        }
    }
    
    if fm.title.is_none() {
        for line in content.lines() {
            if line.starts_with("# ") {
                fm.title = Some(line[2..].trim().to_string());
                break;
            }
        }
    }
    
    fm
}

fn extract_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    
    // Match [[Link]] or [[Link|Alias]]
    let wiki_re = Regex::new(r"\[\[([^\]\|]+)(?:\|[^\]]+)?\]\]").unwrap();
    for cap in wiki_re.captures_iter(content) {
        if let Some(m) = cap.get(1) {
            links.push(m.as_str().trim().to_string());
        }
    }
    
    // Match [Text](link.md)
    let md_re = Regex::new(r"\[[^\]]+\]\(([^)]+)\)").unwrap();
    for cap in md_re.captures_iter(content) {
        if let Some(m) = cap.get(1) {
            let link = m.as_str().trim().to_string();
            if !link.starts_with("http") && !link.starts_with("www") {
                links.push(link);
            }
        }
    }
    
    links
}

fn index_dir_recursive(
    tx: &rusqlite::Transaction,
    current_dir: &Path,
    parent_path_str: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let entries = match fs::read_dir(current_dir) {
        Ok(e) => e,
        Err(_) => return Ok(()),
    };

    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/directories (e.g. .git, .zentauri, .DS_Store)
        // Also skip build/package directories
        if file_name.starts_with('.')
            || file_name == "node_modules"
            || file_name == "target"
            || file_name == "dist"
        {
            continue;
        }

        let entry_path = entry.path();
        let file_path = entry_path.to_string_lossy().to_string();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let is_dir = metadata.is_dir();

        if !is_dir && !file_name.to_lowercase().ends_with(".md") && !file_name.to_lowercase().ends_with(".markdown") {
            continue;
        }

        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        let size_bytes = metadata.len() as i64;

        tx.execute(
            "INSERT INTO files (path, parent_path, name, is_directory, modified_at, size_bytes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&file_path, parent_path_str, file_name, is_dir, modified_at, size_bytes],
        )?;

        if is_dir {
            index_dir_recursive(tx, &entry_path, &file_path)?;
        } else {
            let content = fs::read_to_string(&entry_path).unwrap_or_default();
            let fm = extract_metadata(&content);
            let tags_json = fm.tags.map(|t| serde_json::to_string(&t).unwrap_or_default());
            tx.execute(
                "INSERT INTO markdown_metadata (file_path, title, tags, iast, devanagari) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![&file_path, fm.title, tags_json, fm.iast, fm.devanagari],
            )?;

            let links = extract_links(&content);
            for link in links {
                tx.execute(
                    "INSERT INTO markdown_links (source_path, target_name) VALUES (?1, ?2)",
                    params![&file_path, link],
                )?;
            }
        }
    }

    Ok(())
}

pub fn index_workspace(conn: &mut Connection, workspace_path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let workspace = Path::new(workspace_path);
    if !workspace.is_dir() {
        return Ok(());
    }

    let tx = conn.transaction()?;

    tx.execute("DELETE FROM files", [])?;
    tx.execute("DELETE FROM markdown_metadata", [])?;
    tx.execute("DELETE FROM markdown_links", [])?;

    index_dir_recursive(&tx, workspace, workspace_path)?;

    tx.commit()?;
    Ok(())
}

pub fn read_workspace_tree_db(conn: &Connection, parent_path: &str, sort_mode: &str) -> Result<Vec<FileItemNode>> {
    let order_clause = match sort_mode {
        "name-desc" => "ORDER BY is_directory DESC, LOWER(name) DESC",
        "date-desc" => "ORDER BY is_directory DESC, modified_at DESC",
        "date-asc" => "ORDER BY is_directory DESC, modified_at ASC",
        _ => "ORDER BY is_directory DESC, LOWER(name) ASC",
    };
    
    let query = format!("
        SELECT f.name, f.path, f.is_directory, f.modified_at, f.size_bytes, 
               m.title, m.tags, m.iast, m.devanagari
        FROM files f
        LEFT JOIN markdown_metadata m ON f.path = m.file_path
        WHERE f.parent_path = ?1
        {}
    ", order_clause);
    
    let mut stmt = conn.prepare(&query)?;
    let node_iter = stmt.query_map(params![parent_path], |row| {
        let tags_str: Option<String> = row.get(6)?;
        let tags = tags_str.and_then(|s| serde_json::from_str(&s).ok());
        
        Ok(FileItemNode {
            name: row.get(0)?,
            path: row.get(1)?,
            is_directory: row.get(2)?,
            modified_at: row.get::<_, i64>(3)? as u64,
            size_bytes: row.get::<_, i64>(4)? as u64,
            title: row.get(5)?,
            tags,
            iast: row.get(7)?,
            devanagari: row.get(8)?,
        })
    })?;
    
    let mut nodes = Vec::new();
    for node in node_iter {
        nodes.push(node?);
    }
    
    Ok(nodes)
}

pub fn search_files_db(conn: &Connection, query: &str) -> Result<Vec<FileItemNode>> {
    let like_query = format!("%{}%", query);
    
    let mut stmt = conn.prepare(
        "SELECT f.name, f.path, f.is_directory, f.modified_at, f.size_bytes, 
                m.title, m.tags, m.iast, m.devanagari
         FROM files f
         LEFT JOIN markdown_metadata m ON f.path = m.file_path
         WHERE f.name LIKE ?1 OR m.title LIKE ?1 OR m.tags LIKE ?1
         ORDER BY f.is_directory DESC, LOWER(f.name) ASC"
    )?;
    
    let node_iter = stmt.query_map(params![like_query], |row| {
        let tags_str: Option<String> = row.get(6)?;
        let tags = tags_str.and_then(|s| serde_json::from_str(&s).ok());

        Ok(FileItemNode {
            name: row.get(0)?,
            path: row.get(1)?,
            is_directory: row.get(2)?,
            modified_at: row.get::<_, i64>(3)? as u64,
            size_bytes: row.get::<_, i64>(4)? as u64,
            title: row.get(5)?,
            tags,
            iast: row.get(7)?,
            devanagari: row.get(8)?,
        })
    })?;
    
    let mut nodes = Vec::new();
    for node in node_iter {
        nodes.push(node?);
    }
    
    Ok(nodes)
}

#[derive(serde::Serialize, Debug)]
pub struct GraphNode {
    pub id: String,
    pub name: String,
}

#[derive(serde::Serialize, Debug)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
}

#[derive(serde::Serialize, Debug)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

pub fn get_graph_data_db(conn: &Connection) -> Result<GraphData> {
    let mut stmt_nodes = conn.prepare("
        SELECT f.path, IFNULL(m.title, f.name) as name
        FROM files f
        LEFT JOIN markdown_metadata m ON f.path = m.file_path
        WHERE f.is_directory = 0
    ")?;
    
    let node_iter = stmt_nodes.query_map([], |row| {
        Ok(GraphNode {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    })?;
    
    let mut nodes = Vec::new();
    for node in node_iter {
        nodes.push(node?);
    }
    
    let mut stmt_edges = conn.prepare("SELECT source_path, target_name FROM markdown_links")?;
    let edge_iter = stmt_edges.query_map([], |row| {
        Ok(GraphEdge {
            source: row.get(0)?,
            target: row.get(1)?,
        })
    })?;
    
    let mut edges = Vec::new();
    for edge in edge_iter {
        edges.push(edge?);
    }
    
    Ok(GraphData { nodes, edges })
}
