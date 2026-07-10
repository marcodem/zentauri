# Release Notes — ZenTauri v1.0.1

Dieses Release behebt Fehler bei Dateisystem-Berechtigungen und optimiert das Explorer-Verhalten für eine stabilere Benutzererfahrung.

## Behobene Probleme & Optimierungen (v1.0.1)

### 📂 Dateisystem-Berechtigungen & Stabilität
* **Globaler Dateisystem-Zugriff:** Der Berechtigungsbereich wurde auf das gesamte Dateisystem (`**`) erweitert. Dadurch können nun auch Arbeitsbereiche auf externen Laufwerken (z. B. `/Volumes/...`) oder beliebige Projektverzeichnisse beim Starten ohne Einschränkung geladen werden.
* **Fehlertoleranz bei Start:** Falls ein zuvor geöffneter Ordner nicht mehr existiert (z. B. Laufwerk getrennt), stürzt die App nicht ab. Stattdessen wird eine verständliche Fehlermeldung mit der Option „Ordner erneut öffnen“ angezeigt.
* **Fallbacks in Systemdialogen:** In Datei-Öffnen- und Speichern-Dialogen wurde eine "All Files" (`*`)-Filteroption hinzugefügt, um zu verhindern, dass macOS Markdown-Dateien ausgraut.

### 🔄 Synchronisierter Tab-Wechsel
* **Verbesserter Sidebar-Wechsel:** Klicks auf Dateien in der Sidebar (sowohl im Dateibaum als auch unter "Open Editors") prüfen zuerst, ob das Dokument bereits im Editor geöffnet ist. Falls ja, wird direkt zu diesem Tab gewechselt, anstatt die Datei neu von der Festplatte zu laden. Das schützt ungespeicherte Änderungen vor dem Überschreiben und ermöglicht das Wechseln von virtuellen `untitled://`-Tabs direkt aus der Sidebar.

### ✍️ Explorer-Funktionen aktiviert
* **Save All (Alle speichern):** Das Disketten-Symbol in der Sektion „Open Editors“ wurde aktiviert und speichert alle geänderten Tabs parallel.
* **Erweitertes Kontextmenü:** Die Optionen „Neue Datei“ und „Neuer Ordner“ sind nun auch beim Rechtsklick auf eine Datei aktiv (erstellt die Elemente im selben Ordner wie die Datei).
* **Auto-Open:** Neu erstellte Dateien werden nach dem Bestätigen im Explorer sofort automatisch im Editor geöffnet.

---

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
