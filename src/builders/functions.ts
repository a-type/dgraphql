import { DGraphScalar, QueryVariable } from '../types';

export enum FilterName {
  AllOfTerms = 'allofterms',
  AnyOfTerms = 'anyofterms',
  RegExp = 'regexp',
  AllOfText = 'alloftext',
  AnyOfText = 'anyoftext',
  Equal = 'eq',
  LessThanOrEqual = 'le',
  LessThan = 'lt',
  GreaterThanOrEqual = 'ge',
  GreaterThan = 'gt',
  Uid = 'uid',
  UidIn = 'uid_in', // can't be used at root func
  Has = 'has',
  // geo
  Near = 'near',
  Within = 'within',
  Contains = 'contains',
  Intersects = 'intersects',
}

export type GeoLongLat = [number, number];

export type FunctionBuilderContext = {
  // we will be mutating this
  variables: QueryVariable[];
  // namespace for new created variables
  baseName: string;
};

const joinTerms = (terms: string | string[], moreTerms: string[]): string => {
  if (terms instanceof Array || moreTerms) {
    const termsArray: string[] = [].concat(terms).concat(moreTerms || []);
    return termsArray.join(' ');
  }
  return terms;
};

const createTextFilter = (filterName: FilterName) => (
  predicate: string,
  terms: string | string[],
  ...moreTerms: string[]
) =>
  `${filterName}(${predicate}, ${JSON.stringify(joinTerms(terms, moreTerms))})`;

const createInequalityFilter = (filterName: FilterName) => (
  predicateOrValue: string,
  testValue: DGraphScalar,
) => `${filterName}(${predicateOrValue}, ${JSON.stringify(testValue)})`;

const createGeoPolygonFilter = (filterName: FilterName) => (
  predicate: string,
  longLats: GeoLongLat | GeoLongLat[],
  ...moreLongLats: GeoLongLat[]
) => {
  const longLatList = [].concat(longLats).concat(moreLongLats || []);
  return `${filterName}(${predicate}, ${JSON.stringify(longLatList)})`;
};

export default {
  allOfTerms: createTextFilter(FilterName.AllOfTerms),
  anyOfTerms: createTextFilter(FilterName.AnyOfTerms),

  regExp(predicate: string, regExp: RegExp | string) {
    const boxed = new RegExp(regExp);
    return `${FilterName.RegExp}(${predicate}, ${boxed.toString()})`;
  },

  allOfText: createTextFilter(FilterName.AllOfText),
  anyOfText: createTextFilter(FilterName.AnyOfText),

  equal(
    predicateOrValue: string,
    testValue: DGraphScalar | DGraphScalar[],
    ...moreTestValues: DGraphScalar[]
  ) {
    const finalValue =
      testValue instanceof Array || moreTestValues
        ? [].concat(testValue).concat(moreTestValues || [])
        : testValue;
    return `${FilterName.Equal}(${predicateOrValue}, ${JSON.stringify(
      finalValue,
    )})`;
  },

  lessThanOrEqual: createInequalityFilter(FilterName.LessThanOrEqual),
  lessThan: createInequalityFilter(FilterName.LessThan),
  greaterThanOrEqual: createInequalityFilter(FilterName.GreaterThanOrEqual),
  greaterThan: createInequalityFilter(FilterName.GreaterThan),

  uid(uidsOrVariables: string[], ...moreUidsOrVariables: string[]) {
    const finalUidList = []
      .concat(uidsOrVariables)
      .concat(moreUidsOrVariables || []);
    return `${FilterName.Uid}(${finalUidList.join(',')})`;
  },
  /**
   * Can only be used in filters
   */
  uidIn: (predicate: string, uid: string) =>
    `${FilterName.UidIn}(${predicate}, ${uid})`,

  has: (predicate: string) => `${FilterName.Has}(${predicate})`,

  // geo

  near: (predicate: string, longLat: GeoLongLat, distance: number) =>
    `${FilterName.Near}(${predicate}, ${JSON.stringify(
      longLat,
    )}, ${JSON.stringify(distance)})`,

  within: createGeoPolygonFilter(FilterName.Within),
  contains: createGeoPolygonFilter(FilterName.Contains),
  intersects: createGeoPolygonFilter(FilterName.Intersects),
};
