import {overlayResolver, normalizeRange, columnName, selectionRange} from "./coordinates.js";
import {alignmentStatus, normalizeAxes, overlayGeometryChanged} from "./model.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LIMIT_AXIS_LINES = 250;

// Auto-contrasting outlines make custom font colors legible over mixed artwork.
export function labelOutlineColor(hex) {
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const light=rgb.map(x=>x<=.04045 ? x/12.92 : ((x+.055)/1.055)**2.4);
  return light[0]*.2126+light[1]*.7152+light[2]*.0722 > .24 ? "#111827" : "#ffffff";
}
function labelStyle(color,size) {
  return {fill:color,stroke:labelOutlineColor(color),"font-size":size};
}


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
    this.selectionMode = "major"; // Major selection covers the entire displayed G14 block.
    this.calibrating = null;
    this.calibrationStart = null;
    this.calibrationEnd = null;
    this.calibrationGuide = null;
    this.onCalibration = () => false;
    this.onCalibrationCancelled = () => {};
    this.placementMode = null;
    this.placementStart = null;
    this.placementInitialAxes = null;
    this.onPlacementPreview = () => {};
    this.onPlacementDone = () => {};
    this.onPickA1 = () => false;
    this.onPickMajorAxis = () => false;
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
    // Selection listens on Foundry's actual canvas in capture phase. The SVG
    // stays pointer-transparent in selection mode, so right-drag still reaches
    // Foundry's own pan handler instead of being swallowed by our overlay.
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"])
      view.addEventListener(type, this[{pointerdown:"onDown",pointermove:"onMove",pointerup:"onUp",pointercancel:"onCancel"}[type]], true);
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
    if (this.view) for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"])
      this.view.removeEventListener(type, this[{pointerdown:"onDown",pointermove:"onMove",pointerup:"onUp",pointercancel:"onCancel"}[type]], true);
    document.removeEventListener("keydown", this.onEscape);
    this.root?.remove();
    this.root = null;
    this.svg = null;
    if (this.parentPosition !== null && this.parent) this.parent.style.position = this.parentPosition;
    this.parentPosition = null;
    this.parent = null;
    this.view = null;
    this.dragStart = null;
    this.calibrating = null;
    this.calibrationStart = null;
    this.calibrationEnd = null;
    this.calibrationGuide = null;
    this.placementMode = null;
    this.placementStart = null;
    this.placementInitialAxes = null;
  }

  setSceneState(value) { this.sceneState = value; this.schedule(); }
  setPreviewAxes(value) { this.previewAxes = value ? normalizeAxes(value) : null; this.schedule(); }
  get axes() { return normalizeAxes(this.previewAxes ?? this.sceneState?.axes); }
  get geometryPreviewPending() {
    return this.previewAxes && this.sceneState && overlayGeometryChanged(this.sceneState.axes, this.previewAxes,
      Number(canvas.grid?.sizeX), Number(canvas.grid?.sizeY));
  }
  setVisible(visible) { this.localVisible = Boolean(visible); this.schedule(); }
  setSelecting(active) {
    if (active && this.calibrating) this.stopCalibration();
    if (active && this.placementMode) this.stopPlacement({cancel: true});
    this.selecting = Boolean(active);
    if (!this.selecting) this.dragStart = null;
    this.syncInteraction();
    this.schedule();
  }
  setSelectionMode(mode) {
    if (!["major", "fine"].includes(mode)) throw new Error("Select major map cells or fine subcells");
    if (this.selectionMode === mode) return;
    this.selectionMode = mode;
    this.dragStart = null;
    this.setSelection(null);
  }
  selectedSpan(first, last = first) {
    const a = this.axes;
    return selectionRange(first, last, {col:a.majorEveryX,row:a.majorEveryY},
      {row:a.a1Row,col:a.a1Col}, this.selectionMode);
  }
  syncInteraction() {
    this.root?.classList.toggle("gridlines-selecting", this.selecting && !this.pending && !this.geometryPreviewPending);
    this.root?.classList.toggle("gridlines-calibrating", Boolean(this.calibrating) && !this.pending);
    this.root?.classList.toggle("gridlines-dragging", this.placementMode === "drag" && !this.pending);
    this.root?.classList.toggle("gridlines-picking-a1", ["pick-a1", "pick-major-col", "pick-major-row"].includes(this.placementMode) && !this.pending);
  }
  startPlacement(mode) {
    if (!["drag", "pick-a1", "pick-major-col", "pick-major-row"].includes(mode)) throw new Error("Unknown grid placement mode");
    if (!this.root || !this.sceneState || this.pending || !canvas.ready || !canvas.grid?.isSquare)
      throw new Error("Enable Gridlines on a square-grid Scene before adjusting its position");
    if (this.calibrating) this.stopCalibration();
    this.selecting = false;
    this.dragStart = null;
    this.placementMode = mode;
    this.placementStart = null;
    this.placementInitialAxes = null;
    this.selection = null;
    this.onSelection(null);
    this.syncInteraction();
    this.schedule();
  }
  stopPlacement({cancel = false, quiet = false} = {}) {
    const active = Boolean(this.placementMode);
    if (cancel && this.placementStart && this.placementInitialAxes) {
      this.setPreviewAxes(this.placementInitialAxes);
      this.onPlacementPreview(this.placementInitialAxes);
    }
    this.placementMode = null;
    this.placementStart = null;
    this.placementInitialAxes = null;
    this.syncInteraction();
    this.schedule();
    if (active && !quiet) this.onPlacementDone();
  }
  startCalibration(cells) {
    if (![1, 5, 10].includes(cells)) throw new Error("Invalid calibration guide size");
    if (!this.root || !this.sceneState || this.pending || !canvas.ready || !canvas.grid?.isSquare)
      throw new Error("Enable Gridlines on a square-grid Scene before drawing a guide");
    if (this.placementMode) this.stopPlacement();
    this.selecting = false;
    this.dragStart = null;
    this.calibrating = cells;
    this.selection = null;
    this.onSelection(null);
    this.calibrationStart = null;
    this.calibrationEnd = null;
    this.calibrationGuide = null;
    this.syncInteraction();
    this.schedule();
  }
  stopCalibration({clearGuide = true} = {}) {
    const wasCalibrating = Boolean(this.calibrating);
    this.calibrating = null;
    this.calibrationStart = null;
    this.calibrationEnd = null;
    if (clearGuide) this.calibrationGuide = null;
    this.syncInteraction();
    this.schedule();
    if (wasCalibrating) this.onCalibrationCancelled();
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

  scenePointFromEvent(event) {
    if (!canvas.ready || !canvas.grid?.isSquare || this.pending) return null;
    const point = canvas.canvasCoordinatesFromClient({x: event.clientX, y: event.clientY});
    const rect = canvas.dimensions.sceneRect;
    return point && point.x >= rect.x && point.y >= rect.y &&
      point.x <= rect.x + rect.width && point.y <= rect.y + rect.height ? point : null;
  }
  pointFromEvent(event) {
    if (!canvas.ready || !canvas.grid?.isSquare || this.pending || this.geometryPreviewPending) return null;
    const point = canvas.canvasCoordinatesFromClient({x: event.clientX, y: event.clientY});
    return overlayResolver(canvas.grid, canvas.dimensions.sceneRect, this.axes).locate(point);
  }

  onDown(event) {
    if (this.placementMode && !this.pending && event.button === 0) {
      const point = this.scenePointFromEvent(event);
      if (!point) return;
      event.preventDefault(); event.stopPropagation();
      if (["pick-a1", "pick-major-col", "pick-major-row"].includes(this.placementMode)) {
        const cell = overlayResolver(canvas.grid, canvas.dimensions.sceneRect, this.axes).locate(point);
        if (cell && (this.placementMode === "pick-a1" ? this.onPickA1(cell)
          : this.onPickMajorAxis(this.placementMode === "pick-major-col" ? "col" : "row", cell)) === true)
          this.stopPlacement();
        return;
      }
      this.placementStart = point;
      this.placementInitialAxes = {...this.axes};
      try {this.root.setPointerCapture(event.pointerId);} catch { /* optional */ }
      this.schedule();
      return;
    }
    if (this.calibrating && !this.pending && event.button === 0) {
      const point = this.scenePointFromEvent(event);
      if (!point) return;
      event.preventDefault();event.stopPropagation();
      this.calibrationStart = point;
      this.calibrationEnd = point;
      this.calibrationGuide = null;
      try { this.root.setPointerCapture(event.pointerId); } catch { /* optional */ }
      this.schedule();
      return;
    }
    if (!this.selecting || this.pending || this.geometryPreviewPending || event.button !== 0) return;
    const cell = this.pointFromEvent(event);
    if (!cell) return;
    const selected = this.selectedSpan(cell);
    if (!selected) return; // Outside the chosen A1 major grid.
    event.preventDefault();
    event.stopPropagation();
    this.dragStart = cell;
    this.setSelection(selected);
    try { this.view.setPointerCapture(event.pointerId); } catch { /* browser may already have lost capture */ }
  }

  onMove(event) {
    if (this.placementMode === "drag" && this.placementStart) {
      // Allow pointer movement beyond Scene bounds while captured, and use world
      // coordinates so panning/zoom does not change the effective pixel offset.
      const point = canvas.canvasCoordinatesFromClient({x:event.clientX,y:event.clientY});
      if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
        const first = this.placementInitialAxes;
        const next = {...first,
          offsetX:Math.max(-20000,Math.min(20000,Math.round((first.offsetX+point.x-this.placementStart.x)*10)/10)),
          offsetY:Math.max(-20000,Math.min(20000,Math.round((first.offsetY+point.y-this.placementStart.y)*10)/10))};
        this.setPreviewAxes(next);
        this.onPlacementPreview(next); // Update the manager's draft; never write Scene flags.
      }
      return;
    }
    if (this.calibrationStart) {
      const point = this.scenePointFromEvent(event);
      if (point) {this.calibrationEnd = point;this.schedule();}
      return;
    }
    if (!this.dragStart) return;
    const cell = this.pointFromEvent(event);
    if (!cell) return;
    const selected = this.selectedSpan(this.dragStart, cell);
    if (selected) this.setSelection(selected);
  }

  onUp(event) {
    if (this.placementMode === "drag" && this.placementStart) {
      this.onMove(event); // Use the release point even if the browser skipped its last move.
      try {this.root.releasePointerCapture(event.pointerId);} catch { /* optional */ }
      this.stopPlacement();
      return;
    }
    if (this.calibrationStart) {
      const last = this.scenePointFromEvent(event) ?? this.calibrationEnd;
      const guide = {from: this.calibrationStart, to: last, cells: this.calibrating};
      this.calibrationStart = null;
      this.calibrationEnd = null;
      try {this.root.releasePointerCapture(event.pointerId);} catch { /* optional */ }
      // No document writes or changes to native Foundry geometry occur here.
      const previousMode = this.calibrating;
      this.calibrating = null;
      const accepted = this.onCalibration(guide) === true;
      if (accepted) this.calibrationGuide = guide;
      else {
        this.calibrating = previousMode; // Retry an insufficient or malformed span.
        this.onCalibrationCancelled(); // Refresh the guide buttons.
      }
      this.syncInteraction();
      this.schedule();
      return;
    }
    if (!this.dragStart) return;
    const cell = this.pointFromEvent(event);
    if (cell) {
      const selected = this.selectedSpan(this.dragStart, cell);
      if (selected) this.setSelection(selected);
    }
    this.dragStart = null;
    try { this.view.releasePointerCapture(event.pointerId); } catch { /* no capture */ }
  }

  onCancel() {
    if (this.placementMode === "drag" && this.placementStart) {
      this.stopPlacement({cancel:true});
      return;
    }
    this.dragStart = null;
    this.calibrationStart = null;
    this.calibrationEnd = null;
    this.schedule();
  }
  onContext(event) {
    // Right-click and right-drag while selecting belong to Foundry canvas pan.
    if (this.selecting || (!this.calibrating && !this.placementMode)) return;
    event.preventDefault();
    event.stopPropagation();
    this.onContextMenu();
  }
  onEscape(event) {
    if ((!this.selecting && !this.calibrating && !this.placementMode) || event.key !== "Escape" || event.target?.matches?.("input,textarea,[contenteditable]")) return;
    if (this.placementMode) this.stopPlacement({cancel:true});
    else if (this.calibrating) this.stopCalibration();
    else this.setSelection(null);
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
    this.syncInteraction();
    if (!state || !canvas.ready || !canvas.grid?.isSquare || viewRect.width < 1 || viewRect.height < 1) return;
    if (!this.localVisible && !this.calibrating && !this.calibrationGuide && !this.placementMode) return;
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
    const {sizeX, sizeY} = resolver;
    const majorOrigin = {x:origin.x+axes.a1Col*sizeX,y:origin.y+axes.a1Row*sizeY};
    const status = this.pending;
    const screenA = toScreen({x: visibleWorld.x, y: visibleWorld.y});
    const screenB = toScreen({x: visibleWorld.right, y: visibleWorld.bottom});
    // All guides are calculated from the same preview-aware origin/spacing as
    // hit-testing, formatted cell bounds, and named range navigation.
    if (axes.enabled && this.localVisible) {
      const stepX = sizeX * axes.majorEveryX / axes.minorDivisionsX;
      const stepY = sizeY * axes.majorEveryY / axes.minorDivisionsY;
      const xMin = Math.ceil((visibleWorld.x - majorOrigin.x) / stepX - 1e-9);
      const xMax = Math.floor((visibleWorld.right - majorOrigin.x) / stepX + 1e-9);
      const yMin = Math.ceil((visibleWorld.y - majorOrigin.y) / stepY - 1e-9);
      const yMax = Math.floor((visibleWorld.bottom - majorOrigin.y) / stepY + 1e-9);
      if (xMax - xMin <= LIMIT_AXIS_LINES && yMax - yMin <= LIMIT_AXIS_LINES) {
        const minor = [], major = [];
        for (let n = xMin; n <= xMax; n++) {
          const x = majorOrigin.x + n * stepX;
          const p = toScreen({x, y:visibleWorld.y});
          (n % axes.minorDivisionsX === 0 ? major : minor).push(`M${p.x.toFixed(2)} ${screenA.y.toFixed(2)}V${screenB.y.toFixed(2)}`);
        }
        for (let n = yMin; n <= yMax; n++) {
          const y = majorOrigin.y + n * stepY;
          const p = toScreen({x:visibleWorld.x, y});
          (n % axes.minorDivisionsY === 0 ? major : minor).push(`M${screenA.x.toFixed(2)} ${p.y.toFixed(2)}H${screenB.x.toFixed(2)}`);
        }
        if (minor.length) this.svg.append(svgElement("path", {class: "gridlines-minor-axes", d:minor.join(" "), fill:"none", stroke:axes.color,
          "stroke-width":axes.minorWidth, "stroke-opacity":axes.alpha * .55}));
        if (major.length) this.svg.append(svgElement("path", {class: "gridlines-major-axes", d:major.join(" "), fill:"none", stroke:axes.color,
          "stroke-width":axes.majorWidth, "stroke-opacity":axes.alpha}));
        // Headings label ONLY major axes: 10 cells/axis and 5 minor divisions
        // by default. Existing v0.1.1 Scenes keep absolute-cell labels to
        // avoid silently changing their previously established coordinates.
        if (axes.labels) {
          const firstMajorX = Math.max(0, Math.ceil((visibleWorld.x - majorOrigin.x)/(sizeX * axes.majorEveryX) - 1e-9));
          const lastMajorX = Math.floor((visibleWorld.right - majorOrigin.x)/(sizeX * axes.majorEveryX) + 1e-9);
          const firstMajorY = Math.max(0, Math.ceil((visibleWorld.y - majorOrigin.y)/(sizeY * axes.majorEveryY) - 1e-9));
          const lastMajorY = Math.floor((visibleWorld.bottom - majorOrigin.y)/(sizeY * axes.majorEveryY) + 1e-9);
          const screenStepX = Math.abs(toScreen({x:origin.x + sizeX * axes.majorEveryX,y:origin.y}).x - toScreen({x:origin.x,y:origin.y}).x);
          const screenStepY = Math.abs(toScreen({x:origin.x,y:origin.y+sizeY * axes.majorEveryY}).y - toScreen({x:origin.x,y:origin.y}).y);
          if (screenStepX > 40) {
            for (let majorCol = firstMajorX; majorCol <= lastMajorX && majorCol - firstMajorX <= 80; majorCol++) {
              const atX = majorOrigin.x + majorCol * axes.majorEveryX * sizeX;
              const at = toScreen({x:atX, y:visibleWorld.y});
              const lbl = svgElement("text", {x:at.x + 8, y:screenA.y + Math.max(15,axes.colLabelSize+3), class:"gridlines-axis-label", "text-anchor":"start",
                ...labelStyle(axes.colLabelColor,axes.colLabelSize)});
              lbl.textContent = axes.coordinateScope === "major" ? columnName(majorCol) : columnName(majorCol*axes.majorEveryX);
              this.svg.append(lbl);
            }
          }
          if (screenStepY > 40) {
            for (let majorRow = firstMajorY; majorRow <= lastMajorY && majorRow - firstMajorY <= 80; majorRow++) {
              const atY = majorOrigin.y + majorRow * axes.majorEveryY * sizeY;
              const at = toScreen({x:visibleWorld.x, y:atY});
              const lbl = svgElement("text", {x:screenA.x + 6, y:at.y + Math.max(27,axes.rowLabelSize+12), class:"gridlines-axis-label", "text-anchor":"start",
                ...labelStyle(axes.rowLabelColor,axes.rowLabelSize)});
              lbl.textContent = String(1 + (axes.coordinateScope === "major" ? majorRow : majorRow*axes.majorEveryY));
              this.svg.append(lbl);
            }
          }
        }
        // Small reference ruler in the first major block only. If the display
        // has fewer minor divisions than underlying cells, give the GM a visual
        // way to locate fine-cell positions without printing A/K/U everywhere.
        const drawRuler = axes.rulerMode === "on" || (axes.rulerMode === "auto" &&
          (axes.majorEveryX !== axes.minorDivisionsX || axes.majorEveryY !== axes.minorDivisionsY));
        if (drawRuler) {
          const inside = (x,y) => x >= visibleWorld.x && x <= visibleWorld.right && y >= visibleWorld.y && y <= visibleWorld.bottom;
          const headingY = majorOrigin.y + Math.min(sizeY * .24, 14 / Math.max(.001, Math.abs(toScreen({x:origin.x,y:origin.y+1}).y-toScreen({x:origin.x,y:origin.y}).y)));
          const headingX = majorOrigin.x + Math.min(sizeX * .15, 8);
          const widthOnScreen = Math.abs(toScreen({x:majorOrigin.x + sizeX,y:majorOrigin.y}).x - toScreen(majorOrigin).x);
          const heightOnScreen = Math.abs(toScreen({x:majorOrigin.x,y:majorOrigin.y+sizeY}).y - toScreen(majorOrigin).y);
          if (widthOnScreen >= 14) for(let i=0;i<axes.majorEveryX && i<50;i++) {
            const point={x:majorOrigin.x+(i+.5)*sizeX,y:headingY};
            if (!inside(point.x,point.y)) continue;
            const screen=toScreen(point);
            const t=svgElement("text",{x:screen.x,y:screen.y,class:"gridlines-ruler-column","text-anchor":"middle",
              ...labelStyle(axes.subLabelColor,axes.subLabelSize)});
            // If B starts ten fine cells after A, the interior ticks are 1–10;
            // in legacy A/K/U mode they remain fine-cell letters A–J.
            t.textContent=axes.coordinateScope === "major" ? String(i+1) : columnName(i);
            this.svg.append(t);
          }
          if (heightOnScreen >= 13) for(let i=0;i<axes.majorEveryY && i<50;i++) {
            const point={x:headingX,y:majorOrigin.y+(i+.5)*sizeY};
            if (!inside(point.x,point.y)) continue;
            const screen=toScreen(point);
            const t=svgElement("text",{x:screen.x,y:screen.y,class:"gridlines-ruler-row","text-anchor":"start",
              ...labelStyle(axes.subLabelColor,axes.subLabelSize)});
            t.textContent=String(i+1);this.svg.append(t);
          }
        }
      }
    }

    if (status) return; // Never show stale formatting against changed native coordinates.
    if (this.localVisible) for (const format of state.formats) {
      const box = clipBounds(resolver.rangeBounds(format.range), sceneRect);
      if (!box) continue;
      const a = toScreen({x: box.x, y: box.y});
      const b = toScreen({x: box.right, y: box.bottom});
      this.svg.append(svgElement("rect", {x: a.x, y: a.y, width: Math.max(0, b.x - a.x), height: Math.max(0, b.y - a.y), fill: format.fill, "fill-opacity": format.opacity, stroke: "none"}));
    }
    if (this.localVisible) for (const named of state.namedRanges) {
      const box = clipBounds(resolver.rangeBounds(named.range), sceneRect);
      if (!box) continue;
      const a = toScreen({x: box.x, y: box.y});
      const b = toScreen({x: box.right, y: box.bottom});
      this.svg.append(svgElement("rect", {x: a.x, y: a.y, width: Math.max(0, b.x - a.x), height: Math.max(0, b.y - a.y), fill: "none", stroke: "#eab75e", "stroke-width": 1.5, "stroke-dasharray": "6 4", "stroke-opacity": .85}));
    }
    if (this.selection && this.localVisible) {
      const box = clipBounds(resolver.rangeBounds(this.selection), sceneRect);
      if (box) {
        const a = toScreen({x: box.x, y: box.y});
        const b = toScreen({x: box.right, y: box.bottom});
        this.svg.append(svgElement("rect", {x: a.x, y: a.y, width: Math.max(0, b.x - a.x), height: Math.max(0, b.y - a.y), fill: "#3b82f6", "fill-opacity": .15, stroke: "#60a5fa", "stroke-width": 2}));
      }
    }
    // Temporary explicit origin marker: visible while moving/picking A1 and
    // while the picked origin is pending approval. It does not create a Drawing.
    if (this.placementMode || (this.previewAxes && (this.previewAxes.a1Row!==normalizeAxes(state.axes).a1Row ||
        this.previewAxes.a1Col!==normalizeAxes(state.axes).a1Col))) {
      const anchorBox = clipBounds(resolver.rangeBounds({from:{row:axes.a1Row,col:axes.a1Col},
        to:{row:Math.min(99999,axes.a1Row+axes.majorEveryY-1),col:Math.min(99999,axes.a1Col+axes.majorEveryX-1)}}),sceneRect);
      if (anchorBox) {
        const a=toScreen({x:anchorBox.x,y:anchorBox.y}), b=toScreen({x:anchorBox.right,y:anchorBox.bottom});
        this.svg.append(svgElement("rect", {class:"gridlines-a1-area",x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y,
          fill:"#f59e0b","fill-opacity":.06,stroke:"#fbbf24","stroke-width":2,"stroke-dasharray":"7 4"}));
        const tag=svgElement("text",{class:"gridlines-a1-label",x:a.x+8,y:a.y+20});
        tag.textContent="A1";this.svg.append(tag);
      }
    }
    const guide = this.calibrationStart
      ? {from: this.calibrationStart, to: this.calibrationEnd ?? this.calibrationStart, cells: this.calibrating}
      : this.calibrationGuide;
    if (guide) {
      const a = toScreen(guide.from), b = toScreen(guide.to);
      const x = Math.min(a.x,b.x), y = Math.min(a.y,b.y);
      const width = Math.abs(a.x-b.x), height = Math.abs(a.y-b.y);
      if (Math.min(width,height) > 8) {
        this.svg.append(svgElement("rect", {class:"gridlines-calibration-guide",x,y,width,height,
          fill:"#f59e0b","fill-opacity":.09,stroke:"#fbbf24","stroke-width":2.5,"stroke-dasharray":"9 5"}));
      }
      this.svg.append(svgElement("line", {class:"gridlines-calibration-guide",x1:a.x,y1:a.y,x2:b.x,y2:b.y,
        stroke:"#fbbf24","stroke-width":2.5,"stroke-dasharray":"8 4"}));
      for(const p of [a,b]) this.svg.append(svgElement("circle", {cx:p.x,cy:p.y,r:4,fill:"#fbbf24",stroke:"#111827","stroke-width":1}));
      const note = svgElement("text", {class:"gridlines-calibration-label",x:x+9,y:Math.max(18,y-8)});
      note.textContent = `${guide.cells} x ${guide.cells} calibration`;
      this.svg.append(note);
    }
  }
}
