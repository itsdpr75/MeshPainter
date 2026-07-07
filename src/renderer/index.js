import * as THREE from 'three';
import Engine from './core/Engine.js';
import SceneManager from './core/SceneManager.js';
import InputManager from './core/InputManager.js';
import CameraSwitcher from './camera/CameraSwitcher.js';
import Painter from './painting/Painter.js';
import MaterialManager from './materials/MaterialManager.js';
import MaterialModal from './materials/MaterialModal.js';
import DecalManager from './decals/DecalManager.js';
import DecalProjector from './decals/DecalProjector.js';
import DecalGizmo from './decals/DecalGizmo.js';
import UIManager from './ui/UIManager.js';
import UndoRedo from './utils/UndoRedo.js';
import FileIO from './utils/FileIO.js';
import { eventBus } from './utils/EventBus.js';
import { EVENTS } from './utils/Constants.js';

// MeshPaint main application entry point
class MeshPaintApp {
  constructor() {
    this.engine = null;
    this.sceneManager = null;
    this.inputManager = null;
    this.cameraSwitcher = null;
    this.painter = null;
    this.materialManager = null;
    this.materialModal = null;
    this.decalManager = null;
    this.decalProjector = null;
    this.decalGizmo = null;
    this.uiManager = null;
    this.undoRedo = null;

    this._running = false;
    this._decalGizmoMode = null;

    this._init();
  }

  _init() {
    // Get canvas
    const canvas = document.getElementById('viewport-canvas');
    if (!canvas) {
      console.error('Viewport canvas not found');
      return;
    }

    // Core systems
    this.engine = new Engine(canvas);
    this.sceneManager = new SceneManager(this.engine);
    this.inputManager = new InputManager(canvas);
    this.cameraSwitcher = new CameraSwitcher(this.engine);

    // Painting and materials
    this.materialManager = new MaterialManager(this.engine, this.sceneManager);
    this.painter = new Painter(this.engine, this.sceneManager);

    // Decals
    this.decalManager = new DecalManager(this.engine, this.sceneManager);
    this.decalProjector = new DecalProjector(this.engine, this.sceneManager, canvas);
    this.decalGizmo = new DecalGizmo(this.engine);

    // UI
    this.uiManager = new UIManager();
    this.materialModal = new MaterialModal(this.materialManager, document.getElementById('modal-overlay'));

    // Undo/Redo
    this.undoRedo = new UndoRedo();

    // Bind application events
    this._bindAppEvents();
    this._bindInputShortcuts();
    this._bindUndoRedo();
    this._bindDecalSelection();

    // Start render loop
    this._startLoop();
  }

  _bindAppEvents() {
    // Open GLB
    eventBus.on('app:openGLB', async () => {
      await this._handleOpenGLB();
    });

    // Export GLB
    eventBus.on('app:exportGLB', async () => {
      await this._handleExportGLB();
    });

    // Undo/Redo
    eventBus.on('app:undo', () => {
      this._performUndo();
    });

    eventBus.on('app:redo', () => {
      this._performRedo();
    });

    // Material modal
    eventBus.on('ui:showNewMaterialModal', () => {
      this.materialModal.showForNew((data) => {
        const material = this.materialManager.createNewMaterial(data.name);
        this._applyMaterialData(material, data);
        eventBus.emit(EVENTS.MATERIAL_UPDATED);
        this.engine.markDirty();
      });
    });

    eventBus.on('ui:showEditMaterialModal', (material) => {
      this.materialModal.showForEdit(material, (data) => {
        this._applyMaterialData(material, data);
        material.needsUpdate = true;
        eventBus.emit(EVENTS.MATERIAL_UPDATED);
        this.engine.markDirty();
      });
    });

    // Canvas resolution change
    eventBus.on('material:setResolution', ({ material, resolution }) => {
      this.materialManager.setCanvasResolution(material, resolution);
      eventBus.emit(EVENTS.MATERIAL_UPDATED);
    });

    // Model loaded: focus camera
    eventBus.on(EVENTS.MODEL_LOADED, (data) => {
      const box = new THREE.Box3().setFromObject(data.scene);
      this.cameraSwitcher.focusOn(box);
    });
  }

  _bindInputShortcuts() {
    // Ctrl+wheel for brush size
    // Shift+wheel for opacity
    // Alt+wheel for rotation
    // These are handled in the update loop for wheel events
  }

  _bindUndoRedo() {
    eventBus.on(EVENTS.PAINT_STROKE_APPLIED, (data) => {
      // Create undo state for paint strokes
      const material = data.material;
      if (material && material._paintCanvas) {
        const textureData = material._paintCanvas.cloneTextureData(this.engine.renderer);
        this.undoRedo.pushState({
          type: 'paint',
          material: material,
          textureData: new ImageData(
            new Uint8ClampedArray(textureData),
            material._paintCanvas.getResolution(),
            material._paintCanvas.getResolution()
          )
        });
      }
    });

    eventBus.on(EVENTS.DECAL_CREATED, (decalEntry) => {
      this.undoRedo.pushState({
        type: 'decal_create',
        decal: decalEntry
      });
    });

    eventBus.on(EVENTS.DECAL_DELETED, (decalEntry) => {
      this.undoRedo.pushState({
        type: 'decal_delete',
        decal: decalEntry
      });
    });
  }

  _bindDecalSelection() {
    eventBus.on(EVENTS.DECAL_SELECTED, (decalEntry) => {
      this.decalGizmo.showFor(decalEntry);
    });

    eventBus.on(EVENTS.DECAL_DESELECTED, () => {
      this.decalGizmo.hide();
    });
  }

  // Apply full PBR data from modal to a material
  _applyMaterialData(material, data) {
    material.name = data.name;

    // Albedo: color + texture (texture takes precedence)
    material.color.set(data.albedo);
    const mapChanged = (data.albedoTexture && material.map !== data.albedoTexture.texture) ||
                       (!data.albedoTexture && material.map !== null);
    if (data.albedoTexture) {
      material.map = data.albedoTexture.texture;
      material.map._fileName = data.albedoTexture.fileName;
    } else {
      material.map = null;
    }
    // Re-initialize paint canvas from new map or material color
    if (mapChanged && material._paintCanvas) {
      if (material.map) {
        material._paintCanvas.initFromTexture(this.engine.renderer, material.map);
      } else {
        this.materialManager.initCanvasFromColor(material._paintCanvas, material.color);
      }
    }

    // Normal map
    if (data.normalTexture) {
      if (material.normalMap !== data.normalTexture.texture) {
        material.normalMap = data.normalTexture.texture;
        material.normalMap._fileName = data.normalTexture.fileName;
      }
    } else {
      material.normalMap = null;
    }

    // Displacement (preview only, NOT exported)
    if (data.displacementTexture) {
      if (material.displacementMap !== data.displacementTexture.texture) {
        material.displacementMap = data.displacementTexture.texture;
        material.displacementMap._fileName = data.displacementTexture.fileName;
      }
      material.displacementScale = 0.05;
      material.displacementBias = 0;
    } else {
      material.displacementMap = null;
      material.displacementScale = 0;
      material.displacementBias = 0;
    }

    // AO
    if (data.aoTexture) {
      if (material.aoMap !== data.aoTexture.texture) {
        material.aoMap = data.aoTexture.texture;
        material.aoMap._fileName = data.aoTexture.fileName;
      }
    } else {
      material.aoMap = null;
    }

    // Specular: texture takes precedence over numeric
    material.specularIntensity = data.specularIntensity;
    if (data.specularTexture) {
      if (material.specularColorMap !== data.specularTexture.texture) {
        material.specularColorMap = data.specularTexture.texture;
        material.specularColorMap._fileName = data.specularTexture.fileName;
      }
    } else {
      material.specularColorMap = null;
    }

    // Roughness: texture takes precedence over numeric
    material.roughness = data.roughness;
    if (data.roughnessTexture) {
      if (material.roughnessMap !== data.roughnessTexture.texture) {
        material.roughnessMap = data.roughnessTexture.texture;
        material.roughnessMap._fileName = data.roughnessTexture.fileName;
      }
    } else {
      material.roughnessMap = null;
    }

    // Metalness: texture takes precedence over numeric
    material.metalness = data.metalness;
    if (data.metalnessTexture) {
      if (material.metalnessMap !== data.metalnessTexture.texture) {
        material.metalnessMap = data.metalnessTexture.texture;
        material.metalnessMap._fileName = data.metalnessTexture.fileName;
      }
    } else {
      material.metalnessMap = null;
    }

    material.needsUpdate = true;
  }

  async _handleOpenGLB() {
    try {
      const result = await FileIO.openGLB();
      if (!result || !result.buffer) return;

      await this.sceneManager.loadGLB(result.buffer);
    } catch (e) {
      console.error('Failed to open GLB:', e);
      alert('Failed to open GLB file. See console for details.');
    }
  }

  async _handleExportGLB() {
    try {
      // Collect paint textures and apply to materials
      const paintTextures = this.materialManager.collectPaintTextures();
      const originalMaps = [];

      for (const { material, texture } of paintTextures) {
        originalMaps.push({ material, map: material.map });
        material.map = texture;
        material.needsUpdate = true;
      }

      // Save displacement state and temporarily remove it (not exported)
      const displacementBackups = [];
      for (const material of this.materialManager.getMaterials()) {
        if (material.displacementMap) {
          displacementBackups.push({
            material,
            displacementMap: material.displacementMap,
            displacementScale: material.displacementScale,
            displacementBias: material.displacementBias
          });
          material.displacementMap = null;
          material.displacementScale = 0;
          material.displacementBias = 0;
        }
      }

      // Hide decals before export
      const decalsContainer = this.decalManager.getDecalsContainer();
      if (decalsContainer) {
        decalsContainer.visible = false;
      }

      // Export
      const arrayBuffer = await this.sceneManager.exportGLB();

      // Restore decals
      if (decalsContainer) {
        decalsContainer.visible = true;
      }

      // Restore displacement
      for (const { material, displacementMap, displacementScale, displacementBias } of displacementBackups) {
        material.displacementMap = displacementMap;
        material.displacementScale = displacementScale;
        material.displacementBias = displacementBias;
        material.needsUpdate = true;
      }

      // Restore original maps
      for (const { material, map } of originalMaps) {
        material.map = map;
        material.needsUpdate = true;
      }

      // Save file
      const result = await FileIO.saveGLB(arrayBuffer);
      if (result && result.success) {
        eventBus.emit(EVENTS.MODEL_EXPORTED, result);
      }
    } catch (e) {
      console.error('Failed to export GLB:', e);
      alert('Failed to export GLB file. See console for details.');
    }
  }

  _performUndo() {
    const state = this.undoRedo.undo();
    if (!state) return;

    switch (state.type) {
      case 'paint': {
        const paintCanvas = state.material._paintCanvas;
        if (paintCanvas && state.textureData) {
          paintCanvas.setImageData(state.textureData, this.engine.renderer);
          state.material.map = paintCanvas.getRenderTarget().texture;
          state.material.needsUpdate = true;
          this.engine.markDirty();
        }
        break;
      }
      case 'decal_create': {
        // Remove the created decal
        if (state.decal && state.decal.mesh) {
          this.decalManager._decals = this.decalManager._decals.filter(
            d => d !== state.decal
          );
          this.decalManager._decalsContainer.remove(state.decal.mesh);
          state.decal.mesh.geometry.dispose();
          state.decal.mesh.material.dispose();
          if (state.decal.sprite) {
            this.decalManager._decalsContainer.remove(state.decal.sprite);
            state.decal.sprite.material.dispose();
          }
          this.decalManager.selectDecal(null);
          this.engine.markDirty();
        }
        break;
      }
      case 'decal_delete': {
        // Recreate the deleted decal
        if (state.decal) {
          this.decalManager._decals.push(state.decal);
          this.decalManager._decalsContainer.add(state.decal.mesh);
          if (state.decal.sprite) {
            this.decalManager._decalsContainer.add(state.decal.sprite);
          }
          this.decalManager.selectDecal(state.decal);
          this.engine.markDirty();
        }
        break;
      }
    }
  }

  _performRedo() {
    const state = this.undoRedo.redo();
    if (!state) return;

    // Redo is essentially the inverse of undo
    switch (state.type) {
      case 'paint': {
        // Same handling as undo for paint (reapply texture)
        const paintCanvas = state.material._paintCanvas;
        if (paintCanvas && state.textureData) {
          paintCanvas.setImageData(state.textureData, this.engine.renderer);
          state.material.map = paintCanvas.getRenderTarget().texture;
          state.material.needsUpdate = true;
          this.engine.markDirty();
        }
        break;
      }
      case 'decal_create': {
        // Recreate decal
        if (state.decal) {
          this.decalManager._decals.push(state.decal);
          this.decalManager._decalsContainer.add(state.decal.mesh);
          if (state.decal.sprite) {
            this.decalManager._decalsContainer.add(state.decal.sprite);
          }
          this.decalManager.selectDecal(state.decal);
          this.engine.markDirty();
        }
        break;
      }
      case 'decal_delete': {
        // Remove decal again
        if (state.decal && state.decal.mesh) {
          this.decalManager._decals = this.decalManager._decals.filter(
            d => d !== state.decal
          );
          this.decalManager._decalsContainer.remove(state.decal.mesh);
          state.decal.mesh.geometry.dispose();
          state.decal.mesh.material.dispose();
          if (state.decal.sprite) {
            this.decalManager._decalsContainer.remove(state.decal.sprite);
            state.decal.sprite.material.dispose();
          }
          this.decalManager.selectDecal(null);
          this.engine.markDirty();
        }
        break;
      }
    }
  }

  _handleInputShortcuts() {
    const canvas = document.getElementById('viewport-canvas');

    // Ctrl+wheel: brush size
    if (this.inputManager.isKeyDown('control')) {
      const wheel = this.inputManager.getWheel();
      if (wheel !== 0) {
        const sizeInput = document.getElementById('tb-size');
        if (sizeInput) {
          let size = parseInt(sizeInput.value) || 50;
          size = Math.max(0, size - Math.sign(wheel) * 5);
          sizeInput.value = size;
          eventBus.emit(EVENTS.BRUSH_SIZE_CHANGED, size);
        }
      }
    }

    // Shift+wheel: opacity
    if (this.inputManager.isKeyDown('shift')) {
      const wheel = this.inputManager.getWheel();
      if (wheel !== 0) {
        const opacityInput = document.getElementById('tb-opacity');
        if (opacityInput) {
          let opacity = parseFloat(opacityInput.value) || 1;
          opacity = Math.max(0, Math.min(1, opacity - Math.sign(wheel) * 0.05));
          opacity = Math.round(opacity * 100) / 100;
          opacityInput.value = opacity.toFixed(2);
          eventBus.emit(EVENTS.BRUSH_OPACITY_CHANGED, opacity);
        }
      }
    }

    // Alt+wheel: rotation
    if (this.inputManager.isKeyDown('alt')) {
      const wheel = this.inputManager.getWheel();
      if (wheel !== 0) {
        const rotInput = document.getElementById('tb-rotation');
        if (rotInput) {
          let rot = parseInt(rotInput.value) || 0;
          rot = (rot - Math.sign(wheel) * 5) % 360;
          rotInput.value = rot;
          eventBus.emit(EVENTS.BRUSH_ROTATION_CHANGED, rot);
        }
      }
    }

    // Ctrl+Z: undo
    if (this.inputManager.isKeyDown('control') && this.inputManager.wasKeyPressed('z')) {
      this._performUndo();
    }

    // Ctrl+Y: redo
    if (this.inputManager.isKeyDown('control') && this.inputManager.wasKeyPressed('y')) {
      this._performRedo();
    }

    // Delete: remove selected decal
    if (this.inputManager.wasKeyPressed('delete') || this.inputManager.wasKeyPressed('backspace')) {
      const target = document.activeElement;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) {
        this.decalManager.deleteSelectedDecal();
      }
    }

    // W/E/R for gizmo modes when decal selected
    if (this.decalManager.getSelectedDecal()) {
      if (this.inputManager.wasKeyPressed('w')) {
        this.decalGizmo.setMode('translate');
        this.engine.markDirty();
      }
      if (this.inputManager.wasKeyPressed('e')) {
        this.decalGizmo.setMode('rotate');
        this.engine.markDirty();
      }
      if (this.inputManager.wasKeyPressed('r')) {
        this.decalGizmo.setMode('scale');
        this.engine.markDirty();
      }
    }
  }

  _startLoop() {
    this._running = true;
    const canvas = document.getElementById('viewport-canvas');
    let frameCount = 0;
    let lastPaintState = false;

    const loop = () => {
      if (!this._running) return;
      frameCount++;

      const delta = this.engine.getDelta();

      // Update camera
      this.cameraSwitcher.update(this.inputManager, canvas, delta);

      // Handle input shortcuts
      this._handleInputShortcuts();

      // Update decal gizmo
      this.decalGizmo.update(this.inputManager, canvas, this.decalManager);

      // Handle painting (left mouse button with brush selected)
      const mouseDown = this.inputManager.isMouseButtonDown(0);
      const hasBrush = !!this.painter.getActiveBrush();
      const shouldPaint = mouseDown && hasBrush;
      
      // Track paint state changes for debug logging if needed
      lastPaintState = shouldPaint;

      if (shouldPaint) {
        if (!this.decalGizmo._isDragging) {
          this.painter.tryPaint(this.inputManager, canvas);
        }
      } else {
        // Reset stamp tracking when mouse is released
        this.painter.resetStampPosition();
      }

      // Handle decal sprite selection
      if (this.inputManager.wasMouseButtonPressed(0)) {
        const ndc = this.inputManager.getNDC(canvas);
        const hitDecal = this.decalManager.raycastDecalSprites(ndc, this.engine.camera);
        if (hitDecal) {
          this.decalManager.selectDecal(hitDecal);
        } else {
          // Click on empty space deselects decal (unless painting)
          if (!this.painter.getActiveBrush()) {
            this.decalManager.selectDecal(null);
          }
        }
      }

      // End frame
      this.inputManager.endFrame();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  destroy() {
    this._running = false;
    if (this.decalGizmo) this.decalGizmo.destroy();
    if (this.decalManager) this.decalManager.destroy();
    if (this.materialManager) this.materialManager.destroy();
    if (this.painter) this.painter.destroy();
    if (this.inputManager) this.inputManager.destroy();
    if (this.sceneManager) this.sceneManager.destroy();
    if (this.undoRedo) this.undoRedo.destroy();
    if (this.engine) this.engine.destroy();
  }
}

// Boot application
const app = new MeshPaintApp();

// Handle page unload
window.addEventListener('beforeunload', () => {
  app.destroy();
});
