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

### #11 - PENDIENTE: Color space mismatch en PaintShader
**Archivo**: `PaintShader.js`
**Síntoma**: Colores de pintura no-negros se mezclan incorrectamente.
**Causa**: `texture2D(uCanvas)` devuelve valores sRGB crudos (ShaderMaterial no hace conversión automática), pero `uColor.rgb` son valores lineales. La mezcla ocurre en espacios de color diferentes.
**Fix pendiente**: Convertir `canvasSample.rgb` de sRGB a linear antes del `mix()`.
**Fecha**: No aplicado aún

---

## Lecciones Aprendidas

1. **Siempre verificar el colorSpace en WebGLRenderTarget**: Un RT sin `colorSpace` en el constructor usa framebuffer linear, causando discrepancias con texturas marcadas SRGBColorSpace.

2. **La iluminación extrema oculta bugs**: `AmbientLight(Math.PI * 2)` hacía que todo se viera blanco, enmascarando problemas de textura y pintura.

3. **Dual rAF ordering importa**: Engine renderiza antes que Index en cada frame. Los cambios de textura del frame N son visibles en el render del frame N+1.

4. **WebGL feedback loops**: Nunca leer y escribir el mismo RT en un mismo render pass. El intermediateRT (ping-pong buffer) es esencial.

5. **ShaderMaterial no tiene conversión automática de color space**: A diferencia de los materiales built-in de Three.js, los ShaderMaterial personalizados requieren manejo manual de sRGB↔linear.
