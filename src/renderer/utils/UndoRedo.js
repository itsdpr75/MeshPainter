import { MAX_UNDO_STATES } from './Constants.js';
import { eventBus } from './EventBus.js';
import { EVENTS } from './Constants.js';

// Undo/Redo manager with per-material paint state tracking
class UndoRedo {
  constructor() {
    this._undoStack = [];
    this._redoStack = [];
    this._snapshotWorker = null;
    this._initWorker();
  }

  _initWorker() {
    try {
      this._snapshotWorker = new Worker(
        new URL('../workers/undo-snapshot.worker.js', import.meta.url),
        { type: 'module' }
      );
    } catch (e) {
      console.warn('Undo snapshot worker could not be initialized:', e);
      this._snapshotWorker = null;
    }
  }

  async pushState(state) {
    // For texture data snapshots, use worker if available
    if (state.textureData && this._snapshotWorker) {
      try {
        state.textureData = await this._cloneTextureData(state.textureData);
      } catch (e) {
        console.warn('Worker clone failed, using direct clone:', e);
        state.textureData = this._cloneImageDataSync(state.textureData);
      }
    }

    this._undoStack.push(state);
    this._redoStack = [];

    while (this._undoStack.length > MAX_UNDO_STATES) {
      this._undoStack.shift();
    }

    eventBus.emit(EVENTS.UNDO_STATE_CREATED, state);
  }

  async _cloneTextureData(imageData) {
    return new Promise((resolve, reject) => {
      this._snapshotWorker.onmessage = (e) => {
        resolve(e.data);
      };
      this._snapshotWorker.onerror = (e) => {
        reject(e);
      };
      this._snapshotWorker.postMessage({ imageData }, [imageData.data.buffer]);
    });
  }

  _cloneImageDataSync(imageData) {
    const clone = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
    return clone;
  }

  undo() {
    if (this._undoStack.length === 0) return null;

    const currentState = this._undoStack.pop();
    this._redoStack.push(currentState);
    return currentState;
  }

  redo() {
    if (this._redoStack.length === 0) return null;

    const state = this._redoStack.pop();
    this._undoStack.push(state);
    return state;
  }

  canUndo() {
    return this._undoStack.length > 0;
  }

  canRedo() {
    return this._redoStack.length > 0;
  }

  clear() {
    this._undoStack = [];
    this._redoStack = [];
  }

  getStackSizes() {
    return {
      undo: this._undoStack.length,
      redo: this._redoStack.length
    };
  }

  destroy() {
    if (this._snapshotWorker) {
      this._snapshotWorker.terminate();
      this._snapshotWorker = null;
    }
    this.clear();
  }
}

export default UndoRedo;
