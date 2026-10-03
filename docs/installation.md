---
title: Installation & Setup
---

# 💻 Zentauri Installation Guide

This guide explains how to install **Zentauri** on macOS, Windows, and Linux, and how to handle macOS security permissions during first-time setup.

---

## 🍏 macOS Installation & First-Launch Security Setup

Because Zentauri is an open-source project and is not signed with a paid Apple Developer Certificate, macOS Gatekeeper will display a warning upon initial opening stating that the application is from an "unidentified developer".

Follow these simple steps for first-time installation:

### Step 1: Download & Install
1. Download the latest `.dmg` installer from [ZenTauri GitHub Releases](https://github.com/marcodem/zentauri/releases).
2. Open the `.dmg` file and drag **ZenTauri** to your **Applications** folder.

### Step 2: Grant Security Permission (macOS Gatekeeper)
When opening Zentauri for the first time:

#### Option A (Recommended via System Settings):
1. Open **System Settings** on your Mac.
2. Navigate to **Privacy & Security**.
3. Scroll down to the **Security** section.
4. You will see a notification: *"ZenTauri was blocked from use because it is not from an identified developer"*.
5. Click **Open Anyway** (or **Allow**), then enter your Mac password or Touch ID when prompted.

#### Option B (Direct Right-Click):
1. In Finder, navigate to your **Applications** folder.
2. **Right-click** (or `Control` + Click) on **ZenTauri.app**.
3. Click **Open** from the context menu.
4. On the pop-up warning, click **Open**.

---

## 🔄 Automatic Updates

Once Zentauri is installed and granted initial permission on your Mac:

- **Seamless One-Click Updates:** You **do not** need to repeat the security bypass for future updates!
- Simply open **Settings (⚙️)** inside Zentauri and click **Check for Updates**.
- Zentauri will automatically download and install future releases smoothly via the native Tauri updater.

---

## 🪟 Windows Installation
1. Download the `.exe` or `.msi` installer from [GitHub Releases](https://github.com/marcodem/zentauri/releases).
2. If Windows Defender SmartScreen displays a warning, click **More info** → **Run anyway**.

---

## 🐧 Linux Installation
1. Download the `.AppImage` or `.deb` package from [GitHub Releases](https://github.com/marcodem/zentauri/releases).
2. For `.AppImage`, make it executable before launching:
   ```bash
   chmod +x ZenTauri_*.AppImage
   ./ZenTauri_*.AppImage
   ```
