# Gridlines - Experimental Alpha

Gridlines helps a GM identify, shade, and name map cells without adding Tiles, Drawings, or Regions. It uses **Foundry's existing square Scene grid**, and does not resize or calibrate that grid itself.

**Status: v0.1.0 experimental alpha, available through the GitHub-hosted manifest. Not live-tested in Foundry.** This is not an official Foundry package listing or stable release. Install only in a backed-up test world.

## Get started: shade and name a map location

1. **Back up your Foundry test world first.** Install and enable this module in a **test world**, not your active campaign.
2. Open a Scene that uses a native **square grid**. On Foundry's left-hand Scene Controls, choose **Gridlines**, then **Gridlines Manager**.
3. Click **Enable on this Scene**. The overlay lines use your existing native grid; no native Scene grid setting is changed.
4. Activate **Select Cells**. Drag across a rectangular selection, such as D3:F5. In the floating Gridlines panel, choose a color and click **Shade Selection**.
5. Enter `Warehouse` under **Named Ranges** and click **Save Name**. Search `Warehouse` under **Go To** to pan to that area. Reload the Scene to check persistence.
6. To leave selection mode, switch back to Foundry's native Tokens control.

### Check what happens when the native Foundry grid changes

1. Keep an independently recoverable backup of the test world.
2. Use Foundry's normal **Scene Configuration** to change the square grid size.
3. Gridlines detects the change on Scene update/reload, preserves its stored definitions, blocks stale navigation/editing, and opens **Gridlines: Alignment Review**.
4. Compare **Keep Cell Addresses** with **Preview Keep Map Locations**. The second option estimates replacement rectangular addresses; it cannot reproduce fractional cell shapes exactly.
5. Confirm a backup before accepting either option. Do **not** proceed if the preview changes a location unexpectedly.

No existing Actor, Tile, Drawing, Region, Wall, Journal, or native Scene grid setting is modified by Gridlines. The module writes only its own `flags.gridlines.state` on a Scene that the GM explicitly enables.

## Current features

- Excel-style square-cell addresses: A1, D7, Z1, AA1, rectangular ranges.
- GM-only Scene Controls entry, click-and-drag selection, custom major/minor line overlay and coordinate labels.
- Shading and named ranges saved to Scene flags, navigation to addresses or saved names.
- Native-grid size/type/dimension change detection and guarded alignment resolution.
- Read-only programmatic module API for future Gridlines+ integration (`game.modules.get('gridlines').api`).

## Prototype limitations

- **Foundry v14 is the development target, not a live-verified compatibility claim.** No real Foundry world, multi-client UI, or browser was available for this build. The canvas overlay DOM attachment and Scene Controls activation require a first real smoke test.
- Square native grids only; custom independent overlays, hexes, gridless scenes and elevation-aware coordinates are not implemented.
- GM-only authoring and rendering. Player navigation, player broadcast, conditional formatting, triggers, automation, Pro packaging, and private-GM named ranges are **not implemented**.
- Named range names and formatting are stored in **Scene flags, which are not confidential**. Do not put unrevealed plots or private GM secrets into names.
- Stale-revision checks exist but **multi-GM concurrent edits are not atomic**. Use one editing GM at a time.
- No Undo/Redo, rename/delete range, noncontiguous selection, or true per-cell conditional formatting yet. Repeated shading forms ordered visual layers.
- Pixel-preserving remapping approximates coverage to whole cells and is disallowed if Scene dimensions change or the grid type changes.
- The overlay is DOM/SVG on top of the canvas: **fog-of-war occlusion and rendering order are not yet live-tested**. For that reason player rendering is disabled in this build.
- No automatic migration or remap of existing non-Gridlines Scene objects.

## Install for a private test

For the published experimental alpha, in Foundry Setup choose **Add-on Modules → Install Module**, enter `https://raw.githubusercontent.com/rebsiot/gridlines/main/module.json` in **Manifest URL**, and install. Then enable it only in a test world. For a manual ZIP installation:

1. Stop Foundry. Back up the test world (and the existing `Data/modules/gridlines` folder if one exists).
2. Extract the ZIP so that `Data/modules/gridlines/module.json` exists directly, not in an additional nested folder. In the St. Louis environment, `Z:\Data\modules\gridlines\module.json` is the target.
3. Restart Foundry, enable **Gridlines (Private Prototype)** in the test world, then refresh the browser.
4. Follow the Warehouse example above. Verify the browser console has no Gridlines errors.

### Rollback

Disable Gridlines in the world and stop Foundry. Restore the prior `Data/modules/gridlines` folder backup or remove the new module folder if it was newly installed. This **does not** remove its Scene flags; they remain inert until a compatible module reads them. To revert saved Scene data to its earlier state, restore the **matching test-world snapshot**. Never manually remove flags in a live world without a verified backup and an explicit decision.

## Test status

Automated Node tests and a module packaging audit accompany this source. See `TESTING.md`. **Live Foundry v14 test: not run.** A GitHub source commit, manifest and versioned ZIP are intended for this public alpha publication; verify publication separately. No official GitHub Release/tag or live Foundry deployment has been created.

## Source and module identity

- Design owner: **G03**, which is not the Foundry module ID.
- Proposed private-test module ID and installation folder: **`gridlines`**. Do not change this ID after real world data is in use without an explicit migration plan.
- Source provenance: new local implementation against the previously verified empty `rebsiot/gridlines` repository. No existing working ZIP/commit was replaced.
- Branding, licensing, and paid distribution remain the responsibility of the separate AFT conversation. **No explicit open-source redistribution license has been granted by this repository.** A public GitHub source does not imply permission to repackage or resell.
