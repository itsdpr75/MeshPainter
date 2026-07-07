import * as THREE from 'three';
import PaintShader from './PaintShader.js';
import UVAnalyzer from '../core/UVAnalyzer.js';
import { eventBus } from '../utils/EventBus.js';
import { EVENTS } from '../utils/Constants.js';

// Painter: handles brush stamping on material paint canvases
class Painter {
  constructor(engine, sceneManager) {
    this.engine = engine;
    this.sceneManager = sceneManager;

    this._activeBrush = null;
    this._activeMaterial = null;
    this._currentColor = new THREE.Color(0x000000);
    this._currentAlpha = 1.0;

    // Shader material for brush stamping
    this._stampMaterial = null;
    this._stampMesh = null;
    this._stampScene = null;
    this._stampCamera = null;

    // Intermediate texture to avoid WebGL feedback loops
    this._intermediateRT = null;
    this._intermediateTexture = null;

    // Cached blit resources (reused to avoid GC thrashing)
    this._blitMaterial = null;
    this._blitMesh = null;
    this._blitScene = null;

    // Raycaster for hit detection
    this._raycaster = new THREE.Raycaster();

    // Painting state
    this._isPainting = false;
    this._lastStampUV = null;
    this._minStampDistanceFactor = 0.5; // Stamp spacing as fraction of brush size
    this._stampFrameSkip = 1; // Paint every Nth frame (0 = every frame, 1 = every 2nd frame)
    this._stampFrameCounter = 0;
    this._textureBrushMode = true; // Default to texture brush (paint with selected material's texture)

    this._init();
    this._bindEvents();
  }

  _init() {
    // Create a simple full-screen quad for stamping
    this._stampMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uCanvas: { value: null },
        uBrush: { value: null },
        uMaterialMap: { value: null },
        uUseMaterialMap: { value: 0 },
        uCanvasSize: { value: new THREE.Vector2(4096, 4096) },
        uBrushSize: { value: new THREE.Vector2(50, 50) },
        uPosition: { value: new THREE.Vector2(0, 0) },
        uRotation: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Vector4(0, 0, 0, 1) }
      },
      vertexShader: PaintShader.vertexShader,
      fragmentShader: PaintShader.fragmentShader,
      depthTest: false,
      depthWrite: false
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this._stampMesh = new THREE.Mesh(geometry, this._stampMaterial);
    this._stampScene = new THREE.Scene();
    this._stampScene.add(this._stampMesh);
    this._stampCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this._stampCamera.position.z = 1;
  }

  // Creates or resizes the intermediate render target to match paint canvas resolution
  _ensureIntermediateRT(resolution) {
    if (this._intermediateRT && this._intermediateRT.width === resolution) {
      return;
    }

    if (this._intermediateRT) {
      this._intermediateRT.dispose();
    }

    this._intermediateRT = new THREE.WebGLRenderTarget(resolution, resolution, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      colorSpace: THREE.SRGBColorSpace
    });

    this._intermediateTexture = this._intermediateRT.texture;
  }

  _bindEvents() {
    eventBus.on(EVENTS.BRUSH_SELECTED, (brush) => {
      this._activeBrush = brush;
    });

    eventBus.on(EVENTS.MATERIAL_SELECTED, (material) => {
      this._activeMaterial = material;
    });

    eventBus.on(EVENTS.BRUSH_SIZE_CHANGED, (size) => {
      if (this._activeBrush) {
        this._activeBrush.setSize(size);
      }
    });

    eventBus.on(EVENTS.BRUSH_OPACITY_CHANGED, (opacity) => {
      if (this._activeBrush) {
        this._activeBrush.setOpacity(opacity);
      }
    });

    eventBus.on(EVENTS.BRUSH_ROTATION_CHANGED, (rotation) => {
      if (this._activeBrush) {
        this._activeBrush.setRotation(rotation);
      }
    });

    eventBus.on(EVENTS.BRUSH_COLOR_CHANGED, (colorHex) => {
      this._currentColor.set(colorHex);
    });

    eventBus.on(EVENTS.BRUSH_TEXTURE_MODE_CHANGED, (enabled) => {
      this._textureBrushMode = enabled;
    });
  }

  setColor(colorHex) {
    this._currentColor.set(colorHex);
  }

  setAlpha(alpha) {
    this._currentAlpha = alpha;
  }

  // Check if painting should happen at current mouse position
  tryPaint(inputManager, canvas) {
    // Frame skip to avoid CPU/GPU overload: skip raycasting and stamping
    // on frames that are not meant to paint.
    if (this._stampFrameCounter > 0) {
      this._stampFrameCounter--;
      return;
    }
    this._stampFrameCounter = this._stampFrameSkip;

    // Guard: active brush
    if (!this._activeBrush) return;

    // Guard: meshes in scene
    const meshes = this.sceneManager.getMeshes();
    if (meshes.length === 0) return;

    // Guard: mouse over canvas
    if (!inputManager.isMouseOverCanvas(canvas)) return;

    // Cast ray
    const ndc = inputManager.getNDC(canvas);
    this._raycaster.setFromCamera(ndc, this.engine.camera);
    const hits = this._raycaster.intersectObjects(meshes, false);

    if (hits.length === 0) {
      this._lastStampUV = null;
      this._stampFrameCounter = 0;
      return;
    }

    // Get the hit and determine which material was hit
    const hit = hits[0];
    const uv = hit.uv;
    if (!uv) return;

    // Determine the material of the hit face
    let hitMaterial;
    if (Array.isArray(hit.object.material)) {
      const matIndex = hit.face ? hit.face.materialIndex : 0;
      hitMaterial = hit.object.material[matIndex] || hit.object.material[0];
    } else {
      hitMaterial = hit.object.material;
    }

    if (!hitMaterial) return;

    // Use the hit material's paint canvas — this is the material that the
    // mesh actually uses at the hit location.
    const paintCanvas = hitMaterial._paintCanvas;
    const uvBounds = hitMaterial._uvBounds;

    if (!paintCanvas || !uvBounds) return;

    // Convert UV to canvas pixel coords
    const canvasPx = UVAnalyzer.uvToCanvas(uv.x, uv.y, uvBounds, paintCanvas.getResolution());

    // Check minimum distance between stamps based on current brush size
    // This ensures continuous coverage regardless of canvas resolution
    const brushSize = this._activeBrush.getSize();
    const minStampDistance = Math.max(1, brushSize * this._minStampDistanceFactor);
    if (this._lastStampUV) {
      const dx = canvasPx.x - this._lastStampUV.x;
      const dy = canvasPx.y - this._lastStampUV.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minStampDistance) return;
    }

    // Only update last stamp position when we actually stamp
    this._lastStampUV = canvasPx;

    // Perform the stamp on the hit material
    this.stamp(hitMaterial, paintCanvas, canvasPx.x, canvasPx.y);
  }

  stamp(targetMaterial, paintCanvas, x, y) {
    if (!this._activeBrush || !targetMaterial) return;

    const brush = this._activeBrush;
    const brushSize = brush.getSize();
    const effectiveSize = Math.max(1, brushSize); // Clamp to minimum 1px

    const resolution = paintCanvas.getResolution();
    const renderer = this.engine.renderer;

    // Ensure intermediate RT matches resolution
    this._ensureIntermediateRT(resolution);

    // Copy current paint canvas to intermediate texture to avoid WebGL feedback loop
    const prevTarget = renderer.getRenderTarget();
    const sourceTexture = paintCanvas.getRenderTarget().texture;

    // Use cached blit resources (reuse to avoid GC thrashing)
    if (!this._blitMaterial) {
      this._blitMaterial = new THREE.MeshBasicMaterial({
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      });
      this._blitMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._blitMaterial);
      this._blitScene = new THREE.Scene();
      this._blitScene.add(this._blitMesh);
    }
    if (this._blitMaterial.map !== sourceTexture) {
      this._blitMaterial.map = sourceTexture;
      this._blitMaterial.needsUpdate = true;
    }

    renderer.setRenderTarget(this._intermediateRT);
    renderer.render(this._blitScene, this._stampCamera);

    // Set up shader uniforms using the intermediate copy as source
    const uniforms = this._stampMaterial.uniforms;

    uniforms.uCanvas.value = this._intermediateTexture;
    uniforms.uBrush.value = brush.getTexture();
    uniforms.uCanvasSize.value.set(paintCanvas.getResolution(), paintCanvas.getResolution());
    uniforms.uBrushSize.value.set(effectiveSize, effectiveSize);
    uniforms.uPosition.value.set(x, y);
    uniforms.uRotation.value = brush.getRotation();
    uniforms.uOpacity.value = brush.getOpacity();
    uniforms.uColor.value.set(
      this._currentColor.r,
      this._currentColor.g,
      this._currentColor.b,
      this._currentAlpha
    );

    // Texture brush: if enabled and a material is selected with a paint canvas,
    // use its texture as the brush color instead of the solid color.
    // Guard: skip texture mode when the active material shares the same paint
    // canvas as the target to avoid WebGL feedback loop (reading from and
    // writing to the same RT texture in one draw call).
    const canUseTextureMode = this._textureBrushMode &&
      this._activeMaterial &&
      this._activeMaterial._paintCanvas &&
      this._activeMaterial._paintCanvas !== paintCanvas;

    if (canUseTextureMode) {
      uniforms.uMaterialMap.value = this._activeMaterial._paintCanvas.getTexture();
      uniforms.uUseMaterialMap.value = 1;
    } else {
      uniforms.uMaterialMap.value = null;
      uniforms.uUseMaterialMap.value = 0;
    }

    // Render to the paint canvas
    renderer.setRenderTarget(paintCanvas.getRenderTarget());
    renderer.render(this._stampScene, this._stampCamera);
    renderer.setRenderTarget(prevTarget);

    // Apply the painted texture to the target material and any mesh materials
    // that share the same paint canvas (handles GLTFLoader material clones).
    const texture = paintCanvas.getRenderTarget().texture;
    const meshes = this.sceneManager.getMeshes();

    for (const mesh of meshes) {
      const meshMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of meshMats) {
        const isSame = mat === targetMaterial;
        const sharesPaintCanvas = mat._paintCanvas === paintCanvas;
        if ((isSame || sharesPaintCanvas) && mat.map !== texture) {
          mat.map = texture;
          mat.needsUpdate = true;
        }
      }
    }

    // Ensure the target material itself is updated (even if not attached to any mesh)
    if (targetMaterial.map !== texture) {
      targetMaterial.map = texture;
      targetMaterial.needsUpdate = true;
    }
    targetMaterial._painted = true;

    this.engine.markDirty();
    eventBus.emit(EVENTS.SCENE_DIRTY);
    eventBus.emit(EVENTS.PAINT_STROKE_APPLIED, { material: targetMaterial });
  }

  getActiveMaterial() {
    return this._activeMaterial;
  }

  resetStampPosition() {
    this._lastStampUV = null;
    this._stampFrameCounter = 0;
  }

  getActiveBrush() {
    return this._activeBrush;
  }

  destroy() {
    if (this._stampMaterial) {
      this._stampMaterial.dispose();
      this._stampMaterial = null;
    }
    if (this._stampMesh) {
      this._stampMesh.geometry.dispose();
      this._stampMesh = null;
    }
    if (this._blitMaterial) {
      this._blitMaterial.dispose();
      this._blitMaterial = null;
    }
    if (this._blitMesh) {
      this._blitMesh.geometry.dispose();
      this._blitMesh = null;
    }
    if (this._intermediateRT) {
      this._intermediateRT.dispose();
      this._intermediateRT = null;
    }
  }
}

export default Painter;
