import { GraphQLSchema } from 'graphql';
import getFieldsForType from './getFieldsForType';

const getFieldArgs = (
  schema: GraphQLSchema,
  typeName: string,
  field: string,
) => {
  const type = schema.getType(typeName);
  const fields = getFieldsForType(type);
  return fields[field].args;
};

export default getFieldArgs;
