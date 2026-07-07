# Build & Run

## Requisitos

- Node.js 18+
- pnpm

## Instalación

```bash
pnpm install
```

## Desarrollo

```bash
pnpm dev
```

Esto inicia:
1. Vite dev server para el renderer (hot reload)
2. Electron con la ventana de la app

El puerto por defecto es 5173. Si está ocupado, usa 5174.

## Build de Producción

```bash
pnpm build
```

Genera en `out/`:
- `out/main/main.js` (~3.3 KB)
- `out/preload/preload.js` (~0.3 KB)
- `out/renderer/` (assets HTML/CSS/JS, ~1.2 MB bundle)

## Estructura de Build

```
electron.vite.config.js  →  Configura main, preload, renderer
                             renderer incluye worker: { format: 'es' }
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Dev server + Electron |
| `pnpm build` | Build producción |
| `pnpm preview` | Preview del build |

## Debugging

### Consola
La app es Electron, abre DevTools con F12. Los logs de diagnóstico usan prefijos:
- `[LOOP]` - Estado del loop principal
- `[PAINT]` - Pipeline de tryPaint
- `[STAMP]` - Pipeline de stamp GPU
- `[MATERIAL]` - Operaciones de materiales

### Logs esperados al cargar un modelo:
```
[PAINT] Brush selected: Soft Circle | texture size: 256x256
[PAINT] Material selected: openPBR_shader2 | hasPaintCanvas: true | ...
[LOOP] frame=... | mouseDown=false | hasBrush=true | hasMaterial=true
```

### Logs esperados al pintar:
```
[LOOP] frame=... | mouseDown=true | shouldPaint=true
[PAINT] Raycast: hits=1 | ndc=(...)
[PAINT] Hit UV: (...) | canvasPx: (...)
[PAINT] >>> STAMPING at (...)
[STAMP] ===== START =====
[STAMP] Blit done
[STAMP] Rendering stamp
[STAMP] ===== DONE =====
```

### Logs de error al pintar:
```
[PAINT] tryPaint SKIP: no valid hits (...)  → material no está en la malla
[PAINT] tryPaint SKIP: no active brush       → no hay pincel seleccionado
[PAINT] tryPaint SKIP: no active material    → no hay material seleccionado
```

## Problemas Conocidos

### Pintura no visible
Si el STAMP completa pero no se ve en el modelo:
1. Verificar que `AmbientLight` no es excesivo (1.5 actual)
2. Verificar que `PaintCanvas RT` tiene `colorSpace: SRGBColorSpace`
3. Verificar que `material.map` está asignado

### Puerto ocupado
Si `pnpm dev` falla con "port 5173 in use":
- El servidor cambia automáticamente a 5174
- O mata el proceso: `npx kill-port 5173`

### Error de Draco
Si falla la carga de Draco decoder:
- Verificar conexión a `gstatic.com/draco/versioned/decoders/1.5.7/`
- El decoder se carga desde CDN (no empaquetado)
