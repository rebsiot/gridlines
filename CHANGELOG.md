# Changelog

## 0.1.2 — 2026-10-17 (experimental alpha)

- Added editable **overlay cell size (px)** and **X/Y offsets**. These affect Gridlines visuals, selections and Go To positions, not the native Foundry movement grid.
- Fixed missing gridline **color, opacity and stroke-width controls**. They preview instantly without writing Scene data; Save Grid Setup commits the settings.
- New Scene defaults: **10 fine cells per major axis**, with **5 minor divisions** (four interior minor guide lines), and coordinate labels only on major axes.
- Added major-block Go To addressing on new Scenes; `cell:` prefix navigates exact fine cells. Existing v0.1.1 Scenes retain their stored fine-cell coordinate convention and major intervals until deliberately changed.
- Keeps named-range IDs, formatting data, module ID `gridlines` and existing Scene flags. Changes that could relocate saved content require a backup acknowledgment before saving.
- Automated Node/mock tests and ZIP audit: see `TESTING.md`. Live Foundry v14 verification not yet performed.
- Upgrade via the stable manifest; retain an earlier ZIP and a test-world snapshot for rollback.


## 0.1.1 — 2026-10-17 (experimental alpha)

- Fixed manifest-install packaging: `module.json` is at the ZIP root, preventing an extra `gridlines/` directory during extraction.
- Added a GM-only **Gridlines: Open Manager** button under native Token Controls, in addition to the separate Gridlines control.
- Added visible **Select Cells on Map / Stop Selecting Cells** actions to the manager; closing the manager releases map clicks.
- Expanded canvas element detection for PIXI v8 and provided a console warning when no canvas is found.
- Kept module ID, `flags.gridlines.state`, geometry formats, named-range IDs, and native Scene settings unchanged.
- Tested locally with Node/mock checks and ZIP-root audit; **live Foundry v14 test not yet performed**.
- Upgrade: back up the test world and module folder; update via the existing manifest. Rollback: restore previous module files and the matching world snapshot if document data was modified; previous flags remain intact.


## 0.1.0 - 2026-10-17 (Experimental alpha, GitHub manifest build)

- Added native square-grid coordinate conversion, selection, major/minor overlay lines and address navigation.
- Added opt-in per-Scene grid configuration, rectangular fill layers, and named ranges using Scene flags.
- Added native grid-change detection and recovery: keep logical cell addresses or preview a whole-cell remap to approximate original map coverage.
- Kept native Scene grid, Tiles, Drawings, Regions, walls, tokens, actor data and other modules untouched.
- No legacy data migration; no automatic hotbar behavior or Pro automation.
- Known limitations: GM-only visuals, no fog/player smoke test, no robust concurrent GM commit protocol, square grids only.
- Local automated tests: see `TESTING.md`. Live Foundry testing: **not run**.
- Install/rollback: follow README, use a test world and a recoverable world backup before applying the module.
