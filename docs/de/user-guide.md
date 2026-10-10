---
title: Benutzerhandbuch & Anpassung
---

# 📖 Zentauri Benutzerhandbuch

Zentauri wurde speziell für wissenschaftliche Textarbeit, Notizorganisation und die strukturierte Darstellung komplexer Textkorpora (z. B. grammatische Paradigmen und linguistische Editionen) entwickelt.

::: tip Primärzweck & Layout-Philosophie
* **Markdown zu HTML:** Das Hauptziel von Zentauri ist die Transformation von semantischem Markdown in sauberes, standardisiertes **HTML** (prädestiniert für Online-Editionen, Webkorpora und Dokumentationsplattformen).
* **Minimales Layouting:** Zentauri versteht sich nicht als Desktop-Publishing-System (DTP). Eine gezielte Auswahl an Markdown-Syntaxerweiterungen (Container-Boxen, Textzentrierung, Einrückungen, Tabellenumbrüche) ermöglicht minimale didaktische Layouts direkt im Textfluss.
* **PDF-Export:** Die integrierte PDF-Exportfunktion dient dem sauberen Drucken und Weitergeben des HTML-Dokuments, ersetzt jedoch kein manuelles DTP-Satzprogramm.
:::

---

## 1. Benutzeroberfläche & Navigation

- **Aktivitätsleiste links:** Schneller Zugriff auf Datei-Explorer, Workspace-Suche, Cheatsheet und Einstellungen.
- **Split-Pane-Layout:** Synchronisierte Ansicht mit CodeMirror 6 auf der linken Seite und gerenderter Markdown-Vorschau rechts.
- **Wissensgraph & Verlinkung:** Bidirektionale Dokumentverknüpfungen (`[[Wiki-Links]]`) visualisiert als interaktiver Kraftgraph.

---

## 2. Wissenschaftliche Syntax & Container-Boxen

Zentauri unterstützt didaktische Block-Container standardmäßig:

::: grammar-box
**Grammatik-Paradigma:**
devo viṣṇuḥ = ⟪देवो⟫ ⟪विष्णुः⟫ = „Viṣṇu ist ein Gott.“
:::

- **Sanskrit-Typografie:** Text in `《Sanskrit-Text》` oder `⟪Text⟫` wird automatisch auf Devanāgarī-Schriftarten abgebildet.
- **Inline-Signalmarkierungen:** Direkte Inline-Hervorhebungen via `:sig[Signaltext]` (Signalrot) und `:mark[Markierter Text]` (Warmgold).
- **Zeilenumbrüche in Tabellenzellen:** Mit `:br` können saubere Zeilenumbrüche innerhalb von Markdown-Tabellenzellen gesetzt werden.

---

## 3. Eigene Stylesheets (`custom.css`)

Sie können Schriftarten, Farben und Layoutdetails über ein eigenes Stylesheet anpassen. Zentauri lädt automatisch die Datei `custom.css` aus dem Konfigurationsverzeichnis:

1. **Pfad zu `custom.css`:** Liegt unter `~/.config/zentauri/custom.css` (macOS/Linux) bzw. `%APPDATA%\zentauri\custom.css` (Windows).
2. **Vorlagen:** Eine Vorlage wird beim ersten Programmstart automatisch angelegt.
3. **Wirksamkeit:** Änderungen greifen sofort nach einem Neustart des Editors.

### Beispiel: Anpassung der Grammar-Box
```css
/* Grammar-Box mit dezenter blauer Tönung */
.vp-doc .custom-block.grammar-box,
.grammar-box {
  background-color: #f0f8ff !important;
  border-left-color: #0369a1 !important;
}
```

---

## 4. Eigene Syntax-Elemente definieren

Dank `markdown-it-extensible` können neue Syntax-Elemente flexibel definiert werden:

### Dynamische Inline-Direktiven (Ohne Codeänderung)
```markdown
Dies ist ein :magic[spezieller Text].
```
Wird gerendert als `<span class="magic">spezieller Text</span>`. In `custom.css`:
```css
.magic {
  color: #b45309;
  font-weight: bold;
}
```

### Dynamische Block-Container
Vorkonfigurierte Container (`custom1` bis `custom5`) können direkt gestylt werden:
```markdown
::: custom1 [Eigener Titel]
Inhalt des benutzerdefinierten Containers.
:::
```
```css
.custom-block.custom1 {
  background-color: #fcf9f2;
  border-left: 4px solid #b45309;
  padding: 1rem;
}
```
