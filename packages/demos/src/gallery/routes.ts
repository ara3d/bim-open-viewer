// Where the gallery is: a demo and a fixture, in the query string.
//
// Hash-free on purpose. A fragment means "somewhere on this page" to a browser and to a screen
// reader, and the gallery's two pages are two pages; a query string also survives being copied into
// a bug report, which a demo's `verify` line asks people to do.

export type Route = {
  readonly demoId: string | undefined;
  readonly fixtureId: string | undefined;
  // True when another page frames this one and carries the bar itself (`embed=1`): the gallery
  // then draws the demo without its own bar.
  readonly embed?: boolean | undefined;
};

// The index: every chapter and every demo card.
export const indexRoute: Route = { demoId: undefined, fixtureId: undefined };

// True when the route names no demo, which is the index.
export const isIndexRoute = (route: Route): boolean => route.demoId === undefined;

const trimmed = (value: string | null): string | undefined => {
  if (value === null) return undefined;
  const text = value.trim();
  return text === '' ? undefined : text;
};

// The route a query string names. An empty or absent parameter is the same as none.
export const parseRoute = (search: string): Route => {
  const parameters = new URLSearchParams(search);
  const embed = trimmed(parameters.get('embed'));
  return {
    demoId: trimmed(parameters.get('demo')),
    fixtureId: trimmed(parameters.get('fixture')),
    ...(embed === '1' || embed === 'true' ? { embed: true } : {}),
  };
};

// The href of a route, relative to the page, so the gallery works wherever it is served from.
export const routeHref = (route: Route): string => {
  if (route.demoId === undefined) return '?';
  const parameters = new URLSearchParams({ demo: route.demoId });
  if (route.fixtureId !== undefined) parameters.set('fixture', route.fixtureId);
  if (route.embed === true) parameters.set('embed', '1');
  return `?${parameters.toString()}`;
};

// The same route with another fixture chosen, which is what the picker links to.
export const withFixture = (route: Route, fixtureId: string): Route => ({ ...route, fixtureId });

// The same route in its embedded form.
export const embedded = (route: Route): Route => ({ ...route, embed: true });

// The route of one demo at its default fixture.
export const demoRoute = (demoId: string): Route => ({ demoId, fixtureId: undefined });
