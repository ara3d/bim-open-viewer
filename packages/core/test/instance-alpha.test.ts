import { describe, it, expect } from 'vitest';
import { DoubleSide, FrontSide, MeshStandardMaterial } from 'three';
import {
  INSTANCE_ALPHA_ATTRIBUTE,
  INSTANCE_ALPHA_CACHE_KEY,
  patchVertexShader,
  patchFragmentShader,
  patchMaterialForInstanceAlpha,
  setSectionCap,
  SECTION_CAP_LINE,
} from '../src/instance-alpha.js';

const vertexSource = 'void main() {\n\t#include <begin_vertex>\n}';
const fragmentSource = 'void main() {\n\t#include <color_fragment>\n}';

describe('instance-alpha shader patch', () => {
  it('vertex patch declares the attribute and forwards it to a varying', () => {
    const out = patchVertexShader(vertexSource);
    expect(out).toContain(`attribute float ${INSTANCE_ALPHA_ATTRIBUTE};`);
    expect(out).toContain('varying float vInstanceAlpha;');
    expect(out).toContain(`vInstanceAlpha = ${INSTANCE_ALPHA_ATTRIBUTE};`);
    expect(out).toContain('#include <begin_vertex>');
  });

  it('fragment patch discards near-zero alpha and scales diffuse alpha', () => {
    const out = patchFragmentShader(fragmentSource);
    expect(out).toContain('varying float vInstanceAlpha;');
    expect(out).toContain('discard');
    expect(out).toContain('diffuseColor.a *= vInstanceAlpha;');
    expect(out).toContain('#include <color_fragment>');
  });

  it('patchMaterialForInstanceAlpha installs onBeforeCompile and a cache key', () => {
    const m = new MeshStandardMaterial();
    patchMaterialForInstanceAlpha(m);
    expect(m.customProgramCacheKey()).toBe(INSTANCE_ALPHA_CACHE_KEY);
    const shader = { vertexShader: vertexSource, fragmentShader: fragmentSource, uniforms: {} };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    m.onBeforeCompile(shader as any, undefined as any);
    expect(shader.vertexShader).toContain('vInstanceAlpha');
    expect(shader.fragmentShader).toContain('diffuseColor.a *= vInstanceAlpha;');
    m.dispose();
  });
});

describe('section cap', () => {
  it('fragment patch paints back faces before fog', () => {
    const out = patchFragmentShader('void main() {\n\t#include <fog_fragment>\n}');
    expect(out).toContain('uniform vec3 capColor;');
    expect(out).toContain(SECTION_CAP_LINE);
    expect(out.indexOf('!gl_FrontFacing')).toBeLessThan(out.indexOf('#include <fog_fragment>'));
  });

  it('setSectionCap toggles side, the uniforms and needsUpdate', () => {
    const m = new MeshStandardMaterial();
    patchMaterialForInstanceAlpha(m);
    const shader = { vertexShader: vertexSource, fragmentShader: fragmentSource, uniforms: {} as Record<string, { value: unknown }> };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    m.onBeforeCompile(shader as any, undefined as any);
    setSectionCap(m, [0.3, 0.29, 0.28]);
    expect(m.side).toBe(DoubleSide);
    expect(shader.uniforms.capEnabled.value).toBe(1);
    expect(shader.uniforms.capColor.value).toEqual([0.3, 0.29, 0.28]);
    setSectionCap(m, undefined);
    expect(m.side).toBe(FrontSide);
    expect(shader.uniforms.capEnabled.value).toBe(0);
    m.dispose();
  });
});
