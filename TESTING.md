# Gridlines v0.1.3 — Test report

**Source:** verified public GitHub `rebsiot/gridlines` `main` at exact v0.1.2 commit `7e1127c150747a3fee8cb0629967d5f8735a132d`. Local v0.1.2 files were compared against the published blob checksums before editing. Installed live version is **unknown**; no remote Foundry access.

**Local automated/mock tests:** 26 Node tests passed locally on 2026-10-17, including the existing 18 regressions. New tests exercise 10×10, 5×5 and 1×1 calibrated guides, straight horizontal/vertical alignment, reverse drags, offset-phase preservation, near-square tolerances, rejection of distorted/undersized guides, interactive SVG feedback, Esc cancellation, preview without writes, backup-guarded Save, and preservation of existing Scene flag IDs. Run `npm test` or `node --test tests/*.test.mjs`. Existing tests still cover color/opacity/thickness and native grid-change review.

**ZIP audit:** Validate the package with `unzip -t`; `module.json` is at the ZIP root and its `id` and `version` match the manifest path and download filename. Verify no secrets or paid art included.

**Foundry v14 live tests:** Not yet performed. GM controls/canvas attachment may still differ in real Foundry; no player/fog/multi-GM verification was conducted.

## One first live check

In a **backed-up test world** update/install Gridlines v0.1.3, enable it, and open a square-grid Scene. Choose **Token Controls → Gridlines: Open Manager → Grid Setup → Draw 5x5 Guide**. Drag across five squares along an obvious horizontal printed map line, release, and check whether the calculated cell size and X offset visibly align the SVG overlay. Choose **Discard Preview** and confirm no Scene changes were saved. Report the installed Foundry v14 build or browser console errors if the guide does not attach or the pointer is not captured. This is the single next live validation; neither a real GM browser nor a two-client test has run.

## Further regressions

- Try 10x10, 5x5 and 1x1 guides horizontally, vertically and diagonally at different zoom/pan positions; saved offsets should line up with the printed grid.
- Save overlay size/offset, reload and check visual matching with named ranges.
- Change major spacing and subdivisions, verify labels on major lines only.
- Test `A1`/`B2` major Go To and `cell:D3` exact Go To on a new Scene; verify v0.1.1 Scene addresses remain legacy.
- Create and shade a named range, then attempt offset change: preview should work but Save must reject without backup confirmation.
- Use native Foundry Scene Configuration to change grid pixel size; review must appear and stale range navigation remain paused.
- Test zoom/pan, differing map pixel dimensions, fog-of-war visibility, two GMs, rollback and module enablement after an actual Foundry install.

**Safety:** A calibration drag writes **zero** Scene flags. Only explicit Save Grid Setup persists visual overlay settings. There is no migration of world data, Actor, Token, Tile, Region, Drawing or Foundry native grid settings. Flags `gridlines.state` remain and require a world snapshot to restore after user-authored Scene edits. Store no GM secrets in Scene flags.

