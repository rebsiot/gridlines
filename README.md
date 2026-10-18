# AFT Gridlines+ (Experimental Alpha)

A Foundry VTT overlay for GMs to align coordinate grids, mark map cells, and optionally share the grid and individual shaded areas with players. Players receive a read-only visual overlay; editing remains GM-only. The overlay can use rectangular cells, independently of Foundry's **square movement and snapping grid**. No Tiles, Drawings or Regions are created for grid cells.

**Version 0.1.12 — 2026-10-18.** Developed for Foundry V14; live Foundry v14 installation and two-client tests **have not been verified**. Use a backed-up **test world**, not an active campaign.

## First use: align a printed A/B/C, 1/2/3 map

1. Install/upgrade through **Foundry Setup → Add-on Modules** using the [Gridlines+ manifest](https://raw.githubusercontent.com/rebsiot/gridlines/main/module.json). Enable **AFT Gridlines+** in **Manage Modules** inside your test world and refresh your browser.
2. As GM, open a square-grid Scene. Click **Token Controls → AFT Gridlines+: Open Manager → Enable on this Scene** (if needed). The new floating manager has a **title bar to drag**, a **bottom-right resize handle**, and **Reset** to restore its position and size. All layout preferences stay in your own browser, not in Scene flags.
3. Open the **Map** tab. Under **Grid visibility**, click **Hide Foundry Grid** to see only the Gridlines+ overlay while aligning it. This is temporary, local to your browser, and **does not change native snapping**. Closing the manager restores Foundry's grid visibility.
4. Open the **Grid Setup** tab. Use **Drag Grid**, **Pick A1 Cell**, or the **10x10 / 5x5 / 1x1** guide. Optionally unlink **Cell Width / Cell Height** for rectangular overlay cells, and adjust X/Y offset. Preview changes before saving.
5. Set **Major columns: every N fine cells** (default 10), **Major rows: every N fine cells** (default 10), and their separate minor-division intervals (default 5 each). The major map coordinates should read **A, B, C** and **1, 2, 3**, not the underlying fine-cell references A, K, U and 1, 11, 21. Set **Axis coordinate numbering → Major blocks** if this is a legacy Scene.
6. If the overlay shows fewer lines than the fine-cell count, **First major block: fine-cell ruler → Automatic** identifies subcells: **1–10** across the first block when major columns are labeled **A, B, C**; **A–J** across when a legacy fine-column scheme labels major boundaries **A, K, U**. Row subcells use 1–10. This ruler is a *reference*, not an additional grid.
7. Under **Coordinate label fonts**, independently set column letters, row numbers, and subcell ruler font sizes/colors (7–48 px). Set **Column letters placement → Top / Bottom / Top and Bottom / Off** and **Row numbers placement → Left / Right / Left and Right / Off**. This label placement follows the visible viewport and is shared with players whenever the coordinate grid is published. Changes preview live and outlined letters remain readable against light/dark artwork.
8. Back on the **Map** tab, under **Select on map**, choose **Major map blocks** (default on new Scenes) or **Fine subcells**. A single click inside major block `G14` selects the **whole G14 region**, not a hidden fine cell. For a single fine cell inside G14, use `G14.3,4` (third subcolumn, fourth subrow); `G14.C4` also works. **Left-drag selects and right-drag pans** the native Foundry canvas.
9. Open the **Map Areas** tab. Names and shading that occupy exactly the same saved cells appear together. Click **Locate** to pan and flash the whole area, or **Select** to outline it. You can **Add Name**, **Rename**, or **Remove Name**, and **Shade Area** if the area has no shading. Each shading layer has its own **Configure**, **Player Visible**, **To Region** and **Remove Shading** controls. Removing a name preserves shading; removing shading preserves names. Map Areas stays expanded while any named or shaded area remains unless you collapse it yourself. **Clear Shading in Selection** and **Clear All Shading** still preserve names.
10. On the **Map** tab under **Player visibility (GM-controlled)**, choose **Show Coordinate Grid to Players** to publish the coordinate grid on this Scene. In **Map Areas**, each layer has its own **Player Visible: Off/On** switch. All existing layers are hidden from players until you explicitly publish them. Grid sharing and shading sharing are independent: you can share the grid alone, shading alone, or both. The player gets no manager or edit tools. Changes propagate through Scene updates, without creating Region, Tile, or Drawing objects.
11. To make a native Foundry Region from a fill, click **To Region**. A purple border previews the proposed Region. Review its pixel bounds, acknowledge the recoverable Scene backup, and click **Create Region** followed by confirmation. You can **Preview All as Regions** in batches of up to 30 to create several. Existing Regions and Gridlines+ shading remain untouched.
12. Select **Save Grid Setup** to commit overlay settings, or **Discard Preview** to restore them. If existing ranges or shading could be affected, first make a recoverable backup and acknowledge the warning.


### Named and shaded Map Areas (v0.1.11)

Use **Map Areas** to manage the same saved map location as a named range, a shading layer, or both. Matching exact saved rectangles share one on-screen group. Partially overlapping rectangles remain separate to avoid silently changing coverage or identifiers. The **Name Selected Area** input above the list still saves a named range for your temporary selection. From any existing group, **Add Name** creates an additional named-range alias; **Rename** keeps that name's saved ID; **Remove Name** asks for confirmation and does not delete shading or native Regions. **Shade Area** adds a new GM-only shade to a name-only area. Each shading record retains its independent **Player Visible**, **Configure**, **To Region** and **Remove Shading** controls.

The light-blue selection rectangle is **temporary**: click **Clear Selection**, **Stop Selecting Cells**, switch Foundry's tool, or close the manager to remove it. Closing also stops any Locate flash; none of those actions removes saved shading or names. Scene changes/teardown also clear temporary selection. Use the area's **Select** button when you want to reselect a saved location later.

Saved records remain under the existing two Scene-flag arrays (`namedRanges` and `formats`) with their original IDs and exact fine-cell bounds. There is **no data migration**, bulk import, automatic Region conversion, or change to Foundry's movement grid. Player-visible shading is still per-layer, not inherited from the name of a grouped area. Named-range labels are not projected into the player overlay, and raw Scene flags are not a secure GM-secret store.

### Share Gridlines+ with players (v0.1.10)

The GM can turn on **Show Coordinate Grid to Players** after enabling Gridlines+ for the Scene. This displays its saved major/minor overlay and saved coordinate labels on player canvases, and updates after GM edits/reloads. Independently turn **Player Visible: On** on any shading layer in **Map Areas** to publish that one shaded area. Existing and newly created layers default to **GM Only**, including pre-0.1.10 data. **Hiding the coordinate grid does not hide independently published shading**, and sharing the coordinate grid does **not** expose unshared shading or named-range labels through the overlay. The native Foundry movement grid remains unchanged.

- **GM only:** The manager, Scene Controls, selection/placement, shading configuration, native Region conversion and all Scene writes remain GM-only. Players receive a pointer-transparent SVG overlay with no controls.
- **Coordinate labels:** Columns can be at **Top / Bottom / Both / Off** and row numbers at **Left / Right / Both / Off**. Existing Scenes keep top columns and left rows automatically. Font sizes and colors remain independent.
- **Visibility and privacy:** This is an HTML/SVG overlay **above the Foundry canvas, not integrated with Fog Exploration, darkness, token sight, or vision masks**. Any published grid/shading can be seen even over unrevealed areas. Do not publish markers or coloring intended to be concealed by fog. This is **not** a player-visible secret-data security boundary: Foundry Scene flags may be readable by connected clients even when our player renderer filters named ranges and unshared layers. Do not put GM-secret notes or labels in Gridlines+ Scene flags.
- **Cross-client verification pending:** Mock tests confirm opt-in projection, display-label positioning, player-read-only controls, saved flag behavior and update hooks. A GM and player must test live visibility, fog layering, Scene updates and the native canvas before using it during a session.

### Optional native Region conversion — even when grids do not align

Gridlines+ and Foundry's movement grid are independent. **A shaded rectangle can become a native Foundry Region even when Gridlines+ uses different cell dimensions or X/Y offset**. Conversion reads the shaded range's saved cell bounds through Gridlines+' overlay resolver and translates them to an axis-aligned native **rectangle shape in Scene pixel coordinates**. There is **no snapping to the Foundry movement grid**. Partial areas at the edge of the Scene are clipped rather than expanded onto the native grid. The stored rectangle coordinates are rounded to 0.001 pixel to avoid arithmetic noise.

- **Area-level Locate and Select** and per-shading **Configure, Player Visible, To Region and Remove Shading** are found under the persistent **Map Areas** accordion. Optional shading labels help distinguish overlapping fills. Select does not change saved shading until you explicitly perform an edit.
- **Region preview is non-destructive.** A purple outline appears on the Scene. It requires a backup acknowledgment and a separate GM confirmation before a native Region is created. **Cancel Region Preview** creates nothing. Batch conversion uses no more than 30 shading layers at once; remaining ones can be previewed after the first batch.
- One Region is created per selected shading layer (including independently saved fragments), with one native rectangle shape each, color taken from the saved fill and **no Region behaviors or restrictions**. It does **not** combine overlapping layers into a single polygon or reproduce the exact Gridlines+ fill opacity. A native Region may appear differently from a shaded overlay; configure its visibility and behaviors separately in the native Region interface.
- Existing Region documents are never overwritten or deleted. Original shading and named ranges are not removed. Created Regions have `flags.gridlines.sourceKind`, `sourceSceneId`, and `shadeLayerId` metadata; an existing generated Region for that same shading layer prevents accidental duplication. Creating a Region is an explicit persistent Scene change that is **not undone by uninstalling the module**. Delete only that Region in Foundry if necessary, or restore the Scene backup.
- **No automatic synchronization** is established. If you move Gridlines+' origin, resize its cells, edit a shading layer, or delete the source shading later, any Region already created stays at its original location. Review and adjust Regions manually if alignment changes.

**Foundry API modeled:** v14 Region shapes accept rectangular pixel geometry and Scene embedded Region documents. Code and local Node mock tests cover the create/confirm lifecycle and mismatched grids; the actual v14 canvas rendering, permissions and native Region creation still need an in-world GM test before relying on this feature in a live campaign.

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

### Map references, subcells and named ranges

**The visible coordinate is authoritative for new selections.** With 10 underlying fine cells across and down, `G14` means all 100 fine cells inside the major map square labeled G14. Shading and naming `G14` should cover the whole displayed square. In **Fine subcells** mode, `G14.3,4` means fine column 3, fine row 4 **relative to G14**, not absolute internal C4. `G14.C4` is an accepted alphabetic alias; explicit `cell:C4` remains a legacy absolute fine-cell reference. Go To and the selected-range summary use these visible coordinates, and named range listings show the same coordinate system.

You can select multiple major blocks or multiple subcells; an entire major block formats as `G14`, while a partial range shows its fine endpoints (for example `G14.2,3:G14.4,5`). The first-block ruler uses numbers across the top in major A/B/C mode, and letters A–J across in legacy A/K/U mode.

**Previously saved named ranges, fills, and IDs are not migrated or enlarged automatically.** If an older `Warehouse` was saved as a fine-cell rectangle rather than a whole major block, its stored shape is preserved; the manager labels the actual saved extent. Reselect and save a *new* whole-block range if needed rather than overwriting the existing record.

- Ordinary map labels are major blocks: `A1`, `B2`, etc. The column and row major intervals can differ, for example a 10-cell-wide × 8-cell-high map block.
- A major `B2` covers its entire visible rectangle. `B2.1,1` and `B2.A1` both refer to its first underlying fine cell. `cell:D3` remains available in **Go To** for existing absolute fine-cell indices; no stored flags are renumbered.
- **Pick First Major Column** and **Pick First Major Row** each change one origin component without altering the other. **Pick A1 Cell** changes both.
- Previously saved `majorEvery` / `minorDivisions` fields are still read and assigned to both axes when the new independent values are missing. Legacy Scenes with explicit fine-cell coordinate mode keep it until the GM chooses **Major blocks** and saves.
- Named ranges and formatting IDs are preserved. Changes to grid size, origin, or major numbering can change the physical coverage or visible coordinate names of those saved indices; no automatic remapping takes place during Grid Setup.

## Floating manager window (v0.1.12)

The manager is organized into three workspaces:

- **Map:** Go To coordinates/names; select cells; local grid visibility; publish the coordinate overlay to players.
- **Map Areas:** shade/name the selected block; Locate, Select, Configure, Player Visible, remove or convert existing map areas to Regions.
- **Grid Setup:** drag/align the overlay, match the native grid safely, adjust cell geometry/axes and label appearance. Less-used matching, guide and font controls are collapsed until opened. **Save Grid Setup** and **Discard Preview** remain available while scrolling this tab.

Drag the **AFT Gridlines+** title bar to move the window; drag its **bottom-right grip** to resize. **Reset** restores a safe centered-right default. Keyboard users can focus the title/grip and use arrow keys (20 px steps). The manager remembers its position and size on this browser using `gridlines.manager.layout.v1` in localStorage and re-clamps it when the viewport changes. This is a **per-browser UI preference only**, not a Scene change or migration. Closing the manager still clears temporary selections/previews and restores local native-grid visibility.

## Installation and updates

- Manifest: `https://raw.githubusercontent.com/rebsiot/gridlines/main/module.json`
- Manual installation: extract the full ZIP so `Data/modules/gridlines/module.json` is at the root. Stop the Foundry server before replacing module files manually. Restart, enable it in the world, and refresh the browser.
- Technical module ID remains **`gridlines`**. Repository remains [rebsiot/gridlines](https://github.com/rebsiot/gridlines). Scene data remains `flags.gridlines.state` with schema version 1.
- The manager and authoring controls are GM-only. Players can receive the read-only grid and explicitly shared shading, but never the manager. Native Regions created through the separate optional conversion follow Foundry's own Region permissions and visibility. **Scene flags are not secret:** do not place sensitive GM-only information in named ranges.
- No claimed live Foundry compatibility beyond the v14 development target. Hex and gridless modes, fog-aware compositing, undo/redo, conditional formatting, and automation remain outside this prototype.

## Backup and rollback

Before updating, save a **recoverable backup of the test world** (including Scene flags) and, for manual installs, the previous `Data/modules/gridlines` folder. Previous complete ZIPs, including v0.1.11, are retained on GitHub for code rollback.

To roll back, disable the module, stop the server if manually replacing files, restore the previous ZIP/module directory, restart and refresh. **Restoring code alone does not reverse Scene edits.** If you clear shading, reverting only the module will **not restore deleted shading**. Likewise, new Foundry Regions created with 0.1.9 remain until explicitly deleted in Foundry or recovered from a world snapshot. Recover that Scene from its world backup. Older code will ignore the new label font preferences and may show coordinates differently; code rollback alone does not undo saved geometry or coordinate settings. Native Foundry grid-size changes likewise require restoring the world snapshot, not just module code.

## Tests, support and status

The accompanying `TESTING.md` distinguishes local mocks from live workflow verification. No live Foundry v14 Canvas test, multi-GM conflict test or two-client privacy test is claimed. Bug reports: [GitHub Issues](https://github.com/rebsiot/gridlines/issues). Version history: [CHANGELOG.md](CHANGELOG.md).

A public repository does not grant an open-source redistribution license; no separate software license has been approved. The repository contains no campaign-world export, paid creator artwork or account credentials.
