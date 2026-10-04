// What every demo opens, in the order the picker offers it: the private Snowdon model when the dev
// server can hand it out, the three openly licensed buildings, and the generated building last.
//
// The static site keeps the public buildings only (`gallery/hosting.ts`): Snowdon needs the dev
// server, and a generated building is not what a visitor came to see when a real one is there. The
// generated building stays in the dev gallery because it has deliberate gaps and conflicts that a
// real model does not, and some demos exist to show exactly those.

import type { DemoFixture } from '../../gallery/contracts.js';
import { publicBuildingFixtures } from '../public-buildings/fixtures.js';
import { snowdon, syntheticBuilding } from './snowdon.js';

export const defaultFixtures: readonly DemoFixture[] = [snowdon, ...publicBuildingFixtures, syntheticBuilding()];
