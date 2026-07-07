import * as THREE from 'three';
import { DEFAULT_CANVAS_RESOLUTION } from '../utils/Constants.js';

// PaintCanvas: per-material, independent RenderTarget for painting
class PaintCanvas {
  constructor(resolution = DEFAULT_CANVAS_RESOLUTION) {
    this._resolution = resolution;
    this._renderTarget = null;
    this._texture = null;
    this._initialized = false;

    this._init();
  }

  _init() {
    // Create render target with sRGB framebuffer for correct color handling
    this._renderTarget = new THREE.WebGLRenderTarget(
      this._resolution,
      this._resolution,
      {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
        colorSpace: THREE.SRGBColorSpace
      }
    );

    // Texture already has SRGBColorSpace from constructor options

    // Keep _texture for backward compat (points to RT texture)
    this._texture = this._renderTarget.texture;

    this._initialized = true;
  }

  // Initialize this paint canvas by copying a source texture into the render target.
  // Used to preserve the original albedo texture as base for painting.
  initFromTexture(renderer, sourceTexture) {
    if (!renderer || !sourceTexture || !this._renderTarget) return;

    const blitMaterial = new THREE.MeshBasicMaterial({
      map: sourceTexture,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    const blitMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMaterial);
    const blitScene = new THREE.Scene();
    blitScene.add(blitMesh);
    const blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this._renderTarget);
    renderer.render(blitScene, blitCamera);
    renderer.setRenderTarget(prevTarget);

    blitMaterial.dispose();
    blitMesh.geometry.dispose();
  }

  getRenderTarget() {
    return this._renderTarget;
  }

  getTexture() {
    return this._renderTarget.texture;
  }

  getResolution() {
    return this._resolution;
  }

  setResolution(resolution) {
    if (resolution === this._resolution) return;

    this._resolution = resolution;
    this._renderTarget.dispose();
    this._renderTarget = null;
    if (this._whiteTexture) {
      this._whiteTexture.dispose();
      this._whiteTexture = null;
    }
    this._texture = null;

    this._init();
  }

  getImageData(renderer) {
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this._renderTarget);

    const pixels = new Uint8Array(this._resolution * this._resolution * 4);
    renderer.readRenderTargetPixels(
      this._renderTarget,
      0, 0,
      this._resolution, this._resolution,
      pixels
    );

    renderer.setRenderTarget(prevTarget);

    return new ImageData(
      new Uint8ClampedArray(pixels),
      this._resolution,
      this._resolution
    );
  }

  setImageData(imageData, renderer) {
    if (imageData.width !== this._resolution || imageData.height !== this._resolution) {
      throw new Error('ImageData resolution mismatch');
    }

    // Create a DataTexture from the image data
    const tempTexture = new THREE.DataTexture(
      new Uint8Array(imageData.data),
      this._resolution,
      this._resolution,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    tempTexture.needsUpdate = true;
    tempTexture.minFilter = THREE.NearestFilter;
    tempTexture.magFilter = THREE.NearestFilter;
    tempTexture.colorSpace = THREE.SRGBColorSpace;

    // Blit into the RT
    if (renderer) {
      this.initFromTexture(renderer, tempTexture);
    }

    tempTexture.dispose();
  }

  cloneTextureData(renderer) {
    // Use getImageData which reads from GPU via readRenderTargetPixels
    if (renderer) {
      const imageData = this.getImageData(renderer);
      return new Uint8Array(imageData.data);
    }
    // Fallback without renderer: return white data
    const pixelCount = this._resolution * this._resolution;
    const data = new Uint8Array(pixelCount * 4);
    data.fill(255);
    return data;
  }

  dispose() {
    if (this._renderTarget) {
      this._renderTarget.dispose();
      this._renderTarget = null;
    }
    this._texture = null;
    this._initialized = false;
  }
}

export default PaintCanvas;
