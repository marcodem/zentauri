#!/usr/bin/env python3
"""
update_portal.py
Adds the ZenTauri Editor service card and live status check to the Birchville portal.
Updates local copy /Volumes/SanDisk1TB/proj/myhomarr/portal/index.html
and remote /volume1/docker/traefik/homarr/portal/index.html on synology.local.
"""

import sys
import subprocess
from datetime import datetime
from pathlib import Path

LOCAL_PATH = Path("/Volumes/SanDisk1TB/proj/myhomarr/portal/index.html")

ZENTAURI_CARD = """            <div class="card service-card" id="zentauri">
                <h3>ZenTauri Editor</h3>
                <p class="desc">Nativer, leichtgewichtiger Markdown-Editor für wissenschaftliche Editionen &amp; Philologie: Didaktische Syntaxboxen, Typst-PDF-Satz, Harvard-Kyoto- &amp; IAST-Transliteration sowie QA-Vergleichsmodus.</p>
                <div class="service-status">
                    <span class="status-dot checking" id="dot-zentauri"></span>
                    <span id="label-zentauri">Prüfe…</span>
                </div>
                <div class="btn-row">
                    <a class="btn" href="https://marcodem.github.io/zentauri/" target="_blank" rel="noopener">Dokumentation &rarr;</a>
                    <a class="btn" href="https://github.com/marcodem/zentauri/releases" target="_blank" rel="noopener">Downloads &rarr;</a>
                    <a class="btn" href="https://github.com/marcodem/zentauri" target="_blank" rel="noopener">GitHub &rarr;</a>
                </div>
            </div>
"""

def transform_html(content: str) -> str:
    if 'id="dot-zentauri"' in content or 'ZenTauri Editor' in content:
        print("ZenTauri card is already present in HTML.")
        return content

    # 1. Insert service card inside card-grid before the closing </div>
    # Search for the end of the Heritage card
    end_heritage = content.find('id="dot-heritage"')
    if end_heritage != -1:
        # Find the next </div>\n</div> or closing pattern
        insert_marker = content.find('            </div>\n</div>\n    </section>', end_heritage)
        if insert_marker != -1:
            target_str = '            </div>\n</div>\n    </section>'
            replacement = '            </div>\n\n' + ZENTAURI_CARD + '        </div>\n    </section>'
            content = content.replace(target_str, replacement, 1)
        else:
            # Fallback before </div>\n    </section>
            content = content.replace('</div>\n    </section>', ZENTAURI_CARD + '        </div>\n    </section>', 1)
    else:
        content = content.replace('</div>\n    </section>', ZENTAURI_CARD + '        </div>\n    </section>', 1)

    # 2. Add zentauri to services array for live status checks
    if "{ id: 'zentauri'" not in content:
        heritage_svc = "{ id: 'heritage',     url: 'https://birchville-org.github.io/HeritageDictionnaire/', gated: false }"
        zentauri_svc = heritage_svc + ",\n            { id: 'zentauri',     url: 'https://marcodem.github.io/zentauri/', gated: false }"
        if heritage_svc in content:
            content = content.replace(heritage_svc, zentauri_svc)
        else:
            old_services = """        const services = [
            { id: 'payer',        url: 'https://payer.birchville.cc',        gated: false },
            { id: 'heritage',     url: 'https://birchville-org.github.io/HeritageDictionnaire/', gated: false }
        ];"""
            new_services = """        const services = [
            { id: 'payer',        url: 'https://payer.birchville.cc',        gated: false },
            { id: 'heritage',     url: 'https://birchville-org.github.io/HeritageDictionnaire/', gated: false },
            { id: 'zentauri',     url: 'https://marcodem.github.io/zentauri/', gated: false }
        ];"""
            if old_services in content:
                content = content.replace(old_services, new_services)

    return content

def main():
    print("Fetching portal index.html...")
    if LOCAL_PATH.exists():
        print(f"Reading local file: {LOCAL_PATH}")
        raw = LOCAL_PATH.read_text(encoding="utf-8")
    else:
        print("Local file not found, fetching via SSH from synology.local...")
        fetch_cmd = ["ssh", "marco@synology.local", "cat /volume1/docker/traefik/homarr/portal/index.html"]
        raw = subprocess.check_output(fetch_cmd, text=True)

    updated = transform_html(raw)

    if LOCAL_PATH.exists():
        LOCAL_PATH.write_text(updated, encoding="utf-8")
        print("Updated local portal index.html.")

    # 1. Create remote backup on synology
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"/volume1/docker/traefik/homarr/portal/index.html.bak-{timestamp}-zentauri"
    print(f"Creating remote backup on synology.local ({backup_file})...")
    subprocess.run([
        "ssh", "marco@synology.local",
        f"cp /volume1/docker/traefik/homarr/portal/index.html {backup_file}"
    ], check=True)

    # 2. Upload updated index.html to synology.local
    print("Uploading updated index.html to synology.local...")
    proc = subprocess.run(
        ["ssh", "marco@synology.local", "cat > /volume1/docker/traefik/homarr/portal/index.html"],
        input=updated,
        text=True,
        capture_output=True
    )
    if proc.returncode != 0:
        print("Error writing to synology:", proc.stderr)
        sys.exit(proc.returncode)

    print("Successfully updated Birchville Portal with ZenTauri on synology.local.")

if __name__ == "__main__":
    main()
