# AFT Gridlines+ (Experimental Alpha)

A GM-focused Foundry VTT module for aligning a configurable grid overlay to printed map coordinates, finding named locations and shading selected cells. The overlay can use rectangular cells, independently of Foundry's **square movement and snapping grid**. No Tiles, Drawings or Regions are created for grid cells.

**Version 0.1.7 — 2026-10-18.** Developed for Foundry V14; live Foundry v14 installation and two-client tests **have not been verified**. Use a backed-up **test world**, not an active campaign.

## First use: align a printed A/B/C, 1/2/3 map

1. Install/upgrade through **Foundry Setup → Add-on Modules** using the [Gridlines+ manifest](https://raw.githubusercontent.com/rebsiot/gridlines/main/module.json). Enable **AFT Gridlines+** in **Manage Modules** inside your test world and refresh your browser.
2. As GM, open a square-grid Scene. Click **Token Controls → AFT Gridlines+: Open Manager → Enable on this Scene** (if not already enabled).
3. Under **Grid visibility**, click **Hide Foundry Grid** to see only the Gridlines+ overlay while aligning it. This is temporary, local to your browser, and **does not change native snapping**. Closing the manager restores Foundry's grid visibility.
4. Under **Grid Setup**, use **Drag Grid**, **Pick A1 Cell**, or the **10x10 / 5x5 / 1x1** guide. Optionally unlink **Cell Width / Cell Height** for rectangular overlay cells, and adjust X/Y offset. Preview changes before saving.
5. Set **Major columns: every N fine cells** (default 10), **Major rows: every N fine cells** (default 10), and their separate minor-division intervals (default 5 each). The major map coordinates should read **A, B, C** and **1, 2, 3**, not the underlying fine-cell references A, K, U and 1, 11, 21. Set **Axis coordinate numbering → Major blocks** if this is a legacy Scene.
6. If some underlying fine cells are not shown as gridlines, **First major block: fine-cell ruler → Automatic** reveals a small A–J / 1–10 guide inside the first major block. Those letters label *ten cells*; eleven boundary positions would be A–K.
7. Click **Save Grid Setup** to commit overlay settings, or **Discard Preview** to restore them. If existing named ranges or shading could be affected, first make a recoverable backup and acknowledge the warning.

### Match native Foundry and Gridlines+ geometry

| Action | What it does | Does it modify a native Foundry Scene? |
|---|---|---|
| **Show/Hide Foundry Grid** | Temporarily hides/restores the native grid mesh on this GM's browser; snapping stays enabled | **No** |
| **Show/Hide Gridlines+** | Temporarily hides/restores the module's overlay | **No** |
| **Match Gridlines+ to Foundry** | Previews Foundry's native square cell size and zero X/Y offset in the Gridlines+ overlay; retains major axis counts, A1, and existing saved ranges | Only after **Save Grid Setup**, and only its own Scene flag |
| **Match Foundry to Gridlines+** | Previews a native **grid-size-only** update; supports square, integral, zero-offset overlay cells | **Yes, only after backup acknowledgment and a separate confirmation dialog** |
| **Open Foundry Scene Configuration** | Opens Foundry's native Scene settings for any unsupported grid alignment | Only if you explicitly save within Foundry |

**Native limitations:** Foundry's grid is square. A Gridlines+ 120×80 rectangle cannot become the native movement grid, and an independently offset overlay cannot be copied exactly into the native grid. **Match Foundry to Gridlines+** refuses both cases and never silently shifts the background image. Use the separate Gridlines+ overlay or Foundry's built-in Grid Configuration for incompatible scenes. Do not assume the two grids snap identically unless they were actually aligned.

**Changing Foundry's native grid is a real Scene update.** It can affect existing token/wall/tile/light alignment. This is a GM-only action with a readable before/after preview, a recoverable-backup checkbox, and a separate confirmation. Gridlines+ then requires its native-grid **Alignment Review**; saved locations and fine-cell IDs remain unchanged until the GM deliberately confirms a recovery choice. No automatic document movement or mass import occurs.

### Fine-cell references and named ranges

- Ordinary map labels are major blocks: `A1`, `B2`, etc. The column and row major intervals can differ, for example a 10-cell-wide × 8-cell-high map block.
- A major `B2` can cover many fine cells. Use `cell:D3` or `cell:D3:F5` in **Go To** for exact saved fine-cell references. Shading and named ranges continue to use those internal indices.
- **Pick First Major Column** and **Pick First Major Row** each change one origin component without altering the other. **Pick A1 Cell** changes both.
- Previously saved `majorEvery` / `minorDivisions` fields are still read and assigned to both axes when the new independent values are missing. Legacy Scenes with explicit fine-cell coordinate mode keep it until the GM chooses **Major blocks** and saves.
- Named ranges and formatting IDs are preserved. Changes to grid size, origin, or major numbering can change the physical coverage or visible coordinate names of those saved indices; no automatic remapping takes place during Grid Setup.

## Installation and updates

- Manifest: `https://raw.githubusercontent.com/rebsiot/gridlines/main/module.json`
- Manual installation: extract the full ZIP so `Data/modules/gridlines/module.json` is at the root. Stop the Foundry server before replacing module files manually. Restart, enable it in the world, and refresh the browser.
- Technical module ID remains **`gridlines`**. Repository remains [rebsiot/gridlines](https://github.com/rebsiot/gridlines). Scene data remains `flags.gridlines.state` with schema version 1.
- This build is GM-only. Players cannot access the Gridlines+ overlay or location manager. **Scene flags are not secret:** do not place sensitive GM-only information in named ranges.
- No claimed live Foundry compatibility beyond the v14 development target. Hex and gridless modes, player visibility, fog-aware compositing, undo/redo, conditional formatting, and automation remain outside this prototype.

## Backup and rollback

Before updating, save a **recoverable backup of the test world** (including Scene flags) and, for manual installs, the previous `Data/modules/gridlines` folder. Versions 0.1.6 and earlier are retained on GitHub for code rollback.

To roll back, disable the module, stop the server if manually replacing files, restore the previous ZIP/module directory, restart and refresh. **Restoring code alone does not reverse Scene edits.** If you saved new independent major-axis settings in 0.1.7, older releases may not display the same axes; use the matching world snapshot to restore earlier Scene settings when necessary. Native Foundry grid-size changes likewise require restoring the world snapshot, not just module code.

## Tests, support and status

The accompanying `TESTING.md` distinguishes local mocks from live workflow verification. No live Foundry v14 Canvas test, multi-GM conflict test or two-client privacy test is claimed. Bug reports: [GitHub Issues](https://github.com/rebsiot/gridlines/issues). Version history: [CHANGELOG.md](CHANGELOG.md).

A public repository does not grant an open-source redistribution license; no separate software license has been approved. The repository contains no campaign-world export, paid creator artwork or account credentials.
