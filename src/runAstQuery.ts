import { Query, NameMap } from "./types";
import { DgraphClient } from "dgraph-js";
import convertToDGraphQuery from "./convertToDGraphQuery";
import { debug } from "./logger";

type GraphQLVariables = { [variableName: string]: any };
type FlatVariables = { [variableName: string]: string | number | boolean | null };

const mapVariables = (flatVariables: FlatVariables, variables: GraphQLVariables, nameMap: NameMap): FlatVariables => {
  return Object.keys(variables).reduce((flattened, name) => {
    const value = variables[name];
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      const flattenedName = nameMap[name];
      if (typeof flattenedName === 'string') {
        flattened[flattenedName.replace('$', '')] = value;
        return flattened;
      } else {
        throw new Error(`The variables provided to the query didn't match the structure extracted from the schema`);
      }
    } else {
      const nextLevelNameMap = nameMap[name];
      if (typeof nextLevelNameMap === 'string') {
        throw new Error(`The variables provided to the query didn't match the structure extracted from the schema`);
      }
      return mapVariables(flattened, value, nextLevelNameMap);
    }
  }, flatVariables);
}

const runAstQuery = async (ast: Query, variables: GraphQLVariables, client: DgraphClient) => {
  const queryString = convertToDGraphQuery(ast);

  // map variables
  const flatVars = mapVariables({}, variables, ast.variableNameMap);

  debug('DGraphQL Query:');
  debug(queryString);
  debug('Variables:');
  debug(JSON.stringify(flatVars));

  const txn = client.newTxn();
  try {
    const result = await txn.queryWithVars(queryString, flatVars);
    await txn.commit();
    return result;
  } finally {
    await txn.discard();
    return null;
  }
};

export default runAstQuery;
