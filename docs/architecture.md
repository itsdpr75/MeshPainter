# MeshPaint - Arquitectura General

## Resumen

MeshPaint es una aplicación **Electron** para pintura de texturas en mallas 3D. Usa **Three.js** (r170+), vanilla JavaScript (ES Modules), **electron-vite** como build tool, y **pnpm** como package manager. Permite cargar modelos GLB, pintar sobre sus materiales con pinceles (tanto en modo color sólido como en modo **Texture Brush** — estampando la textura del material seleccionado), colocar decals, gestionar materiales PBR, y exportar el resultado.

## Stack Tecnológico

| Componente | Tecnología | Versión |
|-----------|-----------|---------|
| Framework | Electron + electron-vite | Electron 33, electron-vite 2.3 |
| 3D Engine | Three.js (WebGL2) | 0.170+ |
| Lenguaje | Vanilla JavaScript (ES Modules) | — |
| Package Manager | pnpm | 11.5+ |
| Build | electron-vite (main, preload, renderer) | — |
| Workers | ES Module Workers | — |
| Empaquetado | electron-builder (NSIS para Windows) | 26.15+ |

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
    │   ├── Painter.js        # Core painting logic (frame skip, Texture Brush, feedback-loop guard)
    │   ├── PaintCanvas.js    # Per-material render target
    │   ├── PaintShader.js    # Brush stamp GLSL shader (color + texture mode)
    │   └── Brush.js          # Brush data (texture, size, opacity, rotation)
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
    │   ├── BrushPanel.js     # Brush selection + color picker + texture mode toggle
    │   ├── DecalPanel.js     # Decal selection panel
    │   ├── MaterialPanel.js  # Material list panel
    │   └── TopBar.js         # Size/opacity/rotation controls
    ├── workers/
    │   ├── brush-processor.worker.js
    │   ├── undo-snapshot.worker.js
    │   └── decal-math.worker.js
    └── utils/
        ├── Constants.js      # Events, defaults, enums, BRUSH_COLOR_CHANGED, BRUSH_TEXTURE_MODE_CHANGED
        ├── EventBus.js       # Pub/sub event system
        ├── FileIO.js         # IPC wrapper for file dialogs
        ├── UndoRedo.js       # 100-state undo stack
        └── ProceduralAssets.js # Default brushes/decals
```

## Flujo de Datos Principal

```
[Usuario] → InputManager → Index._startLoop
                              ├→ CameraSwitcher.update()
                              ├→ _handleInputShortcuts() (Ctrl+wheel=size, Shift+wheel=opacity, Alt+wheel=rotation, Ctrl+Z/Y=undo/redo)
                              ├→ tryPaint() → stamp() → PaintCanvas RT
                              ├→ DecalGizmo.update()
                              └→ Engine.markDirty()

[Engine._startLoop] → if _dirty → renderer.render(scene, camera) → _dirty=false
```

## Sistema de Eventos

La aplicación usa un **EventBus** central (pub/sub) para comunicación entre módulos. Los eventos principales:

| Evento | Emisor | Consumidores | Descripción |
|--------|--------|-------------|-------------|
| `model:loaded` | SceneManager | MaterialManager, CameraSwitcher, Index | GLB cargado |
| `material:selected` | MaterialPanel | Painter | Material seleccionado para pintar |
| `material:created` | MaterialManager | MaterialPanel | Nuevo material creado |
| `material:updated` | Index (tras modal edit) | MaterialPanel | Material modificado |
| `brush:selected` | BrushPanel | Painter | Pincel seleccionado |
| `brush:sizeChanged` | TopBar + Index (Ctrl+wheel) | Painter | Tamaño de pincel |
| `brush:opacityChanged` | TopBar + Index (Shift+wheel) | Painter | Opacidad |
| `brush:rotationChanged` | TopBar + Index (Alt+wheel) | Painter | Rotación |
| `brush:colorChanged` | BrushPanel (color picker) | Painter | Color sólido del pincel |
| `brush:textureModeChanged` | BrushPanel (checkbox) | Painter | Alternar modo Texture Brush |
| `paint:strokeApplied` | Painter | UndoRedo, Index | Pincelada completada — UndoRedo guarda estado, Index clona textura |
| `decal:created/deleted` | DecalManager | UndoRedo, Index | Decal creado/eliminado |
| `scene:dirty` | Painter, DecalGizmo | (marca dirty flag) | Escena modificada |

## Electron IPC

```
Renderer → window.electronAPI.openGLB() → preload contextBridge
  → ipcRenderer.invoke('dialog:openGLB') → main process
  → dialog.showOpenDialog() → fs.readFile() → ArrayBuffer
  → preload → renderer
```

El main process expone 3 handlers IPC:
- `dialog:openGLB`: Abre diálogo para archivos `.glb`, devuelve `ArrayBuffer`
- `dialog:saveGLB`: Guarda GLB exportado, recibe `ArrayBuffer`
- `dialog:openTexture`: Abre diálogo para PNGs (texturas, pinceles, decals)

En producción, el main process registra un protocolo `app://` privilegiado con `protocol.handle()` para servir los archivos del renderer, en lugar de usar `loadFile()`.

## Render Loop Dual

La app usa **dos** `requestAnimationFrame` loops independientes:

1. **Engine._startLoop**: Renderiza la escena al canvas (solo si `_dirty`). Usa dirty rendering — no renderiza frames idle.
2. **Index._startLoop**: Lógica de input, pintura, gizmos, shortcuts de teclado.

Se registran en orden: **Engine primero, luego Index**. En cada frame:
- Engine renderiza (con estado de textura del frame anterior)
- Index procesa input y pinta (actualiza texturas para el siguiente frame)

## Pipeline de Pintado (Resumen)

El pipeline completo está detallado en [`paint-pipeline.md`](./paint-pipeline.md). Resumen:

1. **Input**: Botón izquierdo presionado + brush seleccionado → `shouldPaint = true`
2. **Frame Skip**: Countdown para saltar frames y evitar sobrecarga de CPU/GPU (pinta 1 de cada 2 frames)
3. **Raycast**: Intersecta meshes desde la cámara activa
4. **Filtrado por material**: Determina qué material fue golpeado y obtiene su `PaintCanvas`
5. **UV → Canvas**: Convierte coordenadas UV a píxeles del canvas usando `UVAnalyzer`
6. **Stamp (GPU)**: Blit a RT intermedio → shader stamp (color o textura) → RT del canvas → actualiza `material.map`

## Texture Brush Mode

El modo **Texture Brush** (activado por defecto) permite pintar usando la **textura del material seleccionado** como "tinta" en lugar de un color sólido:

- El shader (`PaintShader`) tiene uniforms `uMaterialMap` (textura del material activo) y `uUseMaterialMap` (int, 0 o 1)
- Cuando `uUseMaterialMap = 1`, el shader samplea `texture2D(uMaterialMap, canvasUV)` y usa esos valores RGB como color del pincel
- El checkbox "Paint with Material Texture" en el panel de pinceles alterna entre modo textura y modo color
- **Guard de feedback loop**: Si el material activo comparte el mismo `_paintCanvas` que el material golpeado, se desactiva automáticamente el modo textura para ese stamp (evita leer y escribir la misma textura en un mismo draw call)

## Sistema de Empaquetado

Usa **electron-builder** para generar instaladores nativos:

- **Script**: `pnpm dist` (ejecuta `electron-vite build && electron-builder --win nsis`)
- **Instalador**: `MeshPaint Setup 1.0.0.exe` (NSIS, instalación personalizable)
- **App portable**: `dist/win-unpacked/MeshPaint.exe`
- **Config**: En `package.json` bajo la clave `"build"`, con `appId`, `productName`, targets NSIS
- **Pre-flight**: Requiere `pnpm approve-builds --all` para autorizar scripts de `electron-winstaller`
