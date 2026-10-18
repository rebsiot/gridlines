/** Non-persistent calibration guide math. Does not touch Foundry's Scene grid.
 * Drag across the outer corners of an N by N block of printed cells, which
 * may be rectangular, or measure one axis with a straight line.
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
  let mode;
  // A nearly straight pointer gesture is a one-axis measurement. A true
  // rectangular guide, even with markedly different sides, sets both axes.
  if (Math.min(r.width, r.height) <= Math.max(8, Math.max(r.width, r.height) * 0.015)) {
    mode = r.width >= r.height ? "horizontal" : "vertical";
  } else {
    mode = "rectangle";
  }
  let width = roundPixel(r.width / cells);
  let height = roundPixel(r.height / cells);
  const nearlySquare = Math.abs(r.width - r.height) / ((r.width + r.height) / 2) <= .08;
  const linked = axes.linkCellDimensions !== false;
  if (mode === "rectangle" && linked && nearlySquare) {
    mode = "square";
    width = height = roundPixel((r.width + r.height) / (2 * cells));
  }
  if (mode === "horizontal") height = width;
  if (mode === "vertical") width = height;
  const measured = mode === "horizontal" ? [width] : mode === "vertical" ? [height] : [width,height];
  if (measured.some(x => !(x >= 10 && x <= 2000)))
    throw new Error("Measured cell width and height must each be 10–2000 pixels");
  const oldOrigin = {
    x: nativeOrigin.x + Number(axes.offsetX ?? 0),
    y: nativeOrigin.y + Number(axes.offsetY ?? 0)
  };
  // A linked one-axis guide retains the prior square behavior; unlinked
  // measurement leaves the other axis unchanged. Rectangles automatically
  // unlink unless their sides were deliberately measured equal.
  const recommended = {cellSize: null};
  if (mode !== "vertical") recommended.cellWidth = width;
  if (mode !== "horizontal") recommended.cellHeight = height;
  if (mode === "horizontal" && linked) recommended.cellHeight = width;
  if (mode === "vertical" && linked) recommended.cellWidth = height;
  if (mode === "rectangle") recommended.linkCellDimensions = false;
  if (mode !== "vertical") recommended.offsetX = alignedOffset(r.left, width, nativeOrigin.x, oldOrigin.x);
  if (mode !== "horizontal") recommended.offsetY = alignedOffset(r.top, height, nativeOrigin.y, oldOrigin.y);
  return {
    mode, cells, guide: r, recommended,
    measuredX: roundPixel(r.width / cells), measuredY: roundPixel(r.height / cells),
    discrepancyPercent: mode === "square"
      ? roundPixel(Math.abs(r.width - r.height) / ((r.width + r.height) / 2) * 100) : null
  };
}
