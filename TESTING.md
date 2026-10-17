# Gridlines 0.1.1 - Prototype verification

**Additional local checks:** `module.json` appears at ZIP root; no duplicate module folder; native Token Controls launcher is GM-only; manager has manual select/stop controls; source syntax checks and Node mock tests. Native Foundry v14 live behavior is **unverified**.

# Gridlines - Prototype verification

## Evidence summary

- Source: created from scratch for this prototype, not derived from an existing verified working G03 ZIP or deployed source.
- Target: Foundry VTT v14, installed patch version **unknown**.
- Native Foundry integration: API documentation reviewed; actual Scene Controls, canvas DOM positioning, Scene flags and render cycle **not exercised live**.
- Node automated tests: run with `node --test tests/*.test.mjs` from the module folder (results must be verified for the exact supplied artifact).
- ZIP integrity: inspect files and run `unzip -t`.
- Deployment: **not performed**.

## Recommended single first live check

In a separate test world using the actual installed Foundry v14 build, enable the module, open a square-grid Scene, click Gridlines -> Gridlines Manager -> Enable on this Scene, then confirm grid lines are visible and aligned before creating any ranges. Record Foundry build, browser, errors and screenshots. Do not proceed to authoring or native grid changes if this fails.

## Further test sequence (not yet run)

1. Select D3:F5 on the canvas; confirm correct address, normal Token control after switching out of select.
2. Shade and name Warehouse, reload Scene; confirm the Scene `flags.gridlines.state` contains only the Gridlines data.
3. Navigate to Warehouse, compare center with the expected cells.
4. Take a *separate world snapshot*, change the native Scene grid size in Foundry Scene Configuration, observe warning and pause.
5. Preview preserve-map versus keep-cell-addresses; do not apply unexpected remapping.
6. Confirm acceptance persists on refresh without moving existing objects.
7. Test two GM clients, one player client, grid-type change, fog of war, canvas zoom/pan, drawing compatibility, and large/rotated Scenes before a public release.

## Backups and non-goals

Never test alignment on an irreplaceable live Scene. Back up the entire test world if changing its native Scene grid. A module ZIP does not back up world data, and disabling the module does not remove Scene flags. No current Pro automation is shipped.
