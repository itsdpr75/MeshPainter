import * as THREE from 'three';
import PaintCanvas from '../painting/PaintCanvas.js';
import UVAnalyzer from '../core/UVAnalyzer.js';
import PBRMaterial from './PBRMaterial.js';
import { EVENTS, DEFAULT_CANVAS_RESOLUTION } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';
import { CANVAS_RESOLUTIONS } from '../utils/Constants.js';

// MaterialManager: manages editor materials, paint canvases, and UV analysis
class MaterialManager {
  constructor(engine, sceneManager) {
    this.engine = engine;
    this.sceneManager = sceneManager;

    // Map: Three.js material -> editor metadata
    this._materialMeta = new Map();
    this._materials = [];

    this._bindEvents();
  }

  _bindEvents() {
    eventBus.on(EVENTS.MODEL_LOADED, (data) => {
      this._onModelLoaded(data);
    });

    eventBus.on(EVENTS.MATERIAL_SELECTED, (material) => {
      this._showMaterialOnMesh(material);
    });
  }

  _onModelLoaded(data) {
    this._materials = [];
    this._materialMeta.clear();

    const { meshes, materials } = data;

    for (const material of materials) {
      this._registerMaterial(material, meshes);
    }
  }

  _registerMaterial(material, meshes) {
    if (this._materialMeta.has(material)) return;

    // Analyze UV bounds for meshes using THIS material
    const uvBounds = UVAnalyzer.analyzeMaterial(meshes, material);

    // Create paint canvas
    const paintCanvas = new PaintCanvas(DEFAULT_CANVAS_RESOLUTION);

    // Initialize paint canvas: copy original albedo texture if present, else material color
    if (material.map && material.map.isTexture) {
      paintCanvas.initFromTexture(this.engine.renderer, material.map);
    } else {
      this.initCanvasFromColor(paintCanvas, material.color);
    }

    this._materialMeta.set(material, {
      uvBounds,
      paintCanvas,
      resolution: DEFAULT_CANVAS_RESOLUTION
    });

    // Store reference on the material itself for quick access
    material._paintCanvas = paintCanvas;
    material._uvBounds = uvBounds;
    material._painted = false;

    // Assign PaintCanvas as material.map so the model shows the base color/texture on load
    material.map = paintCanvas.getTexture();
    material.needsUpdate = true;

    this._materials.push(material);
  }

  // Show a material's PaintCanvas on meshes that use this material
  _showMaterialOnMesh(material) {
    const meshes = this.sceneManager.getMeshes();
    if (meshes.length === 0) return;

    const paintCanvas = material._paintCanvas;
    if (!paintCanvas) return;

    const texture = paintCanvas.getTexture();

    for (const mesh of meshes) {
      const meshMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of meshMats) {
        if (mat === material) {
          mat.map = texture;
          mat.needsUpdate = true;
        }
      }
    }

    this.engine.markDirty();
  }

  createNewMaterial(name) {
    const material = PBRMaterial.createDefault(name);

    const meshes = this.sceneManager.getMeshes();

    // Get UV bounds from all meshes (analyzeAllMeshes for new materials not on any mesh)
    const uvBounds = meshes.length > 0
      ? UVAnalyzer.analyzeAllMeshes(meshes)
      : { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };

    const paintCanvas = new PaintCanvas(DEFAULT_CANVAS_RESOLUTION);

    // Initialize with the new material's own color (clean slate)
    this.initCanvasFromColor(paintCanvas, material.color);

    this._materialMeta.set(material, {
      uvBounds,
      paintCanvas,
      resolution: DEFAULT_CANVAS_RESOLUTION
    });

    material._paintCanvas = paintCanvas;
    material._uvBounds = uvBounds;
    material._painted = false;
    material.map = paintCanvas.getTexture();
    material.needsUpdate = true;

    this._materials.push(material);

    eventBus.emit(EVENTS.MATERIAL_CREATED, material);
    return material;
  }

  // Fill a paint canvas with a solid color (used when no albedo texture exists)
  initCanvasFromColor(paintCanvas, color) {
    // Convert linear Three.js color to sRGB for 2D Canvas API
    const srgbColor = color.clone();
    if (srgbColor.convertLinearToSRGB) {
      srgbColor.convertLinearToSRGB();
    }
    const hex = '#' + srgbColor.getHexString();

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 64, 64);
    const imageData = ctx.getImageData(0, 0, 64, 64);

    const solidTex = new THREE.DataTexture(
      new Uint8Array(imageData.data),
      64, 64,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    solidTex.needsUpdate = true;
    solidTex.minFilter = THREE.NearestFilter;
    solidTex.magFilter = THREE.NearestFilter;
    solidTex.colorSpace = THREE.SRGBColorSpace;

    paintCanvas.initFromTexture(this.engine.renderer, solidTex);
    solidTex.dispose();
  }

  getMaterialMeta(material) {
    return this._materialMeta.get(material) || null;
  }

  getPaintCanvas(material) {
    const meta = this._materialMeta.get(material);
    return meta ? meta.paintCanvas : null;
  }

  getUVBounds(material) {
    const meta = this._materialMeta.get(material);
    return meta ? meta.uvBounds : null;
  }

  getMaterials() {
    return this._materials;
  }

  setCanvasResolution(material, resolution) {
    if (!CANVAS_RESOLUTIONS.includes(resolution)) {
      throw new Error(`Invalid resolution: ${resolution}. Must be one of ${CANVAS_RESOLUTIONS.join(', ')}`);
    }

    const meta = this._materialMeta.get(material);
    if (meta) {
      meta.paintCanvas.setResolution(resolution);
      meta.resolution = resolution;
      material._paintCanvas = meta.paintCanvas;
      this.engine.markDirty();
    }
  }

  // Collect textures from all paint canvases for export
  collectPaintTextures() {
    const textures = [];

    for (const [material, meta] of this._materialMeta.entries()) {
      if (material._painted && meta.paintCanvas) {
        const imageData = meta.paintCanvas.getImageData(this.engine.renderer);

        const texture = new THREE.DataTexture(
          new Uint8Array(imageData.data),
          imageData.width,
          imageData.height,
          THREE.RGBAFormat,
          THREE.UnsignedByteType
        );
        texture.needsUpdate = true;
        texture.flipY = false;

        textures.push({
          material,
          texture,
          imageData
        });
      }
    }

    return textures;
  }

  destroy() {
    for (const [material, meta] of this._materialMeta.entries()) {
      if (meta.paintCanvas) {
        meta.paintCanvas.dispose();
      }
    }
    this._materialMeta.clear();
    this._materials = [];
  }
}

export default MaterialManager;
