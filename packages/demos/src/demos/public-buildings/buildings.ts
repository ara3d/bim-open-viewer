// The openly licensed buildings the gallery opens, where their files come from, and the credit each
// licence asks for.
//
// The files are BIM Open Schema archives converted by ara3d/bim-open-data, read at one pinned commit
// so the site shows the same bytes until the pin is moved. Nothing here is committed to this
// repository: the pages build and the gallery's dev server fetch them (`scripts/public-samples.mjs`)
// and serve them under `samples/`, next to `gallery.html`.
//
// This module is plain data with no browser or viewer import, because the Vite configurations read
// it too, to know which files to fetch.

// The bim-open-data commit the files are read at.
export const publicSamplesCommit = 'b4c7e3f3033706a15517b471b50eb32731ea584b';

// Where the files are fetched from.
export const publicSamplesOrigin = `https://raw.githubusercontent.com/ara3d/bim-open-data/${publicSamplesCommit}/samples/public/`;

// Where the site serves them, relative to `gallery.html`.
export const publicSamplesPath = 'samples/';

// The notice every copy of the files ships with: licences, sources, and what the conversion changed.
export const publicSamplesNotice = 'NOTICE.md';

// A colour a discipline model is drawn in, named for the inspector.
export type DisciplineColour = { readonly name: string; readonly rgb: readonly [number, number, number] };

const red: DisciplineColour = { name: 'red', rgb: [0.86, 0.3, 0.24] };
const blue: DisciplineColour = { name: 'blue', rgb: [0.22, 0.5, 0.86] };
const amber: DisciplineColour = { name: 'amber', rgb: [0.95, 0.68, 0.16] };
const teal: DisciplineColour = { name: 'teal', rgb: [0.16, 0.68, 0.58] };
const violet: DisciplineColour = { name: 'violet', rgb: [0.6, 0.42, 0.84] };

// One source model inside a federated file, named by its title in the file's `Documents` table
// (the `Document` column of `Entities` says which one each entity came from). A part with a colour
// is drawn in it; one without keeps the colours the file records.
export type PublicPart = {
  readonly document: string;
  readonly discipline: string;
  readonly colour?: DisciplineColour | undefined;
};

// One `.bos` file of a building, with its geometry. A file with `parts` is a federated union and is
// drawn part by part, by source model; one without is a single discipline, drawn in `colour` when it
// has one and in the colours the file records when it has none.
export type PublicModel = {
  readonly file: string;
  readonly discipline: string;
  readonly colour?: DisciplineColour | undefined;
  readonly parts?: readonly PublicPart[] | undefined;
};

export type PublicBuilding = {
  readonly id: string;
  readonly title: string;
  // One sentence for the landing page card and the inspector.
  readonly summary: string;
  // Drawn together, in this order, in one scene. A federated building is one union file.
  readonly models: readonly PublicModel[];
  // The credit line the licence asks for, from bim-open-data's samples/public/NOTICE.md.
  readonly attribution: string;
  readonly licence: { readonly name: string; readonly url: string };
  // Where the source IFC files are published.
  readonly upstream: string;
  // What the building has that the scene does not draw, when something is left out.
  readonly omitted?: string | undefined;
};

export const publicBuildings: readonly PublicBuilding[] = [
  {
    id: 'schependomlaan',
    title: 'Schependomlaan',
    summary: 'A ten-apartment block: the Archicad design model, with 6 storeys, 205 doors, and 259 windows.',
    models: [{ file: 'schependomlaan.bos', discipline: 'Architecture' }],
    attribution:
      'Schependomlaan dataset, (C) original owners, licensed CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; converted to BIM Open Schema tables by Ara 3D.',
    licence: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    upstream: 'https://github.com/openBIMstandards/Archive-DataSetSchependomlaan',
  },
  {
    id: 'digitalhub',
    title: 'DigitalHub, federated',
    summary:
      'An office building of RWTH Aachen University: the architecture, heating, ventilation, and plumbing models drawn together.',
    models: [
      {
        file: 'digitalhub-federated.bos',
        discipline: 'Federated',
        parts: [
          { document: 'DigitalHub_FM-ARC_v2', discipline: 'Architecture' },
          { document: 'DigitalHub_FM-HZG_v2', discipline: 'Heating', colour: red },
          { document: 'DigitalHub_FM-LFT_v2', discipline: 'Ventilation', colour: teal },
          { document: 'DigitalHub_FM-SAN_v2', discipline: 'Plumbing', colour: violet },
        ],
      },
    ],
    attribution:
      'DigitalHub, Copyright (c) 2020 RWTH Aachen University - E3D Institute of Energy Efficiency and Sustainable Building, MIT License; converted to BIM Open Schema tables by Ara 3D.',
    licence: { name: 'MIT', url: 'https://github.com/RWTH-E3D/DigitalHub/blob/master/LICENSE' },
    upstream: 'https://github.com/RWTH-E3D/DigitalHub',
  },
  {
    id: 'duplex',
    title: 'Duplex Apartment, federated',
    summary: 'A two-unit house: the architecture, MEP, electrical, and rooms models drawn together.',
    models: [
      {
        file: 'duplex-federated.bos',
        discipline: 'Federated',
        parts: [
          { document: 'Duplex_A_20110907', discipline: 'Architecture' },
          { document: 'Duplex_MEP_20110907', discipline: 'MEP', colour: blue },
          { document: 'Duplex_Electrical_20121207', discipline: 'Electrical', colour: amber },
          { document: 'Duplex_M_20111024_ROOMS_AND_SPACES', discipline: 'Rooms and heating', colour: red },
        ],
      },
    ],
    attribution:
      'BSI (2020) Duplex Apartment Test Files, buildingSMART International. (C) original authors, licensed CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; converted to BIM Open Schema tables by Ara 3D.',
    licence: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    upstream: 'https://github.com/buildingsmart-community/Community-Sample-Test-Files',
    omitted:
      'Shared elements, 448 GlobalIds that appear in more than one model, are drawn once for each model that holds them, so they are drawn twice.',
  },
];

// Every file the site has to serve: each model, and the notice.
export const publicSampleFiles: readonly string[] = [
  ...publicBuildings.flatMap((building) => building.models.map((model) => model.file)),
  publicSamplesNotice,
];
