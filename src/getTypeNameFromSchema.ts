import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLSchema,
  TypeNode,
  isTypeNode,
  GraphQLType,
} from 'graphql';
import getFieldsForType from './getFieldsForType';

const getSchemaTypeName = (type: GraphQLType): string => {
  if (type instanceof GraphQLList || type instanceof GraphQLNonNull) {
    return getSchemaTypeName(type.ofType);
  } else {
    return type.name;
  }
};

const getTypeNodeTypeName = (node: TypeNode): string => {
  if (!isTypeNode(node)) {
    throw new Error('Argument was not a TypeNode');
  }

  if (node.kind === 'ListType' || node.kind === 'NonNullType') {
    return getTypeNodeTypeName(node.type);
  } else {
    return node.name.value;
  }
};

export const getTypeName = (type: GraphQLType | TypeNode) => {
  if (isTypeNode(type as any)) {
    return getTypeNodeTypeName(type as TypeNode);
  } else {
    return getSchemaTypeName(type as any);
  }
};

const getFieldTypeName = (
  schema: GraphQLSchema,
  parentType: string,
  fieldName: string,
) => {
  const type = schema.getType(parentType);
  const field = getFieldsForType(type)[fieldName];
  return getTypeName(field.type);
};

export default getFieldTypeName;
