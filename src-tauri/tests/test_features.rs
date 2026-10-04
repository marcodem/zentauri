use tauri_app_lib::db;
use std::fs;
use typst_as_lib::TypstEngine;

#[test]
fn test_sqlite_indexing_and_graph() {
    let temp_dir = std::env::temp_dir().join("zentauri_test_workspace");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    // Create 3 interconnected scholarly markdown files
    let doc1 = r#"---
title: "Pāṇini Grammatik Einführung"
iast: "Aṣṭādhyāyī"
devanagari: "अष्टाध्यायी"
tags: ["sanskrit", "grammar"]
---

# Pāṇini Einführung
Siehe auch [[Sanskrit Vokale]] und das Dokument [Konsonantensystem](./konsonanten.md).
"#;

    let doc2 = r#"---
title: "Sanskrit Vokale"
iast: "Svara"
devanagari: "स्वर"
tags: ["phonetics"]
---

# Die Vokale im Sanskrit
Verbindung zurück zu [[Pāṇini Einführung]].
"#;

    let doc3 = r#"---
title: "Konsonantensystem"
iast: "Vyañjana"
devanagari: "व्यञ्जन"
tags: ["phonetics"]
---

# Das Konsonantensystem
Hier werden die 33 Konsonanten beschrieben.
"#;

    fs::write(temp_dir.join("panini.md"), doc1).unwrap();
    fs::write(temp_dir.join("vokale.md"), doc2).unwrap();
    fs::write(temp_dir.join("konsonanten.md"), doc3).unwrap();

    let sub_dir = temp_dir.join("subfolder");
    fs::create_dir_all(&sub_dir).unwrap();
    fs::write(sub_dir.join("nested.md"), "# Nested Chapter\nNested notes.").unwrap();

    // 1. Initialize DB and Index
    let mut conn = db::init_db(temp_dir.to_str().unwrap()).expect("Init DB failed");
    db::index_workspace(&mut conn, temp_dir.to_str().unwrap()).expect("Index workspace failed");

    // 2. Test reading root workspace tree
    let root_tree = db::read_workspace_tree_db(&conn, temp_dir.to_str().unwrap(), "name-asc").expect("Read root tree failed");
    // Should have 3 md files + 1 subfolder = 4 entries
    assert_eq!(root_tree.len(), 4, "Expected 4 entries in root tree (3 files + 1 subfolder)");

    let panini_node = root_tree.iter().find(|n| n.name == "panini.md").expect("panini.md not found");
    assert_eq!(panini_node.title.as_deref(), Some("Pāṇini Grammatik Einführung"));
    assert_eq!(panini_node.iast.as_deref(), Some("Aṣṭādhyāyī"));
    assert_eq!(panini_node.devanagari.as_deref(), Some("अष्टाध्यायी"));

    // 3. Test reading subfolder tree
    let sub_tree = db::read_workspace_tree_db(&conn, sub_dir.to_str().unwrap(), "name-asc").expect("Read subfolder tree failed");
    assert_eq!(sub_tree.len(), 1, "Expected 1 entry in subfolder");
    assert_eq!(sub_tree[0].name, "nested.md");
    assert_eq!(sub_tree[0].title.as_deref(), Some("Nested Chapter"));

    // 4. Test Knowledge Graph Data (contains all markdown files)
    let graph = db::get_graph_data_db(&conn).expect("Get graph data failed");
    assert_eq!(graph.nodes.len(), 4, "Expected 4 nodes in graph (including nested)");
    assert_eq!(graph.edges.len(), 3, "Expected 3 link connections in graph");

    // 5. Test Scoped Search with LIKE escaping
    let search_all = db::search_files_db(&conn, "Panini", temp_dir.to_str().unwrap()).expect("Search failed");
    assert_eq!(search_all.len(), 1, "Expected 1 search match for Panini in root scope");
    assert_eq!(search_all[0].name, "panini.md");

    let search_scoped = db::search_files_db(&conn, "Panini", sub_dir.to_str().unwrap()).expect("Search failed");
    assert_eq!(search_scoped.len(), 0, "Panini should not match in sub_dir scope");

    let search_nested = db::search_files_db(&conn, "Nested", sub_dir.to_str().unwrap()).expect("Search failed");
    assert_eq!(search_nested.len(), 1, "Nested should match in sub_dir scope");

    // 6. Test Single Directory Incremental Sync
    let added_file = sub_dir.join("added.md");
    fs::write(&added_file, "# Newly added\nSome content").unwrap();
    db::sync_directory(&mut conn, sub_dir.to_str().unwrap()).expect("Sync directory failed");
    let sub_tree_after_add = db::read_workspace_tree_db(&conn, sub_dir.to_str().unwrap(), "name-asc").unwrap();
    assert_eq!(sub_tree_after_add.len(), 2, "Expected 2 entries after sync_directory");

    fs::remove_file(&added_file).unwrap();
    db::sync_directory(&mut conn, sub_dir.to_str().unwrap()).expect("Sync directory failed");
    let sub_tree_after_remove = db::read_workspace_tree_db(&conn, sub_dir.to_str().unwrap(), "name-asc").unwrap();
    assert_eq!(sub_tree_after_remove.len(), 1, "Expected 1 entry after removing and sync_directory");

    println!("✓ SQLite Recursive Indexing & Metadata: PASS (Root: 4 items, Subfolder: 1 item, Badges ready)");
    println!("✓ Knowledge Graph Data: PASS (Nodes: {}, Edges: {})", graph.nodes.len(), graph.edges.len());
    println!("✓ Scoped Search & sync_directory: PASS");

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_typst_native_pdf_export() {
    let output_pdf = std::env::temp_dir().join("zentauri_scholarly_demo.pdf");
    let _ = fs::remove_file(&output_pdf);

    let typst_markup = r##"
#set page(paper: "a4", margin: (x: 2cm, y: 2.5cm))
#set text(font: ("Liberation Serif", "Linux Libertine", "Noto Sans Devanagari"), size: 11pt)
#set par(justify: true)

= Zentauri Native Typst PDF Demonstration

== 1. Scholarly Grammar Box
#rect(width: 100%, inset: 10pt, stroke: 1pt + rgb("#d8d2c6"), fill: rgb("#f1eee7"), radius: 4pt)[
  *Schema: Prädikatsnomen - Subjekt* \
  z.B. devo viṣṇuḥ = #text(font: "Noto Sans Devanagari")[देवो विष्णुः] = "Viṣṇu ist ein Gott."
]

== 2. Mathematical Equations
$ e^(i pi) + 1 = 0 $

$ sum_(k=1)^n k = (n(n+1)) / 2 $

== 3. Tabular Overview
#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + rgb("#d8d2c6"),
  inset: 6pt,
  [*Lautklasse*], [*IAST*], [*Devanāgarī*],
  [Gutturale], [k, kh, g, gh, ṅ], [#text(font: "Noto Sans Devanagari")[क, ख, ग, घ, ङ]],
  [Palatale], [c, ch, j, jh, ñ], [#text(font: "Noto Sans Devanagari")[च, छ, ज, झ, ञ]],
)
"##;

    // Compile via Typst Engine with system and embedded fonts
    let engine = TypstEngine::builder()
        .search_fonts_with(typst_as_lib::typst_kit_options::TypstKitFontOptions::default())
        .main_file(typst_markup.to_string())
        .build();

    let doc = engine.compile().output.expect("Typst compilation failed");
    let options = typst_pdf::PdfOptions::default();
    let pdf_bytes = typst_pdf::pdf(&doc, &options).expect("PDF generation failed");

    fs::write(&output_pdf, &pdf_bytes).expect("Failed to write PDF file");

    assert!(output_pdf.exists(), "PDF file must exist");
    assert!(pdf_bytes.len() > 1000, "PDF must have content");
    println!("✓ Typst Native PDF Rendering: PASS ({:?}, Size: {} bytes)", output_pdf, pdf_bytes.len());
}

#[test]
fn test_export_pdf_validation_rules() {
    use tauri_app_lib::validate_export_destination;

    // 1. Rejects null bytes
    assert!(validate_export_destination("/valid/path\0evil.pdf").is_err());

    // 2. Rejects non-pdf extensions
    assert!(validate_export_destination("/valid/path/file.txt").is_err());
    assert!(validate_export_destination("/valid/path/file.exe").is_err());
    assert!(validate_export_destination("/valid/path/file.sh").is_err());

    // 3. Rejects system root paths
    assert!(validate_export_destination("/evil.pdf").is_err());
    assert!(validate_export_destination("/etc/evil.pdf").is_err());
    assert!(validate_export_destination("/system/evil.pdf").is_err());
    assert!(validate_export_destination("/usr/evil.pdf").is_err());

    // 4. Rejects sensitive configuration components
    assert!(validate_export_destination("/home/user/.ssh/id_rsa.pdf").is_err());
    assert!(validate_export_destination("/Users/user/.gnupg/keys.pdf").is_err());
    assert!(validate_export_destination("/Users/user/.bashrc.pdf").is_err());

    // 5. Accepts valid path in temp directory
    let temp_target = std::env::temp_dir().join("valid_export_test.pdf");
    let result = validate_export_destination(temp_target.to_str().unwrap());
    assert!(result.is_ok(), "Temp path must be allowed: {:?}", result);
}
