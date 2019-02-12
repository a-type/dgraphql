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

        const ast = constructAst(capturedParams[3], {}, []);

        expect(ast).toEqual({
          name: 'Test',
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

        const ast = constructAst(capturedParams[3], {}, []);

        expect(ast).toEqual({
          name: 'Test',
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
          typeName: 'Outer',
          func: `eq("id", "foo")`,
          first: 10,
          offset: 0,
        });

        const innerQueryFunc = argNames => ({
          typeName: 'Inner',
          filter: `eq("id", ${argNames.id})`,
        });

        await execute({
          schema,
          document,
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(
          capturedParams[3],
          {
            'Query.outer': outerQueryFunc,
            'Outer.inner': innerQueryFunc,
          },
          [],
        );

        expect(ast).toEqual({
          name: 'Test',
          blocks: [
            {
              kind: 'QueryBlock',
              name: 'outer',
              typeName: 'Outer',
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
                  typeName: 'Inner',
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
          typeName: 'Outer',
          func: `eq("id", "foo")`,
          first: 10,
          offset: 0,
        });

        const innerQueryFunc = argNames => ({
          typeName: 'Inner',
          filter: `eq("id", ${argNames.id})`,
        });

        await execute({
          schema,
          document,
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(
          capturedParams[3],
          {
            'Query.outer': outerQueryFunc,
            'Outer.inner': innerQueryFunc,
          },
          [],
        );

        expect(ast).toEqual({
          name: 'Test',
          blocks: [
            {
              kind: 'QueryBlock',
              name: 'outer',
              typeName: 'Outer',
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
                  typeName: 'Inner',
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
          typeName: 'Outer',
          func: `eq("id", "foo")`,
          first: 10,
          offset: 0,
        });

        const innerQueryFunc = argNames => ({
          typeName: 'Inner',
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
          variableValues: {
            innerId: 'bar',
          },
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(
          capturedParams[3],
          {
            'Query.outer': outerQueryFunc,
            'Outer.inner': innerQueryFunc,
            'Outer.enum': enumQueryFunc,
            'Outer.count': countQueryFunc,
          },
          [],
          true,
        );

        expect(ast).toEqual({
          name: 'Test',
          blocks: [
            {
              kind: 'QueryBlock',
              name: 'outer',
              typeName: 'Outer',
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
                  typeName: 'Inner',
                  value: 'relationship',
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
          typeName: 'Outer',
          func: `anyofterms("name", ${argNames.input.nested.match})`,
          first: argNames.input.first,
          offset: 0,
        });

        const innerQueryFunc = argNames => ({
          typeName: 'Inner',
          filter: `eq("id", ${argNames.input.id})`,
        });

        await execute({
          schema,
          document,
          variableValues: {
            input: {
              first: 10,
              nested: {
                match: 'foo',
              },
            },
            innerInput: {
              id: 'bar',
            },
          },
        });

        expect(capturedParams).toHaveLength(4);

        const ast = constructAst(
          capturedParams[3],
          {
            'Query.outer': outerQueryFunc,
            'Outer.inner': innerQueryFunc,
          },
          [],
        );

        expect(ast).toEqual({
          name: 'Test',
          blocks: [
            {
              kind: 'QueryBlock',
              typeName: 'Outer',
              name: 'outer',
              func: `anyofterms("name", "foo")`,
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
                  typeName: 'Inner',
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
  });
});
