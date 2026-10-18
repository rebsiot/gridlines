import {normalizeRange} from "./coordinates.js";

/**
 * Read-only GM view of saved map areas. A named range and a shading layer share
 * a row only when their normalized fine-cell rectangles are exactly identical.
 * Partial overlaps remain separate: no ID, extent or player-visibility flag is
 * changed, and the Scene's flags retain the existing two-array schema.
 */
export function buildMapAreas(state) {
  if (!state || !Array.isArray(state.namedRanges) || !Array.isArray(state.formats))
    throw new Error("Gridlines+ map areas require a valid Scene state");
  const areas = new Map();
  const add = (entry, field) => {
    const range = normalizeRange(entry.range.from, entry.range.to);
    const key = `${range.from.row},${range.from.col}:${range.to.row},${range.to.col}`;
    if (!areas.has(key)) areas.set(key, {key, range, names: [], shadings: []});
    areas.get(key)[field].push(entry);
  };
  for (const range of state.namedRanges) add(range, "names");
  for (const layer of state.formats) add(layer, "shadings");
  return Array.from(areas.values()).sort((a, b) =>
    a.range.from.row - b.range.from.row || a.range.from.col - b.range.from.col ||
    a.range.to.row - b.range.to.row || a.range.to.col - b.range.to.col);
}
