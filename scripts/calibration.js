/** Non-persistent calibration guide math. Does not touch Foundry's Scene grid.
 * Drag across the outer corners of a known N x N printed square, or draw a
 * straight N-cell horizontal/vertical line to calibrate only that axis.
 */
export const CALIBRATION_PRESETS = Object.freeze([10, 5, 1]);
const roundPixel = value => Math.round(value * 100) / 100;

export function guideBounds(from, to) {
  if (![from?.x, from?.y, to?.x, to?.y].every(Number.isFinite))
    throw new Error("Calibration needs two valid map coordinates");
  return {
    left: Math.min(from.x, to.x), top: Math.min(from.y, to.y),
    right: Math.max(from.x, to.x), bottom: Math.max(from.y, to.y),
    width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y)
  };
}

function alignedOffset(guideStart, size, nativeStart, existingOrigin) {
  // Match the guide to ANY grid boundary without assigning a new cell A1 at
  // the drawing location. Prefer the matching origin nearest the current one.
  const aligned = guideStart + Math.round((existingOrigin - guideStart) / size) * size;
  return roundPixel(aligned - nativeStart);
}

/**
 * @param {{from:{x:number,y:number},to:{x:number,y:number},cells:1|5|10,
 *   nativeOrigin:{x:number,y:number},nativeSize:number,axes:object}} spec
 */
export function calibrateGuide({from, to, cells, nativeOrigin, nativeSize, axes = {}}) {
  if (!CALIBRATION_PRESETS.includes(cells)) throw new Error("Choose a 10x10, 5x5 or 1x1 guide");
  if (![nativeOrigin?.x, nativeOrigin?.y, nativeSize].every(Number.isFinite) || nativeSize <= 0)
    throw new Error("Native grid geometry is unavailable");
  const r = guideBounds(from, to);
  if (Math.max(r.width, r.height) < cells * 10)
    throw new Error(`Drag across ${cells} complete printed map cells before releasing`);
  const ratio = Math.min(r.width, r.height) / Math.max(r.width, r.height);
  let mode, size;
  if (ratio <= 0.12) {
    mode = r.width >= r.height ? "horizontal" : "vertical";
    size = Math.max(r.width, r.height) / cells;
  } else if (Math.abs(r.width - r.height) / ((r.width + r.height) / 2) <= 0.08) {
    mode = "square";
    size = (r.width + r.height) / (2 * cells);
  } else {
    throw new Error("Draw a straight horizontal/vertical line, or a nearly square corner-to-corner guide");
  }
  size = roundPixel(size);
  if (!(size >= 10 && size <= 2000)) throw new Error("Measured cell size must be 10–2000 pixels");
  const oldOrigin = {
    x: nativeOrigin.x + Number(axes.offsetX ?? 0),
    y: nativeOrigin.y + Number(axes.offsetY ?? 0)
  };
  const recommended = {cellSize: size};
  if (mode !== "vertical") recommended.offsetX = alignedOffset(r.left, size, nativeOrigin.x, oldOrigin.x);
  if (mode !== "horizontal") recommended.offsetY = alignedOffset(r.top, size, nativeOrigin.y, oldOrigin.y);
  return {
    mode, cells, guide: r, recommended,
    measuredX: roundPixel(r.width / cells), measuredY: roundPixel(r.height / cells),
    discrepancyPercent: mode === "square"
      ? roundPixel(Math.abs(r.width - r.height) / ((r.width + r.height) / 2) * 100) : null
  };
}
