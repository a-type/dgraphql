import {
  GraphQLResolveInfo,
  SelectionNode,
  FieldNode,
  SelectionSetNode,
  OperationDefinitionNode,
} from 'graphql';

export type GenericArgs = {
  [argName: string]: any;
};

export type ResolverArgs = GenericArgs;

export type DGraphQLQueryFragmentDefinition = {
  func?: string;
  filter?: string;
  arguments?: GenericArgs;
  alias?: string;
};

export type DGraphQLQueryResolver = (
  args: ResolverArgs,
  context: any,
) => DGraphQLQueryFragmentDefinition;

export type DGraphQLQueryTypeResolver = {
  [fieldName: string]: DGraphQLQueryResolver;
};

export type DGraphQLResolverTree = {
  Query: DGraphQLQueryTypeResolver;
};

export type DGraphQLOptions = {
  defaultQueryResolver: DGraphQLQueryResolver;
};

export type DGraphAugmentedSelectionSetNode<
  SelectionNodeType
> = SelectionSetNode & {
  selections: ReadonlyArray<SelectionNodeType>;
};

export type DGraphAugmentedFieldNode = FieldNode & {
  readonly dgraph: DGraphQLQueryFragmentDefinition;
  readonly selectionSet: DGraphAugmentedSelectionSetNode<
    DGraphAugmentedFieldNode
  >;
};

export type DGraphAugmentedOperationDefinitionNode = OperationDefinitionNode & {
  readonly selectionSet: DGraphAugmentedSelectionSetNode<
    DGraphAugmentedFieldNode
  >;
};

/**
 * Begin: types for query building constructs
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
