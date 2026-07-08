# Build & Run

## Requisitos

- **Node.js** 18+
- **pnpm** 11+ (instalado globalmente)

## Instalación

```bash
pnpm install
```

**Nota sobre pnpm y build scripts**: pnpm bloquea por defecto la ejecución de scripts de build de dependencias. `electron-builder` requiere `electron-winstaller`, que tiene un script de build. Para autorizarlo:

```bash
pnpm approve-builds --all
```

Esto aprueba todos los scripts pendientes de una vez (no interactivo). Alternativamente, el proyecto incluye configuración en `pnpm-workspace.yaml` y `package.json` (campo `onlyBuiltDependencies`) para autorizar `electron`, `electron-winstaller`, y `esbuild`.

## Desarrollo

```bash
pnpm dev
```

Esto inicia:
1. Vite dev server para el renderer (hot reload)
2. Electron con la ventana de la app

El puerto por defecto es 5173. Si está ocupado, usa 5174 automáticamente.

## Build de Producción

```bash
pnpm build
```

Genera en `out/`:
- `out/main/main.js` — Electron main process
- `out/preload/preload.js` — contextBridge preload
- `out/renderer/` — HTML, CSS, JS bundle (~1.2 MB) + workers

### Estructura de Build (`electron.vite.config.js`)

```js
export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: { input: { main: 'src/main/main.js' } }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: { input: { preload: 'src/preload/preload.js' } }
    }
  },
  renderer: {
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: { index: 'src/renderer/index.html' } },
      worker: { format: 'es' }  // ES Module Workers
    }
  }
});
```

## Empaquetado a Ejecutable (Windows)

```bash
pnpm dist
```

Este comando ejecuta:
1. `electron-vite build` — build de producción
2. `electron-builder --win nsis` — genera instalador NSIS para Windows

**Archivos generados en `dist/`:**
- `MeshPaint Setup 1.0.0.exe` — Instalador NSIS (instalación personalizable, elige directorio)
- `win-unpacked/MeshPaint.exe` — App portable (ejecutar sin instalar)

### Configuración de electron-builder

En `package.json`:

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

### Troubleshooting de empaquetado

| Problema | Solución |
|---------|----------|
| `ERR_PNPM_IGNORED_BUILDS` | Ejecutar `pnpm approve-builds --all` |
| `electron-winstaller` bloqueado | Añadir a `onlyBuiltDependencies` en `package.json` + `pnpm-workspace.yaml` |
| Build timeout (>15 min) | Es normal en el primer build (descarga Electron binaries). Esperar. |
| Error de espacio en disco | El build requiere ~2 GB libres para los binarios de Electron |
| `pnpm approve-builds` interactivo | Usar flag `--all` para modo no interactivo |

## Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Dev server + Electron (hot reload) |
| `pnpm build` | Build producción (out/) |
| `pnpm preview` | Preview del build de producción |
| `pnpm dist` | Build + empaquetado NSIS para Windows |

## Debugging

### Consola
La app es Electron. Abre DevTools con **F12**. Los logs de diagnóstico usan prefijos:
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

### Logs de error/skip al pintar:
```
[PAINT] tryPaint SKIP: no valid hits (...)  → material no está en la malla
[PAINT] tryPaint SKIP: no active brush       → no hay pincel seleccionado
[PAINT] tryPaint SKIP: no active material    → no hay material seleccionado
[PAINT] tryPaint SKIP: frame skipped          → frame skip countdown activo
```

## Problemas Conocidos

### Pintura no visible
Si el STAMP completa pero no se ve en el modelo:
1. Verificar que `AmbientLight` no es excesivo (1.5 actual)
2. Verificar que `PaintCanvas RT` tiene `colorSpace: SRGBColorSpace`
3. Verificar que `material.map` está asignado correctamente

### Pintura se ve negra
Posibles causas:
1. El color del pincel es negro por defecto → cambiar en el color picker
2. El modo Texture Brush está activo pero el material seleccionado no tiene textura → desmarcar "Paint with Material Texture"
3. El `_blitMaterial` no tiene `needsUpdate = true` → ya corregido (Bug #14)

### Puerto ocupado
Si `pnpm dev` falla con "port 5173 in use":
- El servidor cambia automáticamente a 5174
- O mata el proceso: `npx kill-port 5173`

### Error de Draco
Si falla la carga de Draco decoder:
- Verificar conexión a `gstatic.com/draco/versioned/decoders/1.5.7/`
- El decoder se carga desde CDN (no empaquetado)

### Pintura con lag
Si la app se siente lenta al pintar:
1. Reducir resolución del canvas (2048 por defecto, bajar a 1024)
2. El frame skip ya está configurado para pintar 1 de cada 2 frames
3. Verificar que no haya muchos decals activos
