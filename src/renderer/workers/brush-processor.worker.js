// brush-processor: validates PNG and returns ImageBitmap for brushes
self.onmessage = async function(e) {
  const { buffer, usage } = e.data;

  try {
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      self.postMessage({ error: 'Invalid buffer' });
      return;
    }

    // Create ImageBitmap from buffer
    const blob = new Blob([buffer], { type: 'image/png' });
    const imageBitmap = await createImageBitmap(blob);

    // Create offscreen canvas for validation
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (usage === 'brush') {
      // Validate grayscale
      if (!isGrayscale(imageData)) {
        imageBitmap.close();
        self.postMessage({ error: 'Brushes must be grayscale PNG' });
        return;
      }

      // Ensure alpha channel
      ensureAlphaFromLuminance(imageData);
    }

    // Transfer back
    self.postMessage({
      imageBitmap,
      imageData,
      width: imageData.width,
      height: imageData.height
    }, [imageBitmap]);

  } catch (err) {
    self.postMessage({ error: err.message });
  }
};

function isGrayscale(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (Math.abs(r - g) > 2 || Math.abs(g - b) > 2) {
      return false;
    }
  }
  return true;
}

function ensureAlphaFromLuminance(imageData) {
  const data = imageData.data;
  let hasAlpha = false;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) {
      hasAlpha = true;
      break;
    }
  }

  if (!hasAlpha) {
    for (let i = 0; i < data.length; i += 4) {
      data[i + 3] = data[i];
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
}
