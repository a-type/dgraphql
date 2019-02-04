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
import { QueryVariable, QueryVariableType } from './types';
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
  type: GraphQLType;
  defaultValue?: ValueNode;
  schema: GraphQLSchema;
};

const combineNames = (baseName: string, key: string) => `${baseName}_${key}`;

const getNestedDefaultValueNode = (value: ObjectValueNode, key: string) => {
  const field = value.fields.find(field => field.name.value === key);
  if (!field) {
    return undefined;
  }
  return field.value;
};

const flattenAndConvertSchemaType = ({
  nameRoot,
  type,
  defaultValue,
  schema,
}: SchemaTypeInfo): QueryVariable | QueryVariable[] => {
  if (isScalarType(type)) {
    return {
      name: nameRoot,
      type: convertQueryVariableType(getTypeName(type)),
      defaultValue: defaultValue && getArgValueName(defaultValue),
    };
  } else if (isEnumType(type)) {
    return {
      name: nameRoot,
      type: 'string',
      defaultValue: defaultValue && getArgValueName(defaultValue),
    };
  } else if (isInputObjectType(type)) {
    const fields = type.getFields();
    return Object.keys(fields).reduce((list, fieldName) => {
      const nestedDefault =
        defaultValue && defaultValue.kind === 'ObjectValue'
          ? getNestedDefaultValueNode(defaultValue, fieldName)
          : undefined;
      return list.concat(
        flattenAndConvertSchemaType({
          nameRoot: combineNames(nameRoot, fieldName),
          type: fields[fieldName].type,
          defaultValue: nestedDefault,
          schema,
        }),
      );
    }, []);
  }
};

type TypeNodeInfo = {
  nameRoot: string;
  type: TypeNode;
  defaultValue?: ValueNode;
  schema: GraphQLSchema;
};

const flattenAndConvertNamedType = ({
  nameRoot,
  type,
  defaultValue,
  schema,
}: TypeNodeInfo): QueryVariable | QueryVariable[] => {
  if (type.kind === 'NamedType') {
    const schemaTypeName = type.name.value;
    const schemaType = schema.getType(schemaTypeName);
    return flattenAndConvertSchemaType({
      nameRoot,
      type: schemaType,
      defaultValue,
      schema,
    });
  } else if (type.kind === 'NonNullType') {
    return flattenAndConvertNamedType({
      nameRoot,
      type: type.type,
      defaultValue,
      schema,
    });
  } else {
    // no support for list variables... yet... still trying to figure
    // out how to flatten them when we don't actually know how many
    // items will be coming in on the final value. Perhaps we can wait
    // until query execution and utilize the passed in value itself
    return [];
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
): QueryVariable[] => {
  // quick unwrap of VariableDefinitionNode into a more neutral format
  return variables.reduce<QueryVariable[]>(
    (list, varDef) =>
      list.concat(
        flattenAndConvertNamedType({
          nameRoot: varDef.variable.name.value,
          type: varDef.type,
          defaultValue: varDef.defaultValue,
          schema,
        }),
      ),
    [],
  );
};

export default flattenAndConvertVariables;
