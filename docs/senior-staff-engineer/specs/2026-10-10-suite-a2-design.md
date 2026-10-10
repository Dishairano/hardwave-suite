# Hardwave Suite A2: design

Approved by the founder on 2026-10-10 from the mockup at
https://suite.hardwavestudios.com/suite-v2-mockup/screens.html (A2, every screen) and the installer at
https://suite.hardwavestudios.com/suite-v2-mockup/ (A2 · installer).

## What changes

The Suite becomes the one Hardwave app on the PC: your plug-ins first, the other Hardwave lines in slim rows.
The install logic, the updater, the beta channel, crash reports and the login stay as they are (Rust side untouched).
The UI is rebuilt around seven screens, one calm window, the Workspace look (Archivo, Barlow, JetBrains Mono, the
wave mark, Hardwave red, surfaces `#0a0a0a` / `#131315` / `#1a1a1c`).

## Screens

1. **Home.** A status line (how many plug-ins on this PC, which one has an update, one link to update it). One
   task card ("One thing left") built from `first_run_check`: the first installed plug-in that has never been
   opened, with the steps for the chosen DAW (FL Studio, Ableton, Bitwig, Reaper) and "I found it" / "Show me a
   video". A shelf "Your plug-ins" with large tiles (the real interface as picture, Analyser as a live preview) for
   every installed plug-in; status as a coloured dot and a few words. A shelf "Ready with your Pro" with the Pro
   plug-ins not installed yet (only with a Pro subscription; otherwise "With Pro" and a link). Three slim rows
   "More from Hardwave": Workspace, DAW, Academy, each with one line of state and an arrow to its screen.
2. **Plug-ins.** Header with "Update all". Filters: All, On this PC, Updates, Pro beta, with counts. The grid of
   six tiles with the same tile component. Under it two cards: what changed in the first available update
   (changelog), and where plug-ins go (VST3 and CLAP paths, open folder).
3. **Workspace.** Header with "Open Workspace". A hero (the real Workspace picture) with the backup line, a storage
   card, a "Saved recently" list. Live data when the Workspace API accepts the Suite's token; until then the hero
   and the links, with the numbers hidden rather than invented.
4. **DAW.** Header with the beta-list state. Hero with the DAW picture, "What is inside" facts, "From the beta"
   (release notes land here), "On your PC" facts. Join the beta list opens the site.
5. **Academy.** Header with "Join the waitlist". The guides as a list (fetched from the site when an API exists,
   else the fixed nine from the mockup, every one a real guide), two cards: when it opens, free now.
6. **Settings.** Four cards: Account (signed in as, plan, manage subscription, sign out), Updates (beta builds
   toggle = update channel; an "update on their own" toggle only once that behaviour exists), Install locations
   (VST3 and CLAP, change), This app (start with Windows only if the autostart exists; crash reports toggle;
   version).
7. **Help.** Header with "Report a bug". Three guides, "Talk to us" (Discord, copy the log), "This PC" facts, FAQ
   rows.

The sidebar lists Home, Plug-ins (a dot when an update waits), Workspace, DAW, Academy, a gap, Settings, Help.
Account lives in Settings; the sidebar bottom keeps the signed-in name.

## Tile

One component for every plug-in: picture (bundled poster per slug, Analyser with a short bundled loop), name,
status dot + words, and the one action that fits the state: Install, Update, Installing… n %, nothing when up to
date. State comes from the same data the hub uses today: products, installed versions, the beta manifest, the
download reducer.

## What is not in this change

- The installer's own screens (NSIS). The Tauri bundler allows a header and sidebar image, the icon and the
  colours; the full A2 installer flow is a separate piece of work.
- New Rust commands. Where a screen wants data the app does not have (Workspace numbers, beta-list state,
  autostart), the screen shows what it knows and a link, never a made-up number.

## Checks

`tsc --noEmit`, `vite build`, and a render of every screen from `dist` with the Tauri bridge mocked (the
screenshot technique used for the mockups), compared side by side with the mockup before the founder sees it.
