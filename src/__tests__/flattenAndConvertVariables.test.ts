import flattenAndConvertVariables from '../flattenAndConvertVariables';
import { DocumentNode, OperationDefinitionNode } from 'graphql';
import { makeExecutableSchema, gql } from 'apollo-server';

const typeDefs = gql`
  enum TestEnum {
    One
    Two
  }

  input NestedInput {
    bar: String
  }

  input TestInput {
    foo: Int
    nested: NestedInput
  }

  type Foo {
    id: ID!
  }

  type Query {
    scalars(a: Int, b: String, c: Boolean): Foo
    enum(a: TestEnum): Foo
    object(a: TestInput): Foo
  }
`;

const schema = makeExecutableSchema({
  typeDefs,
});

const getVariables = (doc: DocumentNode) => {
  return (doc.definitions[0] as OperationDefinitionNode).variableDefinitions;
};

describe('flattenAndConvertVariables', () => {
  describe('with scalar variables', () => {
    test('with no values', () => {
      const vars = getVariables(gql`
        query Foo($a: Int, $b: String, $c: Boolean) {
          scalars(a: $a, b: $b, c: $c) {
            id
          }
        }
      `);

      expect(flattenAndConvertVariables(vars, schema)).toEqual([
        {
          name: 'a',
          type: 'int',
        },
        {
          name: 'b',
          type: 'string',
        },
        {
          name: 'c',
          type: 'bool',
        },
      ]);
    });

    test('with default values', () => {
      const vars = getVariables(gql`
        query Foo($a: Int = 1, $b: String = "foo", $c: Boolean = true) {
          scalars(a: $a, b: $b, c: $c) {
            id
          }
        }
      `);

      expect(flattenAndConvertVariables(vars, schema)).toEqual([
        {
          name: 'a',
          type: 'int',
          defaultValue: 1,
        },
        {
          name: 'b',
          type: 'string',
          defaultValue: '"foo"',
        },
        {
          name: 'c',
          type: 'bool',
          defaultValue: true,
        },
      ]);
    });
  });

  describe('with enum variable', () => {
    test('with no value', () => {
      const vars = getVariables(gql`
        query Foo($a: TestEnum) {
          enum(a: $a) {
            id
          }
        }
      `);

      expect(flattenAndConvertVariables(vars, schema)).toEqual([
        {
          name: 'a',
          type: 'string',
        },
      ]);
    });

    test('with default value', () => {
      const vars = getVariables(gql`
        query Foo($a: TestEnum = One) {
          enum(a: $a) {
            id
          }
        }
      `);

      expect(flattenAndConvertVariables(vars, schema)).toEqual([
        {
          name: 'a',
          type: 'string',
          defaultValue: '"One"',
        },
      ]);
    });
  });

  describe('with input object variables', () => {
    test('with no value', () => {
      const vars = getVariables(gql`
        query Foo($a: TestInput) {
          object(a: $a) {
            id
          }
        }
      `);

      expect(flattenAndConvertVariables(vars, schema)).toEqual([
        {
          name: 'a_foo',
          type: 'int',
        },
        {
          name: 'a_nested_bar',
          type: 'string',
        },
      ]);
    });

    test('with full default values', () => {
      const vars = getVariables(gql`
        query Foo($a: TestInput = { foo: 1, nested: { bar: "bar" } }) {
          object(a: $a) {
            id
          }
        }
      `);

      expect(flattenAndConvertVariables(vars, schema)).toEqual([
        {
          name: 'a_foo',
          type: 'int',
          defaultValue: 1,
        },
        {
          name: 'a_nested_bar',
          type: 'string',
          defaultValue: '"bar"',
        },
      ]);
    });

    test('with partial default values', () => {
      const vars = getVariables(gql`
        query Foo($a: TestInput = { foo: 1 }) {
          object(a: $a) {
            id
          }
        }
      `);

      expect(flattenAndConvertVariables(vars, schema)).toEqual([
        {
          name: 'a_foo',
          type: 'int',
          defaultValue: 1,
        },
        {
          name: 'a_nested_bar',
          type: 'string',
        },
      ]);
    });
  });
});
