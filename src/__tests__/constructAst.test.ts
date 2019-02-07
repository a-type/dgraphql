import constructAst from '../constructAst';
import { makeExecutableSchema, gql } from 'apollo-server';
import { execute } from 'graphql';

const typeDefs = gql`
  enum TestEnum {
    One
    Two
  }

  input NestedInput {
    match: String
  }

  input TestInput {
    first: Int
    nested: NestedInput
  }

  input TestInnerInput {
    id: ID
  }

  type Inner {
    id: ID!
    foo: String
  }

  type Outer {
    id: ID!
    enum: TestEnum
    name: String
    count: Int
    inner(id: ID, input: TestInnerInput): Inner
  }

  type Query {
    outer(scalar: Int, input: TestInput): Outer
  }
`;

describe('constructAst', () => {
  describe('without dgraph query definitions', () => {
    let capturedParams = [];
    const resolvers = {
      Query: {
        outer: (...params) => {
          capturedParams = params;
          return null;
        },
      },
    };

    // assign an id to the resolver for consistency with lib behavior
    resolvers.Query.outer['id'] = 'Query.outer';

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    describe('basic, no variables', () => {
      test('builds a valid ast', async () => {
        const document = gql`
          query Test {
            outer {
              id
              enum
              inner {
                id
                foo
              }
            }
          }
        `;

        await execute({
          schema,
          document,
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(capturedParams[3], {});

        expect(ast).toEqual({
          name: 'Test',
          variables: [],
          variableNameMap: {},
          blocks: [
            {
              kind: 'QueryBlock',
              name: 'outer',
              predicates: [
                {
                  kind: 'ScalarPredicate',
                  name: 'id',
                },
                {
                  kind: 'ScalarPredicate',
                  name: 'enum',
                },
                {
                  kind: 'EdgePredicate',
                  name: 'inner',
                  predicates: [
                    {
                      kind: 'ScalarPredicate',
                      name: 'id',
                    },
                    {
                      kind: 'ScalarPredicate',
                      name: 'foo',
                    },
                  ],
                },
              ],
            },
          ],
        });
      });
    });

    describe('basic with variables', () => {
      test('builds a valid ast', async () => {
        const document = gql`
          query Test($scalar: Int = 3) {
            outer(scalar: $scalar) {
              id
              enum
              inner {
                id
                foo
              }
            }
          }
        `;

        await execute({
          schema,
          document,
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(capturedParams[3], {});

        expect(ast).toEqual({
          name: 'Test',
          variables: [
            {
              name: 'scalar',
              type: 'int',
              defaultValue: 3,
            },
          ],
          variableNameMap: {
            scalar: '$scalar',
          },
          blocks: [
            {
              kind: 'QueryBlock',
              name: 'outer',
              predicates: [
                {
                  kind: 'ScalarPredicate',
                  name: 'id',
                },
                {
                  kind: 'ScalarPredicate',
                  name: 'enum',
                },
                {
                  kind: 'EdgePredicate',
                  name: 'inner',
                  predicates: [
                    {
                      kind: 'ScalarPredicate',
                      name: 'id',
                    },
                    {
                      kind: 'ScalarPredicate',
                      name: 'foo',
                    },
                  ],
                },
              ],
            },
          ],
        });
      });
    });
  });

  describe('with dgraph query definitions', () => {
    let capturedParams = [];
    const resolvers = {
      Query: {
        outer: (...params) => {
          capturedParams = params;
          return null;
        },
      },

      Outer: {
        enum: () => null,
        count: () => null,
        inner: () => null,
      },
    };

    // assign an id to the resolver for consistency with lib behavior
    resolvers.Query.outer['id'] = 'Query.outer';
    resolvers.Outer.enum['id'] = 'Outer.enum';
    resolvers.Outer.inner['id'] = 'Outer.inner';
    resolvers.Outer.count['id'] = 'Outer.count';

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    describe('basic, no variables', () => {
      test('builds a valid ast', async () => {
        const document = gql`
          query Test {
            outer {
              id
              enum
              inner(id: "bar") {
                id
                foo
              }
            }
          }
        `;

        const outerQueryFunc = argNames => ({
          func: `eq("id", "foo")`,
          first: 10,
          offset: 0,
        });

        const innerQueryFunc = argNames => ({
          filter: `eq("id", ${argNames.id})`,
        });

        await execute({
          schema,
          document,
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(capturedParams[3], {
          'Query.outer': outerQueryFunc,
          'Outer.inner': innerQueryFunc,
        });

        expect(ast).toEqual({
          name: 'Test',
          variables: [],
          variableNameMap: {},
          blocks: [
            {
              kind: 'QueryBlock',
              name: 'outer',
              func: `eq("id", "foo")`,
              first: 10,
              offset: 0,
              predicates: [
                {
                  kind: 'ScalarPredicate',
                  name: 'id',
                },
                {
                  kind: 'ScalarPredicate',
                  name: 'enum',
                },
                {
                  kind: 'EdgePredicate',
                  name: 'inner',
                  filter: `eq("id", "bar")`,
                  predicates: [
                    {
                      kind: 'ScalarPredicate',
                      name: 'id',
                    },
                    {
                      kind: 'ScalarPredicate',
                      name: 'foo',
                    },
                  ],
                },
              ],
            },
          ],
        });
      });
    });

    describe('basic with variables', () => {
      test('builds a valid ast', async () => {
        const document = gql`
          query Test($innerId: ID) {
            outer {
              id
              enum
              inner(id: $innerId) {
                id
                foo
              }
            }
          }
        `;

        const outerQueryFunc = argNames => ({
          func: `eq("id", "foo")`,
          first: 10,
          offset: 0,
        });

        const innerQueryFunc = argNames => ({
          filter: `eq("id", ${argNames.id})`,
        });

        await execute({
          schema,
          document,
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(capturedParams[3], {
          'Query.outer': outerQueryFunc,
          'Outer.inner': innerQueryFunc,
        });

        expect(ast).toEqual({
          name: 'Test',
          variables: [
            {
              name: 'innerId',
              type: 'string',
              defaultValue: undefined,
            },
          ],
          variableNameMap: {
            innerId: '$innerId',
          },
          blocks: [
            {
              kind: 'QueryBlock',
              name: 'outer',
              func: `eq("id", "foo")`,
              first: 10,
              offset: 0,
              predicates: [
                {
                  kind: 'ScalarPredicate',
                  name: 'id',
                },
                {
                  kind: 'ScalarPredicate',
                  name: 'enum',
                },
                {
                  kind: 'EdgePredicate',
                  name: 'inner',
                  filter: `eq("id", $innerId)`,
                  predicates: [
                    {
                      kind: 'ScalarPredicate',
                      name: 'id',
                    },
                    {
                      kind: 'ScalarPredicate',
                      name: 'foo',
                    },
                  ],
                },
              ],
            },
          ],
        });
      });
    });

    describe('customized predicates', () => {
      test('builds a valid ast', async () => {
        const document = gql`
          query Test($innerId: ID) {
            outer {
              id
              enum
              count
              inner(id: $innerId) {
                id
                foo
              }
            }
          }
        `;

        const outerQueryFunc = argNames => ({
          func: `eq("id", "foo")`,
          first: 10,
          offset: 0,
        });

        const innerQueryFunc = argNames => ({
          filter: `eq("id", ${argNames.id})`,
          value: 'relationship',
        });

        const enumQueryFunc = argNames => ({
          value: 'baz',
          language: 'en',
        });

        const countQueryFunc = () => ({
          value: 'count(name)',
        });

        await execute({
          schema,
          document,
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(capturedParams[3], {
          'Query.outer': outerQueryFunc,
          'Outer.inner': innerQueryFunc,
          'Outer.enum': enumQueryFunc,
          'Outer.count': countQueryFunc
        });

        expect(ast).toEqual({
          name: 'Test',
          variables: [
            {
              name: 'innerId',
              type: 'string',
              defaultValue: undefined,
            },
          ],
          variableNameMap: {
            innerId: '$innerId',
          },
          blocks: [
            {
              kind: 'QueryBlock',
              name: 'outer',
              func: `eq("id", "foo")`,
              first: 10,
              offset: 0,
              predicates: [
                {
                  kind: 'ScalarPredicate',
                  name: 'id',
                },
                {
                  kind: 'ScalarPredicate',
                  name: 'enum',
                  value: 'baz',
                  language: 'en',
                },
                {
                  kind: 'ScalarPredicate',
                  name: 'count',
                  value: 'count(name)',
                },
                {
                  kind: 'EdgePredicate',
                  name: 'inner',
                  value: 'relationship',
                  filter: `eq("id", $innerId)`,
                  predicates: [
                    {
                      kind: 'ScalarPredicate',
                      name: 'id',
                    },
                    {
                      kind: 'ScalarPredicate',
                      name: 'foo',
                    },
                  ],
                },
              ],
            },
          ],
        });
      });
    });

    describe('with complex object variables', () => {
      test('builds a valid ast', async () => {
        const document = gql`
          query Test($input: TestInput, $innerInput: TestInnerInput) {
            outer(input: $input) {
              id
              enum
              inner(input: $innerInput) {
                id
                foo
              }
            }
          }
        `;

        const outerQueryFunc = argNames => ({
          func: `anyofterms("name", ${argNames.input.nested.match})`,
          first: argNames.input.first,
          offset: 0,
        });

        const innerQueryFunc = argNames => ({
          filter: `eq("id", ${argNames.input.id})`,
        });

        await execute({
          schema,
          document,
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(capturedParams[3], {
          'Query.outer': outerQueryFunc,
          'Outer.inner': innerQueryFunc,
        });

        expect(ast).toEqual({
          name: 'Test',
          variables: [
            {
              name: 'input_first',
              type: 'int',
            },
            {
              name: 'input_nested_match',
              type: 'string',
            },
            {
              name: 'innerInput_id',
              type: 'string',
              defaultValue: undefined,
            },
          ],
          variableNameMap: {
            input: {
              first: '$input_first',
              nested: {
                match: '$input_nested_match',
              },
            },
            innerInput: {
              id: '$innerInput_id'
            }
          },
          blocks: [
            {
              kind: 'QueryBlock',
              name: 'outer',
              func: `anyofterms("name", $input_nested_match)`,
              first: '$input_first',
              offset: 0,
              predicates: [
                {
                  kind: 'ScalarPredicate',
                  name: 'id',
                },
                {
                  kind: 'ScalarPredicate',
                  name: 'enum',
                },
                {
                  kind: 'EdgePredicate',
                  name: 'inner',
                  filter: `eq("id", $innerInput_id)`,
                  predicates: [
                    {
                      kind: 'ScalarPredicate',
                      name: 'id',
                    },
                    {
                      kind: 'ScalarPredicate',
                      name: 'foo',
                    },
                  ],
                },
              ],
            },
          ],
        });
      });
    });
  });
});
