import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

describe('@bim-open-viewer/render', () => {
  it('loads', () => {
    expect(api).toBeDefined();
  });
});
