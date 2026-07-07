export const CANVAS_RESOLUTIONS = [1024, 2048, 4096, 8192];
export const DEFAULT_CANVAS_RESOLUTION = 2048;

export const MAX_UNDO_STATES = 100;

export const CAMERA_MODES = {
  ORBIT: 'orbit',
  FREE: 'free'
};

export const DECAL_GIZMO_MODES = {
  TRANSLATE: 'translate',
  ROTATE: 'rotate',
  SCALE: 'scale'
};

export const DEFAULT_BRUSH_SIZE = 50;
export const DEFAULT_BRUSH_OPACITY = 1.0;
export const DEFAULT_BRUSH_ROTATION = 0;

export const BRUSH_SIZE_MIN = 0;

export const EVENTS = {
  // Material events
  MATERIAL_SELECTED: 'material:selected',
  MATERIAL_UPDATED: 'material:updated',
  MATERIAL_CREATED: 'material:created',
  MATERIAL_DELETED: 'material:deleted',

  // Brush events
  BRUSH_SELECTED: 'brush:selected',
  BRUSH_SIZE_CHANGED: 'brush:sizeChanged',
  BRUSH_OPACITY_CHANGED: 'brush:opacityChanged',
  BRUSH_ROTATION_CHANGED: 'brush:rotationChanged',
  BRUSH_COLOR_CHANGED: 'brush:colorChanged',
  BRUSH_TEXTURE_MODE_CHANGED: 'brush:textureModeChanged',

  // Decal events
  DECAL_SELECTED: 'decal:selected',
  DECAL_DESELECTED: 'decal:deselected',
  DECAL_CREATED: 'decal:created',
  DECAL_DELETED: 'decal:deleted',
  DECAL_TRANSFORMED: 'decal:transformed',

  // Model events
  MODEL_LOADED: 'model:loaded',
  MODEL_EXPORTED: 'model:exported',

  // Camera events
  CAMERA_MODE_CHANGED: 'camera:modeChanged',

  // Paint events
  PAINT_STROKE_START: 'paint:strokeStart',
  PAINT_STROKE_END: 'paint:strokeEnd',
  PAINT_STROKE_APPLIED: 'paint:strokeApplied',

  // Undo events
  UNDO_STATE_CREATED: 'undo:stateCreated',

  // UI events
  DECAL_EYE_TOGGLED: 'decal:eyeToggled',
  DECAL_DRAG_START: 'decal:dragStart',
  DECAL_DROP: 'decal:drop',

  // Scene events
  SCENE_DIRTY: 'scene:dirty',
  CANVAS_UPDATED: 'canvas:updated'
};
