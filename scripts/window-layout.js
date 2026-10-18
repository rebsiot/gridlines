/** GM-local floating manager placement. Never saved to Scene flags. */
export const WINDOW_LAYOUT_KEY = "gridlines.manager.layout.v1";
export const PANEL_MIN_WIDTH = 340;
export const PANEL_MIN_HEIGHT = 280;

const finite = (number, fallback) => Number.isFinite(Number(number)) ? Number(number) : fallback;
const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

export function viewportDimensions(host = globalThis.window, doc = globalThis.document) {
  return {
    width: Math.max(300, finite(host?.innerWidth ?? doc?.documentElement?.clientWidth, 1366)),
    height: Math.max(300, finite(host?.innerHeight ?? doc?.documentElement?.clientHeight, 850))
  };
}

export function defaultManagerLayout(viewport) {
  const width = Math.min(480, viewport.width - 16);
  const height = Math.min(600, viewport.height - 100);
  return {
    left: Math.max(8, viewport.width - width - (viewport.width > 1050 ? 335 : 18)),
    top: Math.min(85, Math.max(8, viewport.height - height - 8)),
    width, height
  };
}

export function fitManagerLayout(layout, viewport) {
  const defaults = defaultManagerLayout(viewport), candidate = layout && typeof layout === "object" ? layout : defaults;
  const maxWidth = Math.max(250, viewport.width - 16), maxHeight = Math.max(250, viewport.height - 16);
  const minWidth = Math.min(PANEL_MIN_WIDTH, maxWidth), minHeight = Math.min(PANEL_MIN_HEIGHT, maxHeight);
  const width = clamp(finite(candidate.width, defaults.width), minWidth, maxWidth);
  const height = clamp(finite(candidate.height, defaults.height), minHeight, maxHeight);
  return {
    left: clamp(finite(candidate.left, defaults.left), 8, viewport.width - width - 8),
    top: clamp(finite(candidate.top, defaults.top), 8, viewport.height - height - 8),
    width, height
  };
}

export function moveManagerLayout(start, dx, dy, viewport) {
  return fitManagerLayout({...start, left: start.left + finite(dx, 0), top: start.top + finite(dy, 0)}, viewport);
}

export function resizeManagerLayout(start, dx, dy, viewport) {
  // Once the window reaches the viewport edge, resizing stops there instead
  // of allowing a hidden resize handle or close button.
  const width = clamp(start.width + finite(dx, 0), Math.min(PANEL_MIN_WIDTH, viewport.width - 16), viewport.width - start.left - 8);
  const height = clamp(start.height + finite(dy, 0), Math.min(PANEL_MIN_HEIGHT, viewport.height - 16), viewport.height - start.top - 8);
  return fitManagerLayout({...start, width, height}, viewport);
}

function localStore() {
  try { return globalThis.window?.localStorage ?? globalThis.localStorage ?? null; }
  catch { return null; }
}

export class GridlinesWindowLayout {
  constructor() {
    let saved = null;
    try { saved = JSON.parse(localStore()?.getItem(WINDOW_LAYOUT_KEY) ?? "null"); }
    catch { /* Private browsing or invalid previous preference: use defaults. */ }
    this.layout = fitManagerLayout(saved, viewportDimensions());
    this.root = null;
    this.host = null;
    this.dragCleanup = null;
    this.onViewportResize = () => this.apply();
  }

  persist() {
    try { localStore()?.setItem(WINDOW_LAYOUT_KEY, JSON.stringify(this.layout)); }
    catch { /* User can still move the window for the current session. */ }
  }

  mount(root) {
    this.root = root;
    this.host = globalThis.window ?? globalThis.document ?? null;
    this.host?.addEventListener?.("resize", this.onViewportResize);
    this.apply();
  }

  apply() {
    this.layout = fitManagerLayout(this.layout, viewportDimensions());
    if (!this.root) return;
    Object.assign(this.root.style, {
      left: `${this.layout.left}px`, top: `${this.layout.top}px`, right: "auto",
      width: `${this.layout.width}px`, height: `${this.layout.height}px`
    });
  }

  reset() {
    this.layout = defaultManagerLayout(viewportDimensions());
    this.apply();
    this.persist();
  }

  begin(event, mode) {
    if (event.button !== 0 || this.dragCleanup || !this.root) return;
    const host = globalThis.window ?? globalThis.document;
    if (!host?.addEventListener || !host?.removeEventListener) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    const origin = {x: event.clientX, y: event.clientY};
    const start = {...this.layout};
    const pointer = event.pointerId;
    const onMove = e => {
      if (pointer != null && e.pointerId != null && e.pointerId !== pointer) return;
      const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
      this.layout = mode === "resize"
        ? resizeManagerLayout(start, dx, dy, viewportDimensions())
        : moveManagerLayout(start, dx, dy, viewportDimensions());
      this.apply();
      e.preventDefault?.();
    };
    const onEnd = e => {
      if (pointer != null && e?.pointerId != null && e.pointerId !== pointer) return;
      this.dragCleanup?.();
      this.persist();
    };
    this.dragCleanup = () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onEnd);
      host.removeEventListener("pointercancel", onEnd);
      this.dragCleanup = null;
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onEnd);
    host.addEventListener("pointercancel", onEnd);
  }

  nudge(dx, dy, mode = "move") {
    this.layout = mode === "resize"
      ? resizeManagerLayout(this.layout, dx, dy, viewportDimensions())
      : moveManagerLayout(this.layout, dx, dy, viewportDimensions());
    this.apply();
    this.persist();
  }

  unmount() {
    this.dragCleanup?.();
    this.host?.removeEventListener?.("resize", this.onViewportResize);
    this.host = null;
    this.root = null;
  }
}
