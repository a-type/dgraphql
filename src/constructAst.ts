import {
  GraphQLResolveInfo,
  SelectionNode,
  GraphQLSchema,
  SelectionSetNode,
} from 'graphql';
import {
  DGraphFragmentFunc,
  QueryBlockNode,
  PredicateNode,
  Query,
  QueryVariable,
  NameMap,
} from './types';
import flattenAndConvertVariables from './flattenAndConvertVariables';
import getFieldTypeName from './getTypeNameFromSchema';
import getArgValueNames from './getArgValueNames';
import defaultQueryDetailsFunc from './defaultQueryDetailsFunc';
import getFieldsForType from './getFieldsForType';

type AddBlockArgs = {
  selectionSet: SelectionSetNode;
  resolveInfo: GraphQLResolveInfo;
  parentType: string;
  queryDetailsFuncsById: { [id: string]: DGraphFragmentFunc };
  variables: QueryVariable[];
  variableNameMap: NameMap;
};

const createQueryBlocks = ({
  selectionSet,
  resolveInfo,
  parentType,
  queryDetailsFuncsById,
  variableNameMap,
  variables,
}: AddBlockArgs): QueryBlockNode[] => {
  return selectionSet.selections.reduce((list, selection) => {
    if (selection.kind === 'Field') {
      const { fieldTypeName, queryDetails } = getFieldInfo({
        selection,
        schema: resolveInfo.schema,
        parentType,
        queryDetailsFuncsById,
        variableNameMap,
      });

      return list.concat({
        kind: 'QueryBlock',
        name: selection.name.value,
        ...queryDetails,
        predicates: createPredicateBlocks({
          selectionSet: selection.selectionSet,
          resolveInfo,
          parentType: fieldTypeName,
          queryDetailsFuncsById,
          variableNameMap,
          variables,
        }),
      });
    } else if (selection.kind === 'InlineFragment') {
      return list.concat(
        createQueryBlocks({
          selectionSet: selection.selectionSet,
          resolveInfo,
          parentType,
          queryDetailsFuncsById,
          variableNameMap,
          variables,
        }),
      );
    } else {
      // grab fragment from info
      const fragmentName = selection.name.value;
      const fragment = resolveInfo.fragments[fragmentName];
      return list.concat(
        createQueryBlocks({
          selectionSet: fragment.selectionSet,
          resolveInfo,
          parentType,
          queryDetailsFuncsById,
          variableNameMap,
          variables,
        }),
      );
    }
  }, []);
};

const createPredicateBlocks = ({
  selectionSet,
  resolveInfo,
  parentType,
  queryDetailsFuncsById,
  variables,
  variableNameMap,
}: AddBlockArgs): PredicateNode[] => {
  return selectionSet.selections.reduce((list, selection) => {
    if (selection.kind === 'Field') {
      const { fieldTypeName, queryDetails } = getFieldInfo({
        selection,
        schema: resolveInfo.schema,
        parentType,
        queryDetailsFuncsById,
        variableNameMap,
      });

      const selectionSet = selection.selectionSet;
      if (selectionSet) {
        // if the selection has a nested selection set,
        // it's an edge predicate.
        return list.concat({
          kind: 'EdgePredicate',
          name: selection.name.value,
          ...queryDetails,
          predicates: createPredicateBlocks({
            selectionSet: selection.selectionSet,
            resolveInfo,
            parentType: fieldTypeName,
            queryDetailsFuncsById,
            variableNameMap,
            variables,
          }),
        });
      } else {
        return list.concat({
          kind: 'ScalarPredicate',
          name: selection.name.value,
          ...queryDetails,
        });
      }
    } else if (selection.kind === 'InlineFragment') {
      // dive into fragment selections
      return list.concat(
        createPredicateBlocks({
          selectionSet: selection.selectionSet,
          resolveInfo,
          parentType,
          queryDetailsFuncsById,
          variableNameMap,
          variables,
        }),
      );
    } else {
      // grab fragment from info
      const fragmentName = selection.name.value;
      const fragment = resolveInfo.fragments[fragmentName];
      return list.concat(
        createPredicateBlocks({
          selectionSet: fragment.selectionSet,
          resolveInfo,
          parentType,
          queryDetailsFuncsById,
          variableNameMap,
          variables,
        }),
      );
    }
  }, []);
};

const getFieldResolver = (
  schema: GraphQLSchema,
  typeName: string,
  field: string,
) => {
  // fixme: assumptions
  const type = schema.getType(typeName);
  const fields = getFieldsForType(type);
  return fields[field].resolve;
};

const getVariableName = (possibleVarName: any) => {
  if (typeof possibleVarName === 'string' && possibleVarName.startsWith('$')) {
    return possibleVarName.replace('$', '');
  }
  return null;
};

const getFieldInfo = ({
  selection,
  schema,
  parentType,
  queryDetailsFuncsById,
  variableNameMap,
}: {
  selection: SelectionNode;
  schema: GraphQLSchema;
  parentType: string;
  queryDetailsFuncsById: { [id: string]: DGraphFragmentFunc };
  variableNameMap: NameMap;
}) => {
  if (selection.kind === 'Field') {
    const fieldName = selection.name.value;
    const resolver = getFieldResolver(schema, parentType, fieldName);
    const id = (resolver && resolver['id']) || null;
    const shallowArgNames = getArgValueNames(selection.arguments);
    const argNames = Object.keys(shallowArgNames).reduce(
      (acc, key) => ({
        ...acc,
        [key]:
          (getVariableName(shallowArgNames[key]) &&
            variableNameMap[getVariableName(shallowArgNames[key])]) ||
          shallowArgNames[key],
      }),
      {},
    );
    const queryDetails = (queryDetailsFuncsById[id] || defaultQueryDetailsFunc)(
      argNames,
    );
    return {
      /**
       * a resolver exists for this field, but it is not one of ours.
       * do not include this query block / predicate in our DGraph query,
       * the user must want to resolve it from another source.
       */
      skip: resolver && !id,
      /** id of the query details func stored in our system */
      id,
      /** the name of the field */
      fieldName,
      /** the type name of the field's return value */
      fieldTypeName: getFieldTypeName(schema, parentType, fieldName),
      /** argument name map for this field's arguments, if any */
      argNames,
      /** user-supplied query details for building the DGraph query */
      queryDetails,
    };
  }
};

const constructAst = (
  resolveInfo: GraphQLResolveInfo,
  queryDetailsFuncsById: { [id: string]: DGraphFragmentFunc },
): Query => {
  const { operation, parentType } = resolveInfo;
  const [variables, variableNameMap] = flattenAndConvertVariables(
    operation.variableDefinitions,
    resolveInfo.schema,
  );

  return {
    variables,
    variableNameMap,
    blocks: createQueryBlocks({
      selectionSet: operation.selectionSet,
      resolveInfo,
      parentType: parentType.name,
      queryDetailsFuncsById,
      variables,
      variableNameMap,
    }),
    name: operation.name.value,
  };
};

export default constructAst;
