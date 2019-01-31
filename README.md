Still very WIP.

Scratchpad for usage ideas:

```ts
const typeDefs = gql`
  type Query {
    foo(id: ID!): Foo!
    foos: [Foo!]!
  }

  type Foo {
    id: ID!
    name: String!
    bars(barFilter: BarFilterInput, first: Int, offset: Int): [Bar!]!
  }

  type Bar {
    id: ID!
    type: BarType!
    score: Int!
  }

  input BarFilterInput {
    type: BarType
    scoreGt: Int
  }

  enum BarType {
    Baz
    Corge
  }
`;

const resolvers = {
  Query: {
    foo: dgraphql.createQueryResolver(args => ({
      func: dgraphql.func.eq('id', args.id),
    })),
  },

  Foo: {
    bars: dgraphql.createQueryResolver(args => {
      const filters = [];
      if (args.type !== undefined) {
        filters.push(dgraphql.func.eq('type', args.type));
      }
      if (args.scoreGt !== undefined) {
        filters.push(dgraphql.func.gt('score', args.scoreGt));
      }

      return {
        filter: dgraphql.filters.and(filters),
        first: args.first,
        offset: args.offset,
      };
    }),
  },
};
```
