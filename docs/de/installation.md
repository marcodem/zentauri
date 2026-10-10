---
title: Installation & Einrichtung
---

# 💻 Zentauri Installationsanleitung

Diese Anleitung erklärt die Installation von **Zentauri** unter macOS, Windows und Linux sowie die Freigabe der macOS-Sicherheitsberechtigungen beim Erststart.

---

## 🍏 macOS Installation & Gatekeeper-Freigabe

Da Zentauri ein Open-Source-Projekt ist und nicht mit einem kostenpflichtigen Apple-Entwicklerzertifikat signiert wurde, zeigt macOS Gatekeeper beim ersten Öffnen einen Sicherheitshinweis an, dass das Programm von einem „nicht verifizierten Entwickler“ stammt.

Folgen Sie diesen einfachen Schritten für die Ersteinrichtung:

### Schritt 1: Herunterladen & Installieren
1. Laden Sie die neueste `.dmg`-Installationsdatei von den [ZenTauri GitHub Releases](https://github.com/marcodem/zentauri/releases) herunter.
2. Öffnen Sie die `.dmg`-Datei und ziehen Sie **ZenTauri** in Ihren **Programme**-Ordner (`Applications`).

### Schritt 2: Sicherheitsfreigabe (macOS Gatekeeper)
Beim erstmaligen Öffnen von Zentauri:

#### Option A (Empfohlen über Systemeinstellungen):
1. Öffnen Sie die **Systemeinstellungen** auf Ihrem Mac.
2. Navigieren Sie zu **Datenschutz & Sicherheit**.
3. Scrollen Sie nach unten zum Bereich **Sicherheit**.
4. Dort erscheint der Hinweis: *„ZenTauri wurde blockiert, da das Programm nicht von einem verifizierten Entwickler stammt“*.
5. Klicken Sie auf **Dennoch öffnen** (oder **Erlauben**) und bestätigen Sie die Abfrage mit Ihrem Mac-Passwort oder Touch ID.

#### Option B (Direkt per Rechtsklick):
1. Navigieren Sie im Finder zum Ordner **Programme**.
2. Führen Sie einen **Rechtsklick** (oder `Control` + Klick) auf **ZenTauri.app** aus.
3. Wählen Sie **Öffnen** aus dem Kontextmenü.
4. Klicken Sie im Bestätigungsdialog auf **Öffnen**.

---

## 🔄 Automatische Updates

Sobald Zentauri auf Ihrem Mac installiert und freigegeben ist:

- **1-Klick-Aktualisierungen:** Der Sicherheitsdialog muss bei zukünftigen Updates **nicht** wiederholt werden.
- Zentauri prüft beim Start und im laufenden Betrieb automatisch auf Updates.
- Alternativ können Sie in den **Einstellungen (⚙️)** auf **Nach Updates suchen** klicken.

---

## 🪟 Windows Installation
1. Laden Sie den `.exe`- oder `.msi`-Installer von den [GitHub Releases](https://github.com/marcodem/zentauri/releases) herunter.
2. Falls Windows Defender SmartScreen einen Hinweis anzeigt, klicken Sie auf **Weitere Informationen** → **Trotzdem ausführen**.

---

## 🐧 Linux Installation
1. Laden Sie das `.AppImage`- oder `.deb`-Paket von den [GitHub Releases](https://github.com/marcodem/zentauri/releases) herunter.
2. Machen Sie das `.AppImage` vor dem Start ausführbar:
   ```bash
   chmod +x ZenTauri_*.AppImage
   ./ZenTauri_*.AppImage
   ```
