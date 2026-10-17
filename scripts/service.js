import {MODULE_ID, DATA_KEY, validateState, geometrySnapshot, newState, alignmentStatus, previewPixelRemap} from "./model.js";

export class SceneService {
  constructor({isGM = () => game.user.isGM} = {}) { this.isGM = isGM; }

  read(scene) {
    const state = scene?.getFlag?.(MODULE_ID, DATA_KEY);
    return state ? validateState(state) : null;
  }

  getStatus(scene) {
    const state = this.read(scene);
    return alignmentStatus(state, geometrySnapshot(scene));
  }

  async enable(scene) {
    if (!this.isGM()) throw new Error("GM access required");
    if (this.read(scene)) throw new Error("Gridlines is already enabled for this Scene");
    const state = newState(geometrySnapshot(scene));
    await scene.setFlag(MODULE_ID, DATA_KEY, state);
    return state;
  }

  /** Not atomic across two concurrent GMs: a revision check reduces, but cannot eliminate, last-writer races. */
  async edit(scene, expectedRevision, callback, {allowPending = false} = {}) {
    if (!this.isGM()) throw new Error("GM access required");
    const previous = this.read(scene);
    if (!previous) throw new Error("Enable Gridlines on this Scene first");
    if (previous.revision !== expectedRevision) throw new Error("This Scene was edited elsewhere. Reopen Gridlines before saving.");
    const snapshot = geometrySnapshot(scene);
    if (!allowPending && alignmentStatus(previous, snapshot).pending) throw new Error("Review the changed Foundry grid before editing Gridlines");
    const next = structuredClone(previous);
    callback(next, snapshot);
    validateState(next);
    next.revision += 1;
    await scene.setFlag(MODULE_ID, DATA_KEY, next);
    return next;
  }

  async acceptCurrentGeometry(scene, revision) {
    return this.edit(scene, revision, (state, snapshot) => {
      state.baseline = snapshot;
      state.geometryRevision += 1;
    }, {allowPending: true});
  }

  previewPreserveMap(scene) {
    const state = this.read(scene);
    if (!state) throw new Error("Enable Gridlines first");
    return previewPixelRemap(state, geometrySnapshot(scene));
  }

  async preserveMap(scene, revision) {
    return this.edit(scene, revision, (state, snapshot) => {
      const remapped = previewPixelRemap(state, snapshot).state;
      state.formats = remapped.formats;
      state.namedRanges = remapped.namedRanges;
      state.baseline = snapshot;
      state.geometryRevision += 1;
    }, {allowPending: true});
  }
}
