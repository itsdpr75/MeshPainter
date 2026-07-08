# Bugs Encontrados y Fixes Aplicados

## Historial de Bugs del Pipeline de Pintado

### #1 - CRÍTICO: OrthographicCamera Z-clipping
**Archivo**: `Painter.js:_init()`
**Síntoma**: El stamp no renderizaba absolutamente nada.
**Causa**: `stampCamera.position.z = 1` con `near=-1, far=1`. El `PlaneGeometry` en z=0 estaba en el plano `view_z = -1 = far`, exactamente en el plano de clipping lejano.
**Fix**: `position.z = 0` (el plano ahora está en `view_z = 0`, dentro del volumen de clipping).
**Fecha**: Sesión 1

### #2 - CRÍTICO: PAINT_STROKE_APPLIED nunca emitido
**Archivo**: `Painter.js:stamp()`
**Síntoma**: Undo/redo roto para operaciones de pintura.
**Causa**: El evento `PAINT_STROKE_APPLIED` no se emitía después del stamp.
**Fix**: Añadido `eventBus.emit(EVENTS.PAINT_STROKE_APPLIED, ...)` al final de `stamp()`.
**Fecha**: Sesión 1

### #3 - MEDIO: _lastStampUV nunca reseteado
**Archivo**: `Painter.js` + `index.js`
**Síntoma**: Segundo clic en el mismo sitio ignorado.
**Causa**: `_lastStampUV` no se reseteaba al soltar el ratón.
**Fix**: `resetStampPosition()` llamado en el `else` de `shouldPaint` en `index.js`.
**Fecha**: Sesión 1

### #4 - MEDIO: Alpha compositing destruía alpha del destino
**Archivo**: `PaintShader.js`
**Síntoma**: Pintar con transparencia destruía el canal alpha del canvas.
**Causa**: El shader sobrescribía `gl_FragColor.a` sin preservar el alpha existente.
**Fix**: Alpha compositing correcto: `blendedAlpha = canvasSample.a + effectiveAlpha * (1.0 - canvasSample.a)`.
**Fecha**: Sesión 1

### #5 - BAJO: intermediateRT sin SRGBColorSpace
**Archivo**: `Painter.js:_ensureIntermediateRT`
**Síntoma**: Posible banding/precision loss en el blit intermedio.
**Causa**: El RT intermedio no tenía `colorSpace: THREE.SRGBColorSpace`.
**Fix**: Añadido al constructor.
**Fecha**: Sesión 1

### #6 - BAJO: GC thrashing por nuevos Scene/Mesh/Geometry cada stamp
**Archivo**: `Painter.js:stamp()`
**Síntoma**: 60+ alocaciones/segundo durante pintura continua.
**Causa**: Se creaban nuevos `MeshBasicMaterial`, `Mesh`, `Scene` en cada stamp.
**Fix**: Cacheados en `_blitMaterial`, `_blitMesh`, `_blitScene`.
**Fecha**: Sesión 1

### #7 - CRÍTICO: material.map no asignado al cargar el modelo
**Archivo**: `MaterialManager.js:_registerMaterial()`
**Síntoma**: El modelo se veía como silueta blanca/gris plana sin textura.
**Causa**: `_registerMaterial` creaba el PaintCanvas pero nunca lo asignaba a `material.map`. La malla renderizaba solo con `material.color` (#dadada).
**Fix**: Añadido `material.map = paintCanvas.getTexture()` y `material.needsUpdate = true`.
**Fecha**: Sesión 4

### #8 - ALTO: Doble conversión de espacio de color en initCanvasFromColor
**Archivo**: `MaterialManager.js:initCanvasFromColor()`
**Síntoma**: El color base del material se veía incorrecto (oscuro/desaturado).
**Causa**: `color.getHexString()` asume sRGB pero Three.js Color es linear. El canvas 2D es sRGB, la DataTexture se marca SRGBColorSpace → doble encoding.
**Fix**: `color.clone().convertLinearToSRGB()` antes de `getHexString()`.
**Fecha**: Sesión 4

### #9 - CRÍTICO: AmbientLight(Math.PI * 2) blanqueaba TODO
**Archivo**: `Engine.js:_init()`
**Síntoma**: Las pinceladas eran completamente invisibles.
**Causa**: `AmbientLight` a intensidad ~6.28. Con `MeshPhysicalMaterial`, `final = texture × color × lighting`. A 6.28, incluso trazos negros se saturaban a blanco tras `ACESFilmicToneMapping`.
**Fix**: Reducido a 1.5 + añadido `DirectionalLight(0xffffff, 0.5)` para forma.
**Fecha**: Sesión 5

### #10 - CRÍTICO: PaintCanvas RT sin colorSpace en constructor
**Archivo**: `PaintCanvas.js:_init()`
**Síntoma**: Colores incorrectos, posible doble gamma al usar RT como material.map.
**Causa**: El RT se creaba sin `colorSpace: SRGBColorSpace`. El framebuffer era linear pero la textura se marcaba SRGBColorSpace → discrepancia.
**Fix**: Añadido `colorSpace: THREE.SRGBColorSpace` al constructor del `WebGLRenderTarget`.
**Fecha**: Sesión 5

---

## Sesión de Optimización y Texture Brush

### #11 - ALTO: Pinceladas dispersas (huecos entre stamps)
**Archivo**: `Painter.js:tryPaint()` + `Constants.js`
**Síntoma**: Al pintar arrastrando el ratón, las pinceladas dejaban puntos dispersos con huecos, especialmente con pinceles grandes.
**Causa**: 
1. `_minStampDistance` era fijo a 5 píxeles, independientemente del tamaño del pincel. Un pincel de 50px necesitaba ~25px de espaciado para cobertura continua.
2. Resolución del canvas era 4096×4096, haciendo que 5px de distancia en el canvas fuera muy pequeño en UV.
**Fix**: 
1. `_minStampDistance = Math.max(1, brushSize * 0.5)` — proporcional al tamaño del pincel.
2. `DEFAULT_CANVAS_RESOLUTION` reducido de 4096 a 2048 (4× menos píxeles por render).
**Fecha**: Sesión de optimización

### #12 - ALTO: Lag/pintura no fluida
**Archivo**: `Painter.js:tryPaint()`
**Síntoma**: La pintura se sentía con delay y la app iba a pocos FPS al arrastrar el ratón.
**Causa**: Cada frame se hacía raycast + 2 renders fullscreen (blit + stamp) a 4096×4096. A 60 FPS, esto saturaba la GPU.
**Fix**: Frame skip con countdown al inicio de `tryPaint()` (ANTES del raycast). Pinta 1 de cada 2 frames. El contador se resetea al soltar el ratón o al perder el mesh.
**Fecha**: Sesión de optimización

### #13 - CRÍTICO: Todo lo pintado salía negro (#1)
**Archivo**: `Painter.js:stamp()` + `PaintCanvas.js:initFromTexture()`
**Síntoma**: Independientemente del color o textura del material, todo lo pintado se veía completamente negro.
**Causa**: `MeshBasicMaterial` sin `toneMapped: false`. El `ACESFilmicToneMapping` del renderer se aplicaba a los materiales de blit en cada stamp, oscureciendo progresivamente la textura. En múltiples stamps consecutivos (arrastrando el ratón), la textura se volvía negra.
**Fix**: Añadido `toneMapped: false` tanto al `_blitMaterial` en `Painter.js` como al `blitMaterial` en `PaintCanvas.js:initFromTexture()`.
**Fecha**: Sesión de optimización

### #14 - CRÍTICO: Todo lo pintado salía negro (#2 - causa raíz)
**Archivo**: `Painter.js:stamp()`
**Síntoma**: Incluso después del fix #13, lo pintado seguía saliendo negro.
**Causa**: El `_blitMaterial` se creaba SIN `map`. Three.js compilaba el shader sin la macro `#define USE_MAP`. Al asignar `sourceTexture` dinámicamente con `this._blitMaterial.map = sourceTexture`, el shader **ignoraba** la textura porque `needsUpdate` nunca se marcaba. El blit fallaba silenciosamente → canvas se corrompía → todo negro.
**Fix**: 
```js
if (this._blitMaterial.map !== sourceTexture) {
  this._blitMaterial.map = sourceTexture;
  this._blitMaterial.needsUpdate = true;
}
```
Esto fuerza a Three.js a recompilar el shader con `USE_MAP` la primera vez que se asigna una textura.
**Fecha**: Sesión de optimización

### #15 - FEATURE: Texture Brush mode
**Archivo**: `PaintShader.js`, `Painter.js`, `BrushPanel.js`, `Constants.js`
**Feature**: Permite pintar usando la textura del material seleccionado como "tinta" en lugar de un color sólido.
**Implementación**:
- Shader: Añadidos uniforms `uMaterialMap` (sampler2D) y `uUseMaterialMap` (int). Cuando `uUseMaterialMap == 1`, samplea `texture2D(uMaterialMap, canvasUV)` como color de pincel.
- Painter: `_textureBrushMode = true` por defecto. En `stamp()`, pasa la textura del `_activeMaterial._paintCanvas` como `uMaterialMap`.
- BrushPanel: Checkbox "Paint with Material Texture" + color picker (se atenúa en modo textura).
- Eventos: `BRUSH_TEXTURE_MODE_CHANGED` y `BRUSH_COLOR_CHANGED`.
**Fecha**: Sesión de optimización

### #16 - ALTO: WebGL feedback loop en Texture Brush
**Archivo**: `Painter.js:stamp()`
**Síntoma**: Al pintar un material sobre sí mismo en modo Texture Brush, podía ocurrir un feedback loop de WebGL (leer y escribir la misma textura en un mismo draw call).
**Causa**: `uMaterialMap` apuntaba al mismo RT que el target de render del stamp.
**Fix**: Guard `this._activeMaterial._paintCanvas !== paintCanvas`. Si comparten el mismo canvas, se desactiva automáticamente el modo textura para ese stamp.
**Importante**: Se compara a nivel de `_paintCanvas` (no a nivel de material) para cubrir el caso de clones de GLTFLoader donde dos objetos material distintos comparten el mismo canvas subyacente.
**Fecha**: Sesión de optimización

### #17 - BAJO: Evento inicial de Texture Brush perdido
**Archivo**: `BrushPanel.js:_bindEvents()`
**Síntoma**: Potencial race condition donde el evento `BRUSH_TEXTURE_MODE_CHANGED` inicial se emitía antes de que Painter se suscribiera.
**Causa**: `BrushPanel` se instancia en el constructor de `UIManager`, pero `Painter` se crea después en `MeshPaintApp._init()`. El evento emitido en `_bindEvents()` se perdía.
**Fix**: Eliminado el emit inicial. `Painter` tiene `_textureBrushMode = true` por defecto, que coincide con el checkbox marcado, así que el comportamiento es correcto sin el evento inicial.
**Fecha**: Sesión de optimización

---

## Lecciones Aprendidas

1. **Siempre verificar el colorSpace en WebGLRenderTarget**: Un RT sin `colorSpace` en el constructor usa framebuffer linear, causando discrepancias con texturas marcadas SRGBColorSpace.

2. **La iluminación extrema oculta bugs**: `AmbientLight(Math.PI * 2)` hacía que todo se viera blanco, enmascarando problemas de textura y pintura.

3. **Dual rAF ordering importa**: Engine renderiza antes que Index en cada frame. Los cambios de textura del frame N son visibles en el render del frame N+1.

4. **WebGL feedback loops**: Nunca leer y escribir el mismo RT en un mismo render pass. El intermediateRT (ping-pong buffer) es esencial.

5. **ShaderMaterial no tiene conversión automática de color space**: A diferencia de los materiales built-in de Three.js, los ShaderMaterial personalizados requieren manejo manual de sRGB↔linear.

6. **`toneMapped: false` en MeshBasicMaterial**: Si un material se usa para blit (copiar texturas entre RTs), DEBE tener `toneMapped: false` para evitar que el tone mapping del renderer (ACESFilmicToneMapping) se aplique repetidamente.

7. **`needsUpdate = true` al asignar `map` dinámicamente**: Si un `MeshBasicMaterial` se crea sin `map` y luego se le asigna una textura, Three.js NO recompila el shader automáticamente. Hay que marcar `needsUpdate = true` para que el shader incluya la macro `USE_MAP`.

8. **Clones de GLTFLoader comparten `_paintCanvas`**: Dos objetos `THREE.Material` diferentes pueden compartir el mismo `_paintCanvas`. Al actualizar `material.map`, hay que iterar TODOS los materiales de las mallas y actualizar aquellos que compartan el mismo `_paintCanvas`, no solo el material golpeado.

9. **Guard de feedback loop a nivel de canvas, no de material**: Comparar `_paintCanvas` en lugar de referencias de material para cubrir clones de GLTFLoader.

10. **Frame skip ANTES del raycast**: Poner el frame skip al principio de `tryPaint()` ahorra tanto CPU (raycast) como GPU (render). Moverlo antes del raycast fue clave para reducir el lag.
