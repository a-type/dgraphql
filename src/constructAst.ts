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
  ParentNode,
  EdgePredicateNode,
  ScalarPredicateNode,
  DGraphFragmentDetails,
  EdgePredicateDetails,
  QueryBlockDetails,
} from './types';
import getFieldTypeName from './getTypeNameFromSchema';
import defaultQueryDetailsFunc from './defaultQueryDetailsFunc';
import valueNodeToValue from './valueNodeToValue';
import getFieldArgs from './getFieldArgs';

type AddBlockArgs = {
  selectionSet: SelectionSetNode;
  resolveInfo: GraphQLResolveInfo;
  parentType: string;
  queryDetailsFuncsByPath: { [id: string]: DGraphFragmentFunc };
  resolveBlacklist: string[];
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
    resolveBlacklist,
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
      } = getFieldInfo(
        {
          selection,
          schema: resolveInfo.schema,
          parentType,
          queryDetailsFuncsByPath,
          variableValues: resolveInfo.variableValues,
          resolveBlacklist,
        },
        debug,
      );

      // skip means this is a field the user wants to resolve outside
      // of the dgraph query, like a relationship to data from another
      // source.
      if (skip) {
        return ast;
      }

      const queryBlock: QueryBlockNode = {
        kind: 'QueryBlock',
        name: selection.name.value,
        ...(queryDetails as QueryBlockDetails),
        predicates: [],
      };

      ast.blocks.push(queryBlock);

      // add predicates for fields
      addPredicates(ast, queryBlock, {
        selectionSet: selection.selectionSet,
        resolveInfo,
        parentType: fieldTypeName,
        queryDetailsFuncsByPath,
        resolveBlacklist,
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
        resolveBlacklist,
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
        resolveBlacklist,
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
    resolveBlacklist,
    debug,
  }: AddBlockArgs,
): Query => {
  return selectionSet.selections.reduce<Query>((ast, selection) => {
    if (selection.kind === 'Field') {
      const {
        fieldTypeName,
        dgraphFragmentDetails: queryDetails,
        skip,
      } = getFieldInfo({
        selection,
        schema: resolveInfo.schema,
        parentType,
        queryDetailsFuncsByPath,
        variableValues: resolveInfo.variableValues,
        resolveBlacklist,
      });

      // skip means this is a field the user wants to resolve outside
      // of the dgraph query, like a relationship to data from another
      // source.
      if (skip) {
        return ast;
      }

      const selectionSet = selection.selectionSet;
      if (selectionSet) {
        // if the selection has a nested selection set,
        // it's an edge predicate.
        const edgePredicate: EdgePredicateNode = {
          kind: 'EdgePredicate',
          name: selection.name.value,
          ...(queryDetails as EdgePredicateDetails),
          predicates: [],
        };

        parentNode.predicates.push(edgePredicate);

        addPredicates(ast, edgePredicate, {
          selectionSet: selection.selectionSet,
          resolveInfo,
          parentType: fieldTypeName,
          queryDetailsFuncsByPath,
          resolveBlacklist,
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
        resolveBlacklist,
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
        resolveBlacklist,
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
  /** fully defaulted arg values passed to resolver */
  argValues: { [name: string]: any };
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
    resolveBlacklist,
  }: {
    selection: SelectionNode;
    schema: GraphQLSchema;
    parentType: string;
    queryDetailsFuncsByPath: { [path: string]: DGraphFragmentFunc };
    variableValues: { [name: string]: any };
    resolveBlacklist: string[];
  },
  debug: boolean = false,
): FieldInfo => {
  if (debug) {
    console.debug('DGraphQL getting field info for selection:');
    console.debug(JSON.stringify(selection));
  }
  if (selection.kind === 'Field') {
    const fieldName = selection.name.value;
    const args = getFieldArgs(schema, parentType, fieldName);
    const queryDetailsFunc =
      queryDetailsFuncsByPath[`${parentType}.${fieldName}`];

    // first, combine default values and provided values into one structure
    const argValues = args
      .filter(arg => arg.defaultValue !== undefined)
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

    const queryDetails = (queryDetailsFunc || defaultQueryDetailsFunc)(
      argValues,
    );
    if (debug) {
      console.debug('DGraphQL query field resolver info');
      console.debug(
        `path: ${parentType}.${fieldName}, args: ${JSON.stringify(argValues)}`,
      );
      console.debug(`user info: ${JSON.stringify(queryDetails)}`);
    }
    return {
      // this feels pretty brittle FIXME
      skip: resolveBlacklist.includes([parentType, fieldName].join('.')),
      fieldName,
      fieldTypeName: getFieldTypeName(schema, parentType, fieldName),
      argValues,
      dgraphFragmentDetails: queryDetails,
    };
  }
};

const constructAst = (
  resolveInfo: GraphQLResolveInfo,
  queryDetailsFuncsById: { [id: string]: DGraphFragmentFunc },
  resolveBlacklist: string[], // paths we should not add to a Dgraph query
  debug: boolean = false,
): Query => {
  const { operation, parentType } = resolveInfo;

  const ast: Query = {
    blocks: [],
    name: operation.name && operation.name.value,
  };

  return addQueryBlocks(ast, {
    selectionSet: operation.selectionSet,
    resolveInfo,
    parentType: parentType.name,
    queryDetailsFuncsByPath: queryDetailsFuncsById,
    resolveBlacklist,
    debug,
  });
};

export default constructAst;
