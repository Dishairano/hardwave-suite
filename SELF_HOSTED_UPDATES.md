# Self-Hosted Updates (No GitHub Releases)

Hardwave Suite uses the Tauri updater. It only needs:

- A URL that serves a `latest.json`-style manifest (JSON)
- The signed installer artifacts referenced by that manifest

This repo is configured to fetch updates from:

- `https://hardwavestudios.com/api/updates/hardwave-suite/latest`

The website endpoint reads a file named:

- `hardwave-suite-latest.json`

from the website server's `PUBLIC_DOWNLOADS_DIR` directory, and the installers are served via:

- `https://hardwavestudios.com/api/download-file/<filename>`

## 1) Build (per OS)

You still need to run the Tauri build on each OS you want to ship:

- Windows runner: produces `*-setup.exe` (+ `.sig`) and optional `.msi`
- macOS runner (Apple Silicon): produces `*.app.tar.gz` (+ `.sig`) and optional `.dmg`
- Linux runner: produces `*.AppImage` (+ `.sig`) and optional `.deb`

The updater uses the `.sig` files to verify the download using the public key embedded in `src-tauri/tauri.conf.json`.

## 2) Generate the updater manifest

Collect the 3 updater artifacts (`*-setup.exe`, `*.app.tar.gz`, `*.AppImage`) and their `.sig` files into a folder (example: `release-files/`), then run:

```bash
npm run gen:latest -- --in release-files --base-url https://hardwavestudios.com/api/download-file --out hardwave-suite-latest.json
```

## 3) Publish to the website server

Copy these files to the website server's `PUBLIC_DOWNLOADS_DIR` (default on this machine is `/home/cnstexultant/hardwave-uploads/public-downloads`):

- `hardwave-suite-latest.json`
- all 3 artifacts referenced by it (and optionally any extra assets you want to offer for direct download)

## Important: Migration from older builds

Builds released before `v0.5.7` still check the old GitHub `latest.json` endpoint. To move everyone to self-hosted updates:

- Either ship one last update on the old endpoint (bridge release), or
- Have users install the new version once manually (then future updates come from the website).

