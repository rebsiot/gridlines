# Changelog

## 0.1.10 — 2026-10-18 (Experimental alpha — GM-controlled player overlays and label placement)

- **Share Gridlines+ with players:** New per-Scene **Show/Hide Coordinate Grid to/from Players** control. Off by default for all existing and newly enabled Scenes. Players render only a read-only, non-interactive coordinate SVG with the saved axis spacing, colors and labels. They get no module edit/selection controls.
- **Share shading individually:** Each layer in Shading Layers now has **Player Visible: Off/On**. New and existing layers default off; the flag is set only through explicit GM action. Grid sharing and per-shade sharing are independent, allowing selected shading without the coordinate grid and vice versa. Configuration, partial shading deletion and splitting preserve each surviving layer's visibility flag.
- **Label placement:** **Column letters**: Top, Bottom, Both or Off; **Row numbers**: Left, Right, Both or Off. Independent color and font-size settings remain in place. Locations are based on the visible viewport and apply equally to the GM and player overlays. Existing Scenes default to top/left, with no Scene-flag migration.
- **Privacy/visibility limitation:** The HTML/SVG overlay is **not fog-of-war/vision masked**. Explicitly shared markings may appear over unrevealed map portions. Players are not sent any unshared shading/named-range labels through the module's public rendering state, but Scene flags are not guaranteed secret from clients; do not store GM-secret names in them.
- **Compatibility/data:** Keeps the `gridlines` technical ID and schema v1, shading/range IDs, fine-cell locations, prior Region conversion controls and all existing native-grid behavior. Optional `playerGridVisible` and `formats[].playerVisible` fields default hidden when absent. All writes require a GM and retain revision checking.
- **Release/testing:** Local Node/mock suite validates GM opt-in and player rendering, label placement, controls and saved state; real Foundry v14 GM/player/fog two-client test still required. Back up the test world before updating. v0.1.9 package remains available for rollback; code-only rollback does not undo newly saved visibility flags.

## 0.1.9 — 2026-10-18 (Experimental alpha — shaded-area management and native Regions)

- **Locate shading:** Each saved shading layer now offers Locate. The canvas pans to the layer and briefly displays a prominent yellow outline without replacing the current selection or saving any Scene data.
- **Select exact shading:** Each shading layer has Select, which selects its complete saved fine-cell rectangle (even if it is only part of a major map block). This supports immediate Clear Shading in Selection and other existing actions.
- **Configure shading:** Each layer can receive an optional descriptive label (up to 64 characters), a revised fill color and opacity. Save/Cancel acts on that one existing layer without rewriting its ID, bounds or any named range. Older Scene flags without a label still load unchanged under schema version 1.
- **Shading Layers accordion:** Expanded/collapsed state survives Locate, Select, Configure, Remove, selection updates and all normal manager refreshes. It stays expanded until the GM explicitly closes it, or until the last shading layer is removed. Panel scroll position is preserved when rebuilding the UI.
- **Native Foundry Regions (opt-in):** Preview a single shaded rectangle with **To Region**, or preview the next batch of up to 30 unconvertered shading layers. Purple outlines show the exact Scene-pixel rectangles. A recoverable-backup acknowledgment and a separate confirmation are required before any `Scene.createEmbeddedDocuments("Region", ...)` call.
- **Native geometry:** New Regions are created with native rectangle shapes in Scene pixel coordinates, independently of native Foundry square-grid snapping. The rectangles follow Gridlines+ width/height and X/Y offset (and are clipped to the Scene). They are rounded only to 0.001 pixel to eliminate numeric noise. No grid-based approximation is applied and no Region behaviors are attached. Native Regions may render differently from the Gridlines+ shading overlay.
- **No implicit conversion/removal:** Original shading, named ranges, existing Regions, Tokens, Walls, Tiles, Drawings and native grid are unchanged. Created Regions include private provenance flags linking back to their original shading ID; duplicate creation from the same shading layer is blocked while that Region still exists. Later shade color/geometry changes do not automatically update an already-created Region.
- **Rollback:** The previous v0.1.8 ZIP is retained for code rollback. Disabling/downgrading Gridlines+ will **not** delete newly created native Regions or undo saved shading edits. Use the native Region tool to remove particular created Regions, or restore the matching recoverable world snapshot; never delete all Regions to undo one conversion.
- **Evidence:** 67 local automated/mock tests passed; root-level release ZIP and source integrity audited; published GitHub source/download verified separately. **No live Foundry v14 Region creation test or two-client test has been completed.**


## 0.1.8 — 2026-10-18 (Experimental alpha — visible coordinates and formatting controls)

- **Named ranges follow visible map cells:** By default, selecting a major map block (e.g., `G14`) selects all underlying fine cells in that displayed block. Fine Subcells mode selects individual finer positions using relative subaddresses such as `G14.3,4` (numeric X,Y) or `G14.C4` (alphabetic alias). Go To and named-range listings use visible coordinates; `cell:` retains explicit legacy absolute fine indices. No old named ranges or IDs are automatically remapped.
- **Relative first-block ruler:** Numeric 1–10 horizontal subcolumns when the major-map columns read A/B/C; letters A–J when legacy axes read A/K/U. Subrows use numbers. The ruler is reference-only and does not write Scene flags.
- **Right-drag panning:** During cell selection the Gridlines SVG remains pointer-transparent. Left-pointer events are handled on the Foundry canvas for selection; right-pointer events are allowed through for native pan. Foundry v14 live interaction is still unverified.
- **Shading removal:** Clear selected cells across all overlapping shading layers, splitting rectangular layers where necessary; remove one shading layer by ID; or clear every shading layer with explicit confirmation. Named ranges, original Scene IDs, token positions, Drawings, Tiles, Regions and Foundry native grid are untouched. Bulk/split changes require a world snapshot for recovery, as no undo stack is implemented.
- **Label fonts:** Independent GM controls for top-column letters, side-row numbers and fine-cell ruler font sizes and font colors. Live SVG preview; automatically contrasting font outline. Existing Scene settings inherit previous visual defaults without migration.
- **Preserved:** module ID `gridlines`, Scene-flag schema v1, stored range/format IDs and fine-cell indices, previous Grid Setup geometry and native grid matching. Only explicit GM actions save revised Scene flags.
- **Verification:** 56 local Node automated/mock tests passed; scripts checked for syntax, full root-level ZIP audited, source and package hashes compared. No live Foundry v14 test or two-client test performed.
- **Upgrade:** Back up test-world Scene data and module folder, update from the unchanged manifest, refresh browser. Previous v0.1.7 ZIP retained for code rollback. Restoring code alone does not recover explicitly cleared shading; restore the corresponding world snapshot.

## 0.1.7 - 2026-10-18 (Experimental alpha — alignment and coordinate clarity)

- **Native grid visibility:** GM-local Hide/Show Foundry Grid and Show/Hide Gridlines+ controls. Hiding native lines does not change snapping, grid opacity, or the Scene. Visibility is restored on manager close or canvas teardown; unsupported Foundry mesh arrangements yield an error instead of silently pretending to hide lines.
- **Match buttons:** Match Gridlines+ to Foundry previews native square sizing and zero offsets; Save Grid Setup required. Match Foundry to Gridlines+ previews a native grid-size-only update for square, integer, zero-offset overlays. Rectangular cells and independent overlay offsets are rejected without altering Foundry or shifting the map background. Exposes Foundry Scene Configuration for manual calibration.
- **Native change safeguard:** The reverse match requires a recoverable-backup acknowledgment and a separate native confirmation dialog before `Scene.update` changes `grid.size`. Existing alignment-review logic then blocks Gridlines location edits until the GM reviews the new native geometry. No tokens, walls, lights, tiles or other embedded documents are rewritten by this module.
- **Major axis clarity:** Separate major interval for columns/rows, separate minor subdivision counts for each axis, independently selectable first major column and row. Show A/B/C and 1/2/3 for major map blocks; preserve legacy fine-cell mode until the GM explicitly switches. Optional first-block A–J / 1–10 fine-cell ruler is automatic when divisions omit underlying cells.
- **Data contract:** Keep technical module ID `gridlines`, `flags.gridlines.state` schema 1, named-range IDs, formatting IDs, saved fine-cell indices, A1 anchors and older scalar major/minor fields. Existing v0.1.6 scenes read with scalar-to-both-axis fallback without forced migration. Independent major settings appear only after an explicit Save.
- **Verification:** 45 Node automated/mock tests passed. Exact Foundry v14 live behavior, native Canvas mesh path and native grid change UI are pending GM smoke test.
- **Upgrade and rollback:** Test world only; back up the world before changes. The v0.1.6 ZIP is retained. Downgrade alone will not restore independently saved major settings or a native Scene grid-size change; restore a matching world snapshot if necessary.

## 0.1.6 — 2026-10-18 (experimental alpha)

- Added **Cell width** and **Cell height** inputs in Grid Setup. Uncheck **Link width and height (square cells)** to make rectangular overlay cells, e.g. 120 px wide by 80 px tall; recheck to synchronize dimensions. Both values preview on the map before Save.
- Updated the shared grid resolver, major/minor line rendering, labels, shading, selections, A1 origin and Go To navigation to use X and Y dimensions independently.
- A 10×10, 5×5 or 1×1 corner-to-corner calibration guide now accepts **rectangular printed cells**, measuring width and height separately and automatically unlinking unequal sizes. In unlinked mode a horizontal guide changes only width; a vertical guide changes only height.
- Existing v0.1.5 and older Scene flags with scalar `cellSize` still read as **square** cells; they are not automatically rewritten. Saved names, formatting IDs, A1 references and native Scene geometry are retained.
- Changing width or height with saved formatting/names requires the existing recoverable-backup confirmation. Discard does not write Scene data. Gridlines does **not** change the native Foundry movement/snap grid.
- Tests: 39 Node/mock tests passed and source/ZIP integrity checked locally; **real Foundry v14 UI not tested**. On rollback to v0.1.5, rectangular dimensions cannot be displayed correctly. Restore the matching Scene backup to revert saved grid geometry.

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
