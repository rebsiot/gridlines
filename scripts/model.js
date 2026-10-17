import {normalizeRange, formatRange} from "./coordinates.js";

export const MODULE_ID = "gridlines";
export const DATA_KEY = "state";
export const SCHEMA_VERSION = 1;
const MAX_RANGES = 500;
const MAX_FORMATS = 1000;

export const DEFAULT_AXES = Object.freeze({ enabled: true, labels: true, majorEvery: 5, color: "#65baff", alpha: .65 });

/** Only geometry-affecting fields are fingerprinted. Grid color/distance should not trigger a review. */
export function geometrySnapshot(scene) {
  const dimensions = scene.getDimensions?.() ?? scene.dimensions;
  const rect = dimensions?.sceneRect;
  const grid = scene.grid;
  if (!rect || !grid) throw new Error("Scene geometry is not available");
  const topCell = grid.getOffset?.({x: rect.x + .5, y: rect.y + .5});
  const vertices = topCell && grid.getVertices?.(topCell);
  const topLeft = vertices?.length ? {
    x: Math.min(...vertices.map(p => p.x)), y: Math.min(...vertices.map(p => p.y))
  } : {x: rect.x, y: rect.y};
  const snap = {
    type: Number(scene._source?.grid?.type ?? scene.grid?.type ?? -1),
    size: Number(scene._source?.grid?.size ?? grid.size),
    width: Number(scene.width ?? dimensions.sceneWidth),
    height: Number(scene.height ?? dimensions.sceneHeight),
    padding: Number(scene.padding ?? 0),
    sceneX: Number(rect.x), sceneY: Number(rect.y),
    gridOriginX: Number(topLeft.x - rect.x), gridOriginY: Number(topLeft.y - rect.y)
  };
  return snap;
}

export function geometryChanged(a, b) {
  if (!a || !b) return true;
  return ["type", "size", "width", "height", "padding", "sceneX", "sceneY", "gridOriginX", "gridOriginY"].some(k => a[k] !== b[k]);
}

export function newState(snapshot) {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    geometryRevision: 1,
    baseline: snapshot,
    axes: {...DEFAULT_AXES},
    formats: [],
    namedRanges: []
  };
}

export function validateState(value) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.formats) || !Array.isArray(value.namedRanges) || !value.baseline) {
    throw new Error("Gridlines Scene data is missing or from an unsupported schema; no changes were saved");
  }
  if (!Number.isInteger(value.revision) || value.revision < 1 || !Number.isInteger(value.geometryRevision) || value.geometryRevision < 1) throw new Error("Invalid Gridlines revision");
  if (value.formats.length > MAX_FORMATS || value.namedRanges.length > MAX_RANGES) throw new Error("Gridlines Scene data exceeds the prototype limits");
  return value;
}

export function alignmentStatus(state, sceneSnapshot) {
  if (!state) return {pending: false};
  return {pending: geometryChanged(state.baseline, sceneSnapshot), before: state.baseline, after: sceneSnapshot};
}

export function remapRangeByPixels(range, previous, current) {
  if (!previous || !current || previous.type !== current.type) throw new Error("Different grid types require a manual review");
  if (previous.width !== current.width || previous.height !== current.height) throw new Error("Scene dimensions changed; automatic remapping is unavailable");
  if (!(previous.size > 0 && current.size > 0)) throw new Error("Invalid grid sizes");
  const rect = normalizeRange(range.from, range.to);
  const convert = (n, oldOrigin, newOrigin, oldSize, newSize) => Math.floor((oldOrigin + n * oldSize - newOrigin + .00001) / newSize);
  const ending = (n, oldOrigin, newOrigin, oldSize, newSize) => Math.floor((oldOrigin + (n + 1) * oldSize - newOrigin - .00001) / newSize);
  const from = {
    row: convert(rect.from.row, previous.gridOriginY, current.gridOriginY, previous.size, current.size),
    col: convert(rect.from.col, previous.gridOriginX, current.gridOriginX, previous.size, current.size)
  };
  const to = {
    row: ending(rect.to.row, previous.gridOriginY, current.gridOriginY, previous.size, current.size),
    col: ending(rect.to.col, previous.gridOriginX, current.gridOriginX, previous.size, current.size)
  };
  const maxRow = Math.ceil(current.height / current.size) - 1;
  const maxCol = Math.ceil(current.width / current.size) - 1;
  if (from.row < 0 || from.col < 0 || to.row > maxRow || to.col > maxCol) throw new Error("At least one range would leave the Scene; manual review required");
  return normalizeRange(from, to);
}

export function previewPixelRemap(state, currentSnapshot) {
  validateState(state);
  const changes = [];
  const transform = (entry, type) => {
    const next = remapRangeByPixels(entry.range, state.baseline, currentSnapshot);
    changes.push({type, name: entry.name ?? entry.id, before: formatRange(entry.range), after: formatRange(next)});
    return {...entry, range: next};
  };
  return {
    changes,
    state: {
      ...state,
      namedRanges: state.namedRanges.map(n => transform(n, "Named range")),
      formats: state.formats.map(f => transform(f, "Fill"))
    }
  };
}

export function addNamedRange(state, name, range, id) {
  const clean = String(name ?? "").trim();
  if (!clean || clean.length > 64 || /[\x00-\x1F]/.test(clean)) throw new Error("Name must contain 1–64 ordinary characters");
  if (state.namedRanges.some(item => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error("A range with that name already exists on this Scene");
  if (state.namedRanges.length >= MAX_RANGES) throw new Error("This Scene has reached the named-range limit");
  state.namedRanges.push({id, name: clean, range: normalizeRange(range.from, range.to)});
}

export function addFill(state, range, color, opacity, id) {
  if (state.formats.length >= MAX_FORMATS) throw new Error("This Scene has reached the formatting limit");
  if (!/^#[0-9A-Fa-f]{6}$/.test(color) || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new Error("Invalid fill style");
  state.formats.push({id, range: normalizeRange(range.from, range.to), fill: color, opacity});
}
