import { GraphQLResolveInfo } from 'graphql';
import { DgraphClient } from 'dgraph-js';
import { ResolverArgs, DGraphFragmentFunc, QueryResolver } from './types';
import { v4 as uuid } from 'uuid';
import constructAst from './constructAst';
import runAstQuery from './runAstQuery';
import builders from './builders';

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

  filters = builders;

  constructor(client: DgraphClient) {
    this.client = client;
  }

  createQueryResolver = (queryDetailsFunc: DGraphFragmentFunc): QueryResolver => {
    const resolverId = uuid();
    this.queryDetailsFuncsById[resolverId] = queryDetailsFunc;
    const resolver = this.constructResolver(resolverId);
    return resolver;
  };

  private constructResolver = (id: string): QueryResolver => {
    const resolver: QueryResolver = (
      _parent: any,
      _args: ResolverArgs,
      _context: any,
      info: GraphQLResolveInfo,
    ) => {
      const ast = constructAst(info, this.queryDetailsFuncsById);
      return runAstQuery(ast, info.variableValues, this.client);
    };

    resolver.id = id;

    return resolver;
  };
}
