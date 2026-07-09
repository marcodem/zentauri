# Release Notes — ZenTauri v1.0.0

Wir freuen uns, das offizielle Release **ZenTauri v1.0.0** ankündigen zu können! Dieses Release portiert die reichhaltigen, wissenschaftlichen Markdown-Funktionen aus dem ZenNotes-Erbe auf ein schlankes, natives Tauri-Fundament und ergänzt es um moderne IDE-Werkzeuge für Sanskrit-Lehrer und Linguisten.

---

## Neue Funktionen & Highlights

### 📂 Premium-Explorer mit Inline-Editing
* **Popup-freie Erstellung & Umbenennung:** Dateinamen und Ordner werden direkt im Dateibaum über eingeblendete Textfelder bearbeitet. Bestätigung erfolgt intuitiv per `Enter` oder Klick außerhalb (`Blur`), Abbrechen per `Esc`.
* **Dateityp-spezifische Icons:** Visuelle Unterstützung durch spezifische Symbole für Markdown-Dateien, PDF-Dokumente, Bild-Assets und Konfigurationen.
* **Explorer-Werkzeuge:** Shortcuts zum automatischen Schließen aller Ordner ("Collapse All") und zum manuellen Neuladen des Workspace-Verzeichnisses.
* **Aktive Dateiverfolgung:** Das Anklicken eines geöffneten Tabs expandiert automatisch alle übergeordneten Verzeichnisse und markiert die Datei im Explorer.

### 🔍 Dateispezifische Textsuche
* **Integriertes Such-Panel:** Erreichbar über die Suchlupe in der Activity-Leiste.
* **Echtzeit-Trefferliste:** Listet alle Zeilen-Treffer inklusive Zeilennummern und Vorschautext mit farbiger Markierung des Suchbegriffs auf.
* **Fall-Sensitivität (Case Sensitivity):** Option zum Filtern nach exakter Groß-/Kleinschreibung.
* **Code-Verlinkung:** Ein Klick auf ein Suchergebnis springt im CodeMirror 6-Editor sofort an die exakte Zeile und fokussiert diese.

### ✍️ Wissenschaftliches Markdown & Sanskrit-Syntax (Payer-kompatibel)
* **Standardisierte Sanskrit-Highlighting:** Text in CJK-Doppelwinkel-Klammern `《Sanskrit-Wort》` wird vollautomatisch erkannt und rot eingefärbt.
* **Layout-Kompatibilität:** Vollständige Angleichung der Container-Boxen an das Payer-Layout (`:::grammar-box`, `:::grammar-box2`, `:::note-box`, `:::important`) ohne störende Header-Titel-Deklarationen.
* **Technische Syntax:** Unterstützung für komplexe LaTeX-Formeln über KaTeX, Mermaid-Strukturdiagramme und GFM-Tabellen.

---

## CI/CD Builds & Verteilung
* **Automatisierter Build-Workflow:** GitHub Actions kompiliert ab sofort bei jedem Push eines `v*`-Tags vollautomatisch die Installationsdateien für alle Zielplattformen:
  * **macOS:** Universal `.dmg` / `.app` (für Apple Silicon M1/M2/M3 und Intel).
  * **Windows:** `.msi` & `.exe`-Installer.
  * **Linux:** Portables `.AppImage` & `.deb`-Pakete.
* Die Artefakte werden automatisch als Entwurf (Draft) unter den GitHub-Releases abgelegt.
