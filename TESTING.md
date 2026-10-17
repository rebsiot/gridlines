# Gridlines v0.1.2 — Test report

**Source:** exact prior GitHub branch `rebsiot/gridlines` at `c05920e25e700e425449497ee849cce7c85e8f1c`; new local code built in separate directory. Not deployed.

**Local automated/mock tests:** 18 Node tests passed locally on 2026-10-17, covering syntax and mock workflows. Node syntax, pure coordinate/label logic, overlay pixel size/offset mapping, in-memory Scene flag persistence, native resize warning, live-style preview mock, 10/5 major/minor SVG rendering, existing v0.1.1 flag compatibility, and explicit backup confirmation for relocating saved cells. Run `npm test` or `node --test tests/*.test.mjs`.

**ZIP audit:** Validate the package with `unzip -t`; `module.json` is at the ZIP root and its `id` and `version` match the manifest path and download filename. Verify no secrets or paid art included.

**Foundry v14 live tests:** Not yet performed. GM controls/canvas attachment may still differ in real Foundry; no player/fog/multi-GM verification was conducted.

## One first live check

On a test Scene, enable Gridlines v0.1.2, open Token Controls → Gridlines: Open Manager → Enable on this Scene. Under Grid Setup, adjust **Gridline color** and **Gridline opacity %**, watching for an immediate change in visible SVG guides, then try a small **Offset X** change and **Discard Preview**. Confirm native Foundry grid and objects did not change. Report Foundry v14 build and any console error if the overlay is missing.

## Further regressions

- Save overlay size/offset, reload and check visual matching with named ranges.
- Change major spacing and subdivisions, verify labels on major lines only.
- Test `A1`/`B2` major Go To and `cell:D3` exact Go To on a new Scene; verify v0.1.1 Scene addresses remain legacy.
- Create and shade a named range, then attempt offset change: preview should work but Save must reject without backup confirmation.
- Use native Foundry Scene Configuration to change grid pixel size; review must appear and stale range navigation remain paused.
- Test zoom/pan, differing map pixel dimensions, fog-of-war visibility, two GMs, rollback and module enablement after an actual Foundry install.

**Safety:** There is no migration of world data, Actor, Token, Tile, Region, Drawing or Foundry native grid settings. Flags `gridlines.state` remain and require a world snapshot to restore after user-authored Scene edits. Store no GM secrets in Scene flags.

