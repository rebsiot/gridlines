# Gridlines v0.1.4 — test report

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
