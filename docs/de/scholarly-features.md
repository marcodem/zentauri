---
title: Editor-Features & Scholarly-Erweiterungen
---

# 📝 Editor-Features & Scholarly-Erweiterungen

Zentauri integriert spezialisierte Erweiterungen auf Basis von `markdown-it-extensible`, um wissenschaftliche Editions- und Typografie-Anforderungen direkt im flüssigen Schreibprozess zu unterstützen.

---

## 1. Erweiterte Markdown-Syntax

Der Markdown-Parser unterstützt didaktische und linguistische Blöcke:

- **Scholarly Container:** Spezielle Blöcke wie `::: grammar-box`, `::: note-box` und `::: important`.
- **Fußnoten & Definitionslisten:** Vollständige wissenschaftliche Fußnoten (`[^1]` und `[^1]: Notiz`) und mehrzeilige Definitionslisten (`Begriff\n: Definition`).
- **Inline Sanskrit-Typografie:** Syntax wie `《Sanskrit》` mit automatischer Schriftartenkaskade (`Noto Sans Devanagari`, `Kohinoor Devanagari`).
- **Signal-Markierungen:** Direkte Inline-Hervorhebungen via `:sig[Signal]` und `:mark[Highlight]`.
- **Formelsatz & Gleichungen:** Native KaTeX/MathJax-Syntax `$e^{i\pi} + 1 = 0$` nahtlos in der Vorschau gerendert.
- **Mermaid-Diagramme:** Interaktive Architektur- und Ablaufdiagramme direkt im Editor.

---

## 2. Interaktiver Wissensgraph (Roadmap / Backlog für v2.0.0)

::: info Status: Im Backlog geparkt
Die interaktive Wissensgraph-Visualisierung (`v-network-graph`) ist derzeit im Backlog geparkt (siehe [Roadmap & Backlog](./roadmap)), um den v1.x Core-Editor schlank und reaktionsschnell zu halten. Die Link-Extraktion und Datenbank-Indexierung im Rust-Backend bleiben aktiv.
:::

Geplante Features bei Wiederaufnahme:

- Volle Unterstützung für bidirektionale `[[Wiki-Links]]` und relative Markdown-Links `[Label](./datei.md)`.
- Interaktive Visualisierung über `v-network-graph` im Frontend.
- Doppelklick auf Knoten öffnet die entsprechende Notiz direkt im Editor.

---

## 3. Silent Auto-Repair

Zentauri repariert Syntaxfehler im Markdown geräuschlos beim Speichern (`auto-repair.ts`):

- **Stille Autokorrektur:** Schließt offene Container (`:::`) und korrigiert Einrückungen automatisch.
- **Visuelles Feedback:** Dezente Gelbfärbung des Speichern-Buttons signalisiert die durchgeführte Korrektur ohne störende Popups.

---

## 4. SQLite Metadaten-Extraktion

Der Datei-Explorer greift auf die native SQLite-Datenbank zu, um Dokumenttitel und Sprach-Tags (`IAST`, `Devanagari`) aus YAML-Frontmattern direkt im Dateibaum anzuzeigen.

---

## 5. QA-Vergleichsmodus & Synchron-Scrollen

Für Übersetzer, Lektoren und vergleichende Textanalysen (nach Vorbild des Payer QA Viewers):

- **Dual- & Triple-Pane (2-Col / 3-Col):** Parallele Anzeige einer Referenzdatei links neben dem CodeMirror-Editor (2-Col) bzw. mit zusätzlicher Live-Vorschau rechts (3-Col).
- **SWAP-Funktion:** Schneller Seitentausch von Referenz- und Arbeitsdokument mit einem Klick.
- **Heading-basiertes Synchron-Scrollen:** Intelligente Verknüpfung über Markdown-Überschriften (`#`, `##`, `###`), Nummernpräfixe und relative Interpolation – kein Desynchronisieren bei unterschiedlich langen Sprachfassungen. Umschaltbar zwischen *Sync: Header*, *Sync: Percentage* und *Sync: Off*.
- **Parallele Sprachnavigation:** Automatische Erkennung paralleler Sprachversionen (z. B. `de/` ↔ `en/`) und Ein-Klick-Auswahl passender Referenzdokumente im Workspace.
