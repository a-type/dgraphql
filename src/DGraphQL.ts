import { GraphQLResolveInfo } from 'graphql';
import { DgraphClient } from 'dgraph-js';
import { ResolverArgs, DGraphFragmentFunc, QueryResolver } from './types';
import { v4 as uuid } from 'uuid';
import constructAst from './constructAst';
import runAstQuery from './runAstQuery';
import builders from './builders';

const DGRAPHQL_RESOLVER_ID_KEY = 'dgraphQLResolverId';

export type DGraphQLOptions = {
  debug?: boolean;
};

/**
 * Although this class is used as the primary means of interacting with the library,
 * it's mostly just a container for the stateful parts. Mainly, a map of unique ids to
 * user-defined query details functions which we call to help glue together each
 * block of the GraphQL -> DGraph query, transfering all variables into DGraph
 * appropriately and according to how the user wants to translate their queries.
 */
export default class DGraphQL {
  private client: DgraphClient;
  private queryDetailsFuncsById: { [id: string]: DGraphFragmentFunc } = {};
  private queryDetailsFuncsByPath: { [path: string]: DGraphFragmentFunc } = {};
  private resolveBlacklist: string[] = [];
  private options: DGraphQLOptions;

  filters = builders;

  constructor(
    client: DgraphClient,
    options: DGraphQLOptions = { debug: false },
  ) {
    this.client = client;
    this.options = options;
  }

  readResolvers = (resolverTree: { [field: string]: any }) => {
    const idMap = Object.keys(resolverTree).reduce(
      (fieldPathToIdMap, typeName) => {
        const resolver = resolverTree[typeName];
        if (typeof resolver === 'object') {
          return Object.keys(resolver).reduce((pathToIdMap, fieldName) => {
            const field = resolver[fieldName];
            // check to see if its one of our id'd resolvers
            if (typeof field === 'function') {
              if (field[DGRAPHQL_RESOLVER_ID_KEY]) {
                if (this.options.debug) {
                  console.debug(
                    `DGraphQL read resolver: ${
                      field[DGRAPHQL_RESOLVER_ID_KEY]
                    }`,
                  );
                }
                pathToIdMap[`${typeName}.${fieldName}`] =
                  field[DGRAPHQL_RESOLVER_ID_KEY];
              } else {
                this.resolveBlacklist.push(`${typeName}.${fieldName}`);
              }
            }
            return pathToIdMap;
          }, fieldPathToIdMap);
        } else if (resolver) {
          if (resolver[DGRAPHQL_RESOLVER_ID_KEY]) {
            // TODO: actually use type level resolvers... if such a thing is real?
            if (this.options.debug) {
              console.debug(
                `DGraphQL read resolver: ${resolver[DGRAPHQL_RESOLVER_ID_KEY]}`,
              );
            }
            fieldPathToIdMap[typeName] = resolver[DGRAPHQL_RESOLVER_ID_KEY];
          } else {
            this.resolveBlacklist.push(typeName);
          }
        }
      },
      {},
    );

    this.queryDetailsFuncsByPath = Object.keys(idMap).reduce((map, path) => {
      map[path] = this.queryDetailsFuncsById[idMap[path]];
      return map;
    }, {});
  };

  createQueryResolver = (
    queryDetailsFunc: DGraphFragmentFunc,
  ): QueryResolver => {
    const resolverId = uuid();
    this.queryDetailsFuncsById[resolverId] = queryDetailsFunc;
    const resolver = this.constructResolver(resolverId);
    if (this.options.debug) {
      console.debug(`DGraphQL: registered resolver with id ${resolverId}`);
    }
    return resolver;
  };

  private constructResolver = (id: string): QueryResolver => {
    const resolver: QueryResolver = async (
      parent: any,
      // we will use the arg values, but we will reference them from the
      // info arg instead just due to the way we will end up having
      // to pre-traverse the entire query in a consistent way.
      _args: ResolverArgs,
      _context: any,
      info: GraphQLResolveInfo,
    ) => {
      // short-circuit if a resolver further up has already run the query
      if (parent && parent[info.fieldName]) {
        return parent[info.fieldName];
      }

      const ast = constructAst(
        info,
        this.queryDetailsFuncsByPath,
        this.resolveBlacklist,
        this.options.debug,
      );
      const result = await runAstQuery(ast, this.client, this.options.debug);
      const fieldValue = result[info.fieldName];
      return fieldValue;
    };

    resolver[DGRAPHQL_RESOLVER_ID_KEY] = id;

    return resolver;
  };
}
