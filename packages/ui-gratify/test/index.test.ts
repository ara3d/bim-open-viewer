import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

describe('@bim-open-viewer/ui-gratify', () => {
  it('loads', () => {
    expect(api).toBeDefined();
  });
});
