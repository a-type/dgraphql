Still very WIP.

# What is it trying to do?

Ultimately, the goal is to turn a GraphQL query like this

```graphql
input ComplexInput {
  nameMatch: String
}

query GetFooWithBar($fooId: ID!, $input: ComplexInput) {
  foo(id: $fooId) {
    id
    name
    barCount
    bar(input: $input) {
      id
      name
      type
      etc
    }
  }
}
```

Into a GraphQL+- query like this

```graphql+-
query GetFooWithBar($fooId: string!, $input_nameMatch: string) {
  foo(func: eq(id, $fooId)) {
    id
    name@en
    barCount: count(bar)
    bar @filter(anyofterms(name, $input_nameMatch)) {
      id
      name
      type: barType@en
      etc
    }
  }
}
```

To convert GraphQL to GraphQL+-, we need to:

- Flatten all input variables into scalar types (GraphQL+- does not support complex variable types)
- Define the underlying `func`/`filter`/paginations necessary to fetch the data, utilizing the arguments passed to each field
- Attach aliases, languages, and custom value resolution to predicates as specified by the user

# Scratchpad for usage ideas:

## Resolver-based

### Pros

- Very explicit
- JS logic is available to the user
- Few assumptions
- TS-based suggestions reduce need to remember all DGraph language features

### Cons

- Verbose
- Impossible to identify DGraph powered resources from scanning the schema

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
    name: dgraphql.createQueryResolver(args => ({
      langauge: 'en',
    })),
    bars: dgraphql.createQueryResolver(args => {
      const filters = [];
      if (args.type !== undefined) {
        filters.push(dgraphql.func.eq('type', args.barFilter.type));
      }
      if (args.scoreGt !== undefined) {
        filters.push(dgraphql.func.gt('score', args.barFilter.scoreGt));
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

## Directive-based (neo4j-graphql-js style)

### Pros

- Very terse
- Information is embedded in schema
- No resolver work necessary

### Cons

- "Magic" around null values - will unused filters just disappear?
- No JS logic available to do more complex stuff
- I'm not sure I like tons of directives... creates a lot of noise

```ts
const typeDefs = gql`
  type Query {
    foo(id: ID!): Foo! @dgraphFunc("eq", "id", "{args.id}")
    foos: [Foo!]! @dgraphFirst(10) @dgraphOffset(0)
  }

  type Foo {
    id: ID!
    name: String! @dgraphLang("en")
    bars(barFilter: BarFilterInput, first: Int, offset: Int): [Bar!]!
      @dgraphFilter("eq", "type", "{args.barFilter.type}")
      @dgraphFilter("gt", "score", "{args.barFilter.scoreGt}")
      @dgraphFirst("{args.first}")
      @graphOffset("{args.offset}")
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

// ...

// auto-creates resolvers based on annotations
const dgraphSchema = augmentSchema(schema);
```
