import {
  GraphQLResolveInfo,
  SelectionSetNode,
  OperationDefinitionNode,
  SelectionNode,
} from 'graphql';
import { DgraphClient } from 'dgraph-js';
import {
  DGraphQLResolverTree,
  ResolverArgs,
  DGraphQLOptions,
  DGraphAugmentedSelectionSetNode,
  DGraphQLQueryResolver,
  DGraphAugmentedOperationDefinitionNode,
  DGraphAugmentedFieldNode,
} from './types';
import { transformDocument } from 'graphql-ast-tools';
import {
  extractSelectionFieldName,
  extractSelectionArguments,
} from './extractors';

const DEFAULT_OPTIONS: DGraphQLOptions = {
  defaultQueryResolver: (args: ResolverArgs, _ctx: any) => ({}),
};

export default class DGraphQL {
  private client: DgraphClient;
  private resolvers: DGraphQLResolverTree;
  private options: DGraphQLOptions;

  constructor(
    client: DgraphClient,
    resolvers: DGraphQLResolverTree,
    options: DGraphQLOptions,
  ) {
    this.client = client;
    this.resolvers = resolvers;
    this.options = options;
  }

  /**
   * Meant to be used as a drop-in resolver for read queries.
   */
  resolveQuery = (
    _parent: any,
    args: ResolverArgs,
    context: any,
    info: GraphQLResolveInfo,
  ) => {
    const simplifiedInfoDocument = transformDocument({
      kind: 'Document',
      loc: info.operation.loc,
      definitions: [info.operation],
    });

    const augmentedAST = this.mergeFieldASTWithResolvedInfo(
      simplifiedInfoDocument.definitions[0] as OperationDefinitionNode,
      context,
    );
  };

  private mergeFieldASTWithResolvedInfo = (
    operation: OperationDefinitionNode,
    context: any,
  ): DGraphAugmentedOperationDefinitionNode => ({
    ...operation,
    selectionSet: this.recursivelyMergeSelectionASTWithResolvedInfo(
      'foo',
      operation.selectionSet,
      context,
    ),
  });

  private recursivelyMergeSelectionASTWithResolvedInfo = (
    parentType: string,
    selection: SelectionSetNode,
    context: any,
  ): DGraphAugmentedSelectionSetNode<DGraphAugmentedFieldNode> => ({
    ...selection,
    selections: selection.selections.map<DGraphAugmentedFieldNode>(
      (selectionNode: SelectionNode): DGraphAugmentedFieldNode => {
        const fieldName = extractSelectionFieldName(selectionNode);
        const args = extractSelectionArguments(selectionNode);

        return {
          ...selectionNode,
          dgraph: this.getQueryResolver(parentType, fieldName)(args, context),
        } as DGraphAugmentedFieldNode;
      },
    ),
  });

  private getQueryResolver = (
    parentType: string,
    fieldName: string,
  ): DGraphQLQueryResolver => {
    if (this.resolvers[parentType] && this.resolvers[parentType][fieldName]) {
      return this.resolvers[parentType][fieldName];
    }
    return this.options.defaultQueryResolver;
  };
}
