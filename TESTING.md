# AFT Gridlines+ v0.1.11 — combined Map Areas and transient selection regression report

**Date:** 2026-10-18. **Component:** G03 (`gridlines`) / AFT Gridlines+. **Verified source baseline:** v0.1.10, repository `rebsiot/gridlines` main commit `e76923f73b0b8b04fad274b911c7ac4633a5fead`, checked against the complete local v0.1.10 source. **Installed module and exact live Foundry build:** Unknown.

**Implemented:** A read-only grouping of the existing `namedRanges` and `formats` arrays by identical normalized fine-cell bounds, shown in a single Map Areas accordion. Existing unequal or overlapping areas stay separate. Every saved name retains its ID through Rename; Remove Name is separately confirmed and deletes only that named-range record. A name-only area can receive GM-only shading; shading removal/configuration/player-visibility and native Region preview/conversion remain independent. No state schema change or migration.

**Transient-selection fix:** `Stop Selecting Cells` and deactivating Foundry's Gridlines control clear the selected rectangle and panel state. Closing the manager clears selection plus any Locate flash; canvas teardown also clears transient selection. Added a visible Clear Selection button. None of these actions writes Scene flags or removes permanent shading, labels, named ranges, or Regions.

**Automated/mock evidence:** `npm test` — **90 passed, 0 failed**. Includes the previous suite updated for the Map Areas presentation plus new tests of exact-boundary grouping, unmodified source flags, rename/duplicate checks, independent name removal, GM-only shading creation, accordion persistence, cancel-delete no-write, player data projection, stopping selection, manager close/reopen and canvas detach/reconnect. `node --check scripts/*.js tests/*.test.mjs` completed. ZIP integrity, manifest-at-root, no nested module folder, file equality and GitHub artifact checksum to be audited as part of release publication.

**Confirmed live:** No v0.1.11 Foundry v14 or two-client test. This is an experimental alpha. No native Scene writes were performed on the user's installed server by this build process.

**GM smoke test (pending):** Back up a disposable Foundry world and `Data/modules/gridlines`; update to 0.1.11 and hard-refresh. Create a saved name and shading covering the same cells; confirm one Map Areas row and Locate/Select. Rename the name, confirm its shading and Go To remain. Add a name to another shaded area, and Shade Area on a name-only location; confirm the new shade is GM Only. Cancel a Remove Name dialog before trying one in the test Scene. Select cells with left drag, Stop Selecting Cells, and confirm the blue rectangle disappears. Repeat after closing the manager and after switching Foundry tools/Scenes; right-drag should still pan. With a separate player client, confirm shared shading behavior and that no name labels appear. Native Regions should still be present and unchanged.

**Upgrade:** Existing manifest `https://raw.githubusercontent.com/rebsiot/gridlines/main/module.json`, same module ID. Preserve complete ZIP and Scene/world backup. No automatic Scene-data writes or migrations on install; edits continue to require GM actions. **Rollback:** Restore the prior v0.1.10 ZIP (kept under `dist` in GitHub) and reload clients. Code-only rollback cannot restore a name/shading that the GM explicitly deleted, nor remove native Regions created in any version; restore a matching world backup if needed.

**Shared document synchronization:** G03 owner release record and historical inventory `103` need to reflect the verified 0.1.11 package and mock-only status. The Scene-flag data contract in `100` remains unchanged (`namedRanges` and `formats` arrays; optional visibility flags). Release procedure `101` unchanged; no adjacent module code contracts affected.

---

# AFT Gridlines+ v0.1.10 — GM/player sharing and label placement

**Component:** G03 / module ID `gridlines`. **Working source:** verified GitHub commit `b35d1ff3de05897fabbff1ac1b6a25cc08942a78` (v0.1.9) and the matching local complete ZIP. **Installed Foundry v14 build:** not inspected; the latest live player experience remains unverified.

**New tests:** `tests/player-visibility-v020.test.mjs` exercises legacy GM-only visibility defaults, per-shading publication independent of grid publication, public renderer filtering, player canvas non-interactivity and GM edit enforcement, label placement on both edges, live preview without writes, persistence and validation. Prior suite must stay green.

**Release test commands:** `npm test`, `node --check` for JS scripts/tests, manifest validation, ZIP CRC audit, full package source-to-ZIP hash comparison, verified GitHub tree and manifest/download path. Passing mocks/ZIP packaging do **not** count as Foundry live tests.

**Required GM/player smoke test on backed-up test Scene:** GM enables the Scene and publishes coordinate grid. Have a second logged-in player view the same active Scene and verify major/minor lines and top/bottom labels while panning/zooming. Confirm player cannot open the manager or select/shade; verify native token snapping remains unchanged. Hide the grid: player sees no coordinate lines. Publish one shaded layer only; player sees that layer but not a second unpublished layer or named-range outlines, including after a full browser refresh. Unshare and confirm it disappears. Test column bottom/both and row right/both, and light/dark backgrounds. **Fog warning:** verify that shared overlays are not fog-masked; do not use them for secret markers.

**Rollback:** keep `gridlines` ID; backup `Data/modules/gridlines` and the world snapshot. Restore the previous v0.1.9 ZIP and reload the world. Persistent `playerGridVisible` and `formats[].playerVisible` flags are ignored by v0.1.9 but remain saved; reverting code alone does not undo the GM's visibility decisions. Restore the matching world snapshot or turn sharing off before downgrade if necessary. No automatic migrations, imports or Region creation in this release.

**Documentation sync:** G03 handoff/latest release record and shared inventory 103 need status/version updates; 100 should note the new optional per-Scene player visibility fields and the non-fog-masked rendering limitation. No adjacent component's API changed. **Live Foundry evidence remains pending**.

---

# AFT Gridlines+ v0.1.9 — release test and safety record

**Date:** 2026-10-18. **Owner:** G03. **Module:** `gridlines`; display title `AFT Gridlines+`. **Source baseline:** tested local v0.1.8 ZIP matching GitHub blob SHA `8aca834f94d8fc8c20ad0fc65c2115cff5a30568` on `rebsiot/gridlines` commit `ef797d72e867d6154eb710830ab08f9e19dd1ec2`. Actual installed module and Foundry v14 patch build are not available to this development session.

## Implemented scope and automated/mock evidence

- Added Locate with animated camera pan and transient yellow SVG rectangle (no Scene writes). Select chooses the exact saved fine-cell rectangle, without permanently changing shading. Configure edits optional layer label/fill/opacity through revision-checked Scene flag updates and retains all IDs, bounds, and named ranges.
- Shading Layers `details` section holds client-local expanded/collapsed state through `render` rebuilds, preserving scroll position. A GM can close it manually; the section closes automatically only when no layers remain. No new persistent panel-layout flag is introduced.
- Region conversion is opt-in, non-destructive, per-layer or in batches of at most 30. Preview builds pixel-accurate, scene-clipped native rectangle data independently of Foundry's square snapping grid. The GM sees purple outlines, a bounding-box summary, backup acknowledgment and a separate confirmation dialog. Creation calls native `scene.createEmbeddedDocuments("Region", data)`; these are genuine new Regions, not faux-grid per-cell objects.
- New native Regions contain one rectangle, no behaviors, saved fill color, and `flags.gridlines` provenance. The original fill data remains; other Regions and named ranges remain untouched. Duplicate conversion is blocked when a previously generated Region still exists. Preview rejects stale Gridlines+ revisions or geometry, out-of-scene shapes and duplicate IDs.
- `npm test` automated/mock suite: **67 passed**, zero failed. This includes the original 56 v0.1.8 tests plus 11 new Region-management, metadata, exact geometry, duplicate protection, revision guard, accordion, editing, pan/flash, preview/batch/cancel and persisted-creation tests. `node --check` was run on scripts and tests. The full ZIP was integrity-checked with `module.json` at root and source-byte equality checked against the test directory.

**Live Foundry v14:** NOT RUN. Region rectangle validation/rendering, live permission enforcement, menu interactions, panning, Region legend appearance and multi-client behavior still require user confirmation. The Node DOM mocks do not validate native canvas placement.

## First live smoke test

1. Back up a test world/Scene and the installed Gridlines+ module. Update using the unchanged manifest, confirm **v0.1.9** in Add-on Modules, enable in world, hard-refresh.
2. Open the manager on a square-grid Scene with two saved shaded rectangles. Expand **Shading layers**, click **Locate** on the first: a yellow outline should flash and the camera center on that fill. **Select** should outline exactly its saved rectangle; **Configure** should allow a label and color/opacity change, and Cancel should leave it unchanged. Shading Layers should stay expanded after each action.
3. Click **To Region** for a layer. Check the purple outline and pixel bounds. **Cancel Region Preview**; confirm there is no new native Region. Repeat, acknowledge the backup and confirm **Create 1 Region**. Inspect Foundry's Region legend: one genuine Region should appear in the same place, with no behaviors. Original shading should still be present. A duplicate **To Region** should be blocked.
4. For a deliberately unaligned rectangular Gridlines+ overlay (for example 120×80px with nonzero X/Y offsets), create a second Region and compare its corners to the purple preview rather than snapping to native 100px grid edges. Inspect with native Region tool.
5. Remove one remaining shaded layer and verify Shading Layers stays expanded. Remove the last layer and verify it closes. Confirm previously created native Regions persist after removing source shading, and existing named ranges remain unchanged. Do this in a disposable test Scene; deleting new Region data is not handled by rolling back the module ZIP.

## Install and rollback

No external modules required. Native Foundry v14 is targeted; hex/gridless unsupported. Back up world Scene data before edits. Upgrading the code leaves the module ID and old `flags.gridlines.state` schema 1 unchanged. A newly configured optional fill label is harmless to older versions, but v0.1.8 will not display that label or provide Region conversion. Restore v0.1.8 ZIP to roll back code; to undo saved shading edits or created Region documents, delete only the specific created Regions using Foundry's native controls or restore the matched world snapshot. No automatic deletion or mass change is performed.

## Shared-document sync

G03 release record should record the new `flags.gridlines` Region provenance contract, without changing the original `flags.gridlines.state` schema. `100-GLOBAL-ARCHITECTURE-DATA-CONTRACTS.md` may note the optional Region provenance fields if future modules consume them; `103-CROSS-PROJECT-MODULE-INVENTORY.md` must be updated from its historical G03 concept-stage entry with exact release and mock-only status. `101` and adjacent component owners do not require code changes.

---

# AFT Gridlines+ v0.1.8 — Test and deployment record

**Owner:** G03 · module ID `gridlines`. **Verified source baseline:** GitHub `rebsiot/gridlines` `main` at `4d278c9475b6d288b18f836c103f4afa1f4e08c7` (v0.1.7); matched the complete local v0.1.7 alpha ZIP by Git blob SHA `ccb3c2a8cfd35df9c8a835ba7cd1d182d78eca2d`. **User-installed version:** not independently audited. **Intended Foundry:** v14, live browser/GM test pending.

**Scope:** Major-cell and relative fine-cell selection/navigation/named-range labels; right-button native pan coexistence; clear shading by selection, saved layer, or all; adjustable row/column/subcell label size and color. No Scene data migration; previously stored fine indices and named-range IDs preserved.

**Local verification:** `npm test`: 56 passed, 0 failed; static JS syntax checks; full-package ZIP audit including manifest at root and no forbidden files. Unit tests verify G14 represents a whole block, relative 2D suffixes, independent major X/Y intervals and picked A1, exact legacy cell reference, label colors and sizes, SVG redraw without Scene writes, right-button passthrough, shading rectangular subtraction and ID preservation, GM confirmation on bulk shading removal, and named-range preservation. **Automated/mock-tested, not Foundry live-confirmed.**

**GM live smoke test (not run):** Back up a test world. Load v0.1.8, ensure GM-only panel opens, Select on map → Major map blocks, click one G14 square and verify the entire square is outlined and labeled G14; switch to Fine Subcells and select G14.3,4; verify Go To matching positions, right-drag still pans, change column font size/color and row font size/color then Discard Preview. Shade two overlapping ranges, remove one layer, remove selected shading, and preview Clear All but cancel. Finally reload to confirm persistence. Test multiple clients separately.

**Safety:** Changing font preview does not write Scene flags. Persistent overlay setup and explicit shading actions use the existing Scene-flag revision path; native grid settings are unchanged. Clearing shading is not undone by reinstalling an older module: restore world snapshot for rollback. There is no automatic actor/token/tile/drawing/region update.

**Publication and deployment:** The installable ZIP and GitHub publication must each be verified independently after build. A package uploaded to GitHub is **not** proof of a successful live Foundry installation. No public official Foundry listing is claimed.

**Documentation synchronization needed:** `103-CROSS-PROJECT-MODULE-INVENTORY.md` still lists G03 as an old concept, update after reviewing the verified commit/test state. `100` can record that G03 Scene `axes` now supports optional label size/color preferences without a schema bump; `101` process unchanged. No adjacent module source modified.

---

# AFT Gridlines+ v0.1.7 — test report

**G03 / module `gridlines`.** Verified source baseline: `rebsiot/gridlines` `main` commit `86941a958f16c4a0cc9a340f17ff91257fb51307` (v0.1.6). The mounted complete v0.1.6 ZIP and its source tree were SHA-matched against that commit. **Actual installed world/module version is unknown.**

## v0.1.7 local results — 2026-10-18

- **Automated / mocked:** `npm test` passed **45 tests** (39 existing + 6 new tests). Checks include independent major column/row intervals, first-block ruler, A/B/C major labels, independently picked origins, visibility restoration after native redraw, preview-only copy, native size-only update, error handling for incompatible geometry, backup acknowledgment, and explicit second confirmation before a native Scene write.
- **Static:** All JavaScript syntax checks and full ZIP-root integrity/package-content audit before release. No user-world data, tokens, characters, licensed map art or credentials included.
- **Not verified live:** Foundry v14 actual Canvas `GridLayer` mesh lookup, Scene update hook timing, native grid-size changes with existing tokens/walls/tiles, UI layout, origin selection with zoom/pan, and two-client sync. The implementation is an alpha candidate, not a live certified module.

## One safe live smoke test

On a **backed-up test world** open a native square-grid Scene as GM. Update to 0.1.7. Under **Grid visibility**, click **Hide Foundry Grid** and verify the native fine mesh disappears **but token snapping still works**; then **Show Foundry Grid**. Use **Match Gridlines+ to Foundry**, adjust the major intervals to 10 columns / 10 rows and subdivisions to 5/5, verify letters A/B/C and rows 1/2/3 with the first-block A–J / 1–10 ruler, then **Discard Preview**. The test must leave the Scene unchanged. Only after that passes should you save overlays or test the native-grid reverse match on an empty duplicate Scene.

## Safety and rollback

- **Native Foundry changes** happen only after Preview → recoverable-backup acknowledgment → explicit confirmation. When committed, `grid.size` changes on the existing Scene. It can change snapping and the apparent alignment of existing map objects; Gridlines' alignment-review state must still be resolved explicitly afterward.
- **Overlay changes** happen only after Save Grid Setup. The native-grid visual toggle is client-local and never changes flags. Neither toggle deletes native objects or changes token movement settings.
- **Rollback:** Restore the prior module and matching world snapshot. v0.1.6 code does not interpret separately saved major-column and major-row settings correctly. A module ZIP rollback does not undo native Scene updates or saved flags.

## Documentation synchronization

The existing `103-CROSS-PROJECT-MODULE-INVENTORY.md` describes G03 at a historical concept stage and needs synchronization with the verified release commit and mock-tested status. No adjacent component contracts changed. In `100` note that v0.1.7 adds optional per-Scene major-X/major-Y and minor-X/minor-Y fields to the existing G03 Scene flags schema; `101` release process is unchanged. No separate handoff is created in this owner conversation.

---

## Prior test history

# AFT Gridlines+ v0.1.6 — test report

**Owner:** G03 — Gridlines, technical ID `gridlines`. **Source input:** GitHub `rebsiot/gridlines` default-branch commit `a3812f17d2e9d4885ee1d91b419e51654b7653a9` (v0.1.5), checked against the mounted v0.1.5 source and manifest. The actual installed version on the user's Foundry instance has **not** been inspected.

## v0.1.6 change and checks (2026-10-18)

- Added separate width/height with opt-in linked dimensions. Existing square `cellSize` values from earlier flags continue resolving as squares without automatic writes or schema migrations.
- All overlay geometry consumers use independent sizeX/sizeY: coordinate lookup, rectangle extents, A1 placement, shading/selection, named range Go To and major/minor line spacing. Foundry's native movement grid is not modified.
- 10×10 / 5×5 / 1×1 calibration accepts rectangular guide bounds and automatically unlinks measured unequal axes. In unlinked mode, a one-axis guide updates only that axis.
- UI live preview and Discard never write flags. Saving a width/height change with saved named ranges/formats requires the existing backup acknowledgment; indices, IDs and native Scene settings remain unchanged.
- Automated/mock result: **39 Node tests passed**, zero failed. New `tests/rectangular.test.mjs` covers legacy source data, unequal dimensions, major/minor SVG geometry, independent coordinate/navigation, rectangular calibration, preview, confirmation, persistence and rollback behavior.
- **Live Foundry v14 testing:** not run. In a backed-up test world, set width 120 and height 80 with Link disabled, drag the grid, choose A1, verify visual guides and `cell:` navigation, Save and reload, then compare native token snapping and persisted named ranges. Use Discard first to prove no Scene writes.
- **Upgrade:** preserve a backup of `Data/modules/gridlines` and a recoverable world snapshot; update v0.1.5 through the same manifest, enable in the test world, and hard-refresh. The version remains `gridlines` ID with no Actor/Token/Scene-document migration other than explicit GM saves to the existing module Scene flag.
- **Rollback:** retain the v0.1.5 installable ZIP. The old code does not understand `cellWidth`/`cellHeight`; it will not faithfully show saved rectangular overlays. To restore the previous overlay geometry, restore the corresponding test-world snapshot as well as the old module files, not just the ZIP.
- **Documentation sync:** the Project inventory `103` still describes G03 as concept only and needs an evidence-based source/release status update. The G03 architecture/handoff can record this source commit and mock results at next permitted handoff synchronization; no separate cross-component code changes were made.

## v0.1.5 change and checks (2026-10-18)

- Visible Foundry manifest title, Token Controls launcher, dedicated Scene Control, and manager heading now read **AFT Gridlines+**. Internal identifiers, hooks, stored Scene flags, settings and alignment behavior remain unchanged.
- Run `npm test`, `node --check` for scripts/tests, compare source-to-ZIP contents, verify `module.json` at ZIP root, and check the manifest/download links and Git object hashes after publication.
- **Real Foundry v14 smoke test not run:** In a backed-up test world, update the module, open **Manage Modules** and verify **AFT Gridlines+** appears with its enabled checkbox checked or unchecked according to the world's actual current state. Confirm the native Token Controls launcher and manager title. This package does not enable itself or other AFT modules.
- **Rollback:** Restore the previously downloaded v0.1.4 package/module folder, and refresh the world; no data migration in v0.1.5. Retain an independent world backup in case unrelated world changes need reversal.

## Previous v0.1.4 validation (unchanged functionality)

**Component:** G03 — Gridlines; Foundry module ID `gridlines`; owner thread: G03 current development conversation.

**Source baseline:** GitHub `rebsiot/gridlines`, branch `main`, exact verified v0.1.3 source commit `eb5437e26f941b31f82589ecc79f165f6a65b4a7`. The initial implementation was created from the v0.1.3 source archive; module ID and Scene-flag schema version remain unchanged. The user's installed Foundry module version and live Foundry v14 build are **unknown**.

## Automated and mock tests (2026-10-18)

- `npm test`: **30 tests passed**, zero failed. This includes the preceding 26 tests and four targeted tests for dragging, selecting A1, persisted origin/navigation behavior, escape/discard, and safe handling of old Scene flags.
- Drag preview is a temporary DOM/SVG operation: it does not write any Scene flag. X/Y values use canvas-world coordinates and update under pointer movement; pointer release ends the drag.
- Picking A1 updates preview `a1Row/a1Col` only. Major-block Go To resolves the chosen A1, and explicit `cell:` Go To still uses the original internal fine-cell indices.
- Existing fill IDs and ranges persist, and a changed origin or position with saved material cannot be committed without backup acknowledgment. The native grid configuration remains unchanged.
- Existing v0.1.3 flags missing A1 fields default to a zero-based origin without data migration.
- All module scripts and test files passed `node --check`.
- ZIP check: validate `module.json` at the ZIP root and run a ZIP integrity test. Compare all source entries to the tested directory before publishing.

## Foundry v14 live tests

**Not performed.** A Node DOM/SVG mock is not a real GM browser. Pixel capture, the Foundry Scene Controls registration, fog-layer ordering, viewport zoom/pan, and installation through the manifest still require a live test. Two-client, player, hex and multi-GM validation are not part of this alpha.

## First live smoke test

Back up a **test world**, update Gridlines to v0.1.4 and verify the installed module version. In a square-grid Scene open **Token Controls → Gridlines: Open Manager → Grid Setup**. Click **Drag Grid**; drag the visual grid 40 pixels right and release. Confirm that the grid follows the pointer. Then click **Pick A1 Cell**, choose an interior fine cell and check the orange A1 marker and major labels. **Discard Preview**: the old overlay and A1 should return, and reloading the Scene should not change flags. Only after that passes, test saving in a backed-up test Scene.

## Further regression and rollback

Verify Go To A1 and Go To `cell:A1`, different cell sizes, 5/10-cell calibration, zoom/pan, native grid-change warnings, multiple GM sessions and Scene reload. If you saved a new A1 origin, restoring v0.1.3 code alone does not restore the earlier labels: restore the prior Gridlines Scene flags from a matching world snapshot, or save a new aligned A1 with v0.1.4. Do not delete flags manually on a production world.

**Safety:** No Drawings, Tiles, Regions, Tokens, Walls, Actors or native Scene grid settings are created or modified. Only explicit **Save Grid Setup** writes the module's `flags.gridlines.state` for an enabled Scene. Never store GM secrets inside Scene flags. Publication on GitHub does not imply successful live Foundry deployment.
