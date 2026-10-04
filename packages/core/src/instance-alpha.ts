import { DoubleSide, FrontSide, MeshStandardMaterial } from 'three';

/** Name of the per-instance alpha attribute (1 float per instance). */
export const INSTANCE_ALPHA_ATTRIBUTE = 'instanceAlpha';

/** Instances with alpha below this are discarded in the fragment shader. */
export const MIN_VISIBLE_ALPHA = 1 / 255;

/** Cache key so three.js never shares the unpatched program with this material. */
export const INSTANCE_ALPHA_CACHE_KEY = 'ara3d-instance-alpha';

/**
 * Splices per-instance alpha into the standard shader source. Exported
 * separately so the transform is unit-testable without a GL context.
 */
export function patchVertexShader(source: string): string {
  return (
    `attribute float ${INSTANCE_ALPHA_ATTRIBUTE};\n` +
    'varying float vInstanceAlpha;\n' +
    source.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n\tvInstanceAlpha = ${INSTANCE_ALPHA_ATTRIBUTE};`,
    )
  );
}

/** Name of the section-cap uniforms: colour (vec3) and an on/off float. */
export const SECTION_CAP_COLOR_UNIFORM = 'capColor';
export const SECTION_CAP_ENABLED_UNIFORM = 'capEnabled';

/**
 * The cap line: back faces seen through a clipped solid are painted flat,
 * after lighting, tone mapping and colour space and before fog, so fog and
 * the instance alpha still apply.
 */
export const SECTION_CAP_LINE = `\tif (capEnabled > 0.5 && !gl_FrontFacing) gl_FragColor = vec4(${SECTION_CAP_COLOR_UNIFORM}, gl_FragColor.a);`;

interface CapUniforms {
  readonly capColor: { value: [number, number, number] };
  readonly capEnabled: { value: number };
}

// One uniform pair per material, shared by every program compiled for it.
const capUniformsOf = (material: MeshStandardMaterial): CapUniforms => {
  const data = material.userData as { sectionCap?: CapUniforms };
  data.sectionCap ??= { capColor: { value: [0, 0, 0] }, capEnabled: { value: 0 } };
  return data.sectionCap;
};

export function patchFragmentShader(source: string): string {
  return (
    'varying float vInstanceAlpha;\n' +
    `uniform vec3 ${SECTION_CAP_COLOR_UNIFORM};\n` +
    `uniform float ${SECTION_CAP_ENABLED_UNIFORM};\n` +
    source
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n' +
          `\tif (vInstanceAlpha < ${MIN_VISIBLE_ALPHA}) discard;\n` +
          '\tdiffuseColor.a *= vInstanceAlpha;',
      )
      .replace('#include <fog_fragment>', `${SECTION_CAP_LINE}\n\t#include <fog_fragment>`)
  );
}

/**
 * Patches a MeshStandardMaterial so it multiplies fragment alpha by the
 * `instanceAlpha` instanced attribute and discards fragments whose instance
 * alpha is below MIN_VISIBLE_ALPHA (so alpha-0 instances neither draw nor
 * write depth).
 *
 * Only apply to a material used exclusively on geometry that carries the
 * attribute — the patched program declares it, so meshes without it would
 * fail to link. Materials that are never patched are unaffected.
 */
export function patchMaterialForInstanceAlpha(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = patchVertexShader(shader.vertexShader);
    shader.fragmentShader = patchFragmentShader(shader.fragmentShader);
    const cap = capUniformsOf(material);
    shader.uniforms[SECTION_CAP_COLOR_UNIFORM] = cap.capColor;
    shader.uniforms[SECTION_CAP_ENABLED_UNIFORM] = cap.capEnabled;
  };
  material.customProgramCacheKey = () => INSTANCE_ALPHA_CACHE_KEY;
}

/**
 * Makes a clipped material read as solid: with a colour, both sides are drawn
 * and back faces are painted flat in that colour; with undefined, the
 * material goes back to front faces and normal shading. The material must
 * have been patched with patchMaterialForInstanceAlpha for the colour to show.
 */
export function setSectionCap(
  material: MeshStandardMaterial,
  color: readonly [number, number, number] | undefined,
): void {
  const cap = capUniformsOf(material);
  cap.capEnabled.value = color === undefined ? 0 : 1;
  if (color !== undefined) cap.capColor.value = [color[0], color[1], color[2]];
  material.side = color === undefined ? FrontSide : DoubleSide;
  material.needsUpdate = true;
}
