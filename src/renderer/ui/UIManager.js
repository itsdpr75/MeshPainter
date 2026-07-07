import BrushPanel from './BrushPanel.js';
import DecalPanel from './DecalPanel.js';
import MaterialPanel from './MaterialPanel.js';
import TopBar from './TopBar.js';

// UIManager: orchestrates all UI panels
class UIManager {
  constructor() {
    this.topBar = null;
    this.materialPanel = null;
    this.brushPanel = null;
    this.decalPanel = null;

    this._init();
  }

  _init() {
    // Top bar
    const topBarContainer = document.getElementById('top-bar');
    if (topBarContainer) {
      this.topBar = new TopBar(topBarContainer);
    }

    // Left panel - materials
    const leftPanel = document.getElementById('left-panel');
    if (leftPanel) {
      this.materialPanel = new MaterialPanel(leftPanel);
    }

    // Bottom panel with tabs
    const bottomPanel = document.getElementById('bottom-panel');
    if (bottomPanel) {
      this._setupBottomPanel(bottomPanel);
    }
  }

  _setupBottomPanel(container) {
    // Tabs header
    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'tabs';

    const brushTab = document.createElement('div');
    brushTab.className = 'tab active';
    brushTab.textContent = 'Brushes';
    brushTab.dataset.tab = 'brushes';

    const decalTab = document.createElement('div');
    decalTab.className = 'tab';
    decalTab.textContent = 'Decals';
    decalTab.dataset.tab = 'decals';

    tabsDiv.appendChild(brushTab);
    tabsDiv.appendChild(decalTab);
    container.appendChild(tabsDiv);

    // Tab content
    const brushContent = document.createElement('div');
    brushContent.className = 'tab-content';
    brushContent.id = 'tab-brushes';

    const decalContent = document.createElement('div');
    decalContent.className = 'tab-content hidden';
    decalContent.id = 'tab-decals';

    container.appendChild(brushContent);
    container.appendChild(decalContent);

    // Create panels
    this.brushPanel = new BrushPanel(brushContent);
    this.decalPanel = new DecalPanel(decalContent);

    // Tab switching
    brushTab.addEventListener('click', () => {
      brushTab.classList.add('active');
      decalTab.classList.remove('active');
      brushContent.classList.remove('hidden');
      decalContent.classList.add('hidden');
    });

    decalTab.addEventListener('click', () => {
      decalTab.classList.add('active');
      brushTab.classList.remove('active');
      brushContent.classList.add('hidden');
      decalContent.classList.remove('hidden');
    });
  }
}

export default UIManager;
