import { GraphQLResolveInfo } from 'graphql';

export type DGraphScalar = string | number | boolean;

export type GenericArgs = {
  [argName: string]: any;
};

export type ResolverArgs = GenericArgs;

/**
 * Types for query building constructs
 */
export type UID = string;

export type Func = string; // todo
export type Filter = string; // todo
export type Language = string; // todo

export type NameMap = {
  [key: string]: any;
};

export type FilterableDetails = {
  filter?: Filter;
  first?: number | string;
  offset?: number | string;
  after?: UID;
  orderasc?: string;
  orderdesc?: string;
};

export type EdgePredicateDetails = FilterableDetails & {
  value?: string;
};

export type QueryBlockDetails = FilterableDetails & {
  func?: Func;
};

export type ScalarPredicateDetails = {
  value?: string;
  language?: Language;
};

export type DGraphFragmentDetails =
  | QueryBlockDetails
  | EdgePredicateDetails
  | ScalarPredicateDetails;

export type DGraphFragmentFunc = (argNames: NameMap) => DGraphFragmentDetails;

export type QueryResolver = {
  (parent: any, args: ResolverArgs, ctx: any, info: GraphQLResolveInfo): any;
};

/**
 * Types that define the AST from which we generate the DGraph query
 */

export type QueryVariableType = 'int' | 'float' | 'bool' | 'string';

export type QueryVariable = {
  name: string;
  value: DGraphScalar;
  type: QueryVariableType;
  defaultValue?: DGraphScalar;
};

export interface FilterableNode {
  filter?: Filter;
  first?: number | string;
  offset?: number | string;
  after?: UID;
  orderasc?: string;
  orderdesc?: string;
}

export interface ParentNode {
  predicates: PredicateNode[];
}

export type ScalarPredicateNode = {
  kind: 'ScalarPredicate';
  /**
   * Optional: gets the value of this predicate using a string you provide. When
   * #value is provided, #name becomes the alias for the value.
   */
  value?: string;
  /**
   * The name of the predicate as it is returned. Use #value to determine the
   * value of the predicate separately from its name (alias)
   */
  name: string;
  language?: Language;
};

export type EdgePredicateNode = FilterableNode &
  ParentNode & {
    kind: 'EdgePredicate';
    /**
     * The name of the predicate as it is returned. Use #value to determine the
     * value of the predicate separately from its name (alias)
     */
    name: string;
    /**
     * Optional: gets the value of this predicate using a string you provide. When
     * #value is provided, #name becomes the alias for the value.
     */
    value?: string;
  };

export type PredicateNode = ScalarPredicateNode | EdgePredicateNode;

export type QueryBlockNode = FilterableNode &
  ParentNode & {
    kind: 'QueryBlock';
    name: string;
    func?: Func;
  };

export type Query = {
  variables: QueryVariable[];
  variableNameMap: NameMap;
  name?: string;
  blocks: QueryBlockNode[];
};
