import {MODULE_ID, geometrySnapshot, alignmentStatus} from "./model.js";
import {formatAddress, parseAddress, parseRange, formatRange, squareResolver} from "./coordinates.js";
import {SceneService} from "./service.js";
import {GridlinesOverlay} from "./overlay.js";
import {GridlinesPanel} from "./panel.js";

const service = new SceneService();
const overlay = new GridlinesOverlay();
const panel = new GridlinesPanel(service, overlay);
overlay.snapshotProvider = geometrySnapshot;
overlay.onSelection = range => panel.setSelection(range);
overlay.onContextMenu = () => panel.open();
let lastWarning = null;

function safeRefresh() {
  try {
    if (!game.user.isGM || !canvas.ready || !canvas.scene) return;
    const state = service.read(canvas.scene);
    overlay.setSceneState(state);
    const status = state ? alignmentStatus(state, geometrySnapshot(canvas.scene)) : {pending: false};
    if (status.pending) {
      const signature = `${canvas.scene.id}:${JSON.stringify(status.after)}`;
      if (lastWarning !== signature) {
        lastWarning = signature;
        ui.notifications.warn("Gridlines: Foundry's grid changed. Open Gridlines to review saved locations before editing.", {permanent: true});
      }
      overlay.setSelecting(false);
      panel.open();
    } else {
      lastWarning = null;
    }
    panel.refresh();
  } catch (error) {
    console.error("Gridlines could not read Scene data", error);
    ui.notifications.error(`Gridlines: ${error.message}`);
    overlay.setSceneState(null);
  }
}

Hooks.on("getSceneControlButtons", controls => {
  if (!game.user.isGM) return;
  controls.gridlines = {
    name: "gridlines",
    order: 95,
    title: "Gridlines",
    icon: "fa-solid fa-border-all",
    visible: true,
    activeTool: "select",
    onChange: (_event, active) => { overlay.setSelecting(active); if (active) panel.open(); },
    onToolChange: (_event, tool, active) => { overlay.setSelecting(active && tool.name === "select"); },
    tools: {
      select: {
        name: "select", order: 0, title: "Select Cells", icon: "fa-solid fa-vector-square",
        visible: true, onChange: (_event, active) => { overlay.setSelecting(active); if (active) panel.open(); }
      },
      manage: {
        name: "manage", order: 1, title: "Gridlines Manager", icon: "fa-solid fa-table-cells-large",
        visible: true, button: true, onChange: () => panel.toggle()
      }
    }
  };
});

Hooks.on("canvasReady", () => {
  if (!game.user.isGM) return;
  overlay.attach();
  panel.selection = null;
  overlay.selection = null;
  safeRefresh();
});
Hooks.on("canvasPan", () => overlay.schedule());
Hooks.on("canvasTearDown", () => { overlay.dispose(); panel.close(); lastWarning = null; });
Hooks.on("updateScene", (scene) => {
  if (scene.id !== canvas?.scene?.id || !game.user.isGM) return;
  // Foundry Scene updates can change native grid geometry as well as flags.
  safeRefresh();
  overlay.schedule();
});
Hooks.once("ready", () => {
  // Shared API is read-only in this prototype; Plus can later use the same resolver contract.
  const exposed = Object.freeze({
    getState: (scene = canvas?.scene) => scene ? structuredClone(service.read(scene)) : null,
    getAlignmentStatus: (scene = canvas?.scene) => scene ? service.getStatus(scene) : null,
    formatAddress, parseAddress, parseRange, formatRange,
    resolveAt: (point) => canvas?.ready && canvas.grid?.isSquare ? squareResolver(canvas.grid, canvas.dimensions.sceneRect).locate(point) : null
  });
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = exposed;
  if (game.user.isGM && canvas.ready) { overlay.attach(); safeRefresh(); }
  console.info("Gridlines prototype initialized (not live-certified for this Foundry build)");
});
