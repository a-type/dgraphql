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

# DGraphQL Lifcycle

## 1. Register DGraphQL resolvers

The user constructs a `dgraphl` instance and uses it to define resolvers for any fields they want to be powered by their Dgraph database.

## 2. Read resolver tree to discover structure

Due to a current design limitation, DGraphQL must then read the resolver tree itself to 'discover' the exact type/field usages of each of the registered resolvers so that it knows which resolver corresponds to which field.

## 3. Receive a GraphQL request

When a DGraphQL resolver is called, we begin processing the request and constructing a single Dgraph query AST for the requested data. This AST will later be used to construct the Dgraph query. I stole this trick from [Join Monster](https://github.com/acarl005/join-monster) in hopes that it will create a less brittle system which can iterate more easily to add new features and fix bugs.

## 4. Create query block AST nodes

Using the top-level field of the query, we create query block(s) in our AST. We call the functions users provided in their original resolver definitions to gather `func`, `filter`, and other Dgraph parameters (even aliases and computed predicate values) based on the args passed to the field itself.

Then we take each argument value and extract it into a query variable, generating a new name for it if necessary and registering it to our AST. Essentially we want to 'promote' each argument into a configurable variable for the Dgraph query to give our queries the best chance at being reusable.

## 5. Create predicate block AST nodes

Query blocks and predicate blocks are ultimately pretty similar. We again call the functions users provided in their resolvers. This is an interesting thing, though, because we are still actually running the root-field resolver, not the nested ones. We use the provided `resolveInfo` AST for the GraphQL query to anticipate 'where the query is going' and gather any user-provided data at those levels.

## 6. Assemble the final AST and generate a query

Once we process all nested fields, we finalize the AST and send it to a processor to create a text query.

## 7. Run the query through Dgraph and return the result

Now the easy part... just pass it along to the Dgraph-JS client and send the result on.

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
