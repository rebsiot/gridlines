# Changelog

## 0.1.0 - 2026-10-17 (Experimental alpha, GitHub manifest build)

- Added native square-grid coordinate conversion, selection, major/minor overlay lines and address navigation.
- Added opt-in per-Scene grid configuration, rectangular fill layers, and named ranges using Scene flags.
- Added native grid-change detection and recovery: keep logical cell addresses or preview a whole-cell remap to approximate original map coverage.
- Kept native Scene grid, Tiles, Drawings, Regions, walls, tokens, actor data and other modules untouched.
- No legacy data migration; no automatic hotbar behavior or Pro automation.
- Known limitations: GM-only visuals, no fog/player smoke test, no robust concurrent GM commit protocol, square grids only.
- Local automated tests: see `TESTING.md`. Live Foundry testing: **not run**.
- Install/rollback: follow README, use a test world and a recoverable world backup before applying the module.