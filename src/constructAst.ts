import {
  GraphQLResolveInfo,
  SelectionNode,
  GraphQLSchema,
  SelectionSetNode,
} from 'graphql';
import {
  DGraphFragmentFunc,
  QueryBlockNode,
  Query,
  QueryVariable,
  ResolverArgs,
  ParentNode,
  EdgePredicateNode,
  ScalarPredicateNode,
  DGraphFragmentDetails,
} from './types';
import getFieldTypeName from './getTypeNameFromSchema';
import defaultQueryDetailsFunc from './defaultQueryDetailsFunc';
import valueNodeToValue from './valueNodeToValue';
import getFieldResolver from './getFieldResolver';
import getFieldArgs from './getFieldArgs';
import getArgTypeMap from './getArgTypeMap';

type AddBlockArgs = {
  selectionSet: SelectionSetNode;
  resolveInfo: GraphQLResolveInfo;
  parentType: string;
  queryDetailsFuncsByPath: { [id: string]: DGraphFragmentFunc };
  variableValues: { [variableName: string]: any };
  debug?: boolean;
};

// TODO: get clever and combine addQueryBlocks and addPredicates, since
// they are so similar...
const addQueryBlocks = (
  ast: Query,
  {
    selectionSet,
    resolveInfo,
    parentType,
    queryDetailsFuncsByPath,
    variableValues,
    debug = false,
  }: AddBlockArgs,
): Query => {
  return selectionSet.selections.reduce<Query>((ast, selection) => {
    if (selection.kind === 'Field') {
      if (debug) {
        console.debug('DGraphQL resolving field');
      }

      const {
        fieldTypeName,
        dgraphFragmentDetails: queryDetails,
        skip,
        variables,
      } = getFieldInfo(
        {
          selection,
          schema: resolveInfo.schema,
          parentType,
          queryDetailsFuncsByPath,
          variableValues,
        },
        debug,
      );

      // skip means this is a field the user wants to resolve outside
      // of the dgraph query, like a relationship to data from another
      // source.
      if (skip) {
        return ast;
      }

      // add any extracted variables to the query
      ast.variables.push(...variables);

      const queryBlock: QueryBlockNode = {
        kind: 'QueryBlock',
        name: selection.name.value,
        ...queryDetails,
        predicates: [],
      };

      ast.blocks.push(queryBlock);

      // add predicates for fields
      addPredicates(ast, queryBlock, {
        selectionSet: selection.selectionSet,
        resolveInfo,
        parentType: fieldTypeName,
        queryDetailsFuncsByPath,
        variableValues,
        debug,
      });

      return ast;
    } else if (selection.kind === 'InlineFragment') {
      if (debug) {
        console.debug('DGraphQL resolving inline fragment');
      }

      return addQueryBlocks(ast, {
        selectionSet: selection.selectionSet,
        resolveInfo,
        parentType,
        queryDetailsFuncsByPath,
        variableValues,
        debug,
      });
    } else {
      if (debug) {
        console.debug('DGraphQL resolving named fragment');
      }

      // grab fragment from info
      const fragmentName = selection.name.value;
      const fragment = resolveInfo.fragments[fragmentName];
      return addQueryBlocks(ast, {
        selectionSet: fragment.selectionSet,
        resolveInfo,
        parentType,
        queryDetailsFuncsByPath,
        variableValues,
        debug,
      });
    }
  }, ast);
};

const addPredicates = (
  ast: Query,
  parentNode: ParentNode,
  {
    selectionSet,
    resolveInfo,
    parentType,
    queryDetailsFuncsByPath,
    variableValues,
    debug,
  }: AddBlockArgs,
): Query => {
  return selectionSet.selections.reduce<Query>((ast, selection) => {
    if (selection.kind === 'Field') {
      const {
        fieldTypeName,
        dgraphFragmentDetails: queryDetails,
        variables,
        skip,
      } = getFieldInfo({
        selection,
        schema: resolveInfo.schema,
        parentType,
        queryDetailsFuncsByPath,
        variableValues,
      });

      // skip means this is a field the user wants to resolve outside
      // of the dgraph query, like a relationship to data from another
      // source.
      if (skip) {
        return ast;
      }

      // add any extracted variables to the query
      ast.variables.push(...variables);

      const selectionSet = selection.selectionSet;
      if (selectionSet) {
        // if the selection has a nested selection set,
        // it's an edge predicate.
        const edgePredicate: EdgePredicateNode = {
          kind: 'EdgePredicate',
          name: selection.name.value,
          ...queryDetails,
          predicates: [],
        };

        parentNode.predicates.push(edgePredicate);

        addPredicates(ast, edgePredicate, {
          selectionSet: selection.selectionSet,
          resolveInfo,
          parentType: fieldTypeName,
          queryDetailsFuncsByPath,
          variableValues,
          debug,
        });

        return ast;
      } else {
        const scalarPredicate: ScalarPredicateNode = {
          kind: 'ScalarPredicate',
          name: selection.name.value,
          ...queryDetails,
        };

        parentNode.predicates.push(scalarPredicate);

        return ast;
      }
    } else if (selection.kind === 'InlineFragment') {
      // 'hop over' fragment selections, keeping the
      // same parent node and unwrapping them into it
      return addPredicates(ast, parentNode, {
        selectionSet: selection.selectionSet,
        resolveInfo,
        parentType,
        queryDetailsFuncsByPath,
        variableValues,
        debug,
      });
    } else {
      // same as inline fragments, we just have to go
      // grab the fragment definition from info
      const fragmentName = selection.name.value;
      const fragment = resolveInfo.fragments[fragmentName];
      return addPredicates(ast, parentNode, {
        selectionSet: fragment.selectionSet,
        resolveInfo,
        parentType,
        queryDetailsFuncsByPath,
        variableValues,
        debug,
      });
    }
  }, ast);
};

type FieldInfo = {
  /**
   * a resolver exists for this field, but it is not one of ours.
   * do not include this query block / predicate in our DGraph query,
   * the user must want to resolve it from another source.
   */
  skip: boolean;
  /** the name of the field */
  fieldName: string;
  /** the type name of the field's return value */
  fieldTypeName: string;
  /** argument name map for this field's arguments, if any */
  argNames: { [path: string]: any };
  /** the graphql variables needed for this field in the root query */
  variables: QueryVariable[];
  /** user-supplied query details for building the DGraph query */
  dgraphFragmentDetails: DGraphFragmentDetails;
};

const getFieldInfo = (
  {
    selection,
    schema,
    parentType,
    queryDetailsFuncsByPath,
    variableValues,
  }: {
    selection: SelectionNode;
    schema: GraphQLSchema;
    parentType: string;
    queryDetailsFuncsByPath: { [path: string]: DGraphFragmentFunc };
    variableValues: { [name: string]: any };
  },
  debug: boolean = false,
): FieldInfo => {
  if (debug) {
    console.debug('DGraphQL getting field info for selection:');
    console.debug(JSON.stringify(selection));
  }
  if (selection.kind === 'Field') {
    const fieldName = selection.name.value;
    const resolver = getFieldResolver(schema, parentType, fieldName);
    const args = getFieldArgs(schema, parentType, fieldName);
    const queryDetailsFunc =
      queryDetailsFuncsByPath[`${parentType}.${fieldName}`];

    /**
     * ok, we have 2 things here... we have the explicit arguments passed to this
     * field (selection.arguments) by the user. And we have any default arguments
     * which are defined in the schema itself (we got those with getFieldArgs())
     * Now, the trick is to create two structures:
     * 1. A list of uniquely named variables with the real argument values
     * 2. A deep map of the actual structured provided arguments, which
     *    map to the unique variable names assigned in 1.
     * The variable names (1) will be used in the final Dgraph query. The name
     * map (2) will be used in the predicates to reference those variables for use.
     * To the user of this library, it will appear that they are just rearranging
     * GraphQL args down to Dgraph. But in reality we are promoting all those args
     * as variables and replacing their usage in predicates with the variable names.
     */
    const variables: QueryVariable[] = [];
    const argNames: { [name: string]: any } = {};

    // first, combine default values and provided values into one structure
    const argValues = args
      .filter(arg => !!arg.defaultValue)
      .reduce<{ [name: string]: any }>((map, arg) => {
        map[arg.name] = arg.defaultValue;
        // lookup provided value if present
        const provided = selection.arguments.find(
          node => node.name.value === arg.name,
        );
        if (provided) {
          map[arg.name] = valueNodeToValue(provided.value, variableValues);
        }
        return map;
      }, {});
    const argTypes = getArgTypeMap(args);

    // using array destructuring like a tuple, we read over the structure and extract
    // flattened names.
    Object.keys(argValues).reduce<[QueryVariable[], { [name: string]: any }]>(
      ([variableValues, argNames], argName) => {
        const argValue = argValues[argName];
        const baseArgName = `${parentType}_${fieldName}_${argName}`;
        // recursively work through the structure of the value, extracting names
        const flattenAndAddValues = (
          value: any,
          key: any,
          nameMapParent: { [name: string]: any },
          typeMapParent: { [name: string]: any },
          variableName: string,
        ) => {
          if (typeof value === 'object') {
            if (value instanceof Array) {
              // mimic structure in our name map
              nameMapParent[key] = [];
              // map each array item to flattener
              value.forEach((subValue, index) => {
                flattenAndAddValues(
                  subValue,
                  index,
                  nameMapParent[index],
                  // this is a special identifier, see getArgTypeMap comment
                  typeMapParent.arrayOf,
                  `${baseArgName}_${index}`,
                );
              });
              return;
            } else {
              // mimic structure in our name map
              nameMapParent[key] = {};
              // map each value to flattener
              Object.keys(value).forEach(valueKey =>
                flattenAndAddValues(
                  value[valueKey],
                  valueKey,
                  nameMapParent[key],
                  typeMapParent[key],
                  `${variableName}_${valueKey}`,
                ),
              );
              return;
            }
          } else {
            // assign final name to name map
            nameMapParent[key] = `$${variableName}`;
            // create a new variable by that name with correct value
            variableValues.push({
              name: `$${variableName}`,
              value,
              type: typeMapParent[key],
            });

            return;
          }
        };

        flattenAndAddValues(argValue, argName, argNames, argTypes, baseArgName);

        return [variableValues, argNames];
      },
      [variables, argNames],
    );

    const queryDetails = (queryDetailsFunc || defaultQueryDetailsFunc)(
      argNames,
    );
    if (debug) {
      console.debug('DGraphQL query field resolver info');
      console.debug(
        `path: ${parentType}.${fieldName}, args: ${JSON.stringify(argNames)}`,
      );
      console.debug(`user info: ${JSON.stringify(queryDetails)}`);
    }
    return {
      skip: resolver && !queryDetailsFunc,
      fieldName,
      fieldTypeName: getFieldTypeName(schema, parentType, fieldName),
      argNames,
      variables,
      dgraphFragmentDetails: queryDetails,
    };
  }
};

const constructAst = (
  resolveInfo: GraphQLResolveInfo,
  variableValues: { [name: string]: any },
  queryDetailsFuncsById: { [id: string]: DGraphFragmentFunc },
  debug: boolean = false,
): Query => {
  const { operation, parentType } = resolveInfo;

  const ast: Query = {
    variables: [],
    variableNameMap: {},
    blocks: [],
    name: operation.name && operation.name.value,
  };

  return addQueryBlocks(ast, {
    selectionSet: operation.selectionSet,
    resolveInfo,
    parentType: parentType.name,
    queryDetailsFuncsByPath: queryDetailsFuncsById,
    variableValues,
    debug,
  });
};

export default constructAst;
