import * as THREE from 'three';

// UVAnalyzer: analyzes TEXCOORD_0 bounds per material
class UVAnalyzer {
  // Analyze TEXCOORD_0 bounds for all meshes using a given material
  static analyzeMaterial(meshes, material) {
    let globalUMin = Infinity;
    let globalUMax = -Infinity;
    let globalVMin = Infinity;
    let globalVMax = -Infinity;

    for (const mesh of meshes) {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      const matIndex = materials.indexOf(material);
      if (matIndex === -1) continue;

      const geometry = mesh.geometry;
      if (!geometry) continue;

      const uvAttribute = geometry.attributes.uv;
      if (!uvAttribute) continue;

      // For multi-material meshes, we need to consider which faces use this material
      if (Array.isArray(mesh.material) && geometry.groups.length > 0) {
        const bounds = this._getUVBoundsForMaterial(uvAttribute, geometry, matIndex);
        if (bounds) {
          globalUMin = Math.min(globalUMin, bounds.uMin);
          globalUMax = Math.max(globalUMax, bounds.uMax);
          globalVMin = Math.min(globalVMin, bounds.vMin);
          globalVMax = Math.max(globalVMax, bounds.vMax);
        }
      } else {
        // Single material for whole mesh
        const bounds = this._getUVBoundsAll(uvAttribute);
        globalUMin = Math.min(globalUMin, bounds.uMin);
        globalUMax = Math.max(globalUMax, bounds.uMax);
        globalVMin = Math.min(globalVMin, bounds.vMin);
        globalVMax = Math.max(globalVMax, bounds.vMax);
      }
    }

    if (!isFinite(globalUMin)) {
      // Default UV bounds if no UV data found
      return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
    }

    return {
      uMin: globalUMin,
      uMax: globalUMax,
      vMin: globalVMin,
      vMax: globalVMax
    };
  }

  static _getUVBoundsForMaterial(uvAttribute, geometry, materialIndex) {
    const index = geometry.index;
    if (!index) return null;

    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;

    for (const group of geometry.groups) {
      if (group.materialIndex !== materialIndex) continue;

      const start = group.start;
      const end = start + group.count;

      for (let i = start; i < end; i++) {
        const idx = index.getX(i);
        const u = uvAttribute.getX(idx);
        const v = uvAttribute.getY(idx);
        uMin = Math.min(uMin, u);
        uMax = Math.max(uMax, u);
        vMin = Math.min(vMin, v);
        vMax = Math.max(vMax, v);
      }
    }

    if (!isFinite(uMin)) return null;

    return { uMin, uMax, vMin, vMax };
  }

  static _getUVBoundsAll(uvAttribute) {
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;

    for (let i = 0; i < uvAttribute.count; i++) {
      const u = uvAttribute.getX(i);
      const v = uvAttribute.getY(i);
      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }

    return { uMin, uMax, vMin, vMax };
  }

  // Analyze TEXCOORD_0 bounds for ALL meshes regardless of material assignment
  static analyzeAllMeshes(meshes) {
    let globalUMin = Infinity;
    let globalUMax = -Infinity;
    let globalVMin = Infinity;
    let globalVMax = -Infinity;

    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      if (!geometry) continue;

      const uvAttribute = geometry.attributes.uv;
      if (!uvAttribute) continue;

      const bounds = this._getUVBoundsAll(uvAttribute);
      globalUMin = Math.min(globalUMin, bounds.uMin);
      globalUMax = Math.max(globalUMax, bounds.uMax);
      globalVMin = Math.min(globalVMin, bounds.vMin);
      globalVMax = Math.max(globalVMax, bounds.vMax);
    }

    if (!isFinite(globalUMin)) {
      return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
    }

    return {
      uMin: globalUMin,
      uMax: globalUMax,
      vMin: globalVMin,
      vMax: globalVMax
    };
  }

  // Map UV coordinate to paint canvas pixel coordinate
  static uvToCanvas(u, v, uvBounds, canvasResolution) {
    const cu = ((u - uvBounds.uMin) / (uvBounds.uMax - uvBounds.uMin)) * canvasResolution;
    const cv = ((v - uvBounds.vMin) / (uvBounds.vMax - uvBounds.vMin)) * canvasResolution;
    return { x: Math.round(cu), y: Math.round(cv) };
  }

  // Map paint canvas pixel coordinate to UV
  static canvasToUv(cx, cy, uvBounds, canvasResolution) {
    const u = (cx / canvasResolution) * (uvBounds.uMax - uvBounds.uMin) + uvBounds.uMin;
    const v = (cy / canvasResolution) * (uvBounds.vMax - uvBounds.vMin) + uvBounds.vMin;
    return { u, v };
  }
}

export default UVAnalyzer;
