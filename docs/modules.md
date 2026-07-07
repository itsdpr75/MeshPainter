# Módulos - Referencia Técnica

## Core

### Engine.js
Motor de renderizado WebGL.
- **WebGLRenderer**: `antialias: true`, `preserveDrawingBuffer: true`, `outputColorSpace: SRGBColorSpace`, `toneMapping: ACESFilmicToneMapping`
- **Iluminación**: `AmbientLight(0xffffff, 1.5)` + `DirectionalLight(0xffffff, 0.5)` en (1,1,0.5)
- **Render loop**: Solo renderiza si `_dirty = true` (dirty rendering)
- **Dual rAF**: Engine renderiza ANTES que Index en cada frame (registrado primero)

### SceneManager.js
Carga y exportación de GLB.
- **GLTFLoader**: Con DRACOLoader (`gstatic.com/draco/versioned/decoders/1.5.7/`)
- **loadGLB()**: `loader.parse(arrayBuffer)` → emite `MODEL_LOADED` con `{meshes, materials, scene}`
- **_collectFromNode()**: Recursivo, recoge meshes y sus materiales (arrays o individuales)
- **exportGLB()**: `GLTFExporter.parse()` con `{binary: true, embedImages: true}`
- Al hacer clear del modelo: `traverse()` para disponer geometrías y texturas

### InputManager.js
Estado de teclado y ratón.
- `isMouseButtonDown(button)`: Estado actual del botón
- `wasMouseButtonPressed(button)`: Presionado en este frame
- `getNDC(canvas)`: Convierte clientX/clientY a NDC (-1 a 1)
- `isMouseOverCanvas(canvas)`: `getBoundingClientRect()`
- `getWheel()`: Delta de wheel acumulado
- `endFrame()`: Resetea estados "justPressed/justReleased"

### UVAnalyzer.js
Análisis de coordenadas UV.
- `analyzeMaterial(meshes, material)`: UV bounds solo de mallas que usan ESE material
- `analyzeAllMeshes(meshes)`: UV bounds de TODAS las mallas (para materiales nuevos)
- `uvToCanvas(u, v, bounds, resolution)`: Mapea UV a píxeles del canvas
- `canvasToUv(cx, cy, bounds, resolution)`: Mapea píxeles a UV
- Soporta multi-material meshes con `geometry.groups[materialIndex]`

## Camera

### CameraSwitcher.js
Alterna entre OrbitCamera y FreeCamera con Tab.
- `focusOn(box)`: Centra ambas cámaras en el bounding box del modelo
- `update()`: Actualiza cámara activa según input, llama `markDirty()`

### OrbitCamera.js
Cámara orbital: right-click drag para orbitar, wheel para zoom.

### FreeCamera.js
Cámara libre: WASD horizontal, Q/E vertical, right-click drag para mirar.

## Painting

### Painter.js
Lógica central de pintura.
- **tryPaint()**: Raycast → filtro material → UV mapping → stamp
- **stamp()**: Blit → shader stamp → material update → markDirty
- **Stamp scene**: `PlaneGeometry(2,2)` + `ShaderMaterial(PaintShader)` + `OrthographicCamera(-1,1,1,-1)`
- **Intermediate RT**: Evita feedback loops (ping-pong buffer)
- **_blitMaterial/Mesh/Scene**: Cacheado para evitar GC

### PaintCanvas.js
Render Target por material.
- **WebGLRenderTarget**: 4096×4096, RGBA8, UnsignedByte, SRGBColorSpace
- **initFromTexture(renderer, sourceTexture)**: Blitea textura fuente al RT
- **getImageData(renderer)**: Lee píxeles del GPU (para export/undo)
- **setImageData(imageData, renderer)**: Escribe ImageData al RT
- **cloneTextureData(renderer)**: Copia para undo states

### PaintShader.js
GLSL shader para stamp de pincel.
- Vertex: pasa `uv` a fragment shader
- Fragment: mapea píxeles del canvas, rota brush, alpha compositing
- La mezcla usa `mix(canvas.rgb, brushColor, alpha)` + alpha compositing

### Brush.js
Datos del pincel.
- **_texture**: `DataTexture` desde ImageData (Canvas 2D), 256×256, RGBA8
- **Tamaño**: 0-∞ (clamp interno a 1px mínimo)
- **Opacidad**: 0.00-1.00
- **Rotación**: 0-360° (almacenada en radianes)
- `flipY: true` en la textura

## Materials

### MaterialManager.js
Gestión de materiales del editor.
- **_registerMaterial(material, meshes)**: Crea PaintCanvas, analiza UVs, asigna `material.map`
- **createNewMaterial(name)**: `PBRMaterial.createDefault()` + PaintCanvas + UV bounds
- **initCanvasFromColor(paintCanvas, color)**: Convierte color linear→sRGB, crea DataTexture 64×64, blitea al RT
- **collectPaintTextures()**: Lee píxeles de GPU para export

### PBRMaterial.js
Factory de `MeshPhysicalMaterial`.
- **createDefault(name)**: Blanco, roughness 1.0, metalness 0.0, specularIntensity 1.0
- **createFromExisting(material)**: Clona un material existente

### MaterialModal.js
Modal HTML para crear/editar materiales con campos PBR y texturas.

## Decals

### DecalManager.js
Ciclo de vida de decals (crear, seleccionar, eliminar, visibilidad).

### DecalProjector.js
Drag & drop de decals al viewport. Convierte coordenadas de drop a NDC, raycast, coloca `DecalGeometry`.

### DecalGizmo.js
Gizmo de transformación (W=translate, E=rotate, R=scale) alineado a la normal de la superficie.

### DecalSprite.js
Sprite 2D indicador de posición del decal en el viewport.

## UI

### UIManager.js
Orquestación de paneles UI. Boot de la interfaz.

### BrushPanel.js
Panel inferior con botones de pinceles + botón importar PNG.

### DecalPanel.js
Panel inferior con botones de decals + botón importar PNG.

### MaterialPanel.js
Panel izquierdo con lista de materiales. Click selecciona, doble-click edita.

### TopBar.js
Controles superiores: size slider+input, opacity slider+input, rotation slider+input, eye toggle.

## Utils

### EventBus.js
Pub/sub simple. `on(event, callback)`, `off(event, callback)`, `emit(event, data)`.

### Constants.js
`EVENTS`, `CANVAS_RESOLUTIONS`, `DEFAULT_CANVAS_RESOLUTION`, `CAMERA_MODES`, `DECAL_GIZMO_MODES`, defaults de brush.

### FileIO.js
Wrapper de `window.electronAPI.*`. `openGLB()`, `saveGLB(buffer)`, `openTexture()`.

### UndoRedo.js
Pila de 100 estados. `pushState()`, `undo()`, `redo()`. Soporta tipos: `paint`, `decal_create`, `decal_delete`.

### ProceduralAssets.js
Genera assets por defecto con Canvas 2D: brushes "Soft Circle" y "Glow", decal "Gradient".

## Workers

### brush-processor.worker.js
Valida PNG, convierte a ImageBitmap. Verifica que brushes/decals sean grayscale (±2 tolerancia).

### undo-snapshot.worker.js
Clona ImageData asíncronamente para undo states.

### decal-math.worker.js
Calcula matrices de proyección y alineación de gizmos.
