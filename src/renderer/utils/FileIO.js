// FileIO wrapper for renderer - calls window.electronAPI methods via preload bridge
class FileIO {
  static async openGLB() {
    if (!window.electronAPI) {
      throw new Error('electronAPI not available');
    }
    return await window.electronAPI.openGLB();
  }

  static async saveGLB(arrayBuffer) {
    if (!window.electronAPI) {
      throw new Error('electronAPI not available');
    }
    return await window.electronAPI.saveGLB(arrayBuffer);
  }

  static async openTexture() {
    if (!window.electronAPI) {
      throw new Error('electronAPI not available');
    }
    return await window.electronAPI.openTexture();
  }
}

export default FileIO;
