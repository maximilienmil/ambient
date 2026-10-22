// Header backgrounds: Paper's Grain Gradient shader (Apache-2.0), mounted behind
// each view's hero. Static when the person prefers reduced motion.
import { ShaderMount, grainGradientFragmentShader, GrainGradientShapes, getShaderColorFromString, getShaderNoiseTexture, ShaderFitOptions } from '@paper-design/shaders';

const PALETTES = {
  horizon: { back: '#f3e7c2', colors: ['#fadb4a', '#b9a0f2', '#ffe68a', '#cbb8f7'] },
  compass: { back: '#e9f0dc', colors: ['#b7dca0', '#8fc7cf', '#d6ecbf', '#a9d6dc'] },
  rec: { back: '#e9f1f7', colors: ['#a9d0ee', '#cfe6f6', '#8fbfe6', '#e2f0fa'] },
};

let current = null;
export function mountGrain(el, view, o = {}) {
  if (!el || typeof WebGL2RenderingContext === 'undefined') return null;
  const p = o.palette || PALETTES[view] || PALETTES.horizon;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const uniforms = {
    u_colorBack: getShaderColorFromString(p.back),
    u_colors: p.colors.map(getShaderColorFromString),
    u_colorsCount: p.colors.length,
    u_softness: o.softness ?? 1,
    u_intensity: o.intensity ?? 0.45,
    u_noise: o.noise ?? 0.32,
    u_shape: GrainGradientShapes[o.shape || 'corners'],
    u_noiseTexture: getShaderNoiseTexture(),
    u_fit: ShaderFitOptions.cover,
    u_scale: o.scale ?? 1, u_rotation: 0, u_originX: 0.5, u_originY: 0.5, u_offsetX: 0, u_offsetY: 0, u_worldWidth: 0, u_worldHeight: 0,
  };
  try {
    current?.dispose();
    current = new ShaderMount(el, grainGradientFragmentShader, uniforms, undefined, still ? 0 : 0.12, 4200, 1, 1920 * 1080);
    el.dataset.view = view;
    return current;
  } catch {
    return null;
  }
}
window.AmbientGrain = { mountGrain };
