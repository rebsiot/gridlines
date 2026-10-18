# Changelog

## 0.1.5 — 2026-10-18 (experimental alpha)

- Renamed the Foundry package title to **AFT Gridlines+** so it sorts and identifies consistently in Setup and Manage Modules; the native Foundry checkbox continues to show whether it is enabled in that world.
- Updated the Token Controls launcher, Gridlines Scene Control title, and manager heading to match the new display name.
- Preserved immutable module ID `gridlines`, install folder, GitHub repository, manifest URL, Scene flags, existing range/format IDs, and all grid alignment behavior. No Scene migration or enabling/disabling of modules occurs.
- Install/update from the existing manifest after backing up the module folder/test world, then reload the world and confirm the name and enabled status. Rollback to the retained v0.1.4 ZIP if necessary; Scene flags remain unchanged by this release.
- Tested with local Node/mock checks and package ZIP audit. **Live Foundry v14 testing has not been performed.**

## 0.1.4 — 2026-10-18 (experimental alpha)

- Added **Drag Grid**. Click the mode, drag anywhere on the Scene and release to preview new X/Y offsets; the A1 guide moves with the overlay. The dragging gesture cannot write Scene data.
- Added **Pick A1 Cell** after dragging. Click a fine cell to make it the beginning of major block A1; letter/number labels, the major/minor line phase and normal Go To addresses use the selected origin. For legacy fine-cell mode, displayed cell addresses also follow the selected A1. Explicit `cell:` queries still refer to unchanged internal fine-cell indices.
- Added a temporary highlighted A1 area during placement and whenever the A1 choice is unsaved. Escape cancels a drag or picker; Save/Discard remains explicit.
- Preserved existing Scene flags, saved formatting/range IDs, and previous grid values through optional `a1Row` / `a1Col` fields defaulting to zero. A1 remapping changes reference labels, **not** the stored fine-cell indices; back up and confirm before saving where named ranges/fills exist.
- Does not edit Foundry's native grid, Tiles, Drawings, Regions or tokens. No migration, auto-import or change to Pro ownership.
- Automated/mock verification: 30 passed; package verification performed locally. **Live Foundry v14 test not yet run.**

## 0.1.3 — 2026-10-17 (experimental alpha)

- Added **Draw 10x10 / 5x5 / 1x1 Guide** to GM Grid Setup. Drag horizontally or vertically across that many printed squares to measure a cell size and align the corresponding axis; drag corner-to-corner across an N×N printed square to align both X and Y.
- Calibration uses temporary SVG lines and a rectangle while dragging; no Foundry Drawing, Region, Tile, native-grid setting or Scene document is created or altered by a guide drag.
- On release, Gridlines calculates the nearest congruent overlay origin, previews cell size and X/Y offsets, and requires **Save Grid Setup** to persist. Cancel, Escape, or Discard Preview does not save changes.
- Rejects too-short guides, distorted rectangles, and invalid cell sizes. Scene data with saved named ranges or fills retains its backup confirmation requirement before changing geometry.
- During a geometry preview, range navigation and creating/shading named cells are blocked until Save or Discard. Preserves existing v0.1.2 Scene flags, named-range IDs, and major/minor styling defaults; no schema migration.
- Local Node/mock tests: see `TESTING.md`. **Live Foundry v14 validation not performed.**
- Upgrade: back up test world and module folder, update via the existing manifest and hard-refresh; rollback with the previous ZIP and corresponding world snapshot if you saved new Scene settings.

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
