import {
  GraphQLResolveInfo,
  SelectionSetNode,
  OperationDefinitionNode,
  SelectionNode,
  GraphQLSchema,
  GraphQLType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLFieldMap,
  GraphQLScalarType,
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
  QueryDetailsFunc,
  QueryResolver,
} from './types';
import { transformDocument } from 'graphql-ast-tools';
import {
  extractSelectionFieldName,
  extractSelectionArguments,
} from './extractors';
import uuid from 'uuid';

const DEFAULT_OPTIONS: DGraphQLOptions = {
  defaultQueryResolver: (args: ResolverArgs, _ctx: any) => ({}),
};

export default class DGraphQL {
  private client: DgraphClient;
  private options: DGraphQLOptions;
  private queryDetailsFuncsById: { [id: string]: QueryDetailsFunc } = {};
  private queryDetailsFuncsByPath: { [path: string]: QueryDetailsFunc } = {};
  private hasReadSchema = false;

  constructor(client: DgraphClient, options: DGraphQLOptions) {
    this.client = client;
    this.options = options;
  }

  createQueryResolver = (queryDetailsFunc: QueryDetailsFunc): QueryResolver => {
    const resolverId = uuid();
    this.queryDetailsFuncsById[resolverId] = queryDetailsFunc;
    const resolver = this.constructResolver(resolverId);
    return resolver;
  };

  private readSchema = (schema: GraphQLSchema) => {
    const typeMap = schema.getTypeMap();
    const idMap = Object.keys(typeMap).reduce((fieldPathToIdMap, typeName) => {
      const type = typeMap[typeName];
      const fields = this.getFieldsForType(type);
      return Object.keys(fields).reduce((pathToIdMap, fieldName) => {
        const field = fields[fieldName];
        // check to see if its one of our id'd resolvers
        if (field.resolve && field.resolve['id']) {
          pathToIdMap[`${typeName}.${fieldName}`] = field.resolve['id'];
        }
        return pathToIdMap;
      }, fieldPathToIdMap);
    }, {});
    this.queryDetailsFuncsByPath = Object.keys(idMap).reduce((map, path) => {
      map[path] = this.queryDetailsFuncsById[idMap[path]];
      return map;
    }, {});
    this.hasReadSchema = true;
  };

  private getFieldsForType = (type: GraphQLType): GraphQLFieldMap<any, any> => {
    if (
      type instanceof GraphQLObjectType ||
      type instanceof GraphQLInterfaceType
    ) {
      return type.getFields();
    }
    return undefined;
  };

  private constructResolver = (id: string): QueryResolver => {
    const resolver: QueryResolver = (
      _parent: any,
      args: ResolverArgs,
      context: any,
      info: GraphQLResolveInfo,
    ) => {
      if (!this.hasReadSchema) {
        this.readSchema(info.schema);
      }

      const simplifiedInfoDocument = transformDocument({
        kind: 'Document',
        loc: info.operation.loc,
        definitions: [info.operation],
      });

      const operation = simplifiedInfoDocument
        .definitions[0] as OperationDefinitionNode;

      const augmentedAST = this.mergeFieldASTWithResolvedInfo(
        operation,
        context,
      );
    };

    resolver.id = id;

    return resolver;
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
}
