import getFieldsForType from './getFieldsForType';
import { GraphQLSchema } from 'graphql';

const getFieldResolver = (
  schema: GraphQLSchema,
  typeName: string,
  field: string,
) => {
  const type = schema.getType(typeName);
  const fields = getFieldsForType(type);
  return fields[field].resolve;
};

export default getFieldResolver;
