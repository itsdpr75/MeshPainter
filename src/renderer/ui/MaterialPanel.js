import { EVENTS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

// MaterialPanel: left panel listing materials
class MaterialPanel {
  constructor(container) {
    this._container = container;
    this._materials = [];
    this._selectedMaterial = null;

    this._render();
    this._bindEvents();
  }

  _render() {
    this._container.innerHTML = `
      <div class="panel-header">
        Materials
        <button id="mp-new-material" class="primary small" style="float:right; margin-top:-2px;">+ New</button>
      </div>
      <div id="mp-list"></div>
    `;

    this._listContainer = this._container.querySelector('#mp-list');
  }

  _bindEvents() {
    eventBus.on(EVENTS.MODEL_LOADED, (data) => {
      this._materials = data.materials || [];
      this._selectedMaterial = null;
      this._refreshList();
      // Auto-select first material so user can paint immediately
      if (this._materials.length > 0) {
        this._selectMaterial(this._materials[0]);
      }
    });

    eventBus.on(EVENTS.MATERIAL_CREATED, (material) => {
      this._materials.push(material);
      this._refreshList();
    });

    eventBus.on(EVENTS.MATERIAL_UPDATED, () => {
      this._refreshList();
    });

    const newBtn = this._container.querySelector('#mp-new-material');
    newBtn.addEventListener('click', () => {
      eventBus.emit('ui:showNewMaterialModal');
    });
  }

  _refreshList() {
    this._listContainer.innerHTML = '';

    if (this._materials.length === 0) {
      this._listContainer.innerHTML = `
        <div class="empty-state">
          <div class="icon">📦</div>
          <div class="message">No materials loaded.<br>Open a GLB file to get started.</div>
        </div>
      `;
      return;
    }

    for (const material of this._materials) {
      const item = document.createElement('div');
      item.className = 'list-item';
      if (material === this._selectedMaterial) {
        item.classList.add('selected');
      }

      // Color swatch
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      const hex = '#' + material.color.getHexString();
      swatch.style.background = hex;

      // Info
      const info = document.createElement('div');
      info.className = 'info';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = material.name || 'Material';

      const detail = document.createElement('div');
      detail.className = 'detail';
      const parts = [];
      if (material._painted) parts.push('✓ Painted');
      if (material.map) parts.push('Albedo✓');
      if (material.normalMap) parts.push('Nrm✓');
      if (material.roughnessMap) parts.push('Rgh✓');
      if (material.metalnessMap) parts.push('Mtl✓');
      if (material.aoMap) parts.push('AO✓');
      const res = material._paintCanvas ? material._paintCanvas.getResolution() : '—';
      parts.push(`${res}px`);
      detail.textContent = parts.join(' | ');

      info.appendChild(name);
      info.appendChild(detail);

      item.appendChild(swatch);
      item.appendChild(info);

      // Click to select
      item.addEventListener('click', (e) => {
        if (e.detail === 1) {
          this._selectMaterial(material);
        } else if (e.detail === 2) {
          this._selectMaterial(material);
          eventBus.emit('ui:showEditMaterialModal', material);
        }
      });

      // Resolution control
      const resSelect = document.createElement('select');
      resSelect.style.cssText = 'background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:2px 4px;font-size:11px;';
      [1024, 2048, 4096, 8192].forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        if (r === (material._paintCanvas ? material._paintCanvas.getResolution() : 4096)) {
          opt.selected = true;
        }
        resSelect.appendChild(opt);
      });

      resSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        const res = parseInt(resSelect.value);
        eventBus.emit('material:setResolution', { material, resolution: res });
      });

      const resWrapper = document.createElement('div');
      resWrapper.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:2px;';
      resWrapper.appendChild(resSelect);
      item.appendChild(resWrapper);

      this._listContainer.appendChild(item);
    }
  }

  _selectMaterial(material) {
    this._selectedMaterial = material;
    eventBus.emit(EVENTS.MATERIAL_SELECTED, material);
    this._refreshList();
  }

  getSelectedMaterial() {
    return this._selectedMaterial;
  }
}

export default MaterialPanel;
