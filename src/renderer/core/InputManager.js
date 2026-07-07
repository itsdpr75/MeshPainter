import { eventBus } from '../utils/EventBus.js';
import { EVENTS } from '../utils/Constants.js';

// InputManager: keyboard/mouse state tracking
class InputManager {
  constructor(canvas) {
    this.canvas = canvas;

    // Keyboard state
    this.keys = new Set();
    this.keyJustPressed = new Set();
    this.keyJustReleased = new Set();

    // Mouse state
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.prevMouseX = 0;
    this.prevMouseY = 0;
    this.mouseButtons = new Set();
    this.mouseButtonJustPressed = new Set();
    this.mouseButtonJustReleased = new Set();

    // Wheel
    this.wheelDelta = 0;
    this.wheelDeltaX = 0;

    // Drag
    this.isDragging = false;
    this.rightDrag = false;
    this.middleDrag = false;

    this._boundHandlers = {};
    this._init();
  }

  _init() {
    this._boundHandlers.onKeyDown = this._onKeyDown.bind(this);
    this._boundHandlers.onKeyUp = this._onKeyUp.bind(this);
    this._boundHandlers.onMouseDown = this._onMouseDown.bind(this);
    this._boundHandlers.onMouseUp = this._onMouseUp.bind(this);
    this._boundHandlers.onMouseMove = this._onMouseMove.bind(this);
    this._boundHandlers.onWheel = this._onWheel.bind(this);
    this._boundHandlers.onContextMenu = (e) => e.preventDefault();
    this._boundHandlers.onBlur = this._onBlur.bind(this);

    window.addEventListener('keydown', this._boundHandlers.onKeyDown);
    window.addEventListener('keyup', this._boundHandlers.onKeyUp);
    this.canvas.addEventListener('mousedown', this._boundHandlers.onMouseDown);
    window.addEventListener('mouseup', this._boundHandlers.onMouseUp);
    window.addEventListener('mousemove', this._boundHandlers.onMouseMove);
    this.canvas.addEventListener('wheel', this._boundHandlers.onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this._boundHandlers.onContextMenu);
    window.addEventListener('blur', this._boundHandlers.onBlur);
  }

  _onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();
    if (!this.keys.has(key)) {
      this.keyJustPressed.add(key);
    }
    this.keys.add(key);
  }

  _onKeyUp(e) {
    const key = e.key.toLowerCase();
    this.keys.delete(key);
    this.keyJustReleased.add(key);
  }

  _onMouseDown(e) {
    this.mouseButtons.add(e.button);
    this.mouseButtonJustPressed.add(e.button);

    if (e.button === 2) {
      this.rightDrag = true;
    }
    if (e.button === 1) {
      this.middleDrag = true;
    }
    if (e.button === 0) {
      this.isDragging = true;
    }
  }

  _onMouseUp(e) {
    this.mouseButtons.delete(e.button);
    this.mouseButtonJustReleased.add(e.button);

    if (e.button === 2) this.rightDrag = false;
    if (e.button === 1) this.middleDrag = false;
    if (e.button === 0) this.isDragging = false;
  }

  _onMouseMove(e) {
    this.prevMouseX = this.mouseX;
    this.prevMouseY = this.mouseY;
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.mouseDX = this.mouseX - this.prevMouseX;
    this.mouseDY = this.mouseY - this.prevMouseY;
  }

  _onWheel(e) {
    e.preventDefault();
    this.wheelDelta = e.deltaY;
    this.wheelDeltaX = e.deltaX;
  }

  _onBlur() {
    this.keys.clear();
    this.mouseButtons.clear();
    this.isDragging = false;
    this.rightDrag = false;
    this.middleDrag = false;
  }

  // Call once per frame after processing input
  endFrame() {
    this.keyJustPressed.clear();
    this.keyJustReleased.clear();
    this.mouseButtonJustPressed.clear();
    this.mouseButtonJustReleased.clear();
    this.wheelDelta = 0;
    this.wheelDeltaX = 0;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  isKeyDown(key) {
    return this.keys.has(key.toLowerCase());
  }

  wasKeyPressed(key) {
    return this.keyJustPressed.has(key.toLowerCase());
  }

  wasKeyReleased(key) {
    return this.keyJustReleased.has(key.toLowerCase());
  }

  isMouseButtonDown(button) {
    return this.mouseButtons.has(button);
  }

  wasMouseButtonPressed(button) {
    return this.mouseButtonJustPressed.has(button);
  }

  wasMouseButtonReleased(button) {
    return this.mouseButtonJustReleased.has(button);
  }

  getWheel() {
    return this.wheelDelta;
  }

  getWheelX() {
    return this.wheelDeltaX;
  }

  getMouseDelta() {
    return { x: this.mouseDX, y: this.mouseDY };
  }

  getMousePosition() {
    return { x: this.mouseX, y: this.mouseY };
  }

  getNDC(canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((this.mouseX - rect.left) / rect.width) * 2 - 1,
      y: -((this.mouseY - rect.top) / rect.height) * 2 + 1
    };
  }

  isMouseOverCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    return (
      this.mouseX >= rect.left &&
      this.mouseX <= rect.right &&
      this.mouseY >= rect.top &&
      this.mouseY <= rect.bottom
    );
  }

  destroy() {
    window.removeEventListener('keydown', this._boundHandlers.onKeyDown);
    window.removeEventListener('keyup', this._boundHandlers.onKeyUp);
    this.canvas.removeEventListener('mousedown', this._boundHandlers.onMouseDown);
    window.removeEventListener('mouseup', this._boundHandlers.onMouseUp);
    window.removeEventListener('mousemove', this._boundHandlers.onMouseMove);
    this.canvas.removeEventListener('wheel', this._boundHandlers.onWheel);
    this.canvas.removeEventListener('contextmenu', this._boundHandlers.onContextMenu);
    window.removeEventListener('blur', this._boundHandlers.onBlur);
  }
}

export default InputManager;
