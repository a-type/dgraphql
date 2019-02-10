import {
  GraphQLArgument,
  isInputObjectType,
  GraphQLInputType,
  isScalarType,
  isEnumType,
  isNonNullType,
  isListType,
} from 'graphql';
import { QueryVariableType } from './types';

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

const getInputType = (
  type: GraphQLInputType,
): QueryVariableType | { [key: string]: any } => {
  if (isNonNullType(type)) {
    return getInputType(type.ofType);
  } else if (isInputObjectType(type)) {
    const fields = type.getFields();
    return Object.keys(fields).reduce((nestedMap, fieldKey) => {
      const field = fields[fieldKey];
      nestedMap[fieldKey] = getInputType(field.type);
      return nestedMap;
    }, {});
  } else if (isListType(type)) {
    return {
      // 'special' thing going on here... TODO find a more
      // intuitive way to communicate variable length list item
      // types
      arrayOf: getInputType(type.ofType),
    };
  } else if (isScalarType(type)) {
    return convertQueryVariableType(type.name);
  } else if (isEnumType(type)) {
    return 'string';
  } else {
    throw new Error(`Unrecognized input type: ${type}`);
  }
};

const getArgTypeMap = (args: GraphQLArgument[]): { [name: string]: any } => {
  return args.reduce<{ [name: string]: any }>((map, arg) => {
    map[arg.name] = getInputType(arg.type);
    return map;
  }, {});
};

export default getArgTypeMap;
