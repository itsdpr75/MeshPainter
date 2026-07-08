# Módulos - Referencia Técnica

## Core

### Engine.js
Motor de renderizado WebGL.
- **WebGLRenderer**: `antialias: true`, `preserveDrawingBuffer: true`, `outputColorSpace: SRGBColorSpace`, `toneMapping: ACESFilmicToneMapping`, `toneMappingExposure: 1.0`
- **Pixel ratio**: `Math.min(window.devicePixelRatio, 2)` para rendimiento
- **Iluminación**: `AmbientLight(0xffffff, 1.5)` + `DirectionalLight(0xffffff, 0.5)` en (1,1,0.5)
- **Render loop**: Solo renderiza si `_dirty = true` (dirty rendering). No renderiza frames idle.
- **Dual rAF**: Engine renderiza ANTES que Index en cada frame (registrado primero). Esto garantiza que los cambios de textura del frame N sean visibles en el render del frame N+1.
- **Resize**: `_onResize()` actualiza el tamaño del renderer y el aspect ratio de la cámara
- **Métodos auxiliares**: `readPixels()`, `readPixelsToImageData()`, `markDirty()`, `getDelta()`, `getTime()`, `setCamera()`
- **`markDirty()`**: Pone `_dirty = true` para forzar un render en el próximo frame

### SceneManager.js
Carga y exportación de GLB.
- **GLTFLoader**: Con DRACOLoader (`gstatic.com/draco/versioned/decoders/1.5.7/` desde CDN)
- **loadGLB()**: `loader.parse(arrayBuffer)` → emite `MODEL_LOADED` con `{meshes, materials, scene}`
- **_collectFromNode()**: Recursivo, recoge meshes y sus materiales (arrays o individuales)
- **exportGLB()**: `GLTFExporter.parse()` con `{binary: true, embedImages: true}`
- Al hacer clear del modelo: `traverse()` para disponer geometrías y texturas
- Soporta modelos multi-mesh y multi-material

### InputManager.js
Estado de teclado y ratón.
- `isMouseButtonDown(button)`: Estado actual del botón (0=izquierdo, 1=medio, 2=derecho)
- `wasMouseButtonPressed(button)`: Presionado en este frame (justPressed)
- `getNDC(canvas)`: Convierte clientX/clientY a NDC (-1 a 1)
- `isMouseOverCanvas(canvas)`: `getBoundingClientRect()` para detectar si el ratón está sobre el viewport
- `getWheel()`: Delta de wheel acumulado, reseteado en `endFrame()`
- `isKeyDown(key)`: Estado actual de tecla
- `wasKeyPressed(key)`: Tecla presionada en este frame
- `endFrame()`: Resetea estados "justPressed/justReleased" y wheel delta. Se llama al final de cada frame.

### UVAnalyzer.js
Análisis de coordenadas UV.
- `analyzeMaterial(meshes, material)`: UV bounds solo de mallas que usan ESE material específico
- `analyzeAllMeshes(meshes)`: UV bounds de TODAS las mallas (para materiales nuevos sin asignar)
- `uvToCanvas(u, v, bounds, resolution)`: Mapea UV a píxeles del canvas: `canvasX = ((u - uMin) / (uMax - uMin)) * resolution`
- `canvasToUv(cx, cy, bounds, resolution)`: Mapea píxeles a UV
- Soporta multi-material meshes con `geometry.groups[materialIndex]` para filtrar vértices
- Los UV bounds pueden ser cualquier rango (negativos, >1)

## Camera

### CameraSwitcher.js
Alterna entre OrbitCamera y FreeCamera con Tab.
- `focusOn(box)`: Centra ambas cámaras en el bounding box del modelo tras cargar
- `update()`: Actualiza cámara activa según input, llama `markDirty()`
- Muestra el modo activo en la UI

### OrbitCamera.js
Cámara orbital: right-click drag para orbitar (rotación esférica), wheel para zoom (dolly).

### FreeCamera.js
Cámara libre: WASD horizontal, Q/E vertical, right-click drag para mirar (FPS-style).

## Painting

### Painter.js
Lógica central de pintura. El módulo más complejo de la aplicación.

**Estado interno:**
- `_activeBrush`: Pincel seleccionado (Brush)
- `_activeMaterial`: Material seleccionado en el panel (para Texture Brush)
- `_currentColor`: `THREE.Color` — color sólido del pincel (por defecto negro `0x000000`, actualizado vía `BRUSH_COLOR_CHANGED`)
- `_currentAlpha`: Opacidad (0-1)
- `_stampFrameSkip`: 1 (pinta cada 2do frame)
- `_stampFrameCounter`: Countdown para frame skip
- `_textureBrushMode`: `true` por defecto (modo Texture Brush)
- `_minStampDistanceFactor`: 0.5 (distancia mínima = brushSize × 0.5)

**Métodos:**
- **`_init()`**: Crea `ShaderMaterial` con `PaintShader`, `PlaneGeometry(2,2)`, `OrthographicCamera(-1,1,1,-1)` en z=1
- **`_bindEvents()`**: Escucha `BRUSH_SELECTED`, `MATERIAL_SELECTED`, `BRUSH_SIZE_CHANGED`, `BRUSH_OPACITY_CHANGED`, `BRUSH_ROTATION_CHANGED`, `BRUSH_COLOR_CHANGED`, `BRUSH_TEXTURE_MODE_CHANGED`
- **`tryPaint(inputManager, canvas)`**: 
  1. Frame skip countdown (antes del raycast para ahorrar CPU)
  2. Guards: brush, meshes, mouse over canvas
  3. Raycast desde cámara activa
  4. Determina material de la cara golpeada y su PaintCanvas
  5. UV → canvasPx, check de distancia mínima proporcional al brush size
  6. Llama a `stamp()` con el material golpeado
- **`stamp(targetMaterial, paintCanvas, x, y)`**:
  1. Asegura intermediateRT del tamaño correcto
  2. Blit PaintCanvas → intermediateRT (con `toneMapped: false` y `needsUpdate` correcto)
  3. Configura uniforms (incluyendo `uMaterialMap`/`uUseMaterialMap` según modo)
  4. **Texture Brush guard**: si `activeMaterial._paintCanvas === paintCanvas`, desactiva modo textura
  5. Render stamp shader → PaintCanvas RT
  6. Actualiza `material.map` en TODOS los materiales que comparten `_paintCanvas` (maneja clones de GLTFLoader)
  7. `markDirty()`, emite `SCENE_DIRTY` y `PAINT_STROKE_APPLIED`
- **`_ensureIntermediateRT(resolution)`**: Crea/resizea el RT intermedio a la resolución del PaintCanvas
- **`resetStampPosition()`**: Resetea `_lastStampUV = null` y `_stampFrameCounter = 0`
- **Caché de recursos**: `_blitMaterial`, `_blitMesh`, `_blitScene` cacheados para evitar GC thrashing (crear/destruir objetos cada frame)

### PaintCanvas.js
Render Target por material. Cada material del modelo tiene su propio PaintCanvas independiente.

**Propiedades:**
- **WebGLRenderTarget**: `RGBAFormat`, `UnsignedByteType`, `NearestFilter`, `ClampToEdgeWrapping`, sin depth/stencil buffer, `colorSpace: THREE.SRGBColorSpace`
- **Resolución por defecto**: 2048×2048 (configurable: 1024, 2048, 4096, 8192)

**Métodos:**
- **`_init()`**: Crea el RT con las propiedades correctas de color space
- **`initFromTexture(renderer, sourceTexture)`**: Blitea una textura fuente al RT usando `MeshBasicMaterial` con `toneMapped: false`
- **`getImageData(renderer)`**: Lee píxeles del GPU vía `readRenderTargetPixels()`, devuelve `ImageData`
- **`setImageData(imageData, renderer)`**: Crea `DataTexture` desde ImageData, blitea al RT
- **`cloneTextureData(renderer)`**: Copia datos de textura para undo states (lee del GPU)
- **`setResolution(resolution)`**: Cambia resolución del RT (dispose + reinit)
- **`dispose()`**: Limpia el RT

### PaintShader.js
GLSL shader para stamp de pincel. Soporta dos modos: color sólido y Texture Brush.

**Vertex Shader:**
- `vUv = uv` — pasa coordenadas UV del full-screen quad

**Fragment Shader:**
- Convierte `canvasUV` a píxeles del canvas
- Calcula delta desde el centro del pincel, aplica rotación (matriz 2D)
- Samplea textura del pincel con clamping a bounds (0-1)
- Samplea canvas actual desde el intermediateRT
- **Texture Brush mode** (`uUseMaterialMap == 1`): samplea `uMaterialMap` en `canvasUV` como color de pincel
- **Color mode** (`uUseMaterialMap == 0`): usa `uColor.rgb` como color de pincel
- Alpha compositing: `mix(canvas.rgb, brushColor, effectiveAlpha)` + alpha blending (`canvas.a + alpha * (1 - canvas.a)`)
- WebGL2 maneja automáticamente sRGB↔linear para texturas/framebuffers con `SRGBColorSpace`

### Brush.js
Datos del pincel:
- **_texture**: `DataTexture` desde ImageData (Canvas 2D), 256×256, `RGBAFormat`, `UnsignedByteType`, `SRGBColorSpace`, `NearestFilter`, `ClampToEdgeWrapping`
- **Tamaño**: 0-∞ (clamp interno a 1px mínimo)
- **Opacidad**: 0.00-1.00 (redondeo a 2 decimales)
- **Rotación**: 0-360° (almacenada en radianes)
- **Name**: Identificador del pincel
- `flipY: true` en la textura para corregir orientación

## Materials

### MaterialManager.js
Gestión de materiales del editor.
- **_registerMaterial(material, meshes)**: 
  1. Analiza UV bounds del material
  2. Crea PaintCanvas en resolución por defecto (2048)
  3. Inicializa canvas: si `material.map` existe, blitea la textura original; si no, rellena con color sólido
  4. Asigna `material.map = paintCanvas.getTexture()` y `material.needsUpdate = true`
  5. Registra metadata en `_materialMeta` Map
- **createNewMaterial(name)**: `PBRMaterial.createDefault()` + PaintCanvas + UV bounds de todas las mallas
- **initCanvasFromColor(paintCanvas, color)**: Convierte color linear→sRGB (`convertLinearToSRGB()`), crea canvas 2D 64×64 con color sólido, DataTexture, blitea al RT
- **collectPaintTextures()**: Lee píxeles de GPU de todos los canvas pintados (`material._painted === true`) para export
- **setCanvasResolution(material, resolution)**: Cambia resolución del PaintCanvas (valida contra `CANVAS_RESOLUTIONS`)
- **_showMaterialOnMesh(material)**: Actualiza `material.map` en todas las mallas que usan ese material
- **Corrección de espacio de color**: `initCanvasFromColor()` aplica `convertLinearToSRGB()` antes de `getHexString()` para evitar doble encoding (canvas 2D es sRGB, Three.js Color es linear)

### PBRMaterial.js
Factory de `MeshPhysicalMaterial` (NO `MeshStandardMaterial`, para soportar `KHR_materials_specular` en export).
- **createDefault(name)**: Blanco (#ffffff), roughness 1.0, metalness 0.0, specularIntensity 1.0
- **createFromExisting(material)**: Clona un material existente

### MaterialModal.js
Modal HTML para crear/editar materiales.

Al cambiar el albedo (color o textura), `index.js:_applyMaterialData()` re-inicializa el PaintCanvas llamando a `paintCanvas.initFromTexture()` (si hay nueva textura) o `MaterialManager.initCanvasFromColor()` (si es color sólido). Esto resetea el canvas de pintura al nuevo aspecto base del material.

Campos:
- Nombre del material
- Albedo: color picker + textura PNG (textura tiene prioridad sobre color)
- Normal map: textura PNG
- Displacement map: textura PNG (preview only, NO exportado)
- AO map: textura PNG
- Specular: textura PNG o valor numérico (textura tiene prioridad)
- Roughness: textura PNG o slider 0-1
- Metalness: textura PNG o slider 0-1

## Decals

### DecalManager.js
Ciclo de vida de decals (crear, seleccionar, eliminar, visibilidad). Los decals se almacenan en un contenedor dedicado como hijos de la escena (no como hijos de meshes).

### DecalProjector.js
Drag & drop de decals al viewport. Convierte coordenadas de drop (`clientX/clientY`) a NDC via `canvas.getBoundingClientRect()`, raycast, coloca `DecalGeometry` alineado a la superficie.

### DecalGizmo.js
Gizmo de transformación (W=translate, E=rotate, R=scale) usando `TransformControls` de Three.js. Alineado a la normal de la superficie. Solo activo cuando hay un decal seleccionado.

### DecalSprite.js
Sprite 2D indicador de posición del decal en el viewport (icono clickable para seleccionar). El eye toggle controla su visibilidad.

## UI

### UIManager.js
Orquestación de paneles UI. Inicializa TopBar, BrushPanel, DecalPanel, MaterialPanel, y los botones de la barra superior (Open GLB, Export GLB, Undo, Redo, New Material). Boot de la interfaz completa.

### BrushPanel.js
Panel inferior con:
- **Grid de pinceles**: Botones con thumbnails de los pinceles (Soft Circle, Glow, y cualquier pincel importado)
- **Botón Import**: Importa PNG, valida que sea grayscale (±2 tolerancia en RGB), aplica conversión grayscale→alpha si no hay canal alpha nativo
- **Checkbox "Paint with Material Texture"**: Toggle Texture Brush mode (por defecto activado). Emite `BRUSH_TEXTURE_MODE_CHANGED`
- **Color picker**: Input HTML `type="color"`. Emite `BRUSH_COLOR_CHANGED`. Se atenúa (opacity 0.3, pointer-events none) cuando Texture Brush está activado
- **Validación de PNG**: Los pinceles DEBEN ser efectivamente grayscale. Si no tienen canal alpha, se deriva de luminancia (R = alpha, white→opaque, black→transparent)

### DecalPanel.js
Panel inferior con botones de decals + botón importar PNG. Misma validación grayscale que BrushPanel.

### MaterialPanel.js
Panel izquierdo con lista de materiales. Click selecciona (emite `MATERIAL_SELECTED`), doble-click abre modal de edición. Muestra miniatura de la textura y nombre del material.

### TopBar.js
Controles superiores:
- Size: slider + input numérico (Ctrl+wheel)
- Opacity: slider + input numérico (Shift+wheel)
- Rotation: slider + input numérico (Alt+wheel)
- Eye toggle: visibilidad de sprites de decals

## Utils

### EventBus.js
Pub/sub simple. `on(event, callback)`, `off(event, callback)`, `emit(event, data)`. Los callbacks se ejecutan síncronamente en orden de registro.

### Constants.js
Define:
- `CANVAS_RESOLUTIONS`: [1024, 2048, 4096, 8192]
- `DEFAULT_CANVAS_RESOLUTION`: 2048
- `MAX_UNDO_STATES`: 100
- `CAMERA_MODES`: { ORBIT: 'orbit', FREE: 'free' }
- `DECAL_GIZMO_MODES`: { TRANSLATE, ROTATE, SCALE }
- `DEFAULT_BRUSH_SIZE`: 50
- `DEFAULT_BRUSH_OPACITY`: 1.0
- `DEFAULT_BRUSH_ROTATION`: 0
- `BRUSH_SIZE_MIN`: 0
- `EVENTS`: Objeto con todos los nombres de eventos (material:*, brush:*, decal:*, model:*, camera:*, paint:*, undo:*, scene:*, canvas:*)
  - Incluye eventos recientes: `BRUSH_COLOR_CHANGED`, `BRUSH_TEXTURE_MODE_CHANGED`

### FileIO.js
Wrapper de `window.electronAPI.*`. Métodos: `openGLB()`, `saveGLB(buffer)`, `openTexture()`. NO usa fs, dialog, ni ipcRenderer directamente.

### UndoRedo.js
Pila de 100 estados (FIFO). `pushState()`, `undo()`, `redo()`. Soporta tipos: `paint` (clona ImageData del PaintCanvas), `decal_create`, `decal_delete`. Ctrl+Z para undo, Ctrl+Y para redo.

### ProceduralAssets.js
Genera assets por defecto con Canvas 2D:
- Brush "Soft Circle": 256×256, gradiente radial blanco centro → transparente borde
- Brush "Glow": 256×256, centro opaco, borde suave transparente
- Decal "Gradient": 256×256, gradiente linear negro izquierda → blanco derecha

## Workers

### brush-processor.worker.js
Valida PNG vía `createImageBitmap()`. Verifica que brushes/decals sean grayscale (±2 tolerancia). Convierte a `ImageBitmap` para transferencia eficiente.

### undo-snapshot.worker.js
Clona `ImageData` asíncronamente para undo states, evitando bloquear el hilo principal.

### decal-math.worker.js
Calcula matrices de proyección y alineación de gizmos para decals.
