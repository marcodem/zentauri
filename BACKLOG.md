# Zentauri Feature Backlog

Dieses Dokument erfasst geplante, zurückgestellte oder zukünftige Ausbau-Features für den ZenTauri-Editor.

---

## 1. Knowledge Graph & Zettelkasten-Verknüpfung

- **Status:** Backlog (temporär deaktiviert zur Verschlankung des Kern-Editors)
- **Komponenten:** `src/components/GraphView.vue`, `src-tauri/src/db.rs` (SQLite Workspace Indexer)

### Hintergrund & Motivation
ZenTauri besitzt im Rust-Backend (`src-tauri/src/db.rs`) bereits eine performante SQLite-Indizierung von Wikilinks (`[[Dateiname]]`, `[[Dateiname|Alias]]`) und regulären Markdown-Links (`[Text](pfad.md)`). Die Visualisierung erfolgte über einen interaktiven Force-Directed-Graphen (`v-network-graph`). 

Um den Editor so schlank, fokussiert und ressourceneffizient wie möglich zu halten (Reduktion der Bundle-Größe um über 600 kB und Entlastung der Benutzeroberfläche), wurde das Feature vorläufig aus der aktiven Menüleiste und dem View-Routing entfernt.

### Geplante Ausbaustufen bei Wiederaufnahme:
1. **Editor-Autovervollständigung für Wikilinks (`[[`)**:
   - Beim Tippen von `[[` im CodeMirror-Editor soll ein Autocomplete-Popup mit Fuzzy-Suche über alle Dokumente des aktuellen Workspaces erscheinen.
2. **Direkte Quelltext-Navigation (`Cmd+Klick`)**:
   - Ermöglicht das direkte Anspringen und Öffnen verlinkter Zieldateien per Tastenkombination / Klick im Markdown-Quelltext.
3. **Backlinks & Referenzen-Inspektor**:
   - Einblendung von Dokumenten, die auf die aktuell geöffnete Notiz verweisen (eingehende Kanten).
4. **Graph-Filter & Orphan-Erkennung**:
   - Filtermöglichkeiten nach Verzeichnissen, Frontmatter-Tags sowie gezielte Isolierung verwaister Notizen zur Pflege wissenschaftlicher Wissenssammlungen.

---

## 2. Nativer Typst PDF-Export (Roadmap-Abgleich)

- **Status:** In Entwicklung / Nativ im Rust-Backend (`src-tauri` via `typst` & `typst-pdf`).
- **Ziel:** Vollständiger Ersatz von Headless-Browser-basierten Rendering-Engines durch blitzschnellen, nativen Typst-Compiler-Durchlauf ohne Chromium-Abhängigkeiten.

---

## 3. Übersetzungs- & QA-Vergleichsmodus (Dual-Document View & Heading-Sync)

- **Status:** Implementiert (v1.2.0)
- **Komponenten:** `src/components/QaReferencePane.vue`, `src/lib/heading-sync.ts`, `src/lib/language-detector.ts`, `src/App.vue`, `src/components/StatusBar.vue`

### Hintergrund & Motivation
Im Payer-Projekt existiert im `qa_viewer.html` ein bewährter Side-by-Side-Modus für Lektoren und Übersetzer. Dieser erlaubt es, zwei Dokumente parallel nebeneinander zu öffnen (z.B. Deutsches Original als Referenz und Zielsprache im Editor), um Übersetzungen und Korpora synchron zu prüfen.

### Geplante Funktionen & Ausbaustufen:
1. **Dual-Pane Dokumentenansicht (2-Col / 3-Col Layout):**
   - Paralleles Laden zweier Markdown-Dateien im Workspace (z.B. Referenzdatei links schreibgeschützt oder gerendert, Zieldatei rechts im CodeMirror-Editor).
   - Flexible Umschaltung: 2-Spalten-Vergleich (Original vs. Editor), 3-Spalten-Vergleich (Original, Editor, Live-Vorschau) sowie SWAP-Button zum Seitentausch.
2. **Kapitel- & Überschriften-basiertes Synchron-Scrollen (Heading-Matching):**
   - Intelligente Scroll-Synchronisation basierend auf übereinstimmenden Markdown-Headings (`#`, `##`, `###`) statt reinem Pixel-/Prozent-Scrollen.
   - Verhindert Desynchronisation bei unterschiedlich langen Sprachfassungen (z.B. Deutsch vs. Sanskrit/Englisch).
   - Wählbare Modi: *Sync: Header*, *Sync: Percentage*, *Sync: Off*.
3. **Parallele Workspace-Sprachnavigation:**
   - Schnellauswahl paralleler Dateien bei mehrsprachigen Korpora (z.B. automatische Zuordnung korrespondierender Sprachpfade wie `de/lektion01.md` ↔ `en/lektion01.md`).

---

## 4. Dreistufiges Hybridkonzept für Sanskrit-Eingabe (In-Editor IME & Live-Transliteration)

- **Status:** Backlog / Konzipiert (Architektur dokumentiert in `docs/scholarly-input-architecture.md`)
- **Komponenten:** `src/components/Editor.vue`, `src/lib/transliteration.ts`, CodeMirror 6 Extensions

### Hintergrund & Motivation
Sanskrit-Texte sind im wissenschaftlichen Alltag Mischtexte (deutscher/englischer Kommentar kombiniert mit IAST-Fachbegriffen oder Devanāgarī-Zitaten).
Ein reines OS-Tastaturlayout zwingt zu ständigen Unterbrechungen des Schreibflusses mitten im Satz; reine Harvard-Kyoto-ASCII-Speicherung entstellt den Quelltext typografisch und kollidiert mit Großbuchstaben am Satzanfang.

### Geplante Ausbaustufen:
1. **Stufe 1 (Kanonische Speicherung):**
   - Markdown-Dateien persistieren standardkonformes IAST (`kṛṣṇaḥ`) oder Devanāgarī (`कृष्णः`). Volle Interoperabilität mit externen Tools (Git, Typst, Pandoc).
2. **Stufe 2 (CodeMirror 6 In-Editor Live-IME):**
   - **Scope-basierter IME:** Innerhalb von Sanskrit-Klammern (`《...》` und `⟪...⟫`) tippt der Autor in flüssigem Harvard-Kyoto (`kRSNaH`); CodeMirror wandelt dies während des Tippens in Echtzeit in IAST (`《kṛṣṇaḥ》`) oder Devanāgarī (`《कृष्णः》`) um.
   - **Compose-Key Sequenzen im Fließtext:** Emulation schneller Compose-Kürzel ohne OS-Tastaturwechsel (z. B. `.r` => `ṛ`, `-a` => `ā`, `~n` => `ñ`, `'s` => `ś`, `.s` => `ṣ`, `.m` => `ṃ`, `.h` => `ḥ`).
3. **Stufe 3 (Post-Hoc Transliteration - Bereits aktiv):**
   - Tastatur-Shortcuts `⌥⌘D` (IAST ⇄ Devanāgarī) und `⌥⌘H` (Harvard-Kyoto ⇄ Devanāgarī) sowie Header-Buttons für bestehende Dokumente und Korpus-Importe.

> [!NOTE]
> **Kompatibilität mit OS-Tastaturlayouts:** Das Hybridkonzept schränkt installierte OS-Layouts (z. B. EasyUnicode, Mac Option-IAST) in keiner Weise ein. Da Stufe 1 als Zielformat IAST nutzt, werden vom Betriebssystem gesendete IAST-Unicode-Zeichen nativ und unverändert in den Editor übernommen. Stufe 2 dient rein als optionale Unterstützung für Autoren ohne installiertes OS-Layout und bleibt jederzeit abschaltbar.



