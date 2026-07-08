# MeshPaint — Documento de Definición Completa

> **Versión:** 1.0.0  
> **Fecha:** Julio 2026  
> **Propósito:** Especificación exhaustiva del programa, arquitectura, módulos, flujos de trabajo y detalles técnicos de implementación.

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Arquitectura General](#4-arquitectura-general)
5. [Proceso Principal (Main Process)](#5-proceso-principal-main-process)
6. [Preload Script](#6-preload-script)
7. [Renderer — Motor de Renderizado](#7-renderer--motor-de-renderizado)
8. [Renderer — Cámaras](#8-renderer--cámaras)
9. [Renderer — Pipeline de Pintado](#9-renderer--pipeline-de-pintado)
10. [Renderer — Sistema de Materiales](#10-renderer--sistema-de-materiales)
11. [Renderer — Sistema de Decals](#11-renderer--sistema-de-decals)
12. [Renderer — UI y Paneles](#12-renderer--ui-y-paneles)
13. [Renderer — Sistema de Eventos](#13-renderer--sistema-de-eventos)
14. [Renderer — Undo/Redo](#14-renderer--undoredo)
15. [Renderer — Workers](#15-renderer--workers)
16. [Renderer — Utilidades](#16-renderer--utilidades)
17. [Sistema de Build y Empaquetado](#17-sistema-de-build-y-empaquetado)
18. [Exportación GLB](#18-exportación-glb)
19. [Formato y Validación de Archivos](#19-formato-y-validación-de-archivos)
20. [Atajos de Teclado y Ratón](#20-atajos-de-teclado-y-ratón)
21. [Historial de Bugs y Fixes](#21-historial-de-bugs-y-fixes)
22. [Glosario Técnico](#22-glosario-técnico)

---

## 1. Resumen Ejecutivo

MeshPaint es una aplicación de escritorio para **pintura de texturas 3D** sobre mallas poligonales. Permite a artistas y desarrolladores cargar modelos GLB (Binary glTF 2.0), pintar directamente sobre sus texturas en tiempo real, gestionar materiales PBR, colocar decals, y exportar el resultado como un nuevo archivo GLB con las texturas pintadas incrustadas.

**Plataforma objetivo:** Windows (x64), con soporte extensible a macOS y Linux.  
**Público objetivo:** Artistas 3D, desarrolladores de juegos, diseñadores de assets.

### Capacidades principales

| Capacidad | Descripción |
|-----------|-------------|
| **Pintura 3D** | Pintar sobre texturas de materiales usando pinceles configurables (tamaño, opacidad, rotación). |
| **Texture Brush** | Usar la textura de un material como "tinta" para pintar sobre otro, mezclando materiales en tiempo real. |
| **Materiales PBR** | Gestión completa de MeshPhysicalMaterial: albedo, normal, roughness, metalness, specular, AO, displacement. |
| **Decals** | Colocación de decals mediante drag & drop con gizmos de transformación (W/E/R). |
| **Import/Export GLB** | Carga modelos GLB (con compresión Draco) y exporta los cambios a un nuevo GLB. |
| **Undo/Redo** | 100 estados de historial para pinceladas y operaciones de decals. |
| **Interfaz oscura** | UI profesional con panel de materiales, pinceles, decals y vista 3D. |
| **Instalador nativo** | Empaquetado como instalador NSIS para Windows y portable. |

---

## 2. Stack Tecnológico

| Componente | Tecnología | Versión | Notas |
|-----------|-----------|---------|-------|
| **Framework** | Electron | 33.2.1 | Aplicación de escritorio multiplataforma |
| **Build tool** | electron-vite | 2.3.0 | Compila main, preload y renderer |
| **Motor 3D** | Three.js | 0.170.0 | WebGL 2, MeshPhysicalMaterial, GLTFExporter |
| **Lenguaje** | JavaScript (Vanilla) | ES2022 | ES Modules, sin TypeScript ni frameworks UI |
| **Package manager** | pnpm | 11.5+ | Gestión de dependencias con bloqueo de scripts |
| **Workers** | ES Module Workers | — | `new Worker(new URL('...', import.meta.url), { type: 'module' })` |
| **Empaquetado** | electron-builder | 26.15.3 | Instalador NSIS para Windows |
| **Compresión 3D** | Draco | 1.5.7 | Decodificador cargado desde CDN de Google |
| **Formato 3D** | glTF 2.0 | — | Binary GLB con texturas embebidas |

---

## 3. Estructura del Proyecto

```
MeshPaint/
├── .npmrc                          # Config pnpm (onlyBuiltDependencies)
├── pnpm-workspace.yaml             # Workspace pnpm con dependencias aprobadas
├── package.json                    # Metadatos, scripts, config electron-builder
├── electron.vite.config.js         # Build config (main, preload, renderer, workers)
├── pnpm-lock.yaml                  # Lockfile de dependencias
├── index.html                      # Landing page del proyecto
├── MeshPaint.md                    # Especificación original del proyecto
├── media/
│   └── ui-img.png                  # Captura de pantalla de la interfaz
├── docs/
│   ├── architecture.md             # Documentación de arquitectura
│   ├── paint-pipeline.md           # Documentación del pipeline de pintado
│   ├── modules.md                  # Documentación de módulos
│   ├── build-run.md                # Instrucciones de build y ejecución
│   ├── bugs-fixes.md               # Historial de bugs y fixes
│   └── definition-document.md      # Este documento
├── out/                            # Build de producción (generado)
│   ├── main/main.js
│   ├── preload/preload.js
│   └── renderer/
│       ├── index.html
│       └── assets/
├── dist/                           # Instalador empaquetado (generado)
│   ├── MeshPaint Setup 1.0.0.exe
│   └── win-unpacked/MeshPaint.exe
└── src/
    ├── main/
    │   └── main.js                 # Electron main process
    ├── preload/
    │   └── preload.js              # contextBridge API
    └── renderer/
        ├── index.html              # HTML del renderer
        ├── index.js                # Entry point, loop principal
        ├── styles.css              # Tema oscuro (CSS custom properties)
        ├── core/
        │   ├── Engine.js           # WebGLRenderer, scene, render loop
        │   ├── SceneManager.js     # Carga/exportación GLB
        │   ├── InputManager.js     # Estado de teclado/ratón
        │   └── UVAnalyzer.js       # Análisis de coordenadas UV
        ├── camera/
        │   ├── CameraSwitcher.js   # Alternar Orbit/Free (Tab)
        │   ├── OrbitCamera.js      # Órbita con botón derecho
        │   └── FreeCamera.js       # WASD libre
        ├── painting/
        │   ├── Painter.js          # Lógica central de pintura
        │   ├── PaintCanvas.js      # RenderTarget por material
        │   ├── PaintShader.js      # Shader GLSL de stamp
        │   └── Brush.js            # Datos de pincel
        ├── materials/
        │   ├── MaterialManager.js  # Registro de materiales
        │   ├── PBRMaterial.js      # Factory MeshPhysicalMaterial
        │   └── MaterialModal.js    # Modal crear/editar material
        ├── decals/
        │   ├── DecalManager.js     # Ciclo de vida de decals
        │   ├── DecalGizmo.js       # Gizmo W/E/R
        │   ├── DecalProjector.js   # Drag & drop
        │   └── DecalSprite.js      # Indicadores 2D
        ├── ui/
        │   ├── UIManager.js        # Orquestación UI
        │   ├── BrushPanel.js       # Panel de pinceles + color picker + Texture Brush toggle
        │   ├── DecalPanel.js       # Panel de decals
        │   ├── MaterialPanel.js    # Lista de materiales
        │   └── TopBar.js           # Controles superiores
        ├── workers/
        │   ├── brush-processor.worker.js   # Validación PNG
        │   ├── undo-snapshot.worker.js     # Clonado asíncrono
        │   └── decal-math.worker.js        # Cálculos de gizmo
        └── utils/
            ├── Constants.js        # Eventos, defaults, enums
            ├── EventBus.js         # Pub/sub
            ├── FileIO.js           # Wrapper IPC
            ├── UndoRedo.js         # Pila de 100 estados
            └── ProceduralAssets.js # Brushes/decals por defecto
```

---

## 4. Arquitectura General

### 4.1 Diagrama de alto nivel

```
┌──────────────────────────────────────────────────────┐
│                   Electron Main Process               │
│  main.js: handlers IPC, protocolo app://, ventana     │
└───────────────┬──────────────────┬───────────────────┘
                │ IPC (invoke)     │ IPC (invoke)
                ▼                  ▼
┌───────────────────────┐  ┌───────────────────────┐
│    Preload Script      │  │    Preload Script      │
│  contextBridge API     │  │  openGLB / saveGLB    │
│  window.electronAPI   │  │  openTexture           │
└───────────┬───────────┘  └───────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────┐
│                 Renderer Process                      │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │ Engine  │  │  Painter │  │  MaterialManager  │   │
│  │ (WebGL) │◄─│ (stamps) │──│  (PaintCanvases)  │   │
│  └─────────┘  └──────────┘  └───────────────────┘   │
│       │              │                │               │
│       ▼              ▼                ▼               │
│  ┌──────────────────────────────────────────────┐    │
│  │              EventBus (pub/sub)               │    │
│  └──────────────────────────────────────────────┘    │
│       │              │                │               │
│       ▼              ▼                ▼               │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │   UI    │  │  Decals  │  │    UndoRedo       │   │
│  │ Panels  │  │  Gizmo   │  │    Workers        │   │
│  └─────────┘  └──────────┘  └───────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 4.2 Render Loop Dual

La aplicación ejecuta **dos bucles `requestAnimationFrame` independientes**, registrados en orden:

1. **Engine._startLoop** (primero): Renderiza la escena al canvas **solo si `_dirty === true`** (dirty rendering). Si no hay cambios, no se gasta GPU en renders idle.

2. **Index._startLoop** (segundo): Procesa input del usuario, ejecuta shortcuts de teclado, actualiza cámaras, gestiona el gizmo de decals, y ejecuta `painter.tryPaint()` para las pinceladas. Los cambios de textura del frame N son visibles en el render del frame N+1.

```
Frame N:
  Engine rAF → _dirty? → render(scene) → _dirty = false
  Index rAF → input → tryPaint → stamp (modifica texturas) → markDirty()
  
Frame N+1:
  Engine rAF → _dirty = true → render(scene) CON CAMBIOS → _dirty = false
```

### 4.3 Comunicación entre módulos

Toda comunicación entre módulos del renderer se realiza a través del **EventBus** central. Los módulos no se importan entre sí directamente (excepto dependencias obvias como `Painter → PaintShader`). El EventBus es un simple patrón pub/sub con los métodos `on(event, callback)`, `off(event, callback)`, y `emit(event, data)`.

---

## 5. Proceso Principal (Main Process)

**Archivo:** `src/main/main.js`  
**Rol:** Gestiona la ventana de Electron, registra handlers IPC para diálogos de archivo, y sirve el renderer mediante un protocolo personalizado.

### 5.1 Handlers IPC

El main process expone tres handlers mediante `ipcMain.handle()`:

#### `dialog:openGLB`
- Abre un diálogo nativo con filtro `*.glb`
- Lee el archivo con `fs.promises.readFile()`
- Devuelve `{ buffer: ArrayBuffer, fileName: string }` o `null` si se cancela

#### `dialog:saveGLB`
- Abre un diálogo nativo de guardado con filtro `*.glb`
- Recibe un `ArrayBuffer` del renderer
- Escribe el archivo con `fs.promises.writeFile()`
- Devuelve `{ success: boolean, filePath?: string, canceled?: boolean }`

#### `dialog:openTexture`
- Abre un diálogo nativo con filtro `*.png`
- Lee el archivo con `fs.promises.readFile()`
- Devuelve `{ buffer: ArrayBuffer, fileName: string }` o `null` si se cancela

### 5.2 Ventana Principal

```js
new BrowserWindow({
  width: 1600, height: 1000,
  minWidth: 1200, minHeight: 800,
  backgroundColor: '#1a1a2e',
  webPreferences: {
    preload: join(__dirname, '../preload/preload.js'),
    contextIsolation: true,    // Seguridad: aislar renderer del main
    nodeIntegration: false,     // Seguridad: sin acceso a Node.js
    sandbox: false              // Necesario para preload
  }
});
```

### 5.3 Protocolo Personalizado (Producción)

En producción, NO se usa `win.loadFile()`. En su lugar:

1. Antes de `app.whenReady()`, se registra un esquema privilegiado:
   ```js
   protocol.registerSchemesAsPrivileged([
     { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
   ]);
   ```

2. Tras `app.whenReady()`, se registra un handler para el protocolo:
   ```js
   protocol.handle('app', (request) => {
     const pathname = decodeURIComponent(url.pathname.replace(/^\//, ''));
     const filePath = resolve(__dirname, '../renderer', pathname || 'index.html');
     return net.fetch(pathToFileURL(filePath).href);
   });
   ```

3. La ventana carga `app://./index.html` en lugar de usar `loadFile()`.

**Motivo:** El protocolo `app://` permite que los **ES Module Workers** carguen correctamente en producción. Sin esto, los workers con rutas relativas fallarían al usar `file://`.

### 5.4 Comportamiento de la Ventana

- `window-all-closed`: Cierra la app en Windows/Linux. En macOS (`darwin`), no cierra (comportamiento estándar).
- `activate` (macOS): Re-crea la ventana si no hay ninguna abierta.

---

## 6. Preload Script

**Archivo:** `src/preload/preload.js`  
**Rol:** Puente seguro entre el main process y el renderer mediante `contextBridge`.

### API Expuesta

```js
window.electronAPI = {
  openGLB: () => ipcRenderer.invoke('dialog:openGLB'),
  saveGLB: (buffer) => ipcRenderer.invoke('dialog:saveGLB', buffer),
  openTexture: () => ipcRenderer.invoke('dialog:openTexture')
};
```

**Reglas estrictas:**
- Solo se exponen estos 3 métodos. Nada más.
- `ipcRenderer` NUNCA se expone directamente.
- El renderer accede a través de `window.electronAPI.*`.
- Los **workers NO pueden acceder a `window.electronAPI`**. Para que un worker procese un archivo, el renderer solicita el archivo vía IPC, obtiene el `ArrayBuffer`, y lo transfiere al worker con `postMessage({ buffer }, [buffer])`.

---

## 7. Renderer — Motor de Renderizado

**Archivo:** `src/renderer/core/Engine.js`  
**Rol:** Inicializa WebGLRenderer, gestiona la escena Three.js, ejecuta el render loop con dirty flag.

### 7.1 Configuración del Renderer

```js
new THREE.WebGLRenderer({
  canvas: this.canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true   // Necesario para readPixels
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // Máx 2x para rendimiento
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
```

### 7.2 Iluminación

La iluminación se diseñó para un aspecto **plano ("unlit")** que no distorsione la percepción de las texturas pintadas, pero que mantenga los canales PBR intactos para exportación:

| Luz | Tipo | Color | Intensidad | Posición |
|-----|------|-------|-----------|----------|
| Ambient | AmbientLight | `#ffffff` | 1.5 | — |
| Direccional | DirectionalLight | `#ffffff` | 0.5 | (1, 1, 0.5) |

> **Nota histórica:** Originalmente el AmbientLight tenía intensidad `Math.PI * 2` (~6.28), lo que blanqueaba las pinceladas y ocultaba bugs de textura. Se redujo a 1.5 y se añadió la DirectionalLight para dar definición de forma (Bug #9).

### 7.3 Escena

- `scene.background = new THREE.Color(0x1a1a2e)` — Fondo azul oscuro.
- La escena contiene: los meshes del modelo, las luces, el contenedor de decals.

### 7.4 Dirty Rendering

```js
_startLoop() {
  const loop = () => {
    this._delta = this._clock.getDelta();
    if (this._dirty && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
      this._dirty = false;  // Solo renderiza cuando hay cambios
    }
    this._animationId = requestAnimationFrame(loop);
  };
  this._animationId = requestAnimationFrame(loop);
}
```

El método `markDirty()` pone `_dirty = true`, forzando un render en el próximo frame.

### 7.5 Redimensionamiento

`_onResize()` se dispara con el evento `resize` del `window`:
- Actualiza el tamaño del renderer con `setSize(width, height, false)` (false = no actualizar estilo CSS).
- Actualiza el aspect ratio de la cámara activa (`camera.aspect = width / height`).
- Marca dirty.

### 7.6 Métodos auxiliares

- `readPixels(target, x, y, width, height)` → `Uint8Array`
- `readPixelsToImageData(target, x, y, width, height)` → `ImageData`
- `getDelta()` → delta time del último frame
- `getTime()` → tiempo transcurrido desde el inicio
- `setCamera(camera)` → asigna y configura la cámara activa

---

## 8. Renderer — Cámaras

### 8.1 CameraSwitcher

**Archivo:** `src/renderer/camera/CameraSwitcher.js`

Alterna entre dos modos de cámara mediante la tecla **Tab**:
- `CAMERA_MODES.ORBIT`: OrbitCamera
- `CAMERA_MODES.FREE`: FreeCamera

Muestra el modo activo en la UI. `focusOn(box)` centra ambas cámaras en el bounding box del modelo tras la carga.

### 8.2 OrbitCamera

**Archivo:** `src/renderer/camera/OrbitCamera.js`

- **Órbita:** Click derecho + arrastrar (rotación esférica alrededor del centro de interés)
- **Zoom:** Wheel (dolly)
- Radio mínimo: 0.1, máximo: 100

### 8.3 FreeCamera

**Archivo:** `src/renderer/camera/FreeCamera.js`

- **Movimiento:** WASD (horizontal), Q/E (vertical)
- **Mirada:** Click derecho + arrastrar (FPS-style)
- **Zoom:** Wheel

### 8.4 Bloqueo de Zoom del Navegador

Los eventos de wheel en el canvas usan `{ passive: false }` y llaman a `preventDefault()` para evitar que el navegador haga zoom en la página de Electron.

---

## 9. Renderer — Pipeline de Pintado

> **Documentación detallada:** [`docs/paint-pipeline.md`](./paint-pipeline.md)

### 9.1 Visión General

El pipeline de pintado consta de **7 etapas**:

```
Click → Frame Skip → Raycast → Filtrado Material → UV Mapping → Stamp (GPU) → Material Update → Render
```

### 9.2 Painter.js

**Archivo:** `src/renderer/painting/Painter.js`  
**Rol:** Lógica central de pintura. El módulo más complejo de la aplicación (~320 líneas).

#### Estado interno

| Propiedad | Tipo | Valor inicial | Descripción |
|-----------|------|--------------|-------------|
| `_activeBrush` | `Brush\|null` | `null` | Pincel activo seleccionado en BrushPanel |
| `_activeMaterial` | `Material\|null` | `null` | Material activo (para Texture Brush) |
| `_currentColor` | `THREE.Color` | `0x000000` | Color sólido del pincel (actualizado vía `BRUSH_COLOR_CHANGED`) |
| `_currentAlpha` | `number` | `1.0` | Opacidad global |
| `_stampFrameSkip` | `number` | `1` | Pinta 1 de cada `N+1` frames (1 = cada 2do frame) |
| `_stampFrameCounter` | `number` | `0` | Countdown para frame skip |
| `_textureBrushMode` | `boolean` | `true` | Modo Texture Brush activado por defecto |
| `_minStampDistanceFactor` | `number` | `0.5` | Distancia mínima = `brushSize × 0.5` |
| `_lastStampUV` | `{x,y}\|null` | `null` | Última posición de stamp en píxeles |

#### Recursos cacheados

Para evitar **GC thrashing** (crear/destruir objetos en cada frame), se cachean:

| Recurso | Tipo | Propósito |
|---------|------|-----------|
| `_stampMaterial` | `ShaderMaterial` | Shader de stamp (PaintShader) |
| `_stampMesh` | `Mesh` | Quad full-screen (`PlaneGeometry(2,2)`) |
| `_stampScene` | `Scene` | Escena del stamp |
| `_stampCamera` | `OrthographicCamera` | Cámara ortográfica (-1,1,1,-1), z=1 |
| `_blitMaterial` | `MeshBasicMaterial` | Material para blit (sin `toneMapped`) |
| `_blitMesh` | `Mesh` | Quad para blit |
| `_blitScene` | `Scene` | Escena para blit |
| `_intermediateRT` | `WebGLRenderTarget` | Ping-pong buffer (evita feedback loops) |

#### tryPaint(inputManager, canvas)

1. **Frame Skip** (ANTES del raycast, para ahorrar CPU):
   ```js
   if (this._stampFrameCounter > 0) { this._stampFrameCounter--; return; }
   this._stampFrameCounter = this._stampFrameSkip;
   ```

2. **Guards:** Sin brush → return. Sin meshes → return. Ratón fuera del canvas → return.

3. **Raycast:**
   ```js
   const ndc = inputManager.getNDC(canvas);
   this._raycaster.setFromCamera(ndc, this.engine.camera);
   const hits = this._raycaster.intersectObjects(meshes, false);
   ```

4. **Filtrado por material de la cara golpeada:**
   ```js
   let hitMaterial;
   if (Array.isArray(hit.object.material)) {
     const matIndex = hit.face ? hit.face.materialIndex : 0;
     hitMaterial = hit.object.material[matIndex] || hit.object.material[0];
   } else {
     hitMaterial = hit.object.material;
   }
   ```

5. **UV → Canvas:**
   ```js
   const canvasPx = UVAnalyzer.uvToCanvas(uv.x, uv.y, uvBounds, resolution);
   ```

6. **Distancia mínima proporcional:**
   ```js
   const minStampDistance = Math.max(1, brushSize * 0.5);
   // Si la distancia al último stamp < minStampDistance, skip
   ```

7. **Ejecutar stamp:**
   ```js
   this.stamp(hitMaterial, paintCanvas, canvasPx.x, canvasPx.y);
   ```

#### stamp(targetMaterial, paintCanvas, x, y)

1. **Blit a intermedio** (ping-pong buffer):
   - Copia el contenido actual del PaintCanvas al `_intermediateRT`
   - Usa `_blitMaterial` cacheado con `toneMapped: false`
   - **Fix crítico:** `needsUpdate = true` al asignar `map` dinámicamente (Bug #14)

2. **Configurar uniforms del shader:**
   - `uCanvas` = intermediateRT.texture
   - `uBrush` = brush.getTexture()
   - `uCanvasSize`, `uBrushSize`, `uPosition`, `uRotation`, `uOpacity`, `uColor`
   - **Texture Brush mode:** `uMaterialMap` + `uUseMaterialMap` (ver sección 9.5)

3. **Renderizar stamp:**
   ```js
   renderer.setRenderTarget(paintCanvas.getRenderTarget());
   renderer.render(this._stampScene, this._stampCamera);
   renderer.setRenderTarget(prevTarget);
   ```

4. **Actualizar materiales de malla:**
   ```js
   // Actualiza TODOS los materiales que comparten _paintCanvas (clones GLTFLoader)
   for (const mesh of meshes) {
     for (const mat of meshMaterials) {
       if (mat._paintCanvas === paintCanvas && mat.map !== texture) {
         mat.map = texture;
         mat.needsUpdate = true;
       }
     }
   }
   ```

5. **Emitir eventos:**
   ```js
   this.engine.markDirty();
   eventBus.emit(EVENTS.SCENE_DIRTY);
   eventBus.emit(EVENTS.PAINT_STROKE_APPLIED, { material: targetMaterial });
   ```

### 9.3 PaintShader.js

**Archivo:** `src/renderer/painting/PaintShader.js`  
**Rol:** Shader GLSL que ejecuta el stamp del pincel sobre el canvas.

#### Vertex Shader
```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

#### Fragment Shader
El fragment shader realiza las siguientes operaciones por cada píxel del full-screen quad:

1. **Conversión a píxeles del canvas:**
   ```glsl
   vec2 canvasPx = canvasUV * uCanvasSize;
   ```

2. **Offset y rotación del pincel:**
   ```glsl
   vec2 delta = canvasPx - uPosition;
   vec2 rotatedDelta = vec2(
     delta.x * cos(uRotation) - delta.y * sin(uRotation),
     delta.x * sin(uRotation) + delta.y * cos(uRotation)
   );
   ```

3. **Mapeo a UV del pincel (0-1):**
   ```glsl
   vec2 brushUV = (rotatedDelta / uBrushSize) + 0.5;
   ```

4. **Sampling del pincel** (con clamping a bounds):
   ```glsl
   if (brushUV.x >= 0.0 && brushUV.x <= 1.0 && brushUV.y >= 0.0 && brushUV.y <= 1.0) {
     brushSample = texture2D(uBrush, brushUV);
   }
   ```

5. **Determinación del color del pincel:**
   ```glsl
   if (uUseMaterialMap == 1) {
     // Texture Brush: samplear textura del material activo
     brushColor = texture2D(uMaterialMap, canvasUV).rgb;
   } else {
     // Color sólido
     brushColor = uColor.rgb;
   }
   ```

6. **Alpha compositing** (preserva alpha del destino):
   ```glsl
   float effectiveAlpha = brushAlpha * uColor.a;
   vec3 blendedRGB = mix(canvasSample.rgb, brushColor, effectiveAlpha);
   float blendedAlpha = canvasSample.a + effectiveAlpha * (1.0 - canvasSample.a);
   gl_FragColor = vec4(blendedRGB, blendedAlpha);
   ```

#### Uniforms del Shader

| Uniform | Tipo GLSL | Tipo JS | Origen |
|---------|-----------|---------|--------|
| `uCanvas` | `sampler2D` | `THREE.Texture` | IntermediateRT.texture |
| `uBrush` | `sampler2D` | `THREE.Texture` | `brush.getTexture()` |
| `uMaterialMap` | `sampler2D` | `THREE.Texture` | `activeMaterial._paintCanvas.getTexture()` |
| `uUseMaterialMap` | `int` | `Number (0\|1)` | `Painter._textureBrushMode` |
| `uCanvasSize` | `vec2` | `THREE.Vector2` | Resolución del PaintCanvas |
| `uBrushSize` | `vec2` | `THREE.Vector2` | Tamaño del pincel en px |
| `uPosition` | `vec2` | `THREE.Vector2` | Centro del stamp en px |
| `uRotation` | `float` | `Number` | Rotación en radianes |
| `uOpacity` | `float` | `Number` | Opacidad (0-1) |
| `uColor` | `vec4` | `THREE.Vector4` | Color en espacio linear |

### 9.4 PaintCanvas.js

**Archivo:** `src/renderer/painting/PaintCanvas.js`  
**Rol:** RenderTarget por material. Cada material del modelo tiene su propio PaintCanvas independiente.

#### Configuración del RenderTarget

```js
new THREE.WebGLRenderTarget(resolution, resolution, {
  format: THREE.RGBAFormat,
  type: THREE.UnsignedByteType,
  minFilter: THREE.NearestFilter,     // Sin interpolación (pintura pixel-perfect)
  magFilter: THREE.NearestFilter,
  wrapS: THREE.ClampToEdgeWrapping,
  wrapT: THREE.ClampToEdgeWrapping,
  depthBuffer: false,                  // No necesita depth
  stencilBuffer: false,                // No necesita stencil
  colorSpace: THREE.SRGBColorSpace     // CRÍTICO: framebuffer sRGB
});
```

**Resolución por defecto:** 2048×2048 (configurable: 1024, 2048, 4096, 8192).

#### Métodos

| Método | Descripción |
|--------|-------------|
| `initFromTexture(renderer, sourceTexture)` | Blitea una textura fuente al RT usando `MeshBasicMaterial` con `toneMapped: false` |
| `getImageData(renderer)` | Lee píxeles del GPU vía `readRenderTargetPixels()` → `ImageData` |
| `setImageData(imageData, renderer)` | Crea `DataTexture` desde ImageData, blitea al RT |
| `cloneTextureData(renderer)` | Copia textura para undo states |
| `setResolution(resolution)` | Cambia resolución (dispose + reinit) |
| `dispose()` | Libera el RT |

### 9.5 Texture Brush Mode

El modo **Texture Brush** (activado por defecto) permite pintar usando la **textura del material seleccionado** como "tinta" en lugar de un color sólido.

#### Funcionamiento

1. El checkbox "Paint with Material Texture" en BrushPanel emite `BRUSH_TEXTURE_MODE_CHANGED`
2. `Painter._textureBrushMode` se actualiza
3. En `stamp()`:
   - Si `_textureBrushMode === true` Y `_activeMaterial._paintCanvas` NO es el mismo que el `paintCanvas` del material golpeado:
     - `uMaterialMap.value = _activeMaterial._paintCanvas.getTexture()`
     - `uUseMaterialMap.value = 1`
   - Si no:
     - `uMaterialMap.value = null`
     - `uUseMaterialMap.value = 0`
4. El shader usa `texture2D(uMaterialMap, canvasUV).rgb` como color del pincel

#### Guard de Feedback Loop

```js
const canUseTextureMode = this._textureBrushMode &&
  this._activeMaterial &&
  this._activeMaterial._paintCanvas &&
  this._activeMaterial._paintCanvas !== paintCanvas;  // ← Compara _paintCanvas, no referencias de material
```

**Motivo:** Si el material activo y el material golpeado comparten el mismo `_paintCanvas`, leer y escribir la misma textura en un mismo draw call causa un **WebGL feedback loop** (comportamiento indefinido). La comparación se hace a nivel de `_paintCanvas` (no a nivel de `THREE.Material`) para cubrir el caso de clones de GLTFLoader.

#### UX del Color Picker

- En modo Texture Brush: el color picker se atenúa (`opacity: 0.3`, `pointer-events: none`) indicando que el color sólido está inactivo.
- En modo Color: el color picker se muestra completamente funcional.

### 9.6 Brush.js

**Archivo:** `src/renderer/painting/Brush.js`  
**Rol:** Datos del pincel.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `_name` | `string` | Nombre identificador |
| `_imageData` | `ImageData` | Datos de píxeles (Canvas 2D) |
| `_texture` | `THREE.DataTexture` | Textura GPU: RGBA8, UnsignedByte, SRGBColorSpace, NearestFilter, ClampToEdge, flipY:true |
| `_size` | `number` | Tamaño en px (0-∞, clamp interno a 1px mínimo) |
| `_opacity` | `number` | 0.00-1.00 (redondeo a 2 decimales) |
| `_rotation` | `number` | 0-360° (almacenada en radianes) |

### 9.7 UVAnalyzer.js

**Archivo:** `src/renderer/core/UVAnalyzer.js`  
**Rol:** Análisis de coordenadas UV para mapear entre espacio UV y píxeles del canvas.

#### Métodos

- **`analyzeMaterial(meshes, material)`**: Analiza TEXCOORD_0 solo de las mallas que usan ESE material específico. Devuelve `{ uMin, uMax, vMin, vMax }`.
- **`analyzeAllMeshes(meshes)`**: Analiza UV bounds de TODAS las mallas (para materiales nuevos sin asignar).
- **`uvToCanvas(u, v, bounds, resolution)`**: `canvasX = ((u - uMin) / (uMax - uMin)) * resolution`
- **`canvasToUv(cx, cy, bounds, resolution)`**: Inversa.

**Soporte multi-material:** Usa `geometry.groups[materialIndex]` para filtrar vértices de una geometría que pertenecen a un material específico.

**Rangos de UV:** Los UV pueden ser cualquier rango (negativos, >1, típicamente -10 a +10). El mapeo al canvas normaliza estos rangos al espacio [0, resolution].

---

## 10. Renderer — Sistema de Materiales

### 10.1 MaterialManager.js

**Archivo:** `src/renderer/materials/MaterialManager.js`  
**Rol:** Registro central de materiales, creación de PaintCanvases, y gestión de texturas para exportación.

#### Flujo al cargar un modelo

1. `MODEL_LOADED` → `_onModelLoaded(data)`
2. Para cada material en `data.materials`:
   - `_registerMaterial(material, meshes)`:
     1. Analiza UV bounds (`UVAnalyzer.analyzeMaterial`)
     2. Crea PaintCanvas (`DEFAULT_CANVAS_RESOLUTION = 2048`)
     3. Si `material.map` existe → `paintCanvas.initFromTexture(renderer, material.map)`
     4. Si no → `initCanvasFromColor(paintCanvas, material.color)` (conversión linear→sRGB)
     5. Asigna `material.map = paintCanvas.getTexture()`
     6. Almacena referencias: `material._paintCanvas`, `material._uvBounds`, `material._painted = false`
     7. `material.needsUpdate = true`

#### initCanvasFromColor(paintCanvas, color)

1. Convierte el color de Three.js (linear) a sRGB: `color.clone().convertLinearToSRGB()`
2. Crea un canvas 2D 64×64 y lo rellena con `fillStyle = hexColor`
3. Crea `DataTexture` (RGBA8, UnsignedByte, SRGBColorSpace)
4. Blitea la DataTexture al PaintCanvas

> **Fix crítico (Bug #8):** `color.getHexString()` asume sRGB pero Three.js `Color` es linear. La conversión `convertLinearToSRGB()` antes de `getHexString()` evita el doble encoding (canvas 2D ya es sRGB y la DataTexture se marca SRGBColorSpace).

#### createNewMaterial(name)

1. Crea `MeshPhysicalMaterial` con `PBRMaterial.createDefault(name)`
2. Analiza UV bounds de todas las mallas (`analyzeAllMeshes`)
3. Crea PaintCanvas y lo inicializa con color blanco
4. Emite `MATERIAL_CREATED`

#### collectPaintTextures()

Para cada material marcado como `_painted`:
1. Lee píxeles del GPU: `paintCanvas.getImageData(renderer)`
2. Crea `DataTexture` desde ImageData
3. `texture.flipY = false` (CRÍTICO para exportación)
4. Devuelve array de `{ material, texture, imageData }`

#### setCanvasResolution(material, resolution)

Cambia la resolución del PaintCanvas de un material. Valida contra `CANVAS_RESOLUTIONS`.

### 10.2 PBRMaterial.js

**Archivo:** `src/renderer/materials/PBRMaterial.js`  
**Rol:** Factory de `MeshPhysicalMaterial`.

Usa `MeshPhysicalMaterial` (NO `MeshStandardMaterial`) para soportar `specularIntensity`/`specularColor` en exportación vía `KHR_materials_specular`.

- **`createDefault(name)`**: Blanco `#ffffff`, roughness 1.0, metalness 0.0, specularIntensity 1.0
- **`createFromExisting(material)`**: Clona un material existente

### 10.3 MaterialModal.js

**Archivo:** `src/renderer/materials/MaterialModal.js`  
**Rol:** Modal HTML para crear y editar materiales PBR.

#### Campos del modal

| Campo | Tipo | Prioridad |
|-------|------|-----------|
| Nombre | `string` | — |
| Albedo | Color picker + textura PNG | **Textura > Color** |
| Normal | Textura PNG | — |
| Displacement | Textura PNG | Preview only, **NO exportado** |
| AO | Textura PNG | — |
| Specular | Textura PNG o valor numérico | **Textura > Numérico** |
| Roughness | Textura PNG o slider 0-1 | **Textura > Numérico** |
| Metalness | Textura PNG o slider 0-1 | **Textura > Numérico** |

#### Re-inicialización del PaintCanvas

Cuando se cambia el albedo de un material (color o textura), `index.js:_applyMaterialData()` re-inicializa el PaintCanvas:
- Si hay nueva textura: `paintCanvas.initFromTexture(renderer, material.map)`
- Si es color sólido: `materialManager.initCanvasFromColor(paintCanvas, material.color)`

Esto resetea el canvas de pintura al nuevo aspecto base.

---

## 11. Renderer — Sistema de Decals

### 11.1 DecalManager.js

**Archivo:** `src/renderer/decals/DecalManager.js`  
**Rol:** Ciclo de vida completo de decals.

- Los decals se almacenan en un contenedor dedicado (`_decalsContainer`) como hijos de la escena, **NO como hijos de meshes**.
- Métodos: `createDecal()`, `selectDecal()`, `deleteSelectedDecal()`, `raycastDecalSprites()`
- Emite eventos: `DECAL_CREATED`, `DECAL_DELETED`, `DECAL_SELECTED`, `DECAL_DESELECTED`

### 11.2 DecalProjector.js

**Archivo:** `src/renderer/decals/DecalProjector.js`  
**Rol:** Colocación de decals mediante HTML5 Drag & Drop.

1. El usuario arrastra un decal desde el panel inferior
2. `dragover` → `preventDefault()` para permitir el drop
3. `drop` → convierte `clientX/clientY` a NDC usando `canvas.getBoundingClientRect()`
4. Raycast a todas las mallas de la escena
5. Coloca `DecalGeometry` en el punto de impacto, alineado a la superficie

### 11.3 DecalGizmo.js

**Archivo:** `src/renderer/decals/DecalGizmo.js`  
**Rol:** Gizmo de transformación para decals seleccionados.

- **W:** Translate
- **E:** Rotate
- **R:** Scale
- Solo activo cuando hay un decal seleccionado (sin interferencia con la cámara)
- Gizmo alineado a la normal de la superficie (cálculos en `decal-math.worker.js`)
- Sin decal seleccionado → TransformControls deshabilitado

### 11.4 DecalSprite.js

**Archivo:** `src/renderer/decals/DecalSprite.js`  
**Rol:** Indicadores 2D (sprites) en el viewport para cada decal.

- Click en un sprite → selecciona el decal
- El toggle "Eye" en TopBar controla su visibilidad (solo sprites, los decals siguen visibles)

---

## 12. Renderer — UI y Paneles

### 12.1 Diseño General

La UI usa **vanilla DOM/CSS** con tema oscuro definido en `styles.css` mediante CSS custom properties. El layout es:

```
┌─────────────────────────────────────────────┐
│ TopBar: Size | Opacity | Rotation | Eye 👁   │
├──────┬──────────────────────────────────────┤
│      │                                       │
│ Mat  │         VIEWPORT 3D                   │
│ Panel│         (WebGL Canvas)                │
│      │                                       │
│      │                                       │
├──────┴──────────────────────────────────────┤
│ BrushPanel / DecalPanel (tabs)              │
│ [Brushes Grid] [+ Import] [Color] [TexMode] │
└─────────────────────────────────────────────┘
```

### 12.2 UIManager.js

**Archivo:** `src/renderer/ui/UIManager.js`  
**Rol:** Orquestación de todos los paneles. Inicializa TopBar, BrushPanel, DecalPanel, MaterialPanel, y conecta los botones de la barra superior (Open, Export, Undo, Redo, New Material).

### 12.3 BrushPanel.js

**Archivo:** `src/renderer/ui/BrushPanel.js`  
**Rol:** Panel inferior con gestión de pinceles.

#### Componentes

- **Grid de pinceles:** Thumbnails generados desde ImageData con Canvas 2D. Click para seleccionar.
- **Botón Import:** Abre diálogo para PNG, valida que sea grayscale (±2 tolerancia en RGB).
- **Conversión grayscale→alpha:** Si un pincel PNG no tiene canal alpha, se deriva de luminancia (R = alpha). Blanco → opaco, negro → transparente.
- **Checkbox "Paint with Material Texture":** Toggle Texture Brush mode (default: checked).
- **Color picker:** `<input type="color">` que emite `BRUSH_COLOR_CHANGED`. Se atenúa en modo Texture Brush.

#### Pinceles por defecto

- **"Soft Circle":** 256×256, gradiente radial blanco centro → transparente borde.
- **"Glow":** 256×256, centro opaco, borde suave transparente.
- Generados proceduralmente con Canvas 2D en `ProceduralAssets.js`.

### 12.4 MaterialPanel.js

**Archivo:** `src/renderer/ui/MaterialPanel.js`  
**Rol:** Panel izquierdo con lista de materiales.

- Click: Selecciona material para pintar (emite `MATERIAL_SELECTED`)
- Doble-click: Abre modal de edición (emite `ui:showEditMaterialModal`)
- Muestra miniatura de la textura y nombre

### 12.5 TopBar.js

**Archivo:** `src/renderer/ui/TopBar.js`  
**Rol:** Controles superiores.

| Control | Interacción | Evento |
|---------|-------------|--------|
| Size | Slider + input numérico | `BRUSH_SIZE_CHANGED` |
| Opacity | Slider + input numérico (0.00-1.00) | `BRUSH_OPACITY_CHANGED` |
| Rotation | Slider + input numérico (0-360) | `BRUSH_ROTATION_CHANGED` |
| Eye | Toggle | `DECAL_EYE_TOGGLED` |

### 12.6 DecalPanel.js

**Archivo:** `src/renderer/ui/DecalPanel.js`  
**Rol:** Panel inferior con botones de decals + importar PNG. Misma validación grayscale que BrushPanel.

---

## 13. Renderer — Sistema de Eventos

**Archivo:** `src/renderer/utils/EventBus.js`  
**Rol:** Pub/sub central para comunicación entre módulos.

### API

- `on(event, callback)`: Suscribirse
- `off(event, callback)`: Desuscribirse
- `emit(event, data)`: Emitir (callbacks ejecutados síncronamente en orden de registro)

### Catálogo completo de eventos

**Archivo:** `src/renderer/utils/Constants.js` → `EVENTS`

#### Materiales
| Evento | Emisor | Consumidores | Descripción |
|--------|--------|-------------|-------------|
| `material:selected` | MaterialPanel | Painter | Material clickeado |
| `material:updated` | Index (tras modal) | MaterialPanel | Material editado |
| `material:created` | MaterialManager | MaterialPanel | Nuevo material |
| `material:deleted` | — | — | Material eliminado |
| `material:setResolution` | UI | MaterialManager | Cambiar resolución |

#### Pinceles
| Evento | Emisor | Consumidores | Descripción |
|--------|--------|-------------|-------------|
| `brush:selected` | BrushPanel | Painter | Pincel seleccionado |
| `brush:sizeChanged` | TopBar + Index (Ctrl+wheel) | Painter | Tamaño |
| `brush:opacityChanged` | TopBar + Index (Shift+wheel) | Painter | Opacidad |
| `brush:rotationChanged` | TopBar + Index (Alt+wheel) | Painter | Rotación |
| `brush:colorChanged` | BrushPanel | Painter | Color sólido |
| `brush:textureModeChanged` | BrushPanel | Painter | Texture Brush toggle |

#### Decals
| Evento | Emisor | Consumidores | Descripción |
|--------|--------|-------------|-------------|
| `decal:selected` | DecalManager | Index, DecalGizmo | Decal seleccionado |
| `decal:deselected` | DecalManager | Index, DecalGizmo | Decal deseleccionado |
| `decal:created` | DecalManager | UndoRedo | Decal creado |
| `decal:deleted` | DecalManager | UndoRedo | Decal eliminado |
| `decal:transformed` | DecalGizmo | UndoRedo | Gizmo aplicado |
| `decal:eyeToggled` | TopBar | DecalManager | Visibilidad sprites |
| `decal:dragStart` | DecalPanel | DecalProjector | Inicio drag |
| `decal:drop` | DecalProjector | DecalManager | Drop completado |

#### Modelo
| Evento | Emisor | Consumidores | Descripción |
|--------|--------|-------------|-------------|
| `model:loaded` | SceneManager | MaterialManager, CameraSwitcher, Index | GLB cargado |
| `model:exported` | Index | — | GLB exportado |

#### Pintura
| Evento | Emisor | Consumidores | Descripción |
|--------|--------|-------------|-------------|
| `paint:strokeStart` | — | — | Inicio trazo |
| `paint:strokeEnd` | — | — | Fin trazo |
| `paint:strokeApplied` | Painter | UndoRedo, Index | Stamp completado |

#### Escena
| Evento | Emisor | Consumidores | Descripción |
|--------|--------|-------------|-------------|
| `scene:dirty` | Painter, DecalGizmo | — | Marca dirty flag |
| `canvas:updated` | — | — | Canvas modificado |

#### UI / App
| Evento | Emisor | Consumidores | Descripción |
|--------|--------|-------------|-------------|
| `app:openGLB` | UIManager | Index | Botón Open |
| `app:exportGLB` | UIManager | Index | Botón Export |
| `app:undo` | UIManager | Index | Botón Undo |
| `app:redo` | UIManager | Index | Botón Redo |
| `ui:showNewMaterialModal` | UIManager | Index | Crear material |
| `ui:showEditMaterialModal` | MaterialPanel | Index | Editar material |
| `camera:modeChanged` | CameraSwitcher | UI | Cambio cámara |
| `undo:stateCreated` | UndoRedo | — | Nuevo estado |

---

## 14. Renderer — Undo/Redo

**Archivo:** `src/renderer/utils/UndoRedo.js`  
**Rol:** Pila de estados para deshacer/rehacer operaciones.

### Capacidad

- **Máximo:** 100 estados (FIFO — descarta el más antiguo al exceder).
- **Atajos:** Ctrl+Z undo, Ctrl+Y redo.

### Tipos de estados

| Tipo | Datos almacenados | Restauración |
|------|------------------|-------------|
| `paint` | `{ material, textureData: ImageData }` | `paintCanvas.setImageData(textureData, renderer)` — reemplaza el RT completo |
| `decal_create` | `{ decal: DecalEntry }` | Elimina el decal creado |
| `decal_delete` | `{ decal: DecalEntry }` | Re-crea el decal eliminado |

### Flujo para paint strokes

1. `PAINT_STROKE_APPLIED` → `index.js:_bindUndoRedo()`
2. Clona textura: `material._paintCanvas.cloneTextureData(engine.renderer)` → `Uint8Array`
3. Crea `ImageData` y pushea al stack

### Worker de snapshots

`undo-snapshot.worker.js` clona ImageData asíncronamente para no bloquear el hilo principal durante operaciones de undo/redo con texturas grandes.

---

## 15. Renderer — Workers

### 15.1 brush-processor.worker.js

**Rol:** Validación y procesamiento de PNGs para brushes y decals.

- Recibe `ArrayBuffer` vía `postMessage`
- Crea `ImageBitmap` con `createImageBitmap()`
- Valida que la imagen sea efectivamente grayscale (±2 tolerancia en RGB)
- Aplica conversión grayscale→alpha si no hay canal alpha nativo
- Devuelve `ImageBitmap` procesado

### 15.2 undo-snapshot.worker.js

**Rol:** Clonado asíncrono de `ImageData` para undo states.

- Evita bloquear el hilo principal con texturas de 2048×2048 (16 MB).

### 15.3 decal-math.worker.js

**Rol:** Cálculos matemáticos para gizmos de decals.

- Calcula matrices de proyección
- Calcula alineación del gizmo a la normal de la superficie
- Garantiza que el gizmo no se voltee en superficies anguladas

### 15.4 Comunicación Renderer ↔ Worker

Los workers son **ES Modules**:
```js
new Worker(new URL('./workers/brush-processor.worker.js', import.meta.url), { type: 'module' });
```

Los `ArrayBuffer` se transfieren con transferables para máximo rendimiento:
```js
worker.postMessage({ buffer }, [buffer]);
```

Los workers **NO** pueden acceder a `window.electronAPI` ni a APIs de Electron.

---

## 16. Renderer — Utilidades

### 16.1 Constants.js

**Archivo:** `src/renderer/utils/Constants.js`

| Constante | Valor |
|-----------|-------|
| `CANVAS_RESOLUTIONS` | `[1024, 2048, 4096, 8192]` |
| `DEFAULT_CANVAS_RESOLUTION` | `2048` |
| `MAX_UNDO_STATES` | `100` |
| `DEFAULT_BRUSH_SIZE` | `50` |
| `DEFAULT_BRUSH_OPACITY` | `1.0` |
| `DEFAULT_BRUSH_ROTATION` | `0` |
| `BRUSH_SIZE_MIN` | `0` |
| `CAMERA_MODES` | `{ ORBIT: 'orbit', FREE: 'free' }` |
| `DECAL_GIZMO_MODES` | `{ TRANSLATE: 'translate', ROTATE: 'rotate', SCALE: 'scale' }` |
| `EVENTS` | Objeto con todos los nombres de eventos (ver sección 13) |

### 16.2 FileIO.js

**Archivo:** `src/renderer/utils/FileIO.js`  
**Rol:** Wrapper limpio de `window.electronAPI.*`.

**Regla estricta:** NUNCA usa `fs`, `dialog`, o `ipcRenderer` directamente. Solo llama a los métodos expuestos por el preload script.

```js
// ✅ Correcto
const result = await FileIO.openGLB();

// ❌ Incorrecto (nunca en el renderer)
const fs = require('fs');
```

### 16.3 ProceduralAssets.js

**Archivo:** `src/renderer/utils/ProceduralAssets.js`  
**Rol:** Genera assets por defecto con Canvas 2D.

- `createBrushSoftCircle()`: Canvas 256×256, gradiente radial `createRadialGradient`
- `createBrushGlow()`: Canvas 256×256, centro opaco, parada 0.2 semitransparente, borde transparente
- `createDecalGradient()`: Canvas 256×256, gradiente linear negro→blanco
- `canvasToImageData(canvas)`: Convierte canvas a ImageData

### 16.4 InputManager.js

**Archivo:** `src/renderer/core/InputManager.js`

| Método | Descripción |
|--------|-------------|
| `isMouseButtonDown(button)` | Estado actual del botón (0, 1, 2) |
| `wasMouseButtonPressed(button)` | Presionado en este frame |
| `getNDC(canvas)` | `clientX/clientY` → NDC (-1 a 1) |
| `isMouseOverCanvas(canvas)` | `getBoundingClientRect()` |
| `getWheel()` | Delta de wheel acumulado |
| `isKeyDown(key)` | Estado actual de tecla |
| `wasKeyPressed(key)` | Presionada en este frame |
| `endFrame()` | Resetea justPressed/justReleased/wheel |

---

## 17. Sistema de Build y Empaquetado

### 17.1 Scripts (package.json)

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Dev server (Vite HMR) + Electron |
| `pnpm build` | Build de producción → `out/` |
| `pnpm preview` | Preview del build |
| `pnpm dist` | Build + empaquetado NSIS → `dist/` |

### 17.2 electron-vite

**Archivo:** `electron.vite.config.js`

Configura tres entradas de build:

```js
export default defineConfig({
  main: {
    build: { outDir: 'out/main', rollupOptions: { input: 'src/main/main.js' } }
  },
  preload: {
    build: { outDir: 'out/preload', rollupOptions: { input: 'src/preload/preload.js' } }
  },
  renderer: {
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: 'src/renderer/index.html' },
      worker: { format: 'es' }   // ES Module Workers
    }
  }
});
```

### 17.3 electron-builder

**Configuración en `package.json`:**

```json
{
  "build": {
    "appId": "com.meshpaint.app",
    "productName": "MeshPaint",
    "directories": { "output": "dist" },
    "files": ["out/**/*", "package.json"],
    "win": { "target": "nsis" },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

**Archivos generados:**
- `dist/MeshPaint Setup 1.0.0.exe` — Instalador NSIS
- `dist/win-unpacked/MeshPaint.exe` — App portable

### 17.4 pnpm y Build Scripts

pnpm 11.5 bloquea por defecto los scripts de build de dependencias. `electron-winstaller` (dependencia de electron-builder) requiere aprobación:

```bash
pnpm approve-builds --all   # Aprueba todos los scripts pendientes (no interactivo)
pnpm dist                   # Build + empaquetado
```

Alternativamente, `pnpm-workspace.yaml` y `.npmrc` configuran `onlyBuiltDependencies` para autorizar automáticamente `electron`, `electron-winstaller`, y `esbuild`.

---

## 18. Exportación GLB

**Archivos:** `src/renderer/core/SceneManager.js`, `src/renderer/index.js`

### Flujo de exportación

1. **Recolectar texturas pintadas:** `materialManager.collectPaintTextures()` lee los píxeles de GPU de cada PaintCanvas marcado como `_painted`.

2. **Crear DataTextures temporales:**
   - Formato: RGBA8, UnsignedByte
   - `flipY = false` (CRÍTICO — corrige la orientación para GLTFExporter)
   - `needsUpdate = true`

3. **Asignar texturas a materiales:**
   - Se guardan los `material.map` originales
   - Se asignan las DataTextures temporales

4. **Ocultar elementos no exportables:**
   - Displacement maps: se eliminan temporalmente (preview-only)
   - Decals container: `visible = false` (editor-only)

5. **Exportar con GLTFExporter:**
   ```js
   GLTFExporter.parse(scene, { binary: true, embedImages: true })
   ```

6. **Restaurar estado original:**
   - `material.map` originales
   - Displacement maps
   - Decals container visible

7. **Guardar archivo:**
   - `FileIO.saveGLB(arrayBuffer)` → diálogo nativo de guardado

### Lo que se exporta

- ✅ Geometría original (vértices, normales, UVs)
- ✅ Texturas de materiales pintadas
- ✅ Materiales PBR con sus canales (albedo, normal, roughness, metalness, specular, AO)
- ✅ `KHR_materials_specular` (gracias a MeshPhysicalMaterial)

### Lo que NO se exporta

- ❌ Decals (editor-only)
- ❌ Displacement maps (preview-only)
- ❌ Iluminación de la escena
- ❌ Cámaras

---

## 19. Formato y Validación de Archivos

### 19.1 Modelos

- **Formato:** GLB (Binary glTF 2.0) exclusivamente
- **Compresión:** Draco (decodificador cargado desde `gstatic.com/draco/versioned/decoders/1.5.7/`)
- **Soporte:** Multi-mesh, multi-material, texturas embebidas

### 19.2 Texturas, Pinceles y Decals

- **Formato:** PNG exclusivamente

### 19.3 Validación por caso de uso

| Uso | Validación | Error |
|-----|-----------|-------|
| **Pinceles** | DEBE ser grayscale o grayscale+alpha. Tolerancia: `abs(R-G) <= 2 && abs(G-B) <= 2` en toda la imagen | "Brushes must be grayscale PNG" |
| **Decals** | Misma validación que pinceles | "Decals must be grayscale PNG" |
| **Texturas de material** | CUALQUIER formato (grayscale, RGB, RGBA). Sin rechazo. | — |

### 19.4 Conversión Grayscale→Alpha

Si un brush o decal pasa la validación grayscale pero NO tiene canal alpha (todos los valores alpha son 255):

1. Se deriva alpha de la luminancia: `alpha = R` (R, G, y B son iguales por ser grayscale)
2. Blanco (255) → completamente opaco
3. Negro (0) → completamente transparente
4. Los canales RGB se ponen a blanco (255)

Esto permite usar PNGs sin transparencia nativa como pinceles con bordes suaves.

---

## 20. Atajos de Teclado y Ratón

### Teclado

| Atajo | Acción |
|-------|--------|
| `Tab` | Alternar cámara Orbit/Free |
| `W` | Gizmo: Translate (con decal seleccionado) |
| `E` | Gizmo: Rotate (con decal seleccionado) |
| `R` | Gizmo: Scale (con decal seleccionado) |
| `Delete` / `Backspace` | Eliminar decal seleccionado |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

### Ratón

| Interacción | Acción |
|-------------|--------|
| `Click izquierdo` | Pintar (con brush seleccionado) / Seleccionar decal sprite |
| `Click derecho + arrastrar` | Orbitar cámara (modo Orbit) / Mirar alrededor (modo Free) |
| `Wheel` | Zoom |
| `Ctrl+Wheel` | Cambiar tamaño del pincel (±5px) |
| `Shift+Wheel` | Cambiar opacidad del pincel (±0.05) |
| `Alt+Wheel` | Cambiar rotación del pincel (±5°) |

### Movimiento Free Camera

| Tecla | Movimiento |
|-------|-----------|
| `W` | Adelante |
| `A` | Izquierda |
| `S` | Atrás |
| `D` | Derecha |
| `Q` | Abajo |
| `E` | Arriba |

---

## 21. Historial de Bugs y Fixes

> **Documentación completa:** [`docs/bugs-fixes.md`](./bugs-fixes.md)

### Bugs críticos resueltos

| # | Bug | Causa raíz | Fix |
|---|-----|-----------|-----|
| #1 | Stamp no renderizaba nada | Cámara ortográfica en z=1 con near=-1, far=1 causaba z-clipping del quad en z=0 | `position.z = 0` |
| #7 | Modelo se veía blanco/gris sin textura | `material.map` no asignado al cargar | `material.map = paintCanvas.getTexture()` |
| #9 | Pinceladas invisibles | `AmbientLight(Math.PI * 2)` blanqueaba todo | Reducido a 1.5 + DirectionalLight 0.5 |
| #10 | Colores incorrectos en RT | RT sin `colorSpace: SRGBColorSpace` | Añadido al constructor |
| #13 | Todo pintado salía negro (#1) | Blit materials sin `toneMapped: false` → ACESFilmicToneMapping aplicado repetidamente | `toneMapped: false` |
| #14 | Todo pintado salía negro (#2) | `_blitMaterial.map` asignado sin `needsUpdate = true` → shader ignoraba la textura | `needsUpdate = true` condicional |
| #16 | WebGL feedback loop | Texture Brush leía y escribía mismo RT | Guard `_paintCanvas !== paintCanvas` |

### Lecciones aprendidas clave

1. **`colorSpace: SRGBColorSpace` en WebGLRenderTarget** es obligatorio para consistencia de color.
2. **`toneMapped: false` en MeshBasicMaterial** evita que ACESFilmicToneMapping oscurezca texturas en blits.
3. **`needsUpdate = true` al asignar `map` dinámicamente** fuerza a Three.js a recompilar el shader con `USE_MAP`.
4. **Comparar `_paintCanvas` en lugar de referencias de material** cubre clones de GLTFLoader.
5. **Frame skip ANTES del raycast** ahorra tanto CPU como GPU.

---

## 22. Glosario Técnico

| Término | Definición |
|---------|-----------|
| **PaintCanvas** | `WebGLRenderTarget` por material que almacena la textura pintada. Resolución 2048×2048 por defecto. |
| **Stamp** | Operación atómica de pintura: blit → shader → render. Una "pincelada" individual. |
| **Texture Brush** | Modo de pintura que usa la textura de un material como "tinta" en lugar de un color sólido. |
| **Intermediate RT** | RenderTarget intermedio usado como ping-pong buffer para evitar WebGL feedback loops. |
| **Blit** | Copia de una textura a un RenderTarget usando `MeshBasicMaterial` y cámara ortográfica. |
| **Dirty Rendering** | Técnica de optimización: solo se renderiza la escena cuando `_dirty === true`. |
| **Dual rAF** | Dos bucles `requestAnimationFrame` independientes: Engine (render) + Index (input/lógica). |
| **Frame Skip** | Countdown en `tryPaint()` que salta frames para reducir carga de CPU/GPU (pinta 1 de cada 2). |
| **Feedback Loop** | Error de WebGL al leer y escribir la misma textura en un mismo draw call. Se evita con el intermediate RT. |
| **UV Bounds** | Rango `{uMin, uMax, vMin, vMax}` de coordenadas UV de un material, usado para mapear UV→canvas. |
| **MeshPhysicalMaterial** | Material PBR de Three.js con soporte para specular, clearcoat, sheen. Usado en lugar de MeshStandardMaterial. |
| **NSIS** | Nullsoft Scriptable Install System — formato de instalador para Windows. |
| **Draco** | Compresión de geometría 3D de Google. Los modelos GLB pueden usar Draco para reducir tamaño. |
| **GLTF 2.0** | Formato estándar de transmisión 3D (GL Transmission Format). Binary (.glb) para archivo único. |
| **KHR_materials_specular** | Extensión de glTF para specular color/intensity en PBR. Soportada por MeshPhysicalMaterial. |
| **contextBridge** | API de Electron que expone métodos seguros del preload al renderer sin exponer Node.js. |
| **ES Module Worker** | Worker inicializado con `{ type: 'module' }`, permite `import` dentro del worker. |

---

> **Fin del documento.**  
> MeshPaint v1.0.0 — Documento de Definición Completa  
> Julio 2026
