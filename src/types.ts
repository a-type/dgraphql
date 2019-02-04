import { GraphQLResolveInfo } from 'graphql';

export type GenericArgs = {
  [argName: string]: any;
};

export type ResolverArgs = GenericArgs;

/**
 * Types for query building constructs
 */
export type UID = string;

export type Func = null; // todo
export type Filter = null; // todo
export type CustomPredicate = string;
export type Language = string; // todo

export type QueryDetailsArgNames = {
  [key: string]: string;
};

export type QueryDetails = {
  func?: Func;
  filter?: Filter | Filter[];
  first?: number;
  offset?: number;
  after?: UID;
  orderasc?: string;
  orderdesc?: string;
  customPredicates?: {
    [fieldName: string]: CustomPredicate;
  };
};

export type QueryDetailsFunc = (argNames: QueryDetailsArgNames) => QueryDetails;

export type QueryResolver = {
  (parent: any, args: ResolverArgs, ctx: any, info: GraphQLResolveInfo): any;
  id: string;
};

/**
 * Types that define the AST from which we generate the DGraph query
 */

export type QueryVariableType = 'int' | 'float' | 'bool' | 'string';

export type QueryVariable = {
  name: string;
  type: QueryVariableType;
  defaultValue?: number | boolean | string;
};

export interface FilterableNode {
  filter?: Filter[];
  first?: number;
  offset?: number;
  after?: UID;
  orderasc?: string;
  orderdesc?: string;
}

export type ScalarPredicateNode = {
  kind: 'ScalarPredicate';
  value: string;
  alias?: string;
  language?: Language;
};

export type EdgePredicateNode = FilterableNode & {
  kind: 'EdgePredicate';
  alias?: string;
  predicates: PredicateNode[];
};

export type PredicateNode = ScalarPredicateNode | EdgePredicateNode;

export type QueryBlockNode = FilterableNode & {
  kind: 'QueryBlock';
  func?: Func;
  predicates: PredicateNode[];
};

export type Query = {
  variables: QueryVariable[];
  name?: string;
  blocks: QueryBlockNode[];
};
