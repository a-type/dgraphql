import { ObjectValueNode, ValueNode } from 'graphql';

const convertObjectValueNodeToObject = (
  node: ObjectValueNode,
  variableValues: { [name: string]: any },
) => {
  return node.fields.reduce<{ [key: string]: any }>((acc, field) => {
    acc[field.name.value] = valueNodeToValue(field.value, variableValues);
    return acc;
  }, {});
};

const valueNodeToValue = (
  valueNode: ValueNode,
  variableValues: { [name: string]: any },
) => {
  if (valueNode.kind === 'Variable') {
    return variableValues[valueNode.name.value];
  } else if (valueNode.kind === 'ListValue') {
    return valueNode.values.map(node => valueNodeToValue(node, variableValues));
  } else if (valueNode.kind === 'ObjectValue') {
    return convertObjectValueNodeToObject(valueNode, variableValues);
  } else if (valueNode.kind === 'NullValue') {
    return null; // FIXME: not sure if Dgraph really supports this.
  } else {
    return valueNode.value;
  }
};

export default valueNodeToValue;
