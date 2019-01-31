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
export type Predicate = string;

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
    [fieldName: string]: Predicate;
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
