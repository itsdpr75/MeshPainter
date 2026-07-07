import { EVENTS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

// TopBar: toolbar with brush size, opacity, rotation controls
class TopBar {
  constructor(container) {
    this._container = container;

    this._size = 50;
    this._opacity = 1.0;
    this._rotation = 0;

    this._render();
    this._bindEvents();
  }

  _render() {
    this._container.innerHTML = `
      <div class="toolbar-group">
        <span class="toolbar-label">Size</span>
        <input type="text" id="tb-size" class="toolbar-value" value="50" />
      </div>
      <div class="toolbar-group">
        <span class="toolbar-label">Opacity</span>
        <input type="text" id="tb-opacity" class="toolbar-value" value="1.00" />
      </div>
      <div class="toolbar-group">
        <span class="toolbar-label">Rotation</span>
        <input type="text" id="tb-rotation" class="toolbar-value" value="0" />
      </div>
      <div class="toolbar-group">
        <button id="tb-decal-eye" class="icon-btn" title="Toggle decal visibility">👁</button>
      </div>
      <div class="toolbar-group" style="margin-left:auto; border-right:none;">
        <button id="tb-open" class="primary">Open GLB</button>
        <button id="tb-export">Export</button>
        <button id="tb-undo" class="icon-btn" title="Undo (Ctrl+Z)">↩</button>
        <button id="tb-redo" class="icon-btn" title="Redo (Ctrl+Y)">↪</button>
      </div>
    `;
  }

  _bindEvents() {
    const sizeInput = this._container.querySelector('#tb-size');
    sizeInput.addEventListener('change', () => {
      this._size = Math.max(0, parseInt(sizeInput.value) || 50);
      sizeInput.value = this._size;
      eventBus.emit(EVENTS.BRUSH_SIZE_CHANGED, this._size);
    });

    const opacityInput = this._container.querySelector('#tb-opacity');
    opacityInput.addEventListener('change', () => {
      this._opacity = Math.max(0, Math.min(1, parseFloat(opacityInput.value) || 1));
      opacityInput.value = this._opacity.toFixed(2);
      eventBus.emit(EVENTS.BRUSH_OPACITY_CHANGED, this._opacity);
    });

    const rotationInput = this._container.querySelector('#tb-rotation');
    rotationInput.addEventListener('change', () => {
      this._rotation = parseInt(rotationInput.value) || 0;
      rotationInput.value = this._rotation;
      eventBus.emit(EVENTS.BRUSH_ROTATION_CHANGED, this._rotation);
    });

    const eyeBtn = this._container.querySelector('#tb-decal-eye');
    eyeBtn.addEventListener('click', () => {
      eventBus.emit(EVENTS.DECAL_EYE_TOGGLED);
    });

    const openBtn = this._container.querySelector('#tb-open');
    openBtn.addEventListener('click', () => {
      eventBus.emit('app:openGLB');
    });

    const exportBtn = this._container.querySelector('#tb-export');
    exportBtn.addEventListener('click', () => {
      eventBus.emit('app:exportGLB');
    });

    const undoBtn = this._container.querySelector('#tb-undo');
    undoBtn.addEventListener('click', () => {
      eventBus.emit('app:undo');
    });

    const redoBtn = this._container.querySelector('#tb-redo');
    redoBtn.addEventListener('click', () => {
      eventBus.emit('app:redo');
    });

    // Keyboard shortcuts
    eventBus.on('input:updateBrushSize', (size) => {
      this._size = Math.max(0, size);
      sizeInput.value = this._size;
    });

    eventBus.on('input:updateBrushOpacity', (opacity) => {
      this._opacity = Math.max(0, Math.min(1, Math.round(opacity * 100) / 100));
      opacityInput.value = this._opacity.toFixed(2);
    });

    eventBus.on('input:updateBrushRotation', (rotation) => {
      this._rotation = rotation % 360;
      rotationInput.value = this._rotation;
    });
  }

  getSize() { return this._size; }
  getOpacity() { return this._opacity; }
  getRotation() { return this._rotation; }
}

export default TopBar;
