import {parseRange, normalizeRange, formatRange, overlayResolver, squareResolver, parseMajorRange, formatMajorRange, parseAnchoredFineRange, parseDisplayedRange, formatDisplayedRange} from "./coordinates.js";
import {calibrateGuide, CALIBRATION_PRESETS} from "./calibration.js";
import {geometrySnapshot, alignmentStatus, addFill, addNamedRange, normalizeAxes, validateAxes, overlayGeometryChanged,
  previewClearShading, clearShadingInSelection, clearShadingLayer, clearAllShading, updateShadingLayer,
  setPlayerGridVisible, setShadingPlayerVisible} from "./model.js";
import {planShadingRegions, createShadingRegions, existingShadeRegionIds, MAX_REGION_BATCH} from "./region-bridge.js";
import {NativeGridDisplay, copyFoundryGrid, planNativeGridMatch} from "./native-grid.js";

const uid = () => globalThis.crypto?.randomUUID?.() ?? foundry.utils.randomID();

function button(label, action, parent, {disabled = false, title = ""} = {}) {
  const control = document.createElement("button");
  control.type = "button";
  control.textContent = label;
  control.title = title;
  control.disabled = disabled;
  control.addEventListener("click", action);
  parent.append(control);
  return control;
}
function node(tag, parent, value, className = "") {
  const n = document.createElement(tag);
  if (value !== undefined) n.textContent = value;
  if (className) n.className = className;
  parent.append(n);
  return n;
}
function field(label, type, parent, value = "") {
  const wrap = node("label", parent, undefined, "gridlines-field");
  node("span", wrap, label);
  const input = node("input", wrap);
  input.type = type;
  input.value = value;
  return input;
}

export class GridlinesPanel {
  constructor(service, overlay) {
    this.service = service;
    this.overlay = overlay;
    this.visible = false;
    this.selection = null;
    this.inputs = {color: "#2563eb", opacity: "25", name: "", go: ""};
    this.axesDraft = null;
    this.calibrationResult = null;
    this.draftSceneId = null;
    this.preservePreview = null;
    this.statusText = "";
    this.nativeGrid = new NativeGridDisplay();
    this.nativePreview = null;
    this.shadingExpanded = true;
    this.editingShadeId = null;
    this.editingShadeDraft = null;
    this.regionPreview = null;
    this.regionBackupAcknowledged = false;
  }

  get scene() { return canvas.ready ? canvas.scene : null; }
  open() { this.visible = true; this.render(); }
  close() {
    // A closed panel must never leave an invisible click-catching overlay active.
    this.overlay.setSelecting(false);
    this.overlay.stopPlacement?.({cancel:true,quiet:true});
    this.overlay.stopCalibration?.();
    this.visible = false;
    this.axesDraft = null;
    this.calibrationResult = null;
    this.draftSceneId = null;
    this.overlay.setPreviewAxes?.(null);
    this.nativeGrid.restore();
    this.nativePreview = null;
    this.resetRegionPreview();
    this.editingShadeId = null;
    this.editingShadeDraft = null;
    this.root?.remove(); this.root = null;
  }
  toggle() { this.visible ? this.close() : this.open(); }
  refresh() { this.nativeGrid.sync(); if (this.visible) this.render(); }
  setSelection(range) {
    this.selection = range;
    if (this.visible) this.render();
  }
  announce(message) { ui.notifications?.info?.(message); this.statusText = message; this.refresh(); }
  resetRegionPreview() {
    this.regionPreview=null;
    this.regionBackupAcknowledged=false;
    this.overlay.setRegionPreview?.([]);
  }
  requireSavedGeometry() {
    const state=this.service.read(this.scene);
    if (!state || alignmentStatus(state,geometrySnapshot(this.scene)).pending ||
        this.overlay.geometryPreviewPending || this.overlay.calibrating || this.overlay.placementMode ||
        (this.axesDraft && JSON.stringify(normalizeAxes(this.axesDraft))!==JSON.stringify(normalizeAxes(state.axes))))
      throw new Error("Resolve native alignment and save or discard Grid Setup previews before editing shading or creating Regions");
    return state;
  }
  async locateShading(layer) {
    const state=this.requireSavedGeometry();
    if (!state.formats.some(f=>f.id===layer.id)) throw new Error("Shading layer no longer exists");
    const resolver=overlayResolver(canvas.grid,canvas.dimensions.sceneRect,state.axes);
    const box=resolver.rangeBounds(layer.range),rect=canvas.dimensions.sceneRect;
    const x0=Math.max(box.x,rect.x),x1=Math.min(box.right,rect.x+rect.width);
    const y0=Math.max(box.y,rect.y),y1=Math.min(box.bottom,rect.y+rect.height);
    if (x1<=x0||y1<=y0) throw new Error("Shading area is outside the visible Scene");
    this.overlay.flashRange(layer.range);
    await canvas.animatePan({x:(x0+x1)/2,y:(y0+y1)/2,duration:350});
    this.announce(`Located shading ${layer.label||""}`.trim());
  }
  configureShading(layer) {
    this.requireSavedGeometry();
    this.shadingExpanded=true;
    this.editingShadeId=layer.id;
    this.editingShadeDraft={label:layer.label??"",fill:layer.fill,opacity:Math.round(layer.opacity*100)};
    this.refresh();
  }
  prepareRegionPreview(ids) {
    const scene=this.scene,state=this.requireSavedGeometry();
    const axes=normalizeAxes(state.axes);
    const visibleName=range=>axes.coordinateScope==="major"
      ? formatDisplayedRange(range,{col:axes.majorEveryX,row:axes.majorEveryY},{row:axes.a1Row,col:axes.a1Col},"numbers")
      : `cell:${formatRange(range)}`;
    const preview=planShadingRegions({scene,state,ids,resolver:overlayResolver(canvas.grid,canvas.dimensions.sceneRect,axes),
      sceneRect:canvas.dimensions.sceneRect,displayName:visibleName});
    this.regionPreview=preview;
    this.regionBackupAcknowledged=false;
    this.shadingExpanded=true;
    this.overlay.setRegionPreview?.(preview.items.map(i=>i.range));
    this.refresh();
    return preview;
  }
  async confirmRegionCreation() {
    const preview=this.regionPreview;
    if (!preview) throw new Error("Preview the shading-to-Region conversion first");
    if (!this.regionBackupAcknowledged) throw new Error("Confirm a recoverable Scene backup before creating Regions");
    const scene=this.scene,state=this.requireSavedGeometry();
    const axes=normalizeAxes(state.axes);
    const visibleName=range=>axes.coordinateScope==="major"
      ? formatDisplayedRange(range,{col:axes.majorEveryX,row:axes.majorEveryY},{row:axes.a1Row,col:axes.a1Col},"numbers")
      : `cell:${formatRange(range)}`;
    const message=`Create ${preview.items.length} native Foundry Region${preview.items.length===1?"":"s"} from shading? The new Regions will have no behaviors. Original Gridlines+ shading and all existing Regions remain unchanged.`;
    const DialogV2=globalThis.foundry?.applications?.api?.DialogV2;
    let accepted;
    if (typeof DialogV2?.confirm==="function") accepted=await DialogV2.confirm({window:{title:"Create Regions from Gridlines+ shading"},content:`<p>${message}</p>`});
    else if (typeof globalThis.window?.confirm==="function") accepted=globalThis.window.confirm(message);
    else throw new Error("Native confirmation unavailable; no Regions created");
    if (!accepted) return null;
    const created=await createShadingRegions({scene,state,plan:preview,
      resolver:overlayResolver(canvas.grid,canvas.dimensions.sceneRect,axes),sceneRect:canvas.dimensions.sceneRect,
      displayName:visibleName});
    this.resetRegionPreview();
    this.announce(`Created ${created.length} Foundry Region${created.length===1?"":"s"}; shading and named ranges preserved`);
    return created;
  }
  async run(task) {
    try {
      const value = await task();
      this.overlay.setSceneState(this.service.read(this.scene));
      this.refresh();
      return value;
    } catch (error) {
      console.error("Gridlines:", error);
      ui.notifications?.error?.(`Gridlines: ${error.message}`);
      this.refresh();
      return null;
    }
  }
  /** Receive a finished temporary canvas guide and preview its calculated geometry. */
  applyCalibration(guide) {
    try {
      const scene = this.scene;
      const state = this.service.read(scene);
      if (!scene || !state || alignmentStatus(state, geometrySnapshot(scene)).pending)
        throw new Error("Enable Gridlines and resolve any native grid changes first");
      const native = squareResolver(canvas.grid, canvas.dimensions.sceneRect);
      const origin = native.bounds({row:0,col:0});
      const draft = normalizeAxes(this.axesDraft ?? state.axes);
      const measured = calibrateGuide({from:guide.from,to:guide.to,cells:guide.cells,
        nativeOrigin:{x:origin.x,y:origin.y},nativeSize:Number(canvas.grid.sizeX),axes:draft});
      const next = validateAxes({...draft,...measured.recommended});
      this.axesDraft = next;
      this.calibrationResult = measured;
      this.overlay.setPreviewAxes(next);
      this.announce(`Calibration preview: ${next.cellWidth ?? canvas.grid.sizeX}px wide × ${next.cellHeight ?? canvas.grid.sizeY}px tall; ${measured.mode} guide`);
      return true;
    } catch(error) {
      ui.notifications?.warn?.(`Gridlines calibration: ${error.message}`);
      this.statusText = `Try the guide again: ${error.message}`;
      this.refresh();
      return false;
    }
  }

  /** Update draft origin without writing the Scene; invoked on every drag move. */
  applyDragPreview(axes) {
    this.axesDraft = validateAxes(axes);
    this.calibrationResult = null;
  }

  /** Pick any underlying fine cell as the top-left of the new A1 major block. */
  applyA1(cell) {
    try {
      const scene=this.scene, state=this.service.read(scene);
      if(!scene || !state || alignmentStatus(state, geometrySnapshot(scene)).pending)
        throw new Error("Enable Gridlines and resolve native grid changes before choosing A1");
      const next=validateAxes({...normalizeAxes(this.axesDraft ?? state.axes),a1Row:cell.row,a1Col:cell.col});
      this.axesDraft=next;
      this.calibrationResult=null;
      this.overlay.setPreviewAxes(next);
      this.announce(`A1 starts at fine cell ${cell.col+1}, row ${cell.row+1}. Preview only; click Save Grid Setup.`);
      return true;
    } catch(error) {
      ui.notifications?.warn?.(`Gridlines A1: ${error.message}`);
      return false;
    }
  }

  applyMajorAnchor(axis, cell) {
    try {
      const scene = this.scene, state = this.service.read(scene);
      if (!scene || !state || alignmentStatus(state, geometrySnapshot(scene)).pending)
        throw new Error("Resolve native grid changes before choosing a major axis");
      const draft = normalizeAxes(this.axesDraft ?? state.axes);
      const next = validateAxes({...draft, [axis === "col" ? "a1Col" : "a1Row"]: cell[axis]});
      this.axesDraft = next;
      this.overlay.setPreviewAxes(next);
      this.announce(`First major ${axis === "col" ? "column" : "row"} begins at fine cell ${cell[axis]+1}; preview only`);
      return true;
    } catch(error) { ui.notifications?.warn?.(`Gridlines major axes: ${error.message}`); return false; }
  }

  async applyNativeMatch(plan, state, backupChecked) {
    const scene = this.scene;
    if (!plan || scene?.id !== plan.sceneId || !plan.changes) throw new Error("Preview the native grid change first");
    if (!backupChecked) throw new Error("Confirm a recoverable backup before changing Foundry's grid");
    if (this.service.read(scene)?.revision !== state.revision || Number(scene._source?.grid?.size ?? scene.grid?.size) !== plan.from)
      throw new Error("Scene settings changed since the preview; preview the native grid again");
    if (this.overlay.geometryPreviewPending || JSON.stringify(normalizeAxes(state.axes)) !== JSON.stringify(normalizeAxes(this.axesDraft)))
      throw new Error("Save or discard Gridlines+ overlay changes before changing the Foundry grid");
    const accepted = await this.confirmNativeChange(plan);
    if (!accepted) return;
    this.nativePreview = null;
    // Do NOT update the native grid baseline here. The existing grid-change
    // safeguard pauses location edits and requires an explicit alignment review.
    await scene.update({"grid.size": plan.to});
    ui.notifications?.warn?.("Foundry grid size updated. Review Gridlines+ alignment before editing saved locations.");
  }

  async confirmNativeChange(plan) {
    const message = `Change Foundry's movement/snapping grid from ${plan.from}px to ${plan.to}px? This can shift the apparent alignment of Tokens, Walls, Lights and Tiles. Confirm a recoverable world backup before continuing. The Gridlines+ alignment review will remain required afterward.`;
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof DialogV2?.confirm === "function") return Boolean(await DialogV2.confirm({window:{title:"Apply native Foundry grid change"},content:`<p>${message}</p>`}));
    if (typeof globalThis.window?.confirm === "function") return Boolean(globalThis.window.confirm(message));
    throw new Error("Foundry's native confirmation dialog was unavailable; no changes made");
  }

  currentSelection() {
    if (!this.selection) throw new Error("Select cells first, using Gridlines > Select Cells");
    return normalizeRange(this.selection.from, this.selection.to);
  }
  validateRange(range) {
    const rect = canvas.dimensions.sceneRect;
    const state = this.service.read(this.scene);
    const resolver = overlayResolver(canvas.grid, rect, state?.axes);
    const box = resolver.rangeBounds(range);
    if (box.right <= rect.x || box.bottom <= rect.y || box.x >= rect.x + rect.width || box.y >= rect.y + rect.height)
      throw new Error("Coordinate is outside this Scene");
    return range;
  }
  async go(value) {
    const state = this.service.read(this.scene);
    if (!state) throw new Error("Enable Gridlines on this Scene first");
    if (alignmentStatus(state, geometrySnapshot(this.scene)).pending) throw new Error("Resolve the grid alignment warning first");
    if (this.overlay.geometryPreviewPending || this.overlay.calibrating || this.overlay.placementMode)
      throw new Error("Save or discard the grid calibration preview before navigating");
    const target = String(value || "").trim();
    const named = state.namedRanges.find(n => n.name.toLocaleLowerCase() === target.toLocaleLowerCase());
    const axes = normalizeAxes(state.axes);
    const query = target.toLowerCase().startsWith("cell:") ? target.slice(5).trim() : target;
    const exactCell = target.toLowerCase().startsWith("cell:");
    const anchor={row:axes.a1Row,col:axes.a1Col};
    const range = this.validateRange(named?.range ?? (exactCell ? parseRange(query) : axes.coordinateScope === "cell"
      ? parseAnchoredFineRange(query, anchor) : parseDisplayedRange(query, {col: axes.majorEveryX, row: axes.majorEveryY}, anchor)));
    const resolver = overlayResolver(canvas.grid, canvas.dimensions.sceneRect, axes);
    this.overlay.setSelection(range);
    const box = resolver.rangeBounds(range), rect = canvas.dimensions.sceneRect;
    const x0 = Math.max(box.x, rect.x), x1 = Math.min(box.right,rect.x+rect.width);
    const y0 = Math.max(box.y, rect.y), y1 = Math.min(box.bottom,rect.y+rect.height);
    await canvas.animatePan({x:(x0+x1)/2,y:(y0+y1)/2,duration:350});
  }

  /** A destructive operation is confirmed by Foundry or the browser, never implicitly approved. */
  async confirmShadingClear(count, scope) {
    const text = `Clear ${count} shading layer${count === 1 ? "" : "s"} ${scope}? Named ranges and Scene objects will remain unchanged. Back up this Scene before removing large sets of shading.`;
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof DialogV2?.confirm === "function")
      return Boolean(await DialogV2.confirm({window:{title:"Remove Gridlines+ shading"},content:`<p>${text}</p>`}));
    if (typeof globalThis.window?.confirm === "function") return Boolean(globalThis.window.confirm(text));
    throw new Error("Confirmation dialog unavailable; shading was not removed");
  }

  render() {
    if (!this.visible || !game.user.isGM) return;
    if (!this.root) {
      this.root = node("section", document.body, undefined, "gridlines-panel");
      this.root.setAttribute("role", "region");
      this.root.setAttribute("aria-label", "AFT Gridlines+ manager");
    }
    const root = this.root;
    const priorScroll = root.scrollTop;
    root.replaceChildren();
    const header = node("div", root, undefined, "gridlines-panel-header");
    node("strong", header, "AFT Gridlines+");
    button("×", () => this.close(), header, {title: "Close AFT Gridlines+ manager"});
    const scene = this.scene;
    if (!scene) { node("p", root, "Open a Scene to use Gridlines."); return; }
    if (!canvas.grid?.isSquare) { node("p", root, "This build requires a native Foundry square-grid Scene, although the Gridlines visual overlay can use rectangular cells. No Scene data was changed."); return; }
    let state, snapshot;
    try { state = this.service.read(scene); snapshot = geometrySnapshot(scene); }
    catch (error) { node("p", root, `Cannot read Scene data: ${error.message}`); return; }
    if (!state) {
      node("p", root, "Start on a test Scene. This enables the grid overlay without changing Foundry's grid, Tokens, Drawings, Tiles, or Regions.");
      button("Enable on this Scene", () => this.run(async () => {
        await this.service.enable(scene);
        this.announce("Gridlines enabled for this Scene");
      }), root);
      return;
    }
    const pending = alignmentStatus(state, snapshot).pending;
    if (this.draftSceneId !== scene.id) {
      this.axesDraft=null;this.calibrationResult=null;
      this.overlay.stopPlacement?.({cancel:true,quiet:true});
      this.draftSceneId=scene.id;this.overlay.setPreviewAxes(null);
      this.nativeGrid.restore(); this.nativePreview=null;
      this.editingShadeId=null;this.editingShadeDraft=null;this.resetRegionPreview();
      this.shadingExpanded=true;
    }
    if (this.regionPreview && this.regionPreview.revision !== state.revision) this.resetRegionPreview();
    if (pending) {
      const warning = node("div", root, undefined, "gridlines-warning");
      node("strong", warning, "Foundry grid alignment changed");
      node("p", warning, `Approved: ${state.baseline.size}px · Current: ${snapshot.size}px. Saved locations and fills are preserved. Editing and navigation are paused until you review the change.`);
      const backupCheck = node("label", warning, undefined, "gridlines-check");
      const backup = node("input", backupCheck);
      backup.type = "checkbox";
      node("span", backupCheck, "I have a recoverable backup of this test Scene/world");
      const row = node("div", warning, undefined, "gridlines-actions");
      const applyKeep = button("Keep Cell Addresses", () => this.run(async () => {
        if (!backup.checked) throw new Error("Confirm the Scene backup before approving geometry changes");
        await this.service.acceptCurrentGeometry(scene, state.revision);
        this.preservePreview = null;
        this.announce("Gridlines addresses retained on the new Foundry grid");
      }), row);
      const preview = button("Preview Keep Map Locations", () => this.run(async () => {
        this.preservePreview = this.service.previewPreserveMap(scene);
        this.refresh();
      }), row);
      void applyKeep; void preview;
      if (this.preservePreview) {
        const note = node("div", warning, undefined, "gridlines-preview");
        node("strong", note, "Proposed remapping (no changes applied)");
        for (const item of this.preservePreview.changes.slice(0, 12)) node("p", note, `${item.name}: ${item.before} → ${item.after}`);
        if (this.preservePreview.changes.length > 12) node("p", note, `...and ${this.preservePreview.changes.length - 12} more entries`);
        button("Apply Previewed Remapping", () => this.run(async () => {
          if (!backup.checked) throw new Error("Confirm the Scene backup before applying a remap");
          await this.service.preserveMap(scene, state.revision);
          this.preservePreview = null;
          this.announce("Gridlines formatting and ranges were remapped to approximate their previous image positions");
        }), note);
      }
      node("small", root, "This tool never alters Foundry's native grid size or moves existing map objects.");
      return;
    }
    this.preservePreview = null;
    if (!this.axesDraft) this.axesDraft = normalizeAxes(state.axes);
    const savedAxes = normalizeAxes(state.axes);
    const draft = this.axesDraft;
    const visibility = node("div", root, undefined, "gridlines-section");
    node("strong", visibility, "Grid visibility (your screen only)");
    const visibilityRow = node("div", visibility, undefined, "gridlines-actions");
    button(this.nativeGrid.isVisible ? "Hide Foundry Grid" : "Show Foundry Grid", () => this.run(() => {
      this.nativeGrid.setVisible(!this.nativeGrid.isVisible);
    }), visibilityRow);
    button(this.overlay.localVisible ? "Hide Gridlines+" : "Show Gridlines+", () => this.run(() => {
      this.overlay.setVisible(!this.overlay.localVisible);
    }), visibilityRow);
    node("small", visibility, "Hiding Foundry grid is temporary and affects only this GM's browser. Token snapping still uses Foundry's grid. Closing the manager restores native grid visibility.");

    const sharing = node("div", root, undefined, "gridlines-section gridlines-player-sharing");
    node("strong", sharing, "Player visibility (GM-controlled)");
    node("p", sharing, "Share the Gridlines+ coordinate grid with players in this Scene. Every shading layer has an independent Player Visible toggle in Shading Layers below; old and new layers are GM Only until shared. Neither setting changes Foundry's native movement grid.");
    const sharingActions = node("div", sharing, undefined, "gridlines-actions");
    const playerGridOn = state.playerGridVisible === true;
    button(playerGridOn ? "Hide Coordinate Grid from Players" : "Show Coordinate Grid to Players", () => this.run(async () => {
      await this.service.edit(scene, state.revision, next => setPlayerGridVisible(next, !playerGridOn));
      this.announce(playerGridOn ? "Coordinate grid hidden from players" : "Coordinate grid shown to players on this Scene");
    }), sharingActions);
    node("small", sharing, `Player coordinate grid: ${playerGridOn ? "VISIBLE" : "HIDDEN"}. Player-visible shading: ${state.formats.filter(f => f.playerVisible === true).length} of ${state.formats.length}. Existing layers stay hidden until explicitly shared.`);
    node("small", sharing, "Important: This SVG overlay is not masked by Foundry fog or token vision. Do not publish secret markings. Scene flags, including named-range names, are not private storage; this module does not display named ranges to players.");

    const options = node("details", root, undefined, "gridlines-section");
    options.open = true;
    node("summary", options, "Grid Setup — live preview");
    node("p", options, "Overlay settings preview immediately. Two explicit Match controls below copy between the overlay and Foundry's native grid; native changes always require backup and confirmation.");
    const matching = node("div", options, undefined, "gridlines-calibration-controls");
    node("strong", matching, "Match Foundry and Gridlines+ grids");
    const matchActions = node("div", matching, undefined, "gridlines-actions");
    button("Match Gridlines+ to Foundry", () => this.run(() => {
      const next = validateAxes(copyFoundryGrid(normalizeAxes(this.axesDraft ?? state.axes)));
      this.axesDraft = next;
      this.calibrationResult = null;
      this.nativePreview = null;
      this.overlay.stopPlacement?.({cancel:true,quiet:true});
      this.overlay.stopCalibration?.();
      this.overlay.setPreviewAxes(next);
      this.announce("Gridlines+ now previews Foundry's native cell size and grid origin. Click Save Grid Setup to accept.");
    }), matchActions);
    button("Match Foundry to Gridlines+", () => this.run(() => {
      const next = normalizeAxes(this.axesDraft);
      if (this.overlay.geometryPreviewPending || JSON.stringify(next) !== JSON.stringify(savedAxes))
        throw new Error("Save or discard the Gridlines+ preview before copying it into Foundry");
      this.nativePreview = planNativeGridMatch(scene, canvas.grid, savedAxes);
      this.refresh();
    }), matchActions);
    button("Open Foundry Scene Configuration", () => this.run(() => {
      if (!scene.sheet?.render) throw new Error("Foundry Scene Configuration is not available from this client");
      scene.sheet.render(true);
    }), matchActions);
    if (this.nativePreview) {
      const plan = this.nativePreview;
      const review = node("div", matching, undefined, "gridlines-warning");
      node("strong",review,"Native Foundry grid change — preview only");
      node("p",review,`Foundry grid size: ${plan.from}px → ${plan.to}px. Gridlines+ location data is preserved; Foundry snapping and existing map-object alignment may change.`);
      if (!plan.changes) {
        node("p",review,"Sizes already match. No native Scene update is needed.");
      } else {
        const acknowledgment=node("label",review,undefined,"gridlines-check");
        const check=node("input",acknowledgment);check.type="checkbox";
        node("span",acknowledgment,"I have a recoverable backup and approve changing Foundry's native grid size");
        const row=node("div",review,undefined,"gridlines-actions");
        button("Confirm & Apply Foundry Grid",()=>this.run(()=>this.applyNativeMatch(plan,state,check.checked)),row);
      }
      button("Cancel Native Preview",()=>{this.nativePreview=null;this.refresh();},review);
    }
    node("small", matching, "Foundry's native grid requires square cells and does not support independent overlay X/Y offsets. The reverse-match action refuses incompatible geometry rather than shifting the map artwork. For those maps, keep the Gridlines+ overlay or use Foundry's native Grid Configuration tool.");
    const placement=node("div",options,undefined,"gridlines-calibration-controls");
    node("strong",placement,"Drag grid / Choose A1");
    node("p",placement,"Drag the whole grid directly over the map to align it. Release to preview. Then, if needed, choose Pick A1 and click the cell where major-block coordinate A1 should begin. Neither step writes to the Scene until Save Grid Setup.");
    const placementButtons=node("div",placement,undefined,"gridlines-actions");
    button("Drag Grid",()=>this.run(()=>{
      if (!this.overlay.root) this.overlay.attach();
      this.overlay.startPlacement("drag");
    }),placementButtons,{disabled:this.overlay.placementMode==="drag"});
    button("Pick A1 Cell",()=>this.run(()=>{
      if (!this.overlay.root) this.overlay.attach();
      this.overlay.startPlacement("pick-a1");
    }),placementButtons,{disabled:this.overlay.placementMode==="pick-a1"});
    for (const [mode,label] of [["pick-major-col","Pick First Major Column"],["pick-major-row","Pick First Major Row"]]) {
      button(label,()=>this.run(()=>{
        if (!this.overlay.root) this.overlay.attach();
        this.overlay.startPlacement(mode);
      }),placementButtons,{disabled:this.overlay.placementMode===mode});
    }
    if(this.overlay.placementMode){
      node("p",placement,this.overlay.placementMode==="drag"
        ? "Drag anywhere on the map to move Gridlines. The orange A1 marker follows the grid. Escape cancels the move."
        : this.overlay.placementMode === "pick-a1" ? "Click the fine cell that should begin major block A1. Escape cancels."
        : "Click the fine cell where the first major column or row begins. The other axis stays unchanged. Escape cancels.");
      button("Cancel Placement",()=>{
        this.overlay.stopPlacement({cancel:true});
      },placementButtons);
    }
    node("small",placement,`Current A1 anchor: fine cell column ${draft.a1Col+1}, row ${draft.a1Row+1}. A1 numbering changes; existing saved fine-cell indices do not.`);
    const calibration = node("div", options, undefined, "gridlines-calibration-controls");
    node("strong", calibration, "Draw to align a printed map grid");
    node("p", calibration, "Choose 10x10, 5x5, or 1x1. Draw a horizontal/vertical guide to measure one dimension, or drag corner-to-corner across a printed block to measure both width and height, even if the cells are rectangular. Release to preview; nothing is saved until Save Grid Setup.");
    const guideButtons = node("div", calibration, undefined, "gridlines-actions");
    for (const n of CALIBRATION_PRESETS) {
      button(`Draw ${n}x${n} Guide`, () => this.run(() => {
        if (!this.overlay.root) this.overlay.attach();
        this.overlay.startCalibration(n);
        this.calibrationResult = null;
      }), guideButtons, {disabled: this.overlay.calibrating === n});
    }
    if (this.overlay.calibrating) {
      node("p",calibration, `Drawing ${this.overlay.calibrating}x${this.overlay.calibrating} guide. Drag over the printed map grid. Escape cancels.`);
      button("Cancel Guide", () => {
        this.overlay.stopCalibration();
        this.calibrationResult = null;
        this.refresh();
      },guideButtons);
    }
    if (this.calibrationResult) {
      const measured = this.calibrationResult;
      node("p",calibration, `Preview: ${this.axesDraft.cellWidth ?? canvas.grid.sizeX}px wide × ${this.axesDraft.cellHeight ?? canvas.grid.sizeY}px tall (${measured.mode}). Offsets: X ${this.axesDraft.offsetX}px / Y ${this.axesDraft.offsetY}px. Not saved yet.`);
    }
    const settingsFields = node("div", options, undefined, "gridlines-actions");
    const width = field("Cell width (px; blank = Foundry)", "number", settingsFields, draft.cellWidth == null ? "" : String(draft.cellWidth));
    const height = field("Cell height (px; blank = Foundry)", "number", settingsFields, draft.cellHeight == null ? "" : String(draft.cellHeight));
    for(const ctl of [width,height]) {ctl.min="10";ctl.max="2000";ctl.step=".1";}
    width.placeholder=`Native ${canvas.grid.sizeX}px`;
    height.placeholder=`Native ${canvas.grid.sizeY}px`;
    const linkRow=node("label",options,undefined,"gridlines-check");
    const link=node("input",linkRow);link.type="checkbox";link.checked=draft.linkCellDimensions;
    node("span",linkRow,"Link width and height (square cells)");
    const ox=field("Offset X (px)","number",settingsFields,String(draft.offsetX));
    const oy=field("Offset Y (px)","number",settingsFields,String(draft.offsetY));
    ox.min=oy.min="-20000";ox.max=oy.max="20000";ox.step=oy.step="1";
    const major=field("Major columns: every N fine cells", "number", settingsFields, String(draft.majorEveryX));
    const majorY=field("Major rows: every N fine cells", "number", settingsFields, String(draft.majorEveryY));
    for (const c of [major, majorY]) { c.min="1";c.max="200";c.step="1"; }
    const divisions=field("Minor divisions between columns", "number", settingsFields, String(draft.minorDivisionsX));
    const divisionsY=field("Minor divisions between rows", "number", settingsFields, String(draft.minorDivisionsY));
    for (const c of [divisions,divisionsY]) { c.min="1";c.max="20";c.step="1"; }
    const rulerWrap=node("label",options,undefined,"gridlines-field");
    node("span",rulerWrap,"First major block: fine-cell ruler");
    const ruler=node("select",rulerWrap);
    for(const [v,label] of [["auto","Automatic (only if fine cells are hidden)"],["on","Always show A-J / 1-10"],["off","Off"]]) {
      const option=node("option",ruler,label);option.value=v;
    }
    ruler.value=draft.rulerMode;
    const majorWidth=field("Major line width (px)","number", settingsFields, String(draft.majorWidth));
    const minorWidth=field("Minor line width (px)","number", settingsFields, String(draft.minorWidth));
    majorWidth.min=minorWidth.min=".25";majorWidth.max=minorWidth.max="20";majorWidth.step=minorWidth.step=".25";
    const lineColor=field("Gridline color", "color", settingsFields, draft.color);
    const lineAlpha=field("Gridline opacity %", "number", settingsFields, String(Math.round(draft.alpha*100)));
    lineAlpha.min="0";lineAlpha.max="100";lineAlpha.step="1";
    const labelSettings = node("div",options,undefined,"gridlines-calibration-controls");
    node("strong",labelSettings,"Coordinate label fonts (live preview)");
    const fontFields = node("div",labelSettings,undefined,"gridlines-actions");
    const colLabelSize = field("Column letter size (px)","number",fontFields,String(draft.colLabelSize));
    const rowLabelSize = field("Row number size (px)","number",fontFields,String(draft.rowLabelSize));
    const subLabelSize = field("Subcell label size (px)","number",fontFields,String(draft.subLabelSize));
    for(const item of [colLabelSize,rowLabelSize,subLabelSize]) { item.min="7";item.max="48";item.step="1"; }
    const colLabelColor = field("Column letter color","color",fontFields,draft.colLabelColor);
    const rowLabelColor = field("Row number color","color",fontFields,draft.rowLabelColor);
    const subLabelColor = field("Subcell label color","color",fontFields,draft.subLabelColor);
    const placementFields = node("div",labelSettings,undefined,"gridlines-actions");
    const colPlacementWrap=node("label",placementFields,undefined,"gridlines-field");
    node("span",colPlacementWrap,"Column letters placement");
    const colPlacement=node("select",colPlacementWrap);
    for (const [key,name] of [["top","Top"],["bottom","Bottom"],["both","Top and Bottom"],["off","Off"]]) {
      const option=node("option",colPlacement,name);option.value=key;
    }
    colPlacement.value=draft.colLabelPosition;
    const rowPlacementWrap=node("label",placementFields,undefined,"gridlines-field");
    node("span",rowPlacementWrap,"Row numbers placement");
    const rowPlacement=node("select",rowPlacementWrap);
    for (const [key,name] of [["left","Left"],["right","Right"],["both","Left and Right"],["off","Off"]]) {
      const option=node("option",rowPlacement,name);option.value=key;
    }
    rowPlacement.value=draft.rowLabelPosition;
    node("small",labelSettings,"Column letters may appear at the top, bottom or both edges; row numbers at the left, right or both. Positions follow the visible map viewport for GM and players. Each can also be disabled. Label outlines automatically contrast with their font colors.");
    const scopeWrap=node("label",options,undefined,"gridlines-field");
    node("span",scopeWrap,"Axis coordinate numbering");
    const scope=node("select",scopeWrap);
    for(const [v,label] of [["major","Major blocks: A, B, C / 1, 2, 3"],["cell","Absolute fine cells: A, K, U / 1, 11, 21"]]) {
      const opt=node("option",scope,label);opt.value=v;
    }
    scope.value=draft.coordinateScope;
    const labelRow=node("label",options,undefined,"gridlines-check");
    const labels=node("input",labelRow);labels.type="checkbox";labels.checked=Boolean(draft.labels);
    node("span",labelRow,"Show letters and numbers on MAJOR axes only");
    const visibleRow=node("label",options,undefined,"gridlines-check");
    const showLines=node("input",visibleRow);showLines.type="checkbox";showLines.checked=Boolean(draft.enabled);
    node("span",visibleRow,"Show Gridlines guides");
    const value=()=>({
      ...this.axesDraft,
      // Store independent dimensions. Clearing the deprecated scalar prevents
      // a legacy size from unexpectedly overriding a cleared width or height.
      cellSize:null,
      cellWidth: width.value.trim()==="" ? null : Number(width.value),
      cellHeight: height.value.trim()==="" ? null : Number(height.value),
      linkCellDimensions: link.checked,
      offsetX: Number(ox.value), offsetY:Number(oy.value),
      // Retain legacy scalar fields for old integrations; new renderers use independent axes.
      majorEvery:Number(major.value),minorDivisions:Number(divisions.value),
      majorEveryX:Number(major.value),majorEveryY:Number(majorY.value),
      minorDivisionsX:Number(divisions.value),minorDivisionsY:Number(divisionsY.value),
      rulerMode:ruler.value,
      majorWidth:Number(majorWidth.value),minorWidth:Number(minorWidth.value),
      color:lineColor.value,alpha:Number(lineAlpha.value)/100,
      colLabelSize:Number(colLabelSize.value),rowLabelSize:Number(rowLabelSize.value),subLabelSize:Number(subLabelSize.value),
      colLabelColor:colLabelColor.value,rowLabelColor:rowLabelColor.value,subLabelColor:subLabelColor.value,
      colLabelPosition:colPlacement.value,rowLabelPosition:rowPlacement.value,
      coordinateScope:scope.value,labels:labels.checked,enabled:showLines.checked
    });
    const onPreview=(source=null)=>{
      if (link.checked) {
        // When linked, either field drives the other; when unlinked, both keep
        // their own values. Switching the link on uses current width.
        if (source===height) width.value=height.value;
        else if (source===width || source===link) height.value=width.value;
      }
      try {
        const next=validateAxes(value());
        this.axesDraft=next;
        this.overlay.setPreviewAxes(next); // Schedule redraw without Scene write or destroying input focus.
        if (this.overlay.geometryPreviewPending) this.overlay.setSelecting(false);
      } catch { /* Intermediate invalid numeric input: wait for complete value. */ }
    };
    for(const ctl of [width,height,link,ox,oy,major,majorY,divisions,divisionsY,ruler,majorWidth,minorWidth,lineColor,scope,labels,showLines,lineAlpha,
      colLabelSize,rowLabelSize,subLabelSize,colLabelColor,rowLabelColor,subLabelColor,colPlacement,rowPlacement])
      ctl.addEventListener(ctl.type==="checkbox"||ctl.tagName?.toLowerCase()==="select"?"change":"input",()=>onPreview(ctl));
    const locationAffected=()=>{
      const next=validateAxes(value());
      return overlayGeometryChanged(savedAxes,next,Number(canvas.grid.sizeX),Number(canvas.grid.sizeY)) ||
        savedAxes.majorEveryX !== next.majorEveryX || savedAxes.majorEveryY !== next.majorEveryY ||
        savedAxes.coordinateScope !== next.coordinateScope;
    };
    if (state.formats.length || state.namedRanges.length)
      node("p",options,"This Scene already has formatted cells or named ranges. Changing grid width, height, or position changes their map coverage; picking A1 changes coordinate labels and Go To addresses. Saved fine-cell indices and IDs remain unchanged. Back up the Scene/world before saving changes.");
    const backupRow=node("label",options,undefined,"gridlines-check");
    const backup=node("input",backupRow);backup.type="checkbox";
    node("span",backupRow,"I have a recoverable backup and approve moving existing overlay locations if geometry changes");
    const actions=node("div",options,undefined,"gridlines-actions");
    button("Save Grid Setup",()=>this.run(async()=>{
      const next=validateAxes(value());
      if(locationAffected() && (state.formats.length || state.namedRanges.length) && !backup.checked)
        throw new Error("Back up your Scene and confirm moving existing overlay locations first");
      await this.service.edit(scene,state.revision,current=>{current.axes=next;});
      this.axesDraft=null;
      this.calibrationResult=null;
      this.nativePreview=null;
      this.overlay.stopCalibration?.();
      this.overlay.stopPlacement?.({quiet:true});
      this.overlay.setPreviewAxes?.(null);
      this.announce("Gridlines overlay setup saved");
    }),actions);
    button("Discard Preview",()=>{
      this.axesDraft=null;
      this.calibrationResult=null;
      this.nativePreview=null;
      this.overlay.stopCalibration?.();
      this.overlay.stopPlacement?.({cancel:true,quiet:true});
      this.overlay.setPreviewAxes?.(null);
      this.refresh();
    },actions);
    button("10 / 5 Defaults",()=>{
      this.axesDraft={...this.axesDraft,majorEvery:10,minorDivisions:5,
        majorEveryX:10,majorEveryY:10,minorDivisionsX:5,minorDivisionsY:5,
        rulerMode:"auto",coordinateScope:"major"};
      this.overlay.setPreviewAxes(this.axesDraft);
      this.refresh();
    },actions);
    node("small",options,`Foundry movement grid: ${canvas.grid.sizeX}×${canvas.grid.sizeY}px. Gridlines+ columns: ${draft.majorEveryX} fine cells / ${draft.minorDivisionsX} minor divisions; rows: ${draft.majorEveryY} fine cells / ${draft.minorDivisionsY} minor divisions. Underlying saved fine-cell indices never change when adjusting display labels.`);
    if (savedAxes.coordinateScope === "cell") node("p",options,"This is a legacy Scene showing A, K, U and 1, 11, 21. Choose Major blocks under Axis coordinate numbering, then Save Grid Setup, to show A, B, C and 1, 2, 3 instead.");

    const selectionTools = node("div", root, undefined, "gridlines-section gridlines-actions");
    button(this.overlay.selecting ? "Stop Selecting Cells" : "Select Cells on Map", () => this.run(() => {
      if (this.overlay.geometryPreviewPending || this.overlay.placementMode) throw new Error("Save or discard grid placement changes before selecting cells");
      if (!this.overlay.root) this.overlay.attach();
      if (!this.overlay.root) throw new Error("Gridlines overlay could not attach to Foundry's canvas; check the browser console");
      this.overlay.setSelecting(!this.overlay.selecting);
    }), selectionTools);
    const modeWrap=node("label",selectionTools,undefined,"gridlines-field");
    node("span",modeWrap,"Select on map");
    const mode=node("select",modeWrap);
    for(const [v,label] of [["major","Major map blocks (G14 = whole block)"],["fine","Fine subcells (G14.3,4)"]]) {
      const option=node("option",mode,label);option.value=v;
    }
    mode.value=this.overlay.selectionMode ?? "major";
    mode.addEventListener("change",()=>{this.overlay.setSelectionMode(mode.value);this.refresh();});
    node("small",selectionTools,"Left-drag selects. Right-drag remains Foundry map pan. Major mode selects whole displayed blocks; Fine mode selects individual underlying cells.");
    const nav = node("div", root, undefined, "gridlines-section");
    node("strong", nav, "Go To");
    const navRow = node("div", nav, undefined, "gridlines-actions");
    const go = node("input", navRow); go.type = "text"; go.placeholder = "G14, G14.3,4 or Warehouse"; go.value = this.inputs.go;
    go.setAttribute("aria-label", "Coordinate or named range");
    go.addEventListener("input", () => { this.inputs.go = go.value; });
    const navigate = () => this.run(() => this.go(go.value));
    go.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); navigate(); } });
    button("Go", navigate, navRow);

    node("small", nav, draft.coordinateScope === "major"
      ? `G14 is the entire ${draft.majorEveryX}×${draft.majorEveryY} major block. G14.3,4 is fine subcolumn 3, row 4 inside it (G14.C4 also works). cell:D3 targets a legacy absolute fine cell.`
      : "Existing Scene coordinates use individual cells (legacy mode). Pick A1 to change their displayed numbering; cell:D3 keeps the original fine-cell indices.");
    const selection = node("div", root, undefined, "gridlines-section");
    const visibleAddress = r => savedAxes.coordinateScope === "major"
      ? formatDisplayedRange(r,{col:savedAxes.majorEveryX,row:savedAxes.majorEveryY},{row:savedAxes.a1Row,col:savedAxes.a1Col},"numbers")
      : `cell:${formatRange(r)}`;
    node("strong", selection, this.selection ? `Selected: ${visibleAddress(this.selection)}` : "No cells selected");
    node("p",selection,"Major mode selects the whole visible G14 block. Fine Subcells mode selects G14.3,4; saved records keep their original fine-cell indices.");
    const settings = node("div", root, undefined, "gridlines-actions");
    const color = field("Fill", "color", settings, this.inputs.color);
    color.addEventListener("input", () => { this.inputs.color = color.value; });
    const opacity = field("Opacity %", "number", settings, this.inputs.opacity);
    opacity.min = "0"; opacity.max = "100"; opacity.step = "5";
    opacity.addEventListener("input", () => { this.inputs.opacity = opacity.value; });
    button("Shade Selection", () => this.run(async () => {
      if (this.overlay.geometryPreviewPending || this.overlay.calibrating || this.overlay.placementMode)
        throw new Error("Save or discard the grid calibration preview before shading cells");
      const selected = this.validateRange(this.currentSelection());
      await this.service.edit(scene, state.revision, current => {
        addFill(current, selected, color.value, Number(opacity.value) / 100, uid());
      });
      this.shadingExpanded=true;
      this.announce(`Shaded ${visibleAddress(selected)}`);
    }), selection, {disabled: !this.selection});

    const shadeActions = node("div",selection,undefined,"gridlines-actions");
    button("Clear Shading in Selection",()=>this.run(async()=>{
      if(this.overlay.geometryPreviewPending || this.overlay.calibrating || this.overlay.placementMode)
        throw new Error("Save or discard the grid setup preview before clearing shading");
      const selected=this.validateRange(this.currentSelection());
      const preview=previewClearShading(state,selected);
      if(!preview.affected) {this.announce("No shading overlaps the selected cells");return;}
      if(preview.affected>1 && !await this.confirmShadingClear(preview.affected,`intersecting ${visibleAddress(selected)}`)) return;
      await this.service.edit(scene,state.revision,current=>{
        clearShadingInSelection(current,selected,uid);
      });
      this.resetRegionPreview();
      if (!this.service.read(scene).formats.length) this.shadingExpanded=false;
      this.announce(`Cleared shading in ${visibleAddress(selected)}; saved names remain intact`);
    }),shadeActions,{disabled:!this.selection||!state.formats.length});
    button(`Clear All Shading (${state.formats.length})`,()=>this.run(async()=>{
      if(this.overlay.geometryPreviewPending || this.overlay.calibrating || this.overlay.placementMode)
        throw new Error("Save or discard the grid setup preview before clearing shading");
      if(!state.formats.length) return;
      if(!await this.confirmShadingClear(state.formats.length,"on this Scene")) return;
      await this.service.edit(scene,state.revision,current=>clearAllShading(current));
      this.resetRegionPreview();this.shadingExpanded=false;
      this.editingShadeId=null;this.editingShadeDraft=null;
      this.announce("All Gridlines+ shading cleared; named ranges were preserved");
    }),shadeActions,{disabled:!state.formats.length});
    const layers = node("details",selection,undefined,"gridlines-section gridlines-shading-layers");
    if (!state.formats.length) this.shadingExpanded=false;
    layers.open=Boolean(state.formats.length && this.shadingExpanded);
    layers.addEventListener("toggle",()=>{if(layers.isConnected!==false) this.shadingExpanded=Boolean(layers.open);});
    node("summary",layers,`Shading layers (${state.formats.length}) — locate, select, configure, convert, or remove`);
    const regionFound=existingShadeRegionIds(scene);
    for(const layer of state.formats){
      const item=node("div",layers,undefined,"gridlines-shading-row");
      const top=node("div",item,undefined,"gridlines-shading-title");
      const chip=node("span",top," ","gridlines-color-chip");
      chip.style.backgroundColor=layer.fill;
      node("span",top,`${layer.label ? `${layer.label} · ` : ""}${visibleAddress(layer.range)} · ${Math.round(layer.opacity*100)}% · ${layer.playerVisible === true ? "Player Visible" : "GM Only"}`);
      const controls=node("div",item,undefined,"gridlines-actions gridlines-shading-buttons");
      button("Locate",()=>this.run(()=>this.locateShading(layer)),controls,{title:"Pan to this shading and flash its outline without changing selection"});
      button("Select",()=>this.run(async()=>{
        this.requireSavedGeometry();
        this.overlay.setSelection(layer.range);
        this.announce(`Selected shading ${visibleAddress(layer.range)}`);
      }),controls,{title:"Select exactly this saved shading extent for follow-up actions"});
      button("Configure",()=>this.run(async()=>this.configureShading(layer)),controls);
      button(layer.playerVisible === true ? "Player Visible: On" : "Player Visible: Off",()=>this.run(async()=>{
        this.requireSavedGeometry();
        const nextVisible=layer.playerVisible !== true;
        await this.service.edit(scene,state.revision,current=>setShadingPlayerVisible(current,layer.id,nextVisible));
        this.announce(nextVisible ? "Shading now visible to players" : "Shading hidden from players");
      }),controls,{title:"Independently publish or hide only this shading layer. Existing layers start GM Only."});
      button(regionFound.has(layer.id)?"Region exists":"To Region",()=>this.run(async()=>{
        this.prepareRegionPreview([layer.id]);
      }),controls,{disabled:regionFound.has(layer.id),title:"Preview one native Region using exact Gridlines+ pixel boundaries"});
      button("Remove",()=>this.run(async()=>{
        this.requireSavedGeometry();
        await this.service.edit(scene,state.revision,current=>clearShadingLayer(current,layer.id));
        this.resetRegionPreview();
        if(this.editingShadeId===layer.id){this.editingShadeId=null;this.editingShadeDraft=null;}
        if(!this.service.read(scene).formats.length)this.shadingExpanded=false;
        this.announce(`Removed shading layer ${visibleAddress(layer.range)}; named ranges unchanged`);
      }),controls);
      if(this.editingShadeId===layer.id && this.editingShadeDraft){
        const editor=node("div",item,undefined,"gridlines-shade-editor");
        const label=field("Shading label (optional)","text",editor,this.editingShadeDraft.label);
        label.maxLength=64;
        label.addEventListener("input",()=>{this.editingShadeDraft.label=label.value;});
        const style=node("div",editor,undefined,"gridlines-actions");
        const fill=field("Shading fill", "color",style,this.editingShadeDraft.fill);
        fill.addEventListener("input",()=>{this.editingShadeDraft.fill=fill.value;});
        const opacity=field("Shading opacity %", "number",style,this.editingShadeDraft.opacity);
        opacity.min="0";opacity.max="100";opacity.step="1";
        opacity.addEventListener("input",()=>{this.editingShadeDraft.opacity=Number(opacity.value);});
        const actions=node("div",editor,undefined,"gridlines-actions");
        button("Save Shading",()=>this.run(async()=>{
          this.requireSavedGeometry();
          const draft={...this.editingShadeDraft};
          await this.service.edit(scene,state.revision,current=>updateShadingLayer(current,layer.id,{label:draft.label,fill:draft.fill,opacity:Number(draft.opacity)/100}));
          this.resetRegionPreview();
          this.editingShadeId=null;this.editingShadeDraft=null;
          this.announce(`Updated shading ${visibleAddress(layer.range)}`);
        }),actions);
        button("Cancel Shading Edit",()=>{this.editingShadeId=null;this.editingShadeDraft=null;this.refresh();},actions);
      }
    }
    if(state.formats.length){
      const eligible=state.formats.filter(f=>!regionFound.has(f.id));
      const tools=node("div",layers,undefined,"gridlines-actions");
      const chunk=eligible.slice(0,MAX_REGION_BATCH);
      const bulkLabel=eligible.length>MAX_REGION_BATCH
        ? `Preview Next ${MAX_REGION_BATCH} Regions (${eligible.length} remaining)`
        : `Preview All as Regions (${eligible.length})`;
      button(bulkLabel,()=>this.run(async()=>{
        if(!chunk.length)throw new Error("Every current shading layer already has a corresponding Region");
        this.prepareRegionPreview(chunk.map(f=>f.id));
      }),tools,{disabled:!chunk.length,title:"Preview up to 30 new native Regions at a time; originals remain untouched"});
      if(this.regionPreview){
        const preview=node("div",layers,undefined,"gridlines-region-preview-box");
        node("strong",preview,`Region preview: ${this.regionPreview.items.length} new native Region${this.regionPreview.items.length===1?"":"s"}`);
        node("p",preview,"Purple outlines show exact pixel-aligned Regions, independent of Foundry's grid. No Region is created until you confirm. Shading, named ranges and existing Regions are not changed.");
        for(const proposed of this.regionPreview.items){
          const s=proposed.shape;
          node("small",preview,`${proposed.name}: (${s.x}, ${s.y}) · ${s.width} × ${s.height}px${proposed.clipped?" (clipped to Scene)":""}`);
        }
        const backupRow=node("label",preview,undefined,"gridlines-check");
        const backup=node("input",backupRow);backup.type="checkbox";backup.checked=this.regionBackupAcknowledged;
        backup.addEventListener("change",()=>{this.regionBackupAcknowledged=Boolean(backup.checked);});
        node("span",backupRow,"I have a recoverable Scene backup and approve creating these native Regions");
        const actions=node("div",preview,undefined,"gridlines-actions");
        button(`Create ${this.regionPreview.items.length} Region${this.regionPreview.items.length===1?"":"s"}`,()=>this.run(()=>this.confirmRegionCreation()),actions);
        button("Cancel Region Preview",()=>{this.resetRegionPreview();this.refresh();},actions);
      }
    }
    const names = node("div", root, undefined, "gridlines-section");
    node("strong", names, "Named Ranges (visible coordinates)");
    const naming = node("div", names, undefined, "gridlines-actions");
    const name = node("input", naming); name.type = "text"; name.maxLength = 64; name.placeholder = "Warehouse"; name.value = this.inputs.name;
    name.setAttribute("aria-label", "Name selected cells");
    name.addEventListener("input", () => { this.inputs.name = name.value; });
    button("Save Name", () => this.run(async () => {
      if (this.overlay.geometryPreviewPending || this.overlay.calibrating || this.overlay.placementMode)
        throw new Error("Save or discard the grid calibration preview before naming cells");
      const selected = this.validateRange(this.currentSelection());
      await this.service.edit(scene, state.revision, current => addNamedRange(current, name.value, selected, uid()));
      this.inputs.name = "";
      this.announce(`Saved ${name.value} at ${visibleAddress(selected)}`);
    }), naming, {disabled: !this.selection});
    if (!state.namedRanges.length) node("p", names, "No saved ranges yet.");
    for (const range of state.namedRanges) {
      const item = node("div", names, undefined, "gridlines-name-row");
      const label = node("span", item);
      label.textContent = `${range.name} · ${visibleAddress(range.range)}`;
      button("Go", () => this.run(() => this.go(range.name)), item);
    }
    const footer = node("small", root, "GM authoring; optional player-visible grid and individually published shading. Scene flags are readable data, not secure GM notes. No automation or camera broadcast.", "gridlines-footer");
    if (this.statusText) { const note = node("small", root, this.statusText); note.className = "gridlines-status"; }
    root.scrollTop=priorScroll;
    void footer;
  }
}
