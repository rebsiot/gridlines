import {squareResolver, normalizeRange, formatRange} from "./coordinates.js";
import {alignmentStatus} from "./model.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LIMIT_AXIS_LINES = 250;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function clipBounds(bounds, sceneRect) {
  const x = Math.max(bounds.x, sceneRect.x), y = Math.max(bounds.y, sceneRect.y);
  const right = Math.min(bounds.right, sceneRect.x + sceneRect.width), bottom = Math.min(bounds.bottom, sceneRect.y + sceneRect.height);
  return right > x && bottom > y ? {x, y, right, bottom} : null;
}

export class GridlinesOverlay {
  constructor({onSelection = () => {}, onContextMenu = () => {}} = {}) {
    this.onSelection = onSelection;
    this.onContextMenu = onContextMenu;
    this.selection = null;
    this.dragStart = null;
    this.selecting = false;
    this.localVisible = true;
    this.sceneState = null;
    this.svg = null;
    this.root = null;
    this.resizeObserver = null;
    this.frame = 0;
    this.parentPosition = null;
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onCancel = this.onCancel.bind(this);
    this.onContext = this.onContext.bind(this);
    this.onEscape = this.onEscape.bind(this);
  }

  attach() {
    this.dispose();
    if (!game.user.isGM || !canvas.ready || !canvas.grid?.isSquare) return;
    // Pixi v8 exposes Application.canvas; older Foundry builds used view.
    // Prefer a connected canvas element and give the GM a useful diagnostic.
    const candidates = [
      canvas?.app?.canvas, canvas?.app?.view,
      canvas?.app?.renderer?.canvas, canvas?.app?.renderer?.view,
      document.querySelector("#board canvas"), document.querySelector("canvas#board")
    ];
    const view = candidates.find(el => el?.getBoundingClientRect && el?.parentElement && el.parentElement.isConnected !== false);
    const parent = view?.parentElement;
    if (!view || !parent) {
      console.warn("Gridlines: Foundry canvas HTML element was not found; overlay unavailable");
      return;
    }
    this.view = view;
    this.parent = parent;
    if (getComputedStyle(parent).position === "static") {
      this.parentPosition = parent.style.position;
      parent.style.position = "relative";
    }
    this.root = document.createElement("div");
    this.root.className = "gridlines-canvas-overlay";
    this.svg = svgElement("svg", {"aria-hidden": "true"});
    this.root.append(this.svg);
    parent.append(this.root);
    this.root.addEventListener("pointerdown", this.onDown);
    this.root.addEventListener("pointermove", this.onMove);
    this.root.addEventListener("pointerup", this.onUp);
    this.root.addEventListener("pointercancel", this.onCancel);
    this.root.addEventListener("contextmenu", this.onContext);
    document.addEventListener("keydown", this.onEscape);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.schedule());
      this.resizeObserver.observe(view);
    }
    this.setSelecting(this.selecting);
    this.schedule();
  }

  dispose() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    document.removeEventListener("keydown", this.onEscape);
    this.root?.remove();
    this.root = null;
    this.svg = null;
    if (this.parentPosition !== null && this.parent) this.parent.style.position = this.parentPosition;
    this.parentPosition = null;
    this.parent = null;
    this.view = null;
    this.dragStart = null;
  }

  setSceneState(value) { this.sceneState = value; this.schedule(); }
  setVisible(visible) { this.localVisible = Boolean(visible); this.schedule(); }
  setSelecting(active) {
    this.selecting = Boolean(active);
    if (!this.selecting) this.dragStart = null;
    this.root?.classList.toggle("gridlines-selecting", this.selecting && !this.pending);
    this.schedule();
  }
  setSelection(range) {
    this.selection = range;
    this.onSelection(range);
    this.schedule();
  }
  get pending() {
    if (!this.sceneState || !canvas.scene) return false;
    try { return alignmentStatus(this.sceneState, this.getSnapshot()).pending; }
    catch { return true; }
  }
  getSnapshot() { return this.snapshotProvider?.(canvas.scene); }

  schedule() {
    if (!this.root || this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.render(); });
  }

  pointFromEvent(event) {
    if (!canvas.ready || !canvas.grid?.isSquare || this.pending) return null;
    const point = canvas.canvasCoordinatesFromClient({x: event.clientX, y: event.clientY});
    return squareResolver(canvas.grid, canvas.dimensions.sceneRect).locate(point);
  }

  onDown(event) {
    if (!this.selecting || this.pending || event.button !== 0) return;
    const cell = this.pointFromEvent(event);
    if (!cell) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragStart = cell;
    this.setSelection(normalizeRange(cell));
    try { this.root.setPointerCapture(event.pointerId); } catch { /* browser may already have lost capture */ }
  }

  onMove(event) {
    if (!this.dragStart) return;
    const cell = this.pointFromEvent(event);
    if (!cell) return;
    this.setSelection(normalizeRange(this.dragStart, cell));
  }

  onUp(event) {
    if (!this.dragStart) return;
    const cell = this.pointFromEvent(event);
    if (cell) this.setSelection(normalizeRange(this.dragStart, cell));
    this.dragStart = null;
    try { this.root.releasePointerCapture(event.pointerId); } catch { /* no capture */ }
  }

  onCancel() { this.dragStart = null; }
  onContext(event) {
    if (!this.selecting) return;
    event.preventDefault();
    event.stopPropagation();
    this.onContextMenu();
  }
  onEscape(event) {
    if (!this.selecting || event.key !== "Escape" || event.target?.matches?.("input,textarea,[contenteditable]")) return;
    this.setSelection(null);
  }

  render() {
    if (!this.root || !this.svg || !this.view) return;
    const viewRect = this.view.getBoundingClientRect();
    // The overlay is a DOM sibling of Foundry's canvas, not a PlaceableObject.
    const parentRect = this.parent.getBoundingClientRect();
    this.root.style.left = `${viewRect.left - parentRect.left + this.parent.scrollLeft}px`;
    this.root.style.top = `${viewRect.top - parentRect.top + this.parent.scrollTop}px`;
    this.root.style.width = `${viewRect.width}px`;
    this.root.style.height = `${viewRect.height}px`;
    this.svg.setAttribute("viewBox", `0 0 ${viewRect.width} ${viewRect.height}`);
    this.svg.replaceChildren();
    const state = this.sceneState;
    this.root.classList.toggle("gridlines-selecting", this.selecting && !this.pending);
    if (!this.localVisible || !state || !canvas.ready || !canvas.grid?.isSquare || viewRect.width < 1 || viewRect.height < 1) return;
    const sceneRect = canvas.dimensions.sceneRect;
    const resolver = squareResolver(canvas.grid, sceneRect);
    const toScreen = p => {
      const screen = canvas.clientCoordinatesFromCanvas(p);
      return {x: screen.x - viewRect.left, y: screen.y - viewRect.top};
    };
    const viewportA = canvas.canvasCoordinatesFromClient({x: viewRect.left, y: viewRect.top});
    const viewportB = canvas.canvasCoordinatesFromClient({x: viewRect.right, y: viewRect.bottom});
    const visibleWorld = clipBounds({x: Math.min(viewportA.x, viewportB.x), y: Math.min(viewportA.y, viewportB.y), right: Math.max(viewportA.x, viewportB.x), bottom: Math.max(viewportA.y, viewportB.y)}, sceneRect);
    if (!visibleWorld) return;
    const origin = resolver.bounds({row: 0, col: 0});
    const dx = canvas.grid.sizeX, dy = canvas.grid.sizeY;
    const firstCol = Math.max(0, Math.floor((visibleWorld.x - origin.x) / dx) - 1);
    const lastCol = Math.max(0, Math.ceil((visibleWorld.right - origin.x) / dx) + 1);
    const firstRow = Math.max(0, Math.floor((visibleWorld.y - origin.y) / dy) - 1);
    const lastRow = Math.max(0, Math.ceil((visibleWorld.bottom - origin.y) / dy) + 1);
    const status = this.pending;
    const clipped = clipBounds({x: origin.x, y: origin.y, right: sceneRect.x + sceneRect.width, bottom: sceneRect.y + sceneRect.height}, sceneRect);
    if (!clipped) return;
    const axes = state.axes;
    if (axes?.enabled && lastCol - firstCol <= LIMIT_AXIS_LINES && lastRow - firstRow <= LIMIT_AXIS_LINES) {
      const minor = [], major = [];
      const top = toScreen({x: visibleWorld.x, y: visibleWorld.y});
      const bottom = toScreen({x: visibleWorld.right, y: visibleWorld.bottom});
      const step = Math.max(1, Math.min(50, Number(axes.majorEvery) || 5));
      for (let c = firstCol; c <= lastCol; c++) {
        const x = origin.x + c * dx;
        if (x < visibleWorld.x || x > visibleWorld.right) continue;
        const px = toScreen({x, y: visibleWorld.y}).x;
        (c % step === 0 ? major : minor).push(`M${px.toFixed(2)} ${top.y.toFixed(2)}V${bottom.y.toFixed(2)}`);
      }
      for (let r = firstRow; r <= lastRow; r++) {
        const y = origin.y + r * dy;
        if (y < visibleWorld.y || y > visibleWorld.bottom) continue;
        const py = toScreen({x: visibleWorld.x, y}).y;
        (r % step === 0 ? major : minor).push(`M${top.x.toFixed(2)} ${py.toFixed(2)}H${bottom.x.toFixed(2)}`);
      }
      const color = /^#[0-9a-f]{6}$/i.test(axes.color) ? axes.color : "#65baff";
      const alpha = Math.min(1, Math.max(0, Number(axes.alpha ?? .65)));
      if (minor.length) this.svg.append(svgElement("path", {d: minor.join(" "), fill: "none", stroke: color, "stroke-width": "1", "stroke-opacity": alpha * .45}));
      if (major.length) this.svg.append(svgElement("path", {d: major.join(" "), fill: "none", stroke: color, "stroke-width": "2", "stroke-opacity": alpha}));
    }

    if (status) return; // Never show stale formatting against changed native coordinates.
    for (const format of state.formats) {
      const box = clipBounds(resolver.rangeBounds(format.range), sceneRect);
      if (!box) continue;
      const a = toScreen({x: box.x, y: box.y});
      const b = toScreen({x: box.right, y: box.bottom});
      this.svg.append(svgElement("rect", {x: a.x, y: a.y, width: Math.max(0, b.x - a.x), height: Math.max(0, b.y - a.y), fill: format.fill, "fill-opacity": format.opacity, stroke: "none"}));
    }
    for (const named of state.namedRanges) {
      const box = clipBounds(resolver.rangeBounds(named.range), sceneRect);
      if (!box) continue;
      const a = toScreen({x: box.x, y: box.y});
      const b = toScreen({x: box.right, y: box.bottom});
      this.svg.append(svgElement("rect", {x: a.x, y: a.y, width: Math.max(0, b.x - a.x), height: Math.max(0, b.y - a.y), fill: "none", stroke: "#eab75e", "stroke-width": 1.5, "stroke-dasharray": "6 4", "stroke-opacity": .85}));
    }
    if (this.selection) {
      const box = clipBounds(resolver.rangeBounds(this.selection), sceneRect);
      if (box) {
        const a = toScreen({x: box.x, y: box.y});
        const b = toScreen({x: box.right, y: box.bottom});
        this.svg.append(svgElement("rect", {x: a.x, y: a.y, width: Math.max(0, b.x - a.x), height: Math.max(0, b.y - a.y), fill: "#3b82f6", "fill-opacity": .15, stroke: "#60a5fa", "stroke-width": 2}));
      }
    }
    if (axes?.enabled && axes?.labels && dx > 0 && dy > 0 && lastCol - firstCol < 30 && lastRow - firstRow < 30) {
      const screenCellWidth = dx * (toScreen({x: visibleWorld.x + 1, y: visibleWorld.y}).x - toScreen({x: visibleWorld.x, y: visibleWorld.y}).x);
      if (screenCellWidth > 30) {
        // Labels appear along the topmost visible row to avoid cluttering battlemaps.
        const row = Math.max(0, firstRow);
        for (let col = firstCol; col < lastCol; col++) {
          const center = resolver.center({row, col});
          if (center.x < visibleWorld.x || center.x > visibleWorld.right) continue;
          const pos = toScreen(center);
          const label = svgElement("text", {x: pos.x, y: pos.y - dy * .23, "text-anchor": "middle", class: "gridlines-axis-label"});
          label.textContent = formatRange({from: {row, col}, to: {row, col}});
          this.svg.append(label);
        }
      }
    }
  }
}
