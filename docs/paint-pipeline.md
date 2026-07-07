# Pipeline de Pintado - Paso a Paso

## Visión General

El pipeline de pintado transforma un clic del ratón en una pincelada visible sobre el modelo 3D. Consta de 5 etapas:

```
Click → Raycast → UV Mapping → Stamp (GPU) → Material Update → Render
```

## Etapa 1: Detección de Input

**Archivo**: `index.js` → `_startLoop()`
**Condición**: `mouseDown (botón izquierdo) && brush seleccionado`

```js
const mouseDown = this.inputManager.isMouseButtonDown(0);
const hasBrush = !!this.painter.getActiveBrush();
const shouldPaint = mouseDown && hasBrush;
```

Si `shouldPaint = true` y el gizmo de decals no está arrastrando, se llama a `painter.tryPaint()`.

## Etapa 2: Raycast

**Archivo**: `Painter.js` → `tryPaint()`

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
- Sin material activo (`_activeMaterial`)
- Sin PaintCanvas en el material
- Sin UV bounds analizados
- Sin mallas en la escena
- Ratón fuera del canvas (`isMouseOverCanvas`)

## Etapa 3: Filtrado y UV Mapping

**Archivo**: `Painter.js` → `tryPaint()` (continuación)

### Filtrado por material:
Solo se aceptan hits cuya malla use **exactamente el mismo objeto** que `_activeMaterial`:

```js
const validHits = hits.filter(hit => {
    const objMats = Array.isArray(hit.object.material)
        ? hit.object.material : [hit.object.material];
    return objMats.includes(this._activeMaterial);
});
```

### Conversión UV → Canvas:
```js
const canvasPx = UVAnalyzer.uvToCanvas(uv.x, uv.y, uvBounds, resolution);
// canvasPx.x = ((uv.u - uMin) / (uMax - uMin)) * resolution
// canvasPx.y = ((uv.v - vMin) / (vMax - vMin)) * resolution
```

### Anti-aliasing:
Mínimo 5px de distancia entre stamps consecutivos para evitar sobre-escritura.

## Etapa 4: Stamp (GPU)

**Archivo**: `Painter.js` → `stamp()`

### 4a. Blit a Intermedio
Para evitar feedback loops de WebGL, primero se copia el PaintCanvas actual a un RenderTarget intermedio:

```js
renderer.setRenderTarget(this._intermediateRT);
renderer.render(this._blitScene, this._stampCamera);
// BlitScene: full-screen quad con MeshBasicMaterial(map = PaintCanvas texture)
```

### 4b. Configurar Shader
Se configuran los uniforms del PaintShader:

| Uniform | Valor | Descripción |
|---------|-------|-------------|
| `uCanvas` | intermediateRT.texture | Canvas actual (copia) |
| `uBrush` | brush.getTexture() | Textura del pincel (256×256) |
| `uCanvasSize` | (4096, 4096) | Resolución del canvas |
| `uBrushSize` | (size, size) | Tamaño del pincel en px |
| `uPosition` | (x, y) | Centro del stamp en px |
| `uRotation` | radianes | Rotación del pincel |
| `uOpacity` | 0-1 | Opacidad del pincel |
| `uColor` | (r, g, b, a) | Color de pintura (linear) |

### 4c. Renderizar Stamp
```js
renderer.setRenderTarget(paintCanvas.getRenderTarget());
renderer.render(this._stampScene, this._stampCamera);
```

El `_stampScene` contiene un full-screen quad con `PaintShader`. El shader:
1. Convierte la coordenada UV del quad a píxeles del canvas
2. Calcula el offset desde el centro del pincel
3. Aplica rotación
4. Muestrea la textura del pincel
5. Mezcla el color del pincel con el canvas existente (alpha compositing)

### Shader GLSL (PaintShader.fragmentShader):
```glsl
canvasPx = canvasUV * uCanvasSize;
delta = canvasPx - uPosition;           // offset desde centro
rotatedDelta = rotate(delta, uRotation); // rotar
brushUV = rotatedDelta / uBrushSize + 0.5; // mapear a UV 0-1
brushSample = texture2D(uBrush, brushUV);
brushAlpha = brushSample.a * uOpacity;
canvasSample = texture2D(uCanvas, canvasUV);
// Alpha compositing:
blendedRGB = mix(canvasSample.rgb, uColor.rgb, brushAlpha * uColor.a);
blendedAlpha = canvasSample.a + brushAlpha * uColor.a * (1 - canvasSample.a);
gl_FragColor = vec4(blendedRGB, blendedAlpha);
```

## Etapa 5: Actualización del Material

```js
const texture = paintCanvas.getRenderTarget().texture;
this._activeMaterial.map = texture;
this._activeMaterial.needsUpdate = true;
this._activeMaterial._painted = true;
this.engine.markDirty();
```

Como `mesh.material === this._activeMaterial` (mismo objeto), el cambio en `_activeMaterial.map` se refleja inmediatamente en la malla.

## Renderizado Final

El `Engine._startLoop` detecta `_dirty = true` (establecido por `markDirty()`) y renderiza:

```js
this.renderer.render(this.scene, this.camera);
```

La malla usa `MeshPhysicalMaterial` con `map = PaintCanvas RT texture`. Three.js muestrea la textura (SRGBColorSpace → conversión sRGB→linear), multiplica por `material.color` (linear), aplica iluminación (AmbientLight 1.5 + DirectionalLight 0.5), y aplica ACESFilmicToneMapping.

## Diagrama de Flujo Completo

```
Frame N:
  Engine rAF → render(scene) con estado actual → dirty=false
  
  Index rAF → input → tryPaint()
    → raycaster hits mesh ✓
    → material match ✓
    → UV → canvasPx ✓
    → stamp()
      → blit PaintCanvas → intermediateRT
      → render stamp shader → PaintCanvas RT
      → material.map = PaintCanvas RT texture
      → markDirty()
      
Frame N+1:
  Engine rAF → dirty=true → render(scene) CON PINCELADA → dirty=false
```

## Formatos y Resoluciones

| Componente | Formato | Resolución |
|-----------|---------|-----------|
| PaintCanvas RT | RGBA8, UnsignedByte, sRGB | 4096×4096 (default) |
| Intermediate RT | RGBA8, UnsignedByte, sRGB | 4096×4096 |
| Brush texture | RGBA8, UnsignedByte | 256×256 |
| DataTexture (initCanvas) | RGBA8, UnsignedByte, sRGB | 64×64 (solid color) |
