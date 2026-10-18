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
