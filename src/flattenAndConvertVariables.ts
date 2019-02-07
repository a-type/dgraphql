import {
  VariableDefinitionNode,
  GraphQLSchema,
  TypeNode,
  ValueNode,
  isEnumType,
  isInputObjectType,
  GraphQLInputType,
  GraphQLInputObjectType,
  isListType,
  NamedTypeNode,
  GraphQLType,
  isScalarType,
  NonNullTypeNode,
  ListTypeNode,
  ObjectValueNode,
} from 'graphql';
import {
  QueryVariable,
  QueryVariableType,
  NameMap,
} from './types';
import { getTypeName } from './getTypeNameFromSchema';
import { getArgValueName } from './getArgValueNames';

const GRAPHQL_SCALAR_TYPES = ['String', 'Int', 'Float', 'Boolean'];

const convertQueryVariableType = (graphQLType: string): QueryVariableType => {
  switch (graphQLType) {
    case 'Int':
      return 'int';
    case 'Float':
      return 'float';
    case 'Boolean':
      return 'bool';
    default:
      return 'string';
  }
};

type SchemaTypeInfo = {
  nameRoot: string;
  name: string;
  type: GraphQLType;
  defaultValue?: ValueNode;
  schema: GraphQLSchema;
};

type FlattenResult = [QueryVariable[], NameMap];
type NestedFlattenResult = [QueryVariable[], NameMap | string];

const combineNames = (baseName: string, key: string) => `${baseName}_${key}`;

const getNestedDefaultValueNode = (value: ObjectValueNode, key: string) => {
  const field = value.fields.find(field => field.name.value === key);
  if (!field) {
    return undefined;
  }
  return field.value;
};

const flattenAndConvertSchemaType = (
  [variables, nameMap]: NestedFlattenResult,
  { nameRoot, type, defaultValue, schema, name }: SchemaTypeInfo,
): NestedFlattenResult => {
  if (isScalarType(type)) {
    variables.push({
      name: nameRoot,
      type: convertQueryVariableType(getTypeName(type)),
      defaultValue: defaultValue && getArgValueName(defaultValue),
    });
    nameMap[name] = `$${nameRoot}`;

    return [variables, nameMap];
  } else if (isEnumType(type)) {
    variables.push({
      name: nameRoot,
      type: 'string',
      defaultValue: defaultValue && getArgValueName(defaultValue),
    });
    nameMap[name] = `$${nameRoot}`;

    return [variables, nameMap];
  } else if (isInputObjectType(type)) {
    const fields = type.getFields();
    const allSublevelsResult = Object.keys(fields).reduce<NestedFlattenResult>(
      (acc, fieldName) => {
        const nestedDefault =
          defaultValue && defaultValue.kind === 'ObjectValue'
            ? getNestedDefaultValueNode(defaultValue, fieldName)
            : undefined;
        return flattenAndConvertSchemaType(acc, {
          nameRoot: combineNames(nameRoot, fieldName),
          name: fieldName,
          type: fields[fieldName].type,
          defaultValue: nestedDefault,
          schema,
        });
      },
      [variables, {}],
    );

    return [
      allSublevelsResult[0],
      {
        ...(nameMap as NameMap),
        [name]: allSublevelsResult[1],
      },
    ];
  }
};

type TypeNodeInfo = {
  name: string;
  type: TypeNode;
  defaultValue?: ValueNode;
  schema: GraphQLSchema;
};

const flattenAndConvertNamedType = (
  [variables, nameMap]: FlattenResult,
  { name, type, defaultValue, schema }: TypeNodeInfo,
): FlattenResult => {
  if (type.kind === 'NamedType') {
    const schemaTypeName = type.name.value;
    const schemaType = schema.getType(schemaTypeName);
    return flattenAndConvertSchemaType([variables, nameMap], {
      nameRoot: name,
      name,
      type: schemaType,
      defaultValue,
      schema,
    }) as FlattenResult;
  } else if (type.kind === 'NonNullType') {
    return flattenAndConvertNamedType([variables, nameMap], {
      name,
      type: type.type,
      defaultValue,
      schema,
    });
  } else {
    // no support for list variables... yet... still trying to figure
    // out how to flatten them when we don't actually know how many
    // items will be coming in on the final value. Perhaps we can wait
    // until query execution and utilize the passed in value itself
    return [variables, nameMap];
  }
};

/**
 * Converts GraphQL query variables into a flat list of named and type-coerced DGraph query variables
 * @param variables GraphQL query variables
 * @param schema Corresponding schema
 */
const flattenAndConvertVariables = (
  variables: ReadonlyArray<VariableDefinitionNode>,
  schema: GraphQLSchema,
): FlattenResult => {
  // quick unwrap of VariableDefinitionNode into a more neutral format
  return variables.reduce<FlattenResult>(
    (acc, varDef) =>
      flattenAndConvertNamedType(acc, {
        name: varDef.variable.name.value,
        type: varDef.type,
        defaultValue: varDef.defaultValue,
        schema,
      }),
    [[], {}],
  );
};

export default flattenAndConvertVariables;
