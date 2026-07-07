import * as THREE from 'three';
import { EVENTS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

// Core engine: WebGL renderer, scene, render loop with dirty flag
class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this._dirty = true;
    this._running = false;
    this._animationId = null;
    this._clock = new THREE.Clock();
    this._delta = 0;
    this._time = 0;

    this._init();
  }

  _init() {
    // Create WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Ambient light for flat unlit visual (keeps PBR channels, neutral for painting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambientLight);

    // Subtle directional light for form definition (keeps flat look but adds depth)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(1, 1, 0.5);
    this.scene.add(dirLight);

    // Handle resize
    window.addEventListener('resize', () => this._onResize());

    // Start render loop
    this._startLoop();
  }

  _startLoop() {
    this._running = true;
    const loop = () => {
      if (!this._running) return;

      this._delta = this._clock.getDelta();
      this._time = this._clock.elapsedTime;

      if (this._dirty && this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
        this._dirty = false;
      }

      this._animationId = requestAnimationFrame(loop);
    };
    this._animationId = requestAnimationFrame(loop);
  }

  _onResize() {
    if (!this.renderer || !this.camera) return;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    if (width === 0 || height === 0) return;

    this.renderer.setSize(width, height, false);

    if (this.camera.aspect !== undefined) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    this.markDirty();
  }

  markDirty() {
    this._dirty = true;
  }

  getDelta() {
    return this._delta;
  }

  getTime() {
    return this._time;
  }

  getRenderTargetSize() {
    return {
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight
    };
  }

  setCamera(camera) {
    this.camera = camera;
    this._onResize();
    this.markDirty();
  }

  readPixels(target, x, y, width, height) {
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    const pixels = new Uint8Array(width * height * 4);
    this.renderer.readRenderTargetPixels(target, x, y, width, height, pixels);
    this.renderer.setRenderTarget(prevTarget);
    return pixels;
  }

  readPixelsToImageData(target, x, y, width, height) {
    const pixels = this.readPixels(target, x, y, width, height);
    return new ImageData(new Uint8ClampedArray(pixels), width, height);
  }

  destroy() {
    this._running = false;
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    if (this.scene) {
      this.scene.clear();
      this.scene = null;
    }
  }
}

export default Engine;
