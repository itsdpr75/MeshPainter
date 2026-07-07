import Brush from '../painting/Brush.js';
import ProceduralAssets from '../utils/ProceduralAssets.js';
import FileIO from '../utils/FileIO.js';
import { EVENTS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

// BrushPanel: bottom panel tab for brush selection & import
class BrushPanel {
  constructor(container) {
    this._container = container;
    this._brushes = [];
    this._selectedBrush = null;

    this._render();
    this._loadDefaults();
    this._bindEvents();
  }

  _render() {
    this._container.innerHTML = `
      <div class="brush-grid" id="bp-grid"></div>
      <div style="padding:8px 14px; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:8px;">
        <div class="field-row" style="justify-content:space-between; align-items:center;">
          <label style="font-size:12px; color:var(--text-muted);">Paint with Material Texture</label>
          <input type="checkbox" id="bp-texture-mode" checked style="cursor:pointer;">
        </div>
        <div class="field-row" style="justify-content:space-between;">
          <label style="font-size:12px; color:var(--text-muted);">Brush Color</label>
          <input type="color" id="bp-color" value="#000000" style="width:40px; height:24px; border:none; cursor:pointer; background:none;">
        </div>
        <button id="bp-import" class="small">+ Import Brush (PNG)</button>
      </div>
    `;

    this._grid = this._container.querySelector('#bp-grid');
  }

  _loadDefaults() {
    const softCircleCanvas = ProceduralAssets.createBrushSoftCircle();
    const glowCanvas = ProceduralAssets.createBrushGlow();

    const softCircleImageData = ProceduralAssets.canvasToImageData(softCircleCanvas);
    const glowImageData = ProceduralAssets.canvasToImageData(glowCanvas);

    const softCircle = new Brush('Soft Circle', softCircleImageData);
    const glow = new Brush('Glow', glowImageData);

    this._brushes.push(softCircle, glow);
    this._selectedBrush = softCircle;
    eventBus.emit(EVENTS.BRUSH_SELECTED, softCircle);

    this._refreshGrid();
  }

  _bindEvents() {
    const importBtn = this._container.querySelector('#bp-import');
    importBtn.addEventListener('click', () => this._importBrush());

    const textureModeInput = this._container.querySelector('#bp-texture-mode');
    const colorInput = this._container.querySelector('#bp-color');
    const colorLabel = colorInput.previousElementSibling;

    const updateColorPickerVisibility = () => {
      const enabled = textureModeInput.checked;
      colorInput.style.opacity = enabled ? '0.3' : '1';
      colorInput.style.pointerEvents = enabled ? 'none' : 'auto';
      if (colorLabel) colorLabel.style.opacity = enabled ? '0.3' : '1';
    };

    textureModeInput.addEventListener('change', (e) => {
      eventBus.emit(EVENTS.BRUSH_TEXTURE_MODE_CHANGED, e.target.checked);
      updateColorPickerVisibility();
    });
    updateColorPickerVisibility();

    colorInput.addEventListener('input', (e) => {
      eventBus.emit(EVENTS.BRUSH_COLOR_CHANGED, e.target.value);
    });
  }

  async _importBrush() {
    try {
      const result = await FileIO.openTexture();
      if (!result || !result.buffer) return;

      const blob = new Blob([result.buffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;

      img.onload = () => {
        // Validate: must be grayscale
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const isValid = this._validateGrayscale(imageData);

        if (!isValid) {
          alert('Brushes must be grayscale PNG');
          URL.revokeObjectURL(url);
          return;
        }

        // Apply grayscale-to-alpha conversion if needed
        this._ensureAlpha(imageData);

        const brush = new Brush(result.fileName.replace('.png', ''), imageData);
        this._brushes.push(brush);
        this._refreshGrid();
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        alert('Failed to load PNG');
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      console.error('Failed to import brush:', e);
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

    // Check if any pixel has non-255 alpha
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 255) {
        hasAlpha = true;
        break;
      }
    }

    if (!hasAlpha) {
      // Derive alpha from luminance (R channel since grayscale)
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

    for (const brush of this._brushes) {
      const item = document.createElement('div');
      item.className = 'brush-item';

      if (brush === this._selectedBrush) {
        item.classList.add('selected');
      }

      // Generate thumbnail
      const imageData = brush.getImageData();
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);

      const img = document.createElement('img');
      img.src = canvas.toDataURL();

      item.appendChild(img);

      // Tooltip
      item.title = brush.getName();

      item.addEventListener('click', () => {
        this._selectBrush(brush);
      });

      this._grid.appendChild(item);
    }
  }

  _selectBrush(brush) {
    this._selectedBrush = brush;
    eventBus.emit(EVENTS.BRUSH_SELECTED, brush);
    this._refreshGrid();
  }

  getBrushes() {
    return this._brushes;
  }

  getSelectedBrush() {
    return this._selectedBrush;
  }
}

export default BrushPanel;
