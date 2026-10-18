import {normalizeAxes} from "./model.js";

// Native Foundry Region rectangles use scene pixel coordinates, not grid
// offsets. No snapping or raster approximation is needed for rectangular fills.
export const MAX_REGION_BATCH = 30;

function presentRegions(scene) {
  const collection = scene?.regions;
  if (Array.isArray(collection?.contents)) return collection.contents;
  if (Array.isArray(collection)) return collection;
  if (collection && typeof collection.values === "function") return Array.from(collection.values());
  return [];
}

export function existingShadeRegionIds(scene) {
  return new Set(presentRegions(scene).filter(r => r?.flags?.gridlines?.sourceSceneId === scene?.id &&
    r.flags.gridlines.sourceKind === "shading" && typeof r.flags.gridlines.shadeLayerId === "string")
    .map(r => r.flags.gridlines.shadeLayerId));
}

/** This builds a preview ONLY: nothing is created in Foundry until explicit confirmation. */
export function planShadingRegions({scene, state, ids, resolver, sceneRect, displayName}) {
  if (!scene?.id || !state || !Array.isArray(ids) || !ids.length || typeof resolver?.rangeBounds !== "function")
    throw new Error("Choose one or more existing shading layers first");
  if (ids.length > MAX_REGION_BATCH) throw new Error(`Convert at most ${MAX_REGION_BATCH} shading layers at a time`);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate layer IDs in Region preview");
  if (!(sceneRect?.width > 0 && sceneRect?.height > 0)) throw new Error("Scene rectangle unavailable");
  const existing = existingShadeRegionIds(scene), items = [];
  for (const id of ids) {
    const layer = state.formats.find(f => f.id === id);
    if (!layer) throw new Error("A shading layer changed; refresh and preview again");
    if (existing.has(id)) throw new Error("A Region already exists for one of these shading layers; it was not duplicated");
    const bounds = resolver.rangeBounds(layer.range);
    const x = Math.max(bounds.x,sceneRect.x), y=Math.max(bounds.y,sceneRect.y);
    const right=Math.min(bounds.right,sceneRect.x+sceneRect.width), bottom=Math.min(bounds.bottom,sceneRect.y+sceneRect.height);
    if (!(right > x && bottom > y)) throw new Error("A shading layer is outside the Scene and cannot become a Region");
    // Round only microscopic floating-point noise, never snap to native grid.
    const px = n => Math.round(n*1000)/1000;
    const shape={type:"rectangle",x:px(x),y:px(y),width:px(right-x),height:px(bottom-y)};
    if (!(shape.width>0 && shape.height>0)) throw new Error("Region would have zero size");
    const label = String(layer.label||"").trim();
    items.push({id,range:structuredClone(layer.range),name:label||`Gridlines+ ${displayName(layer.range)}`,
      fill:layer.fill,shape,clipped:x!==bounds.x||y!==bounds.y||right!==bounds.right||bottom!==bounds.bottom});
  }
  return {sceneId:scene.id,revision:state.revision,axesFingerprint:JSON.stringify(normalizeAxes(state.axes)),
    ids:[...ids],items};
}

export async function createShadingRegions({scene, state, plan, resolver, sceneRect, displayName}) {
  if (typeof scene?.createEmbeddedDocuments !== "function") throw new Error("Foundry Scene Region creation API is unavailable");
  if (!plan || scene.id !== plan.sceneId || state.revision !== plan.revision ||
      JSON.stringify(normalizeAxes(state.axes)) !== plan.axesFingerprint)
    throw new Error("Scene or Gridlines+ settings changed; preview Regions again");
  const latest=planShadingRegions({scene,state,ids:plan.ids,resolver,sceneRect,displayName});
  if (JSON.stringify(latest.items) !== JSON.stringify(plan.items))
    throw new Error("Scene geometry or saved shading changed; preview Regions again");
  const docs=latest.items.map(item=>({name:item.name,color:item.fill,shapes:[item.shape],behaviors:[],
    flags:{gridlines:{sourceKind:"shading",sourceSceneId:scene.id,shadeLayerId:item.id,
      sourceRevision:state.revision}}}));
  // No replacement/deletion: new native Regions are added, source shading remains.
  const created=await scene.createEmbeddedDocuments("Region",docs);
  if (!Array.isArray(created) || created.length !== docs.length)
    throw new Error("Foundry returned an unexpected Region count. Check the Region legend before trying again; some may have been created");
  return created;
}
