import * as THREE from 'three';
import ProceduralAssets from '../utils/ProceduralAssets.js';
import FileIO from '../utils/FileIO.js';
import { EVENTS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

// DecalPanel: bottom panel tab for decal selection & import
class DecalPanel {
  constructor(container) {
    this._container = container;
    this._decals = [];
    this._selectedDecal = null;

    this._render();
    this._loadDefaults();
    this._bindEvents();
  }

  _render() {
    this._container.innerHTML = `
      <div class="decal-grid" id="dp-grid"></div>
      <div style="padding:8px 14px; border-top:1px solid var(--border);">
        <button id="dp-import" class="small">+ Import Decal (PNG)</button>
      </div>
    `;

    this._grid = this._container.querySelector('#dp-grid');
  }

  _loadDefaults() {
    const gradientCanvas = ProceduralAssets.createDecalGradient();
    const imageData = ProceduralAssets.canvasToImageData(gradientCanvas);

    // Create texture
    const texture = new THREE.DataTexture(
      new Uint8Array(imageData.data),
      imageData.width,
      imageData.height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.flipY = true;

    const decalData = {
      name: 'Gradient',
      texture: texture,
      imageData: imageData
    };

    this._decals.push(decalData);
    this._selectedDecal = decalData;

    this._refreshGrid();
  }

  _bindEvents() {
    const importBtn = this._container.querySelector('#dp-import');
    importBtn.addEventListener('click', () => this._importDecal());
  }

  async _importDecal() {
    try {
      const result = await FileIO.openTexture();
      if (!result || !result.buffer) return;

      const blob = new Blob([result.buffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const isValid = this._validateGrayscale(imageData);

        if (!isValid) {
          alert('Decals must be grayscale PNG');
          URL.revokeObjectURL(url);
          return;
        }

        this._ensureAlpha(imageData);

        const texture = new THREE.DataTexture(
          new Uint8Array(imageData.data),
          imageData.width,
          imageData.height,
          THREE.RGBAFormat,
          THREE.UnsignedByteType
        );
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.flipY = true;

        const decalData = {
          name: result.fileName.replace('.png', ''),
          texture: texture,
          imageData: imageData
        };

        this._decals.push(decalData);
        this._refreshGrid();
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        alert('Failed to load PNG');
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      console.error('Failed to import decal:', e);
    }
  }

  _validateGrayscale(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (Math.abs(r - g) > 2 || Math.abs(g - b) > 2) {
        return false;
      }
    }
    return true;
  }

  _ensureAlpha(imageData) {
    const data = imageData.data;
    let hasAlpha = false;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 255) {
        hasAlpha = true;
        break;
      }
    }

    if (!hasAlpha) {
      for (let i = 0; i < data.length; i += 4) {
        data[i + 3] = data[i];
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }
  }

  _refreshGrid() {
    this._grid.innerHTML = '';

    for (const decal of this._decals) {
      const item = document.createElement('div');
      item.className = 'decal-item';
      item.draggable = true;

      const canvas = document.createElement('canvas');
      canvas.width = decal.imageData.width;
      canvas.height = decal.imageData.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(decal.imageData, 0, 0);

      const img = document.createElement('img');
      img.src = canvas.toDataURL();
      item.appendChild(img);

      item.title = `Drag ${decal.name} to viewport`;

      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', decal.name);
        eventBus.emit(EVENTS.DECAL_DRAG_START, decal);
      });

      this._grid.appendChild(item);
    }
  }

  getDecals() {
    return this._decals;
  }
}

export default DecalPanel;
