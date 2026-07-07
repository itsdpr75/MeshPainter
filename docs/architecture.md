# MeshPaint - Arquitectura General

## Resumen

MeshPaint es una aplicación Electron para pintura de texturas en mallas 3D. Usa Three.js, vanilla JavaScript, electron-vite y pnpm. Permite cargar modelos GLB, pintar sobre sus materiales con pinceles, colocar decals, y exportar el resultado.

## Stack Tecnológico

| Componente | Tecnología |
|-----------|-----------|
| Framework | Electron + electron-vite |
| 3D Engine | Three.js (WebGL2) |
| Lenguaje | Vanilla JavaScript (ES Modules) |
| Package Manager | pnpm |
| Build | electron-vite (main, preload, renderer) |
| Workers | ES Module Workers |

## Estructura de Carpetas

```
src/
├── main/main.js              # Electron main process
├── preload/preload.js        # contextBridge API
└── renderer/
    ├── index.html            # Entry HTML
    ├── index.js              # App entry, main loop
    ├── styles.css            # Dark theme CSS
    ├── core/
    │   ├── Engine.js         # WebGLRenderer, scene, render loop
    │   ├── SceneManager.js   # GLB import/export
    │   ├── InputManager.js   # Keyboard/mouse state
    │   └── UVAnalyzer.js     # UV coordinate analysis
    ├── camera/
    │   ├── CameraSwitcher.js # Tab toggles Orbit/Free
    │   ├── OrbitCamera.js    # Right-click drag orbit
    │   └── FreeCamera.js     # WASD free movement
    ├── painting/
    │   ├── Painter.js        # Core painting logic
    │   ├── PaintCanvas.js    # Per-material render target
    │   ├── PaintShader.js    # Brush stamp GLSL shader
    │   └── Brush.js          # Brush data (texture, size, opacity)
    ├── materials/
    │   ├── MaterialManager.js # Material registry, canvas creation
    │   ├── PBRMaterial.js    # MeshPhysicalMaterial factory
    │   └── MaterialModal.js  # New/Edit material modal
    ├── decals/
    │   ├── DecalManager.js   # Decal lifecycle
    │   ├── DecalGizmo.js     # W/E/R transform gizmo
    │   ├── DecalProjector.js # Drag & drop placement
    │   └── DecalSprite.js    # 2D sprite indicators
    ├── ui/
    │   ├── UIManager.js      # UI orchestration
    │   ├── BrushPanel.js     # Brush selection panel
    │   ├── DecalPanel.js     # Decal selection panel
    │   ├── MaterialPanel.js  # Material list panel
    │   └── TopBar.js         # Size/opacity/rotation controls
    ├── workers/
    │   ├── brush-processor.worker.js
    │   ├── undo-snapshot.worker.js
    │   └── decal-math.worker.js
    └── utils/
        ├── Constants.js      # Events, defaults, enums
        ├── EventBus.js       # Pub/sub event system
        ├── FileIO.js         # IPC wrapper for file dialogs
        ├── UndoRedo.js       # 100-state undo stack
        └── ProceduralAssets.js # Default brushes/decals
```

## Flujo de Datos Principal

```
[Usuario] → InputManager → Index._startLoop
                              ├→ CameraSwitcher.update()
                              ├→ tryPaint() → stamp() → PaintCanvas RT
                              ├→ DecalGizmo.update()
                              └→ Engine.markDirty()

[Engine._startLoop] → if _dirty → renderer.render(scene, camera) → _dirty=false
```

## Sistema de Eventos

La aplicación usa un EventBus central (pub/sub) para comunicación entre módulos. Los eventos principales:

| Evento | Emisor | Consumidores |
|--------|--------|-------------|
| `model:loaded` | SceneManager | MaterialManager, CameraSwitcher |
| `material:selected` | MaterialPanel | Painter |
| `brush:selected` | BrushPanel | Painter |
| `paint:strokeApplied` | Painter | UndoRedo |
| `decal:created/deleted` | DecalManager | UndoRedo |
| `scene:dirty` | Painter, DecalGizmo | (marca dirty flag) |

## Electron IPC

```
Renderer → window.electronAPI.openGLB() → preload contextBridge
  → ipcRenderer.invoke('dialog:openGLB') → main process
  → dialog.showOpenDialog() → fs.readFile() → ArrayBuffer
  → preload → renderer
```

## Render Loop Dual

La app usa **dos** requestAnimationFrame loops independientes:
1. **Engine._startLoop**: Renderiza la escena al canvas (solo si `_dirty`)
2. **Index._startLoop**: Lógica de input, pintura, gizmos

Se registran en orden: Engine primero, luego Index. En cada frame:
- Engine renderiza (con estado de textura del frame anterior)
- Index procesa input y pinta (actualiza texturas para el siguiente frame)
