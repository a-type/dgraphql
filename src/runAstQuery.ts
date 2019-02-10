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
    console.debug('Variables:');
    console.debug(JSON.stringify(ast.variables));
  }

  const mappedVariables = ast.variables.reduce<{
    [name: string]: DGraphScalar;
  }>((acc, v) => {
    acc[v.name] = v.value;
    return acc;
  }, {});

  const txn = client.newTxn();
  const result = await txn.queryWithVars(queryString, mappedVariables);
  await txn.commit();
  if (debug) {
    console.debug('Dgraph result:');
    console.debug(result);
  }
  return result;
};

export default runAstQuery;
