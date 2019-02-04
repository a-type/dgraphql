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

export default convertQueryVariableType;
