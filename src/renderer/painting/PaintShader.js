// PaintShader: GLSL shader for brush stamping with UV mapping and rotation
const PaintShader = {
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D uCanvas;
    uniform sampler2D uBrush;
    uniform sampler2D uMaterialMap;
    uniform int uUseMaterialMap;
    uniform vec2 uCanvasSize;
    uniform vec2 uBrushSize;
    uniform vec2 uPosition;
    uniform float uRotation;
    uniform float uOpacity;
    uniform vec4 uColor;

    varying vec2 vUv;

    void main() {
      vec2 canvasUV = vUv;
      vec2 canvasPx = canvasUV * uCanvasSize;

      // Offset to brush center
      vec2 brushCenter = uPosition;
      vec2 delta = canvasPx - brushCenter;

      // Rotate the sampling offset
      float cosA = cos(uRotation);
      float sinA = sin(uRotation);
      vec2 rotatedDelta = vec2(
        delta.x * cosA - delta.y * sinA,
        delta.x * sinA + delta.y * cosA
      );

      // Convert to brush UV space
      vec2 brushUV = (rotatedDelta / uBrushSize) + 0.5;

      // Sample brush
      vec4 brushSample = vec4(0.0);
      if (brushUV.x >= 0.0 && brushUV.x <= 1.0 && brushUV.y >= 0.0 && brushUV.y <= 1.0) {
        brushSample = texture2D(uBrush, brushUV);
      }

      // Calculate alpha from brush: alpha channel takes priority
      float brushAlpha = brushSample.a * uOpacity;

      // Sample current canvas
      vec4 canvasSample = texture2D(uCanvas, canvasUV);

      // Determine brush color: either from material texture or solid color
      vec3 brushColor;
      if (uUseMaterialMap == 1) {
        // Sample the selected material's texture using mesh UVs for correct alignment
        vec4 matSample = texture2D(uMaterialMap, canvasUV);
        brushColor = matSample.rgb;
      } else {
        brushColor = uColor.rgb;
      }

      // Blend: proper alpha compositing (preserves destination alpha)
      // WebGL2 automatically handles sRGB<->linear conversion for sRGB textures/framebuffers,
      // so we blend in the native linear space the GPU provides.
      float effectiveAlpha = brushAlpha * uColor.a;
      vec3 blendedRGB = mix(canvasSample.rgb, brushColor, effectiveAlpha);
      float blendedAlpha = canvasSample.a + effectiveAlpha * (1.0 - canvasSample.a);

      gl_FragColor = vec4(blendedRGB, blendedAlpha);
    }
  `
};

export default PaintShader;
