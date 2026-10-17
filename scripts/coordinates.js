/** Pure coordinate/address helpers. Logical rows and columns are zero-based. */
export const MAX_INDEX = 99999;

export function columnName(index) {
  if (!Number.isSafeInteger(index) || index < 0 || index > MAX_INDEX) throw new RangeError("Invalid column");
  let n = index + 1;
  let result = "";
  while (n) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

export function columnIndex(letters) {
  if (typeof letters !== "string" || !/^[A-Z]+$/i.test(letters) || letters.length > 8) throw new Error("Invalid column letters");
  let value = 0;
  for (const character of letters.toUpperCase()) {
    value = value * 26 + character.charCodeAt(0) - 64;
    if (value > MAX_INDEX + 1) throw new RangeError("Column too large");
  }
  return value - 1;
}

export function formatAddress({ row, col }) {
  if (!Number.isSafeInteger(row) || row < 0 || row > MAX_INDEX) throw new RangeError("Invalid row");
  return `${columnName(col)}${row + 1}`;
}

export function parseAddress(value) {
  const match = /^\s*([a-z]+)([1-9]\d*)\s*$/i.exec(String(value ?? ""));
  if (!match) throw new Error("Use a coordinate such as D7");
  const row = Number(match[2]) - 1;
  if (!Number.isSafeInteger(row) || row > MAX_INDEX) throw new RangeError("Row too large");
  return { row, col: columnIndex(match[1]) };
}

export function normalizeRange(a, b = a) {
  for (const p of [a, b]) {
    if (!Number.isInteger(p?.row) || !Number.isInteger(p?.col) || p.row < 0 || p.col < 0 || p.row > MAX_INDEX || p.col > MAX_INDEX)
      throw new Error("Invalid cell range");
  }
  return {
    from: {row: Math.min(a.row, b.row), col: Math.min(a.col, b.col)},
    to: {row: Math.max(a.row, b.row), col: Math.max(a.col, b.col)}
  };
}

export function parseRange(value) {
  const parts = String(value ?? "").split(":");
  if (parts.length > 2 || !parts[0]) throw new Error("Use a coordinate or range such as D3:F5");
  return normalizeRange(parseAddress(parts[0]), parseAddress(parts[1] || parts[0]));
}

export function formatRange(range) {
  const norm = normalizeRange(range.from, range.to);
  const first = formatAddress(norm.from);
  const last = formatAddress(norm.to);
  return first === last ? first : `${first}:${last}`;
}

export function squareResolver(grid, sceneRect) {
  if (!grid?.isSquare || typeof grid.getOffset !== "function" || typeof grid.getCenterPoint !== "function" || typeof grid.getVertices !== "function") {
    throw new Error("Only native square Foundry grids are supported in this prototype");
  }
  if (!sceneRect || sceneRect.width <= 0 || sceneRect.height <= 0) throw new Error("Invalid Scene dimensions");
  const origin = grid.getOffset({ x: sceneRect.x + .5, y: sceneRect.y + .5 });
  const inside = (p) => p.x >= sceneRect.x && p.y >= sceneRect.y && p.x < sceneRect.x + sceneRect.width && p.y < sceneRect.y + sceneRect.height;
  const translate = (cell) => ({i: origin.i + cell.row, j: origin.j + cell.col});
  const locate = (p) => {
    if (!inside(p)) return null;
    const offset = grid.getOffset(p);
    const cell = {row: offset.i - origin.i, col: offset.j - origin.j};
    return cell.row >= 0 && cell.col >= 0 ? cell : null;
  };
  const vertices = (cell) => grid.getVertices(translate(cell));
  const bounds = (cell) => {
    const points = vertices(cell);
    return {
      x: Math.min(...points.map(p => p.x)),
      y: Math.min(...points.map(p => p.y)),
      right: Math.max(...points.map(p => p.x)),
      bottom: Math.max(...points.map(p => p.y))
    };
  };
  const rangeBounds = (range) => {
    const r = normalizeRange(range.from, range.to);
    const topLeft = bounds(r.from);
    const bottomRight = bounds(r.to);
    return {x: topLeft.x, y: topLeft.y, right: bottomRight.right, bottom: bottomRight.bottom};
  };
  return {
    origin, locate, inside, vertices, bounds, rangeBounds,
    center: (cell) => grid.getCenterPoint(translate(cell)),
    centerOfRange: (range) => {
      const b = rangeBounds(range);
      return {x: (b.x + b.right) / 2, y: (b.y + b.bottom) / 2};
    }
  };
}
