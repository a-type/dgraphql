import {
  GraphQLResolveInfo,
  OperationDefinitionNode,
  GraphQLSchema,
  GraphQLType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLFieldMap,
  SelectionNode,
} from 'graphql';
import { DgraphClient } from 'dgraph-js';
import { ResolverArgs, QueryDetailsFunc, QueryResolver, Query } from './types';
import { transformDocument } from 'graphql-ast-tools';
import uuid from 'uuid';

export default class DGraphQL {
  private client: DgraphClient;
  private queryDetailsFuncsById: { [id: string]: QueryDetailsFunc } = {};
  private queryDetailsFuncsByPath: { [path: string]: QueryDetailsFunc } = {};
  private hasReadSchema = false;

  constructor(client: DgraphClient) {
    this.client = client;
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

      const simplifiedOperation = simplifiedInfoDocument
        .definitions[0] as OperationDefinitionNode;

      const simplifiedResolveInfo: GraphQLResolveInfo = {
        ...info,
        operation: simplifiedOperation,
      };
    };

    resolver.id = id;

    return resolver;
  };

  private constructAst = (
    resolveInfo: GraphQLResolveInfo,
    schema: GraphQLSchema,
  ) => {
    const { operation, parentType } = resolveInfo;

    const query: Query = {
      variables: [],
      blocks: [],
      name: operation.name.value,
    };

    operation.selectionSet.selections.reduce(
      (query, selection) =>
        this.addQueryBlock({
          query,
          selection,
          schema,
          parentType: parentType.name,
        }),
      query,
    );
  };

  private addQueryBlock = ({
    query,
    selection,
    schema,
    parentType,
  }: {
    query: Query;
    selection: SelectionNode;
    schema: GraphQLSchema;
    parentType: string;
  }): Query => {
    if (selection.kind === 'Field') {
      const fieldName = selection.name.value;
      const resolver = this.getFieldResolver(schema, parentType, fieldName);
      const id = resolver['id'];

      // todo: get query info from user function

      query.blocks.push({
        predicates: [],
      });

      return query;
    } else {
      // can't wrap my head around a fragment in the main block yet. not even sure it's legal?
      return query;
    }
  };

  private getFieldResolver = (
    schema: GraphQLSchema,
    typeName: string,
    field: string,
  ) => {
    // fixme: assumptions
    const type = schema.getType(typeName);
    const fields = this.getFieldsForType(type);
    return fields[field].resolve;
  };
}
