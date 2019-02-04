import {
  GraphQLType,
  GraphQLFieldMap,
  GraphQLObjectType,
  GraphQLInterfaceType,
} from 'graphql';

const getFieldsForType = (type: GraphQLType): GraphQLFieldMap<any, any> => {
  if (
    type instanceof GraphQLObjectType ||
    type instanceof GraphQLInterfaceType
  ) {
    return type.getFields();
  }
  return undefined;
};

export default getFieldsForType;
