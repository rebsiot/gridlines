import {parseRange, normalizeRange, formatRange, squareResolver} from "./coordinates.js";
import {geometrySnapshot, alignmentStatus, addFill, addNamedRange} from "./model.js";

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
    this.inputs = {color: "#2563eb", opacity: "25", name: "", go: "", major: "5", labels: true};
    this.preservePreview = null;
    this.statusText = "";
  }

  get scene() { return canvas.ready ? canvas.scene : null; }
  open() { this.visible = true; this.render(); }
  close() { this.visible = false; this.root?.remove(); this.root = null; }
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
  currentSelection() {
    if (!this.selection) throw new Error("Select cells first, using Gridlines > Select Cells");
    return normalizeRange(this.selection.from, this.selection.to);
  }
  validateRange(range) {
    const rect = canvas.dimensions.sceneRect;
    const resolver = squareResolver(canvas.grid, rect);
    const first = resolver.bounds(range.from);
    const last = resolver.bounds(range.to);
    if (first.right <= rect.x || first.bottom <= rect.y || last.x >= rect.x + rect.width || last.y >= rect.y + rect.height) throw new Error("Coordinate is outside this Scene");
    return range;
  }
  async go(value) {
    const state = this.service.read(this.scene);
    if (!state) throw new Error("Enable Gridlines on this Scene first");
    if (alignmentStatus(state, geometrySnapshot(this.scene)).pending) throw new Error("Resolve the grid alignment warning first");
    const target = String(value || "").trim();
    const named = state.namedRanges.find(n => n.name.toLocaleLowerCase() === target.toLocaleLowerCase());
    const range = this.validateRange(named?.range ?? parseRange(target));
    const resolver = squareResolver(canvas.grid, canvas.dimensions.sceneRect);
    this.overlay.setSelection(range);
    const center = resolver.centerOfRange(range);
    await canvas.animatePan({x: center.x, y: center.y, duration: 350});
  }

  render() {
    if (!this.visible || !game.user.isGM) return;
    if (!this.root) {
      this.root = node("section", document.body, undefined, "gridlines-panel");
      this.root.setAttribute("role", "region");
      this.root.setAttribute("aria-label", "Gridlines manager");
    }
    const root = this.root;
    root.replaceChildren();
    const header = node("div", root, undefined, "gridlines-panel-header");
    node("strong", header, "Gridlines");
    button("×", () => this.close(), header, {title: "Close Gridlines manager"});
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
    const nav = node("div", root, undefined, "gridlines-section");
    node("strong", nav, "Go To");
    const navRow = node("div", nav, undefined, "gridlines-actions");
    const go = node("input", navRow); go.type = "text"; go.placeholder = "G14 or Warehouse"; go.value = this.inputs.go;
    go.setAttribute("aria-label", "Coordinate or named range");
    go.addEventListener("input", () => { this.inputs.go = go.value; });
    const navigate = () => this.run(() => this.go(go.value));
    go.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); navigate(); } });
    button("Go", navigate, navRow);

    const selection = node("div", root, undefined, "gridlines-section");
    node("strong", selection, this.selection ? `Selected: ${formatRange(this.selection)}` : "No cells selected");
    node("p", selection, "Use the Select Cells tool, then drag on the map. Switch back to Tokens to resume normal play.");
    const settings = node("div", root, undefined, "gridlines-actions");
    const color = field("Fill", "color", settings, this.inputs.color);
    color.addEventListener("input", () => { this.inputs.color = color.value; });
    const opacity = field("Opacity %", "number", settings, this.inputs.opacity);
    opacity.min = "0"; opacity.max = "100"; opacity.step = "5";
    opacity.addEventListener("input", () => { this.inputs.opacity = opacity.value; });
    button("Shade Selection", () => this.run(async () => {
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
    const options = node("details", root, undefined, "gridlines-section");
    node("summary", options, "Grid display settings");
    const visibility = node("label", options, undefined, "gridlines-check");
    const show = node("input", visibility); show.type = "checkbox"; show.checked = this.overlay.localVisible;
    show.addEventListener("change", () => this.overlay.setVisible(show.checked));
    node("span", visibility, "Show overlay on my screen");
    const major = field("Major line every N cells", "number", options, String(state.axes?.majorEvery ?? 5));
    major.min = "1"; major.max = "50";
    const labelRow = node("label", options, undefined, "gridlines-check");
    const labels = node("input", labelRow); labels.type = "checkbox"; labels.checked = Boolean(state.axes?.labels);
    node("span", labelRow, "Display coordinate labels");
    button("Save Display Settings", () => this.run(async () => {
      const n = Number(major.value);
      if (!Number.isInteger(n) || n < 1 || n > 50) throw new Error("Major interval must be between 1 and 50");
      await this.service.edit(scene, state.revision, current => {
        current.axes = {...current.axes, majorEvery: n, labels: labels.checked};
      });
      this.announce("Gridline display settings saved");
    }), options);
    const footer = node("small", root, "Prototype: GM authoring only. All named locations are stored in Scene flags; do not enter GM secrets. No automation or player broadcast yet.", "gridlines-footer");
    if (this.statusText) { const note = node("small", root, this.statusText); note.className = "gridlines-status"; }
    void footer;
  }
}
