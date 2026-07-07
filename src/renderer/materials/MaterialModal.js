import * as THREE from 'three';
import FileIO from '../utils/FileIO.js';

// MaterialModal: modal dialog for creating and editing materials with full PBR channels
class MaterialModal {
  constructor(materialManager, uiContainer) {
    this._materialManager = materialManager;
    this._overlay = document.getElementById('modal-overlay');
    this._modal = null;
    this._onSave = null;
    this._tempTextures = {}; // Stores loaded textures during editing: {channel: {texture, fileName}}
    this._existingMaterial = null;
  }

  showForNew(onSave) {
    this._onSave = onSave;
    this._tempTextures = {};
    this._existingMaterial = null;
    this._render('New Material');
    this._overlay.classList.remove('hidden');
  }

  showForEdit(material, onSave) {
    this._onSave = onSave;
    this._existingMaterial = material;
    // Capture existing textures from material
    this._tempTextures = {};
    this._captureExistingTextures(material);
    this._render(`Edit Material: ${material.name}`);
    this._populateFields(material);
    this._overlay.classList.remove('hidden');
  }

  _captureExistingTextures(material) {
    const textureMap = {
      albedoTexture: 'map',
      normalTexture: 'normalMap',
      displacementTexture: 'displacementMap',
      aoTexture: 'aoMap',
      specularTexture: 'specularColorMap',
      roughnessTexture: 'roughnessMap',
      metalnessTexture: 'metalnessMap'
    };

    for (const [key, prop] of Object.entries(textureMap)) {
      if (material[prop]) {
        this._tempTextures[key] = {
          texture: material[prop],
          fileName: material[prop]._fileName || material[prop].name || '(loaded)'
        };
      }
    }
  }

  hide() {
    // Dispose temp textures to avoid memory leaks
    for (const key of Object.keys(this._tempTextures)) {
      const entry = this._tempTextures[key];
      if (entry && entry.texture && entry.texture.isTexture) {
        // Only dispose textures we created (not existing material textures)
        if (!this._existingMaterial || 
            entry.texture !== this._existingMaterial.map &&
            entry.texture !== this._existingMaterial.normalMap &&
            entry.texture !== this._existingMaterial.displacementMap &&
            entry.texture !== this._existingMaterial.aoMap &&
            entry.texture !== this._existingMaterial.specularColorMap &&
            entry.texture !== this._existingMaterial.roughnessMap &&
            entry.texture !== this._existingMaterial.metalnessMap) {
          entry.texture.dispose();
        }
      }
    }
    this._tempTextures = {};
    this._existingMaterial = null;

    this._overlay.classList.add('hidden');
    if (this._modal) {
      this._modal.remove();
      this._modal = null;
    }
  }

  _render(title) {
    if (this._modal) this._modal.remove();

    this._modal = document.createElement('div');
    this._modal.className = 'modal';
    this._modal.style.maxHeight = '80vh';
    this._modal.style.overflowY = 'auto';

    this._modal.innerHTML = `
      <h2>${title}</h2>

      <div class="panel-section">
        <div class="field-row">
          <label>Name</label>
          <input type="text" id="mat-name" value="New Material" />
        </div>
      </div>

      <!-- Albedo: Color + Texture -->
      <div class="panel-section">
        <h3 style="font-size:13px; margin-bottom:8px; color:#a0a0b0;">Albedo (Base Color)</h3>
        <div class="field-row">
          <label>Color</label>
          <input type="text" id="mat-albedo-hex" value="#ffffff" style="width:80px;" />
          <div id="mat-albedo-swatch" class="color-swatch" style="background:#ffffff;"></div>
        </div>
        <div class="field-row" style="margin-top:6px;">
          <label>Texture</label>
          <span id="mat-albedo-filename" style="font-size:11px; color:var(--text-muted); flex:1;">No texture</span>
          <button id="mat-albedo-load" class="small">Load PNG</button>
          <button id="mat-albedo-clear" class="small" style="display:none;">Clear</button>
        </div>
      </div>

      <!-- Normal Map -->
      <div class="panel-section">
        <h3 style="font-size:13px; margin-bottom:8px; color:#a0a0b0;">Normal Map</h3>
        <div class="field-row">
          <label>Texture</label>
          <span id="mat-normal-filename" style="font-size:11px; color:var(--text-muted); flex:1;">No texture</span>
          <button id="mat-normal-load" class="small">Load PNG</button>
          <button id="mat-normal-clear" class="small" style="display:none;">Clear</button>
        </div>
      </div>

      <!-- Displacement Map (preview only) -->
      <div class="panel-section">
        <h3 style="font-size:13px; margin-bottom:8px; color:#a0a0b0;">Displacement Map
          <span style="font-size:10px; color:var(--warning);">(preview only, not exported)</span>
        </h3>
        <div class="field-row">
          <label>Texture</label>
          <span id="mat-displacement-filename" style="font-size:11px; color:var(--text-muted); flex:1;">No texture</span>
          <button id="mat-displacement-load" class="small">Load PNG</button>
          <button id="mat-displacement-clear" class="small" style="display:none;">Clear</button>
        </div>
      </div>

      <!-- Ambient Occlusion -->
      <div class="panel-section">
        <h3 style="font-size:13px; margin-bottom:8px; color:#a0a0b0;">Ambient Occlusion</h3>
        <div class="field-row">
          <label>Texture</label>
          <span id="mat-ao-filename" style="font-size:11px; color:var(--text-muted); flex:1;">No texture</span>
          <button id="mat-ao-load" class="small">Load PNG</button>
          <button id="mat-ao-clear" class="small" style="display:none;">Clear</button>
        </div>
      </div>

      <!-- Specular: Texture + Numeric -->
      <div class="panel-section">
        <h3 style="font-size:13px; margin-bottom:8px; color:#a0a0b0;">Specular</h3>
        <div class="field-row">
          <label>Value</label>
          <input type="range" id="mat-specular" min="0" max="1" step="0.01" value="1" />
          <input type="number" id="mat-specular-val" value="1.00" min="0" max="1" step="0.01" style="width:65px;" />
        </div>
        <div class="field-row" style="margin-top:6px;">
          <label>Texture</label>
          <span id="mat-specular-filename" style="font-size:11px; color:var(--text-muted); flex:1;">No texture</span>
          <button id="mat-specular-load" class="small">Load PNG</button>
          <button id="mat-specular-clear" class="small" style="display:none;">Clear</button>
        </div>
      </div>

      <!-- Roughness: Texture + Numeric -->
      <div class="panel-section">
        <h3 style="font-size:13px; margin-bottom:8px; color:#a0a0b0;">Roughness</h3>
        <div class="field-row">
          <label>Value</label>
          <input type="range" id="mat-roughness" min="0" max="1" step="0.01" value="1" />
          <input type="number" id="mat-roughness-val" value="1.00" min="0" max="1" step="0.01" style="width:65px;" />
        </div>
        <div class="field-row" style="margin-top:6px;">
          <label>Texture</label>
          <span id="mat-roughness-filename" style="font-size:11px; color:var(--text-muted); flex:1;">No texture</span>
          <button id="mat-roughness-load" class="small">Load PNG</button>
          <button id="mat-roughness-clear" class="small" style="display:none;">Clear</button>
        </div>
      </div>

      <!-- Metalness: Texture + Numeric -->
      <div class="panel-section">
        <h3 style="font-size:13px; margin-bottom:8px; color:#a0a0b0;">Metalness</h3>
        <div class="field-row">
          <label>Value</label>
          <input type="range" id="mat-metalness" min="0" max="1" step="0.01" value="0" />
          <input type="number" id="mat-metalness-val" value="0.00" min="0" max="1" step="0.01" style="width:65px;" />
        </div>
        <div class="field-row" style="margin-top:6px;">
          <label>Texture</label>
          <span id="mat-metalness-filename" style="font-size:11px; color:var(--text-muted); flex:1;">No texture</span>
          <button id="mat-metalness-load" class="small">Load PNG</button>
          <button id="mat-metalness-clear" class="small" style="display:none;">Clear</button>
        </div>
      </div>

      <div class="actions">
        <button id="mat-modal-cancel">Cancel</button>
        <button id="mat-modal-save" class="primary">Save Material</button>
      </div>
    `;

    this._overlay.appendChild(this._modal);
    this._bindEventListeners();
    this._updateTextureUI();
  }

  _bindEventListeners() {
    // Cancel
    this._modal.querySelector('#mat-modal-cancel').addEventListener('click', () => this.hide());

    // Save
    this._modal.querySelector('#mat-modal-save').addEventListener('click', () => {
      const data = this._collectData();
      if (this._onSave) this._onSave(data);
      this.hide();
    });

    // Overlay click close
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.hide();
    }, { once: true });

    // Numeric syncing
    this._syncRange('mat-roughness', 'mat-roughness-val');
    this._syncRange('mat-metalness', 'mat-metalness-val');
    this._syncRange('mat-specular', 'mat-specular-val');

    // Color swatch
    this._modal.querySelector('#mat-albedo-swatch').addEventListener('click', () => {
      const hexInput = this._modal.querySelector('#mat-albedo-hex');
      const newColor = prompt('Enter hex color:', hexInput.value);
      if (newColor && /^#[0-9a-fA-F]{6}$/.test(newColor)) {
        hexInput.value = newColor;
        this._modal.querySelector('#mat-albedo-swatch').style.background = newColor;
      }
    });

    // Hex input updates swatch
    this._modal.querySelector('#mat-albedo-hex').addEventListener('input', (e) => {
      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
        this._modal.querySelector('#mat-albedo-swatch').style.background = e.target.value;
      }
    });

    // Texture load buttons
    const channels = [
      { id: 'albedo', key: 'albedoTexture' },
      { id: 'normal', key: 'normalTexture' },
      { id: 'displacement', key: 'displacementTexture' },
      { id: 'ao', key: 'aoTexture' },
      { id: 'specular', key: 'specularTexture' },
      { id: 'roughness', key: 'roughnessTexture' },
      { id: 'metalness', key: 'metalnessTexture' }
    ];

    for (const channel of channels) {
      const loadBtn = this._modal.querySelector(`#mat-${channel.id}-load`);
      const clearBtn = this._modal.querySelector(`#mat-${channel.id}-clear`);

      loadBtn.addEventListener('click', () => this._loadTexture(channel));
      clearBtn.addEventListener('click', () => this._clearTexture(channel));
    }
  }

  _syncRange(rangeId, valId) {
    const range = this._modal.querySelector(`#${rangeId}`);
    const val = this._modal.querySelector(`#${valId}`);
    range.addEventListener('input', () => { val.value = parseFloat(range.value).toFixed(2); });
    val.addEventListener('input', () => {
      const parsed = parseFloat(val.value);
      range.value = isNaN(parsed) ? 0 : parsed;
    });
  }

  async _loadTexture(channel) {
    try {
      const result = await FileIO.openTexture();
      if (!result || !result.buffer) return;

      const blob = new Blob([result.buffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;

      img.onload = () => {
        // Validate: material textures accept ANY format (no grayscale check)
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Create Three.js texture
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
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = true;
        texture._fileName = result.fileName;

        // Set color space based on channel
        if (channel.id === 'normal') {
          texture.colorSpace = THREE.LinearSRGBColorSpace;
        } else if (channel.id === 'albedo') {
          texture.colorSpace = THREE.SRGBColorSpace;
        }

        this._tempTextures[channel.key] = { texture, fileName: result.fileName };
        this._updateTextureUI();
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        alert('Failed to load PNG');
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      console.error('Failed to load texture:', e);
    }
  }

  _clearTexture(channel) {
    delete this._tempTextures[channel.key];
    this._updateTextureUI();
  }

  _updateTextureUI() {
    const channels = [
      { id: 'albedo', key: 'albedoTexture' },
      { id: 'normal', key: 'normalTexture' },
      { id: 'displacement', key: 'displacementTexture' },
      { id: 'ao', key: 'aoTexture' },
      { id: 'specular', key: 'specularTexture' },
      { id: 'roughness', key: 'roughnessTexture' },
      { id: 'metalness', key: 'metalnessTexture' }
    ];

    for (const channel of channels) {
      const filenameEl = this._modal.querySelector(`#mat-${channel.id}-filename`);
      const clearBtn = this._modal.querySelector(`#mat-${channel.id}-clear`);
      const loaded = this._tempTextures[channel.key];

      if (loaded) {
        filenameEl.textContent = loaded.fileName;
        filenameEl.style.color = 'var(--success)';
        clearBtn.style.display = '';
      } else {
        filenameEl.textContent = 'No texture';
        filenameEl.style.color = 'var(--text-muted)';
        clearBtn.style.display = 'none';
      }
    }
  }

  _populateFields(material) {
    // Name
    this._modal.querySelector('#mat-name').value = material.name || 'Material';

    // Albedo color
    const hexInput = this._modal.querySelector('#mat-albedo-hex');
    const swatch = this._modal.querySelector('#mat-albedo-swatch');
    const hex = '#' + material.color.getHexString();
    hexInput.value = hex;
    swatch.style.background = hex;

    // Roughness
    this._modal.querySelector('#mat-roughness').value = material.roughness;
    this._modal.querySelector('#mat-roughness-val').value = material.roughness.toFixed(2);

    // Metalness
    this._modal.querySelector('#mat-metalness').value = material.metalness;
    this._modal.querySelector('#mat-metalness-val').value = material.metalness.toFixed(2);

    // Specular
    this._modal.querySelector('#mat-specular').value = material.specularIntensity ?? 1.0;
    this._modal.querySelector('#mat-specular-val').value = (material.specularIntensity ?? 1.0).toFixed(2);

    this._updateTextureUI();
  }

  _collectData() {
    return {
      name: this._modal.querySelector('#mat-name').value || 'New Material',
      albedo: this._modal.querySelector('#mat-albedo-hex').value || '#ffffff',
      roughness: parseFloat(this._modal.querySelector('#mat-roughness-val').value) || 1.0,
      metalness: parseFloat(this._modal.querySelector('#mat-metalness-val').value) || 0.0,
      specularIntensity: parseFloat(this._modal.querySelector('#mat-specular-val').value) || 1.0,
      // Texture references (or null if cleared)
      albedoTexture: this._tempTextures.albedoTexture || null,
      normalTexture: this._tempTextures.normalTexture || null,
      displacementTexture: this._tempTextures.displacementTexture || null,
      aoTexture: this._tempTextures.aoTexture || null,
      specularTexture: this._tempTextures.specularTexture || null,
      roughnessTexture: this._tempTextures.roughnessTexture || null,
      metalnessTexture: this._tempTextures.metalnessTexture || null
    };
  }
}

export default MaterialModal;
