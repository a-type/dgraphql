import { Query, DGraphScalar } from './types';
import { DgraphClient } from 'dgraph-js';
import convertToDGraphQuery from './convertToDGraphQuery';

const runAstQuery = async (
  ast: Query,
  client: DgraphClient,
  debug: boolean = false,
) => {
  const queryString = convertToDGraphQuery(ast);

  if (debug) {
    console.debug('DGraphQL AST:');
    console.debug(JSON.stringify(ast));
    console.debug('DGraphQL Query:');
    console.debug(queryString);
  }

  const txn = client.newTxn();
  const result = await txn.query(queryString);
  const json = await result.getJson();
  if (debug) {
    console.debug('Dgraph result:');
    console.debug(json);
  }
  return json;
};

export default runAstQuery;
