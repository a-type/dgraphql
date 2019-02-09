export enum FilterJoin {
  And = 'AND',
  Or = 'OR',
  Not = 'NOT',
}

export type FilterBuilder = {
  (filterBody: string): string;
  and(...filters);
};

const filter;
