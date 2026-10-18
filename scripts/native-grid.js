/** GM-local native grid display and safe copying between Foundry's square
 * movement grid and the independently positioned Gridlines overlay. */

export class NativeGridDisplay {
  constructor(getCanvas = () => canvas) {
    this.getCanvas = getCanvas;
    this.mesh = null;
    this.originalVisible = null;
    this.hidden = false;
  }

  findMesh() {
    const c = this.getCanvas();
    const layer = c?.layers?.find(x => x?.mesh &&
      (x.constructor?.name === "GridLayer" || x.name === "grid" || x.hookName === "GridLayer"));
    const candidates = [layer?.mesh, c?.interface?.grid?.mesh, c?.environment?.grid?.mesh];
    return candidates.find(x => x && typeof x.visible === "boolean") ?? null;
  }

  get available() { return Boolean(this.findMesh()); }
  get isVisible() { return this.hidden ? false : this.findMesh()?.visible !== false; }

  sync() {
    if (!this.hidden) return;
    const current = this.findMesh();
    if (!current) return;
    if (this.mesh && this.mesh !== current && !this.mesh.destroyed) this.mesh.visible = this.originalVisible;
    if (current !== this.mesh) {
      this.mesh = current;
      this.originalVisible = current.visible;
    }
    current.visible = false;
  }

  setVisible(visible) {
    if (visible) { this.restore(); return; }
    const current = this.findMesh();
    if (!current) throw new Error("Foundry v14 native grid mesh was not found; use Scene Configuration → Grid Opacity instead");
    if (this.mesh && this.mesh !== current) this.restore();
    if (!this.hidden) {
      this.mesh = current;
      this.originalVisible = current.visible;
    }
    this.hidden = true;
    current.visible = false;
  }

  restore() {
    if (this.mesh && !this.mesh.destroyed && this.originalVisible !== null) this.mesh.visible = this.originalVisible;
    this.hidden = false;
    this.mesh = null;
    this.originalVisible = null;
  }
}

export function copyFoundryGrid(axes) {
  // These fields affect overlay geometry only. Never change A1, major
  // formatting, named ranges, or native Scene configuration on copy.
  return {...axes, cellSize: null, cellWidth: null, cellHeight: null,
    linkCellDimensions: true, offsetX: 0, offsetY: 0};
}

export function planNativeGridMatch(scene, nativeGrid, axes, minimumSize = 50) {
  if (!nativeGrid?.isSquare) throw new Error("Only Foundry square grids can be matched");
  const width = Number(axes.cellWidth ?? nativeGrid.sizeX);
  const height = Number(axes.cellHeight ?? nativeGrid.sizeY);
  if (Math.abs(width-height) > .000001)
    throw new Error(`Native Foundry cells must be square; Gridlines+ is ${width}×${height}px. Link dimensions or use its overlay independently.`);
  if (!Number.isInteger(width) || width < minimumSize || width > 2000)
    throw new Error(`Foundry grid size must be an integer from ${minimumSize} to 2000 pixels`);
  if (Math.abs(axes.offsetX) > .000001 || Math.abs(axes.offsetY) > .000001)
    throw new Error("Foundry cannot copy independent X/Y overlay offsets. Move the printed map using Foundry's Grid Configuration tool first; this action does not shift the artwork.");
  const before = Number(scene?._source?.grid?.size ?? scene?.grid?.size ?? nativeGrid.size);
  if (!Number.isFinite(before)) throw new Error("Foundry Scene grid size was not readable");
  return {from: before, to: width, changes: before !== width, sceneId: scene.id};
}
