import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openGLB: () => ipcRenderer.invoke('dialog:openGLB'),
  saveGLB: (buffer) => ipcRenderer.invoke('dialog:saveGLB', buffer),
  openTexture: () => ipcRenderer.invoke('dialog:openTexture')
});
