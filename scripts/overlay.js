import {overlayResolver, normalizeRange, columnName} from "./coordinates.js";
import {alignmentStatus, normalizeAxes, overlayGeometryChanged} from "./model.js";

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
    this.previewAxes = null;
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
  setPreviewAxes(value) { this.previewAxes = value ? normalizeAxes(value) : null; this.schedule(); }
  get axes() { return normalizeAxes(this.previewAxes ?? this.sceneState?.axes); }
  get geometryPreviewPending() {
    return this.previewAxes && this.sceneState && overlayGeometryChanged(this.sceneState.axes, this.previewAxes, Number(canvas.grid?.sizeX));
  }
  setVisible(visible) { this.localVisible = Boolean(visible); this.schedule(); }
  setSelecting(active) {
    this.selecting = Boolean(active);
    if (!this.selecting) this.dragStart = null;
    this.root?.classList.toggle("gridlines-selecting", this.selecting && !this.pending && !this.geometryPreviewPending);
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
    if (!canvas.ready || !canvas.grid?.isSquare || this.pending || this.geometryPreviewPending) return null;
    const point = canvas.canvasCoordinatesFromClient({x: event.clientX, y: event.clientY});
    return overlayResolver(canvas.grid, canvas.dimensions.sceneRect, this.axes).locate(point);
  }

  onDown(event) {
    if (!this.selecting || this.pending || this.geometryPreviewPending || event.button !== 0) return;
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
    this.root.classList.toggle("gridlines-selecting", this.selecting && !this.pending && !this.geometryPreviewPending);
    if (!this.localVisible || !state || !canvas.ready || !canvas.grid?.isSquare || viewRect.width < 1 || viewRect.height < 1) return;
    const sceneRect = canvas.dimensions.sceneRect;
    const axes = this.axes;
    const resolver = overlayResolver(canvas.grid, sceneRect, axes);
    const toScreen = p => {
      const screen = canvas.clientCoordinatesFromCanvas(p);
      return {x: screen.x - viewRect.left, y: screen.y - viewRect.top};
    };
    const viewportA = canvas.canvasCoordinatesFromClient({x: viewRect.left, y: viewRect.top});
    const viewportB = canvas.canvasCoordinatesFromClient({x: viewRect.right, y: viewRect.bottom});
    const visibleWorld = clipBounds({x: Math.min(viewportA.x, viewportB.x), y: Math.min(viewportA.y, viewportB.y), right: Math.max(viewportA.x, viewportB.x), bottom: Math.max(viewportA.y, viewportB.y)}, sceneRect);
    if (!visibleWorld) return;
    const origin = resolver.origin;
    const size = resolver.size;
    const status = this.pending;
    const screenA = toScreen({x: visibleWorld.x, y: visibleWorld.y});
    const screenB = toScreen({x: visibleWorld.right, y: visibleWorld.bottom});
    // All guides are calculated from the same preview-aware origin/spacing as
    // hit-testing, formatted cell bounds, and named range navigation.
    if (axes.enabled) {
      const step = size * axes.majorEvery / axes.minorDivisions;
      const xMin = Math.max(0, Math.ceil((visibleWorld.x - origin.x) / step - 1e-9));
      const xMax = Math.floor((visibleWorld.right - origin.x) / step + 1e-9);
      const yMin = Math.max(0, Math.ceil((visibleWorld.y - origin.y) / step - 1e-9));
      const yMax = Math.floor((visibleWorld.bottom - origin.y) / step + 1e-9);
      if (xMax - xMin <= LIMIT_AXIS_LINES && yMax - yMin <= LIMIT_AXIS_LINES) {
        const minor = [], major = [];
        for (let n = xMin; n <= xMax; n++) {
          const x = origin.x + n * step;
          const p = toScreen({x, y:visibleWorld.y});
          (n % axes.minorDivisions === 0 ? major : minor).push(`M${p.x.toFixed(2)} ${screenA.y.toFixed(2)}V${screenB.y.toFixed(2)}`);
        }
        for (let n = yMin; n <= yMax; n++) {
          const y = origin.y + n * step;
          const p = toScreen({x:visibleWorld.x, y});
          (n % axes.minorDivisions === 0 ? major : minor).push(`M${screenA.x.toFixed(2)} ${p.y.toFixed(2)}H${screenB.x.toFixed(2)}`);
        }
        if (minor.length) this.svg.append(svgElement("path", {class: "gridlines-minor-axes", d:minor.join(" "), fill:"none", stroke:axes.color,
          "stroke-width":axes.minorWidth, "stroke-opacity":axes.alpha * .55}));
        if (major.length) this.svg.append(svgElement("path", {class: "gridlines-major-axes", d:major.join(" "), fill:"none", stroke:axes.color,
          "stroke-width":axes.majorWidth, "stroke-opacity":axes.alpha}));
        // Headings label ONLY major axes: 10 cells/axis and 5 minor divisions
        // by default. Existing v0.1.1 Scenes keep absolute-cell labels to
        // avoid silently changing their previously established coordinates.
        if (axes.labels) {
          const firstMajorX = Math.max(0, Math.ceil((visibleWorld.x - origin.x)/(size * axes.majorEvery) - 1e-9));
          const lastMajorX = Math.floor((visibleWorld.right - origin.x)/(size * axes.majorEvery) + 1e-9);
          const firstMajorY = Math.max(0, Math.ceil((visibleWorld.y - origin.y)/(size * axes.majorEvery) - 1e-9));
          const lastMajorY = Math.floor((visibleWorld.bottom - origin.y)/(size * axes.majorEvery) + 1e-9);
          const screenStep = Math.abs(toScreen({x:origin.x + size * axes.majorEvery,y:origin.y}).x - toScreen({x:origin.x,y:origin.y}).x);
          if (screenStep > 40) {
            for (let majorCol = firstMajorX; majorCol <= lastMajorX && majorCol - firstMajorX <= 80; majorCol++) {
              const atX = origin.x + majorCol * axes.majorEvery * size;
              const at = toScreen({x:atX, y:visibleWorld.y});
              const lbl = svgElement("text", {x:at.x + 8, y:screenA.y + 15, class:"gridlines-axis-label", "text-anchor":"start"});
              lbl.textContent = axes.coordinateScope === "major" ? columnName(majorCol) : columnName(majorCol*axes.majorEvery);
              this.svg.append(lbl);
            }
            for (let majorRow = firstMajorY; majorRow <= lastMajorY && majorRow - firstMajorY <= 80; majorRow++) {
              const atY = origin.y + majorRow * axes.majorEvery * size;
              const at = toScreen({x:visibleWorld.x, y:atY});
              const lbl = svgElement("text", {x:screenA.x + 6, y:at.y + 27, class:"gridlines-axis-label", "text-anchor":"start"});
              lbl.textContent = String(1 + (axes.coordinateScope === "major" ? majorRow : majorRow*axes.majorEvery));
              this.svg.append(lbl);
            }
          }
        }
      }
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
  }
}
