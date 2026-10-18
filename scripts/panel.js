import {parseRange, normalizeRange, formatRange, overlayResolver, squareResolver, parseMajorRange, formatMajorRange, parseAnchoredFineRange} from "./coordinates.js";
import {calibrateGuide, CALIBRATION_PRESETS} from "./calibration.js";
import {geometrySnapshot, alignmentStatus, addFill, addNamedRange, normalizeAxes, validateAxes, overlayGeometryChanged} from "./model.js";

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
    this.root?.remove(); this.root = null;
  }
  toggle() { this.visible ? this.close() : this.open(); }
  refresh() { if (this.visible) this.render(); }
  setSelection(range) {
    this.selection = range;
    if (this.visible) this.render();
  }
  announce(message) { ui.notifications?.info?.(message); this.statusText = message; this.refresh(); }
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
      this.announce(`Calibration preview: ${measured.recommended.cellSize}px cells; ${measured.mode} guide`);
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
      ? parseAnchoredFineRange(query, anchor) : parseMajorRange(query, axes.majorEvery, anchor)));
    const resolver = overlayResolver(canvas.grid, canvas.dimensions.sceneRect, axes);
    this.overlay.setSelection(range);
    const box = resolver.rangeBounds(range), rect = canvas.dimensions.sceneRect;
    const x0 = Math.max(box.x, rect.x), x1 = Math.min(box.right,rect.x+rect.width);
    const y0 = Math.max(box.y, rect.y), y1 = Math.min(box.bottom,rect.y+rect.height);
    await canvas.animatePan({x:(x0+x1)/2,y:(y0+y1)/2,duration:350});
  }

  render() {
    if (!this.visible || !game.user.isGM) return;
    if (!this.root) {
      this.root = node("section", document.body, undefined, "gridlines-panel");
      this.root.setAttribute("role", "region");
      this.root.setAttribute("aria-label", "AFT Gridlines+ manager");
    }
    const root = this.root;
    root.replaceChildren();
    const header = node("div", root, undefined, "gridlines-panel-header");
    node("strong", header, "AFT Gridlines+");
    button("×", () => this.close(), header, {title: "Close AFT Gridlines+ manager"});
    const scene = this.scene;
    if (!scene) { node("p", root, "Open a Scene to use Gridlines."); return; }
    if (!canvas.grid?.isSquare) { node("p", root, "This prototype supports only native square grids. No Scene data was changed."); return; }
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
    }
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
    const options = node("details", root, undefined, "gridlines-section");
    options.open = true;
    node("summary", options, "Grid Setup — live preview");
    node("p", options, "These settings change only Gridlines' visual overlay, not Foundry's native movement grid. Changes preview immediately; click Save to keep them.");
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
    if(this.overlay.placementMode){
      node("p",placement,this.overlay.placementMode==="drag"
        ? "Drag anywhere on the map to move Gridlines. The orange A1 marker follows the grid. Escape cancels the move."
        : "Click the fine cell that should begin major block A1. The 10-cell (or configured) major axes will start there. Escape cancels.");
      button("Cancel Placement",()=>{
        this.overlay.stopPlacement({cancel:true});
      },placementButtons);
    }
    node("small",placement,`Current A1 anchor: fine cell column ${draft.a1Col+1}, row ${draft.a1Row+1}. A1 numbering changes; existing saved fine-cell indices do not.`);
    const calibration = node("div", options, undefined, "gridlines-calibration-controls");
    node("strong", calibration, "Draw to align a printed map grid");
    node("p", calibration, "Choose 10x10, 5x5, or 1x1. Drag horizontally/vertically across that many printed squares to calibrate one axis, or drag diagonally from corner to corner to calibrate both. Release to preview; nothing is saved until Save Grid Setup.");
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
      node("p",calibration, `Measured ${measured.recommended.cellSize}px per cell (${measured.mode}). Preview offsets: X ${this.axesDraft.offsetX}px / Y ${this.axesDraft.offsetY}px. Not saved yet.`);
    }
    const settingsFields = node("div", options, undefined, "gridlines-actions");
    const size = field("Overlay cell size (px; blank = Foundry)", "number", settingsFields, draft.cellSize == null ? "" : String(draft.cellSize));
    size.min="10";size.max="2000";size.step="1";
    size.placeholder=`Native ${canvas.grid.sizeX}px`;
    const ox=field("Offset X (px)","number",settingsFields,String(draft.offsetX));
    const oy=field("Offset Y (px)","number",settingsFields,String(draft.offsetY));
    ox.min=oy.min="-20000";ox.max=oy.max="20000";ox.step=oy.step="1";
    const major=field("Major axes every N cells", "number", settingsFields, String(draft.majorEvery));
    major.min="1";major.max="200";major.step="1";
    const divisions=field("Minor divisions per major", "number", settingsFields, String(draft.minorDivisions));
    divisions.min="1";divisions.max="20";divisions.step="1";
    const majorWidth=field("Major line width (px)","number", settingsFields, String(draft.majorWidth));
    const minorWidth=field("Minor line width (px)","number", settingsFields, String(draft.minorWidth));
    majorWidth.min=minorWidth.min=".25";majorWidth.max=minorWidth.max="20";majorWidth.step=minorWidth.step=".25";
    const lineColor=field("Gridline color", "color", settingsFields, draft.color);
    const lineAlpha=field("Gridline opacity %", "number", settingsFields, String(Math.round(draft.alpha*100)));
    lineAlpha.min="0";lineAlpha.max="100";lineAlpha.step="1";
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
      cellSize: size.value.trim()==="" ? null : Number(size.value),
      offsetX: Number(ox.value), offsetY:Number(oy.value),
      majorEvery:Number(major.value),minorDivisions:Number(divisions.value),
      majorWidth:Number(majorWidth.value),minorWidth:Number(minorWidth.value),
      color:lineColor.value,alpha:Number(lineAlpha.value)/100,
      coordinateScope:scope.value,labels:labels.checked,enabled:showLines.checked
    });
    const onPreview=()=>{
      try {
        const next=validateAxes(value());
        this.axesDraft=next;
        this.overlay.setPreviewAxes(next); // Schedule redraw without Scene write or destroying input focus.
        if (this.overlay.geometryPreviewPending) this.overlay.setSelecting(false);
      } catch { /* Intermediate invalid numeric input: wait for complete value. */ }
    };
    for(const ctl of [size,ox,oy,major,divisions,majorWidth,minorWidth,lineColor,scope,labels,showLines,lineAlpha])
      ctl.addEventListener(ctl.type==="checkbox"||ctl.tagName?.toLowerCase()==="select"?"change":"input",onPreview);
    const locationAffected=()=>{
      const next=validateAxes(value());
      return overlayGeometryChanged(savedAxes,next,Number(canvas.grid.sizeX)) ||
        savedAxes.majorEvery !== next.majorEvery || savedAxes.coordinateScope !== next.coordinateScope;
    };
    if (state.formats.length || state.namedRanges.length)
      node("p",options,"This Scene already has formatted cells or named ranges. Moving the grid changes their map positions; picking a new A1 changes coordinate labels and Go To addresses. Saved fine-cell indices and IDs remain unchanged. Back up the Scene/world before saving changes.");
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
      this.overlay.stopCalibration?.();
      this.overlay.stopPlacement?.({quiet:true});
      this.overlay.setPreviewAxes?.(null);
      this.announce("Gridlines overlay setup saved");
    }),actions);
    button("Discard Preview",()=>{
      this.axesDraft=null;
      this.calibrationResult=null;
      this.overlay.stopCalibration?.();
      this.overlay.stopPlacement?.({cancel:true,quiet:true});
      this.overlay.setPreviewAxes?.(null);
      this.refresh();
    },actions);
    button("10 / 5 Defaults",()=>{
      this.axesDraft={...this.axesDraft,majorEvery:10,minorDivisions:5,coordinateScope:"major"};
      this.overlay.setPreviewAxes(this.axesDraft);
      this.refresh();
    },actions);
    node("small",options,`Foundry native grid: ${canvas.grid.sizeX}px. Major axes default every 10 overlay cells; five subdivisions produce four interior minor lines. Gridline color, opacity, and thickness preview as you change them.`);

    const selectionTools = node("div", root, undefined, "gridlines-section gridlines-actions");
    button(this.overlay.selecting ? "Stop Selecting Cells" : "Select Cells on Map", () => this.run(() => {
      if (this.overlay.geometryPreviewPending || this.overlay.placementMode) throw new Error("Save or discard grid placement changes before selecting cells");
      if (!this.overlay.root) this.overlay.attach();
      if (!this.overlay.root) throw new Error("Gridlines overlay could not attach to Foundry's canvas; check the browser console");
      this.overlay.setSelecting(!this.overlay.selecting);
    }), selectionTools);
    const nav = node("div", root, undefined, "gridlines-section");
    node("strong", nav, "Go To");
    const navRow = node("div", nav, undefined, "gridlines-actions");
    const go = node("input", navRow); go.type = "text"; go.placeholder = "G14 or Warehouse"; go.value = this.inputs.go;
    go.setAttribute("aria-label", "Coordinate or named range");
    go.addEventListener("input", () => { this.inputs.go = go.value; });
    const navigate = () => this.run(() => this.go(go.value));
    go.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); navigate(); } });
    button("Go", navigate, navRow);

    node("small", nav, draft.coordinateScope === "major"
      ? "A1 refers to the selected major block origin. Use cell:D3 for an exact internal fine cell."
      : "Existing Scene coordinates use individual cells (legacy mode). Pick A1 to change their displayed numbering; cell:D3 keeps the original fine-cell indices.");
    const selection = node("div", root, undefined, "gridlines-section");
    node("strong", selection, this.selection
      ? `Selected fine cells: ${formatRange(this.selection)} · Major ${formatMajorRange(this.selection, savedAxes.majorEvery, {row:savedAxes.a1Row,col:savedAxes.a1Col})}` : "No cells selected");
    node("p", selection, "Drag across cells, then shade or name them. Major axes are labels for blocks; exact saved selections use fine-cell indices.");
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
      this.announce(`Shaded ${formatRange(selected)}`);
    }), selection, {disabled: !this.selection});

    const names = node("div", root, undefined, "gridlines-section");
    node("strong", names, "Named Ranges");
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
      this.announce(`Saved named range ${name.value}`);
    }), naming, {disabled: !this.selection});
    if (!state.namedRanges.length) node("p", names, "No saved ranges yet.");
    for (const range of state.namedRanges) {
      const item = node("div", names, undefined, "gridlines-name-row");
      const label = node("span", item);
      label.textContent = `${range.name} · ${formatRange(range.range)}`;
      button("Go", () => this.run(() => this.go(range.name)), item);
    }
    const footer = node("small", root, "Prototype: GM authoring only. All named locations are stored in Scene flags; do not enter GM secrets. No automation or player broadcast yet.", "gridlines-footer");
    if (this.statusText) { const note = node("small", root, this.statusText); note.className = "gridlines-status"; }
    void footer;
  }
}
