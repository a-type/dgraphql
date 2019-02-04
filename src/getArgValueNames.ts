import { ValueNode, ArgumentNode } from 'graphql';
import { inspect } from 'util';

/**
 * Unlike getArgValueName, this processes arguments which are nested inside
 * object args. We don't stringify nested objects or arrays or quote the strings.
 * @param valueNode a GraphQL AST value node
 */
const getNestedArgValue = (valueNode: ValueNode) => {
  if (valueNode.kind === 'Variable') {
    // re-introduce variable identifier symbol for second query
    return `$${valueNode.name.value}`;
  } else if (valueNode.kind === 'ListValue') {
    return valueNode.values.map(getNestedArgValue);
  } else if (valueNode.kind === 'ObjectValue') {
    return valueNode.fields.reduce(
      (obj, field) => ({
        ...obj,
        [field.name.value]: getNestedArgValue(field.value),
      }),
      {},
    );
  } else if (valueNode.kind === 'NullValue') {
    return null;
  } else if (
    valueNode.kind === 'StringValue' ||
    valueNode.kind === 'EnumValue'
  ) {
    return valueNode.value;
  } else if (valueNode.kind === 'IntValue') {
    return parseInt(valueNode.value, 10);
  } else if (valueNode.kind === 'FloatValue') {
    return parseFloat(valueNode.value);
  }
  return valueNode.value;
};

/**
 * Reduces a value node down to a single scalar value by stringifying
 * complex arguments. Quotes string values.
 * @param valueNode a GraphQL AST value node
 */
export const getArgValueName = (
  valueNode: ValueNode,
): string | boolean | number | null => {
  if (valueNode.kind === 'Variable') {
    // re-introduce variable identifier symbol for second query
    return `$${valueNode.name.value}`;
  } else if (valueNode.kind === 'ListValue') {
    return inspect(valueNode.values.map(getNestedArgValue));
  } else if (valueNode.kind === 'ObjectValue') {
    return inspect(
      valueNode.fields.reduce(
        (obj, field) => ({
          ...obj,
          [field.name.value]: getNestedArgValue(field.value),
        }),
        {},
      ),
      // unquote variable definitions. NOTE: the regex pattern for variable name is taken
      // directly from the GraphQL spec: https://facebook.github.io/graphql/June2018/#Name
    ).replace(/'(\$[_A-Za-z][_0-9A-Za-z]*)'/g, '$1');
  } else if (valueNode.kind === 'NullValue') {
    return null;
    // we implicitly convert enums into strings
  } else if (
    valueNode.kind === 'StringValue' ||
    valueNode.kind === 'EnumValue'
  ) {
    return JSON.stringify(valueNode.value);
  } else if (valueNode.kind === 'IntValue') {
    return parseInt(valueNode.value, 10);
  } else if (valueNode.kind === 'FloatValue') {
    return parseFloat(valueNode.value);
  }
  return valueNode.value;
};

/**
 * Given a set of argument nodes from a FieldNode, this converts
 * them into a plain object of 'names', i.e. scalar values which may
 * or may not represent the 'true' value natively, but are valid
 * identifiers for the value of those arguments if we template them
 * into the resulting DGraph query. For instance, variable arguments
 * are converted back into variable reference identifiers ($foo),
 * and object arguments are stringified so that they can simply
 * be inlined into place inside the new query. See unit tests
 * for more examples.
 *
 * @param fieldArgs arguments for a GraphQL AST FieldNode (node.arguments)
 */
const getArgValueNames = (fieldArgs: ReadonlyArray<ArgumentNode>) =>
  fieldArgs.reduce(
    (map, arg) => ({
      ...map,
      [arg.name.value]: getArgValueName(arg.value),
    }),
    {},
  );

export default getArgValueNames;
