// undo-snapshot: clones ImageData asynchronously using OffscreenCanvas
self.onmessage = function(e) {
  const { imageData } = e.data;

  try {
    if (!imageData || !imageData.data) {
      self.postMessage({ error: 'Invalid imageData' });
      return;
    }

    // Use OffscreenCanvas for reliable cloning
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);

    const clonedImageData = ctx.getImageData(0, 0, imageData.width, imageData.height);

    // Transfer the buffer back
    self.postMessage(clonedImageData, [clonedImageData.data.buffer]);

  } catch (err) {
    // Fallback: manual clone
    try {
      const data = new Uint8ClampedArray(imageData.data);
      const clone = new ImageData(data, imageData.width, imageData.height);
      self.postMessage(clone);
    } catch (err2) {
      self.postMessage({ error: err.message });
    }
  }
};
