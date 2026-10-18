import {normalizeRange, formatRange} from "./coordinates.js";

export const MODULE_ID = "gridlines";
export const DATA_KEY = "state";
export const SCHEMA_VERSION = 1;
const MAX_RANGES = 500;
const MAX_FORMATS = 1000;

export const DEFAULT_AXES = Object.freeze({
  enabled: true, labels: true, majorEvery: 10, minorDivisions: 5,
  cellSize: null, offsetX: 0, offsetY: 0,
  a1Row: 0, a1Col: 0,
  color: "#65baff", alpha: .65, majorWidth: 2, minorWidth: 1, coordinateScope: "major"
});

/** Optional axis fields maintain v0.1.1 Scene flags without a migration. */
export function normalizeAxes(value = {}) {
  const prior = (value && Object.keys(value).length > 0 && value.coordinateScope === undefined);
  return {...DEFAULT_AXES, ...(value ?? {}), ...(prior ? {coordinateScope: "cell"} : {})};
}

export function validateAxes(value) {
  const a = normalizeAxes(value);
  const integer = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
  const finite = (x, min, max) => typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
  if (!["major", "cell"].includes(a.coordinateScope)) throw new Error("Invalid coordinate labeling mode");
  if (!integer(a.majorEvery, 1, 200) || !integer(a.minorDivisions, 1, 20))
    throw new Error("Major interval must be 1–200 cells, minor divisions 1–20");
  if (!integer(a.a1Row, 0, 99999) || !integer(a.a1Col, 0, 99999))
    throw new Error("A1 anchor must be a valid nonnegative grid cell");
  if (!(a.cellSize === null || finite(a.cellSize, 10, 2000))) throw new Error("Gridlines cell size must be 10–2000 pixels");
  if (!finite(a.offsetX, -20000, 20000) || !finite(a.offsetY, -20000, 20000)) throw new Error("Gridlines offset is outside the supported range");
  if (!/^#[0-9a-f]{6}$/i.test(a.color)) throw new Error("Invalid gridline color");
  if (!finite(a.alpha, 0, 1) || !finite(a.majorWidth, .25, 20) || !finite(a.minorWidth, .25, 20))
    throw new Error("Invalid gridline opacity or line width");
  return a;
}

export function overlayGeometryChanged(before, after, nativeSize) {
  const a = normalizeAxes(before), b = normalizeAxes(after);
  const effective = x => x.cellSize ?? nativeSize;
  // A1 changes coordinate meanings and major-line positions, even though fine-cell geometry stays put.
  return effective(a) !== effective(b) || a.offsetX !== b.offsetX || a.offsetY !== b.offsetY ||
    a.a1Row !== b.a1Row || a.a1Col !== b.a1Col;
}


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
  validateAxes(value.axes);
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
