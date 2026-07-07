import { app, BrowserWindow, ipcMain, dialog, net, protocol } from 'electron';
import { join, resolve } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { pathToFileURL } from 'url';

// Register custom privileged scheme before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#1a1a2e',
    title: 'MeshPaint',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadURL('app://./index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register custom protocol handler for production
function registerAppProtocol() {
  protocol.handle('app', (request) => {
    try {
      const url = new URL(request.url);
      const pathname = decodeURIComponent(url.pathname.replace(/^\//, ''));
      const filePath = resolve(__dirname, '../renderer', pathname || 'index.html');
      const fileUrl = pathToFileURL(filePath).href;
      return net.fetch(fileUrl);
    } catch (err) {
      console.error('Protocol handler error:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
}

// IPC Handlers
ipcMain.handle('dialog:openGLB', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open GLB Model',
    filters: [{ name: 'GLB', extensions: ['glb'] }],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const buffer = await readFile(filePath);
  return { buffer: buffer.buffer, fileName: filePath.split(/[\\/]/).pop() };
});

ipcMain.handle('dialog:saveGLB', async (event, arrayBuffer) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save GLB Model',
    filters: [{ name: 'GLB', extensions: ['glb'] }],
    defaultPath: 'model.glb'
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  const buffer = Buffer.from(arrayBuffer);
  await writeFile(result.filePath, buffer);
  return { success: true, filePath: result.filePath };
});

ipcMain.handle('dialog:openTexture', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Texture',
    filters: [{ name: 'PNG', extensions: ['png'] }],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const buffer = await readFile(filePath);
  return { buffer: buffer.buffer, fileName: filePath.split(/[\\/]/).pop() };
});

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
