# Pipeline de Pintado - Paso a Paso

## Visión General

El pipeline de pintado transforma un clic del ratón en una pincelada visible sobre el modelo 3D. Consta de 7 etapas:

```
Click → Frame Skip → Raycast → Filtrado Material → UV Mapping → Stamp (GPU) → Material Update → Render
```

## Etapa 1: Detección de Input

**Archivo**: `index.js` → `_startLoop()`

```js
const mouseDown = this.inputManager.isMouseButtonDown(0);
const hasBrush = !!this.painter.getActiveBrush();
const shouldPaint = mouseDown && hasBrush;
```

Si `shouldPaint = true` y el gizmo de decals no está arrastrando, se llama a `painter.tryPaint()`.

## Etapa 2: Frame Skip (Countdown)

**Archivo**: `Painter.js` → `tryPaint()` (al inicio)

Para evitar saturar CPU/GPU con raycasts y renders fullscreen cada frame, se implementa un **frame skip con countdown**:

```js
if (this._stampFrameCounter > 0) {
  this._stampFrameCounter--;
  return;  // Salta este frame (NO hace raycast ni stamp)
}
this._stampFrameCounter = this._stampFrameSkip;
// Continúa con raycast y stamp
```

- `_stampFrameSkip = 1` → pinta 1 de cada 2 frames (~30 FPS de pintura)
- El contador se resetea a 0 cuando:
  - El ratón se suelta (`resetStampPosition()` llamado desde `index.js`)
  - El raycast no encuentra hits (ratón fuera del mesh)
- **El frame skip va ANTES del raycast**, ahorrando tanto CPU (raycast) como GPU (render)

## Etapa 3: Raycast

**Archivo**: `Painter.js` → `tryPaint()` (después del frame skip)

1. Obtiene coordenadas NDC del ratón (`inputManager.getNDC(canvas)`)
2. Configura el raycaster desde la cámara activa
3. Intersecta contra todas las mallas de la escena

```js
const ndc = inputManager.getNDC(canvas);
this._raycaster.setFromCamera(ndc, this.engine.camera);
const hits = this._raycaster.intersectObjects(meshes, false);
```

### Guardas (early returns):
- Sin pincel activo (`_activeBrush`)
- Sin mallas en la escena
- Ratón fuera del canvas (`isMouseOverCanvas`)
- Sin hits → resetea `_lastStampUV` y `_stampFrameCounter`

## Etapa 4: Filtrado por Material

**Archivo**: `Painter.js` → `tryPaint()` (continuación)

Se determina qué material fue golpeado en la cara impactada por el rayo:

```js
const hit = hits[0];
let hitMaterial;
if (Array.isArray(hit.object.material)) {
  const matIndex = hit.face ? hit.face.materialIndex : 0;
  hitMaterial = hit.object.material[matIndex] || hit.object.material[0];
} else {
  hitMaterial = hit.object.material;
}
```

A diferencia de versiones anteriores, el sistema ahora pinta sobre **el material que realmente está en la cara golpeada**, no sobre el material seleccionado. Esto permite:

- Pintar con la textura de un material (vía Texture Brush) sobre otro material
- Mezclar materiales independientemente de las caras

## Etapa 5: UV Mapping

**Archivo**: `Painter.js` → `tryPaint()` (continuación)

### Conversión UV → Canvas:
```js
const canvasPx = UVAnalyzer.uvToCanvas(uv.x, uv.y, uvBounds, resolution);
// canvasPx.x = ((uv.u - uMin) / (uMax - uMin)) * resolution
// canvasPx.y = ((uv.v - vMin) / (vMax - vMin)) * resolution
```

### Distancia mínima entre stamps:
La distancia mínima entre stamps consecutivos es **proporcional al tamaño del pincel**:

```js
const minStampDistance = Math.max(1, brushSize * this._minStampDistanceFactor);
// _minStampDistanceFactor = 0.5
```

Esto garantiza cobertura continua sin importar la resolución del canvas. Para un pincel de 50px, la distancia mínima es 25px.

## Etapa 6: Stamp (GPU)

**Archivo**: `Painter.js` → `stamp()`

### 6a. Blit a Intermedio (Ping-Pong Buffer)

Para evitar **WebGL feedback loops** (leer y escribir la misma textura en un mismo draw call), primero se copia el PaintCanvas actual a un RenderTarget intermedio:

```js
renderer.setRenderTarget(this._intermediateRT);
renderer.render(this._blitScene, this._stampCamera);
```

**Importante**: El `_blitMaterial` (un `MeshBasicMaterial`) se crea **una vez y se cachea** para evitar GC thrashing. Al asignar la textura fuente dinámicamente, se marca `needsUpdate = true` la primera vez para que Three.js recompile el shader con la macro `USE_MAP`:

```js
if (this._blitMaterial.map !== sourceTexture) {
  this._blitMaterial.map = sourceTexture;
  this._blitMaterial.needsUpdate = true;
}
```

El `_blitMaterial` usa `toneMapped: false` para evitar que el ACESFilmicToneMapping del renderer oscurezca progresivamente la textura en cada blit.

### 6b. Configurar Shader

Se configuran los uniforms del `PaintShader`:

| Uniform | Valor | Descripción |
|---------|-------|-------------|
| `uCanvas` | intermediateRT.texture | Canvas actual (copia) |
| `uBrush` | brush.getTexture() | Textura del pincel (256×256, sRGB) |
| `uMaterialMap` | activeMaterial._paintCanvas.getTexture() | Textura del material seleccionado (solo en Texture Brush mode) |
| `uUseMaterialMap` | 0 o 1 | 1 = Texture Brush, 0 = Color sólido |
| `uCanvasSize` | (2048, 2048) | Resolución del canvas (default 2048) |
| `uBrushSize` | (size, size) | Tamaño del pincel en px |
| `uPosition` | (x, y) | Centro del stamp en px |
| `uRotation` | radianes | Rotación del pincel |
| `uOpacity` | 0-1 | Opacidad del pincel |
| `uColor` | (r, g, b, a) | Color de pintura (linear) |

### 6c. Texture Brush Mode

Si el modo Texture Brush está activado (`_textureBrushMode = true`) y el material activo NO comparte el mismo `_paintCanvas` que el material golpeado (para evitar feedback loop), se configura:

```js
uniforms.uMaterialMap.value = this._activeMaterial._paintCanvas.getTexture();
uniforms.uUseMaterialMap.value = 1;
```

Si no:
```js
uniforms.uMaterialMap.value = null;
uniforms.uUseMaterialMap.value = 0;
// El shader usará uColor.rgb como color de pincel
```

### 6d. Renderizar Stamp

```js
renderer.setRenderTarget(paintCanvas.getRenderTarget());
renderer.render(this._stampScene, this._stampCamera);
renderer.setRenderTarget(prevTarget);
```

### Shader GLSL Completo (PaintShader):

```glsl
void main() {
  vec2 canvasUV = vUv;
  vec2 canvasPx = canvasUV * uCanvasSize;

  // Calcular offset del centro del pincel
  vec2 delta = canvasPx - uPosition;

  // Rotar el offset
  vec2 rotatedDelta = vec2(
    delta.x * cos(uRotation) - delta.y * sin(uRotation),
    delta.x * sin(uRotation) + delta.y * cos(uRotation)
  );

  // Mapear a UV del pincel (0-1)
  vec2 brushUV = (rotatedDelta / uBrushSize) + 0.5;

  // Samplear pincel solo si está dentro de sus bounds
  vec4 brushSample = vec4(0.0);
  if (brushUV.x >= 0.0 && brushUV.x <= 1.0 && brushUV.y >= 0.0 && brushUV.y <= 1.0) {
    brushSample = texture2D(uBrush, brushUV);
  }

  float brushAlpha = brushSample.a * uOpacity;

  // Samplear canvas actual
  vec4 canvasSample = texture2D(uCanvas, canvasUV);

  // Determinar color del pincel: textura del material O color sólido
  vec3 brushColor;
  if (uUseMaterialMap == 1) {
    vec4 matSample = texture2D(uMaterialMap, canvasUV);
    brushColor = matSample.rgb;
  } else {
    brushColor = uColor.rgb;
  }

  // Alpha compositing (preserva alpha del destino)
  float effectiveAlpha = brushAlpha * uColor.a;
  vec3 blendedRGB = mix(canvasSample.rgb, brushColor, effectiveAlpha);
  float blendedAlpha = canvasSample.a + effectiveAlpha * (1.0 - canvasSample.a);

  gl_FragColor = vec4(blendedRGB, blendedAlpha);
}
```

## Etapa 7: Actualización del Material

```js
const texture = paintCanvas.getRenderTarget().texture;
const meshes = this.sceneManager.getMeshes();

// Actualizar TODOS los materiales de malla que compartan el mismo paint canvas
// (maneja clones de GLTFLoader que crean diferentes objetos material pero mismo _paintCanvas)
for (const mesh of meshes) {
  const meshMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of meshMats) {
    const sharesPaintCanvas = mat._paintCanvas === paintCanvas;
    if ((mat === targetMaterial || sharesPaintCanvas) && mat.map !== texture) {
      mat.map = texture;
      mat.needsUpdate = true;
    }
  }
}

targetMaterial._painted = true;
this.engine.markDirty();
eventBus.emit(EVENTS.PAINT_STROKE_APPLIED, { material: targetMaterial });
```

## Renderizado Final

El `Engine._startLoop` detecta `_dirty = true` (establecido por `markDirty()`) y renderiza:

```js
this.renderer.render(this.scene, this.camera);
```

La malla usa `MeshPhysicalMaterial` con `map = PaintCanvas RT texture`. Three.js muestrea la textura, aplica iluminación (`AmbientLight(0xffffff, 1.5)` + `DirectionalLight(0xffffff, 0.5)`), y tone mapping (`ACESFilmicToneMapping`, exposure 1.0).

## Diagrama de Flujo Completo

```
Frame N (pintura):
  Engine rAF → render(scene) con estado actual → dirty=false
  
  Index rAF → input → tryPaint()
    → frame skip? (counter > 0? decrement y return)
    → raycast hits mesh ✓
    → filtrado por material de la cara golpeada ✓
    → UV → canvasPx (proporcional a brush size) ✓
    → stamp()
      → blit PaintCanvas → intermediateRT (con toneMapped:false y needsUpdate correcto)
      → configurar uniforms (color o Texture Brush según modo)
      → render stamp shader → PaintCanvas RT
      → actualizar material.map en TODOS los materiales que comparten _paintCanvas
      → markDirty()
      
Frame N+1 (renderizado):
  Engine rAF → dirty=true → render(scene) CON PINCELADA → dirty=false
```

## Formatos y Resoluciones

| Componente | Formato | Color Space | Resolución |
|-----------|---------|-------------|-----------|
| PaintCanvas RT | RGBA8, UnsignedByte | SRGBColorSpace | 2048×2048 (default, configurable: 1024/2048/4096/8192) |
| Intermediate RT | RGBA8, UnsignedByte | SRGBColorSpace | misma que PaintCanvas |
| Brush texture | RGBA8, UnsignedByte | SRGBColorSpace | 256×256 |
| DataTexture (initCanvas) | RGBA8, UnsignedByte | SRGBColorSpace | 64×64 (solid color) |

## Modos de Pintado

### Color Mode (`_textureBrushMode = false`)
- El color se toma del `uColor` uniform (definido por el color picker del panel de pinceles)
- El color picker está completamente visible y funcional
- Útil para pintar colores sólidos, sombras, o detalles

### Texture Brush Mode (`_textureBrushMode = true`, por defecto)
- El color se toma de `uMaterialMap` (textura del PaintCanvas del material seleccionado)
- El color picker se atenúa (opacity 0.3, pointer-events none) indicando que está inactivo
- **Feedback-loop guard**: Si `activeMaterial._paintCanvas === targetPaintCanvas`, el modo textura se desactiva automáticamente para ese stamp
- Útil para mezclar texturas de materiales sobre otros materiales
