# Gridlines - Experimental Alpha

Gridlines helps a GM identify, shade, and name map cells without adding Tiles, Drawings, or Regions. It draws over **Foundry's existing square Scene grid**. You can set a separate visual cell size and X/Y offset for Gridlines, without altering Foundry token snapping, walls, map objects or movement distances.

**Status: v0.1.4 experimental alpha, available through the GitHub-hosted manifest. Not live-tested in Foundry.** This is not an official Foundry package listing or stable release. Install only in a backed-up test world.

**v0.1.4 changes:** Drag the overlay itself to align it, then optionally choose which fine cell starts the major **A1** block. Dragging changes only the previewed X/Y offsets; picking A1 changes only its coordinate origin and where major axes begin. These actions do not change Foundry's native grid or write Scene documents until **Save Grid Setup**.

## First use: drag the grid and choose A1

1. As GM, open a backed-up test world's square-grid Scene. Select **Token Controls → Gridlines: Open Manager** and **Enable on this Scene** if needed.
2. In **Grid Setup — live preview**, click **Drag Grid**. Grab the map and move the overlay until its lines match the map image. The temporary amber **A1** area moves along with it. Release to preview the X/Y offsets.
3. **Optional:** Click **Pick A1 Cell**, then click the *fine cell whose top-left corner should begin major block A1*. Gridlines redraws its major axes and numbering from that cell. For a 10-cell major interval, A1 includes that cell and the next nine fine cells in each direction. This does not change the underlying cell size.
4. Verify the orange A1 marker and the alphabetic/numeric major labels. Click **Save Grid Setup** to persist the position and A1 selection, or **Discard Preview** to revert. Escape exits a placement mode and cancels any drag in progress.
5. If this Scene already has named ranges or shading, back up the world and confirm the warning before saving. Saved fine-cell indices and IDs remain unchanged, but map positions after moving the grid and coordinate addresses after choosing A1 can change.

No Drawing, Tile, Region, token movement, or native Foundry Scene grid update is created by this workflow. `Go To → A1` uses the newly chosen major block after saving; `cell:D3` still resolves the same internal fine cell it did before.

**v0.1.3 changes:** You can draw a 10x10, 5x5 or 1x1 alignment guide over the printed map grid. A horizontal or vertical N-cell line calibrates cell size and that axis; a corner-to-corner N×N square calibrates X and Y together. All guide actions preview until you explicitly save. Adjustable Gridlines overlay offsets, major/minor styling and live color/opacity/width preview remain available.

## Get started: draw a 10x10 guide to align a map

1. In a backed-up test world, install/enable the module. As GM, open a native square-grid Scene and choose **Token Controls → Gridlines: Open Manager → Enable on this Scene**.
2. Expand **Grid Setup — live preview** and click **Draw 10x10 Guide**. If the map has a smaller clear reference, use **Draw 5x5 Guide** or **Draw 1x1 Guide** instead.
3. Drag from one printed grid intersection to another **10 cells away horizontally or vertically**, or drag from one corner of a printed **10×10 cell square** to its opposite corner. The temporary amber guide appears while dragging. Release to calculate the cell pixel size and alignment offsets.
4. Inspect the preview. For a one-axis line, draw another line on the other axis if needed (the last measurement sets the shared square cell size). If the print appears stretched rather than square, correct the map image outside Gridlines; this alpha does not independently stretch X and Y cell dimensions.
5. Click **Save Grid Setup** to store the calculated overlay size/offset, or **Discard Preview** to revert. **Escape** cancels an active guide. If saved named ranges or fills exist, first make a recoverable world backup and explicitly approve moving them.

The guide is a temporary browser SVG overlay—not a Foundry Drawing or object—and will not alter native Scene grid size, snapping, token movement, walls or map content. A guide measurement alone never writes Scene data.

## Get started: adjust the grid without changing Foundry's native grid

1. Open a backed-up **test Scene** and enable Gridlines. As GM, open **Token Controls → Gridlines: Open Manager**.
2. Expand **Grid Setup — live preview**. Leave **Overlay cell size** blank to follow Foundry's native cell pixel size, or enter a custom visual size such as `70` px. Enter **Offset X / Offset Y** to move the overlay over the map in pixels.
3. Major axes default to **10 overlay cells**; minor divisions default to **5** per major interval. Major/Minor widths control stroke thickness in screen pixels.
4. Change **Gridline color** or **Gridline opacity %**; the actual displayed guides redraw immediately. No Scene data is changed until **Save Grid Setup**.
5. Click **Save Grid Setup** to persist settings, or **Discard Preview** to restore the saved view. If saved fills or ranges could move because of a size, offset or coordinate-label change, a recoverable backup and explicit confirmation are required. There is no automatic remapping of saved ranges on overlay-size adjustments.

For newly enabled Scenes, `A1` means the first **major block** (10 × 10 fine cells by default); `B2` means the next major block diagonally. Use `cell:D3` or `cell:D3:F5` in Go To to navigate exact fine cells. Selections and named ranges always retain exact underlying fine-cell coverage. Older v0.1.1 Scenes retain the old fine-cell Go To behavior and major spacing unless you choose **10 / 5 Defaults** and save.

## Get started: shade and name a map location

1. **Back up your Foundry test world first.** Install and enable this module in a **test world**, not your active campaign.
2. Open a Scene that uses a native **square grid**. As GM, choose **Token Controls** (person icon, left) and click **Gridlines: Open Manager** in its tool palette. A separate **Gridlines** Scene Control may also be available.
3. Click **Enable on this Scene**. The overlay follows the native grid size until you set a custom size or offset. Nothing changes Foundry native grid settings.
4. Click **Select Cells on Map** in the manager. Drag across a rectangular selection, such as D3:F5. In the floating Gridlines panel, choose a color and click **Shade Selection**.
5. Enter `Warehouse` under **Named Ranges** and click **Save Name**. Search `Warehouse` under **Go To** to pan to that saved area. New Scenes use major-block addresses (such as `A1`) for ordinary Go To, and `cell:D3` for exact cells. Reload the Scene to check persistence.
6. To leave selection mode, click **Stop Selecting Cells** or close the Gridlines manager. Your normal Foundry controls resume immediately.

### Check what happens when the native Foundry grid changes

1. Keep an independently recoverable backup of the test world.
2. Use Foundry's normal **Scene Configuration** to change the square grid size.
3. Gridlines detects the change on Scene update/reload, preserves its stored definitions, blocks stale navigation/editing, and opens **Gridlines: Alignment Review**.
4. Compare **Keep Cell Addresses** with **Preview Keep Map Locations**. The second option estimates replacement rectangular addresses; it cannot reproduce fractional cell shapes exactly.
5. Confirm a backup before accepting either option. Do **not** proceed if the preview changes a location unexpectedly.

No existing Actor, Tile, Drawing, Region, Wall, Journal, or native Scene grid setting is modified by Gridlines. The module writes only its own `flags.gridlines.state` on a Scene that the GM explicitly enables.

## Current features

- Excel-style coordinates: major blocks by default on new Scenes; exact fine-cell addresses also supported. Existing fine-cell Scene definitions remain compatible.
- GM-only Token Controls launcher plus dedicated Scene Control, **Drag Grid**, **Pick A1 Cell**, **Draw 10x10 / 5x5 / 1x1 Guide** calibration, click-and-drag selection, custom overlay size and X/Y offsets, 10-cell major axes / five minor divisions, and major-axis labels.
- Live-preview controls for line thickness, color and opacity; shading and named ranges saved to Scene flags, navigation to addresses or saved names.
- Native-grid size/type/dimension change detection and guarded alignment resolution.
- Read-only programmatic module API for future Gridlines+ integration (`game.modules.get('gridlines').api`).

## Prototype limitations

- **Foundry v14 is the development target, not a live-verified compatibility claim.** No real Foundry world, multi-client UI, or browser was available for this build. The canvas overlay DOM attachment and Scene Controls activation require a first real smoke test.
- Square native Scenes only; Gridlines can overlay a custom visual size and offset, but hexes, gridless scenes and elevation-aware coordinates are not implemented.
- GM-only authoring and rendering. Player navigation, player broadcast, conditional formatting, triggers, automation, Pro packaging, and private-GM named ranges are **not implemented**.
- Named range names and formatting are stored in **Scene flags, which are not confidential**. Do not put unrevealed plots or private GM secrets into names.
- Stale-revision checks exist but **multi-GM concurrent edits are not atomic**. Use one editing GM at a time.
- No Undo/Redo, rename/delete range, noncontiguous selection, or true per-cell conditional formatting yet. Repeated shading forms ordered visual layers.
- Native Foundry grid-change pixel-preserving remapping approximates coverage to whole cells and is disallowed if Scene dimensions change or grid type changes. Custom Gridlines overlay size/offset changes keep stored fine-cell addresses (and therefore may move the highlighted map location); an explicit backup confirmation is required if existing formatting or ranges are present.
- Calibration and Drag Grid placement rely on Foundry canvas coordinate transforms and a DOM/SVG overlay; live drag/hit-testing on different Foundry v14 clients remains unverified. Pick A1 is valid only on an underlying fine cell, and areas before the selected A1 cannot have positive major-block addresses. The overlay is DOM/SVG on top of the canvas: **fog-of-war occlusion and rendering order are not yet live-tested**. For that reason player rendering is disabled in this build.
- No automatic migration or remap of existing non-Gridlines Scene objects.

## Install for a private test

For the published experimental alpha, in Foundry Setup choose **Add-on Modules → Install Module**, enter `https://raw.githubusercontent.com/rebsiot/gridlines/main/module.json` in **Manifest URL**, and install. Then enable it only in a test world. For a manual ZIP installation:

1. Stop Foundry. Back up the test world (and the existing `Data/modules/gridlines` folder if one exists).
2. Create `Data/modules/gridlines/`, then extract the **contents** of the ZIP into that folder. The ZIP contains `module.json` at its root: the installed path must be `Data/modules/gridlines/module.json` (St. Louis: `Z:\Data\modules\gridlines\module.json`). Avoid any extra nested folder.
3. Restart Foundry, verify version **0.1.4**, enable **Gridlines (Alpha)** in the test world, then refresh the browser.
4. Follow the Warehouse example above. Verify the browser console has no Gridlines errors.

### Rollback

Disable Gridlines in the world and stop Foundry. Restore the prior `Data/modules/gridlines` folder backup or remove the new module folder if it was newly installed. This **does not** remove its Scene flags; they remain inert until a compatible module reads them. To revert saved Scene data to its earlier state, restore the **matching test-world snapshot**. Never manually remove flags in a live world without a verified backup and an explicit decision.

## Test status

Automated Node tests and a module packaging audit accompany this source. See `TESTING.md`. **Live Foundry v14 test: not run.** A GitHub source commit, manifest and versioned ZIP are intended for this public alpha publication; verify publication separately. No official GitHub Release/tag or live Foundry deployment has been created.

## Source and module identity

- Design owner: **G03**, which is not the Foundry module ID.
- Proposed private-test module ID and installation folder: **`gridlines`**. Do not change this ID after real world data is in use without an explicit migration plan.
- Source provenance: built from the inspected `rebsiot/gridlines` v0.1.3 source on `main` at exact commit `eb5437e26f941b31f82589ecc79f165f6a65b4a7`. The installed Foundry version is unverified. This update preserves prior module identity and flags; this build has not been live-tested.
- Branding, licensing, and paid distribution remain the responsibility of the separate AFT conversation. **No explicit open-source redistribution license has been granted by this repository.** A public GitHub source does not imply permission to repackage or resell.
