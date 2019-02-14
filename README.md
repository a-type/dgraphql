## Unmaintained. If you're looking for a project that got further down this path, see [here](https://github.com/dpeek/dgraphql) (you may want to fork that one). I'll probably not be migrating to Dgraph, but this was a fun way to learn about the GraphQL AST.

> **Pre-Beta** This library is barely tested, the usage is not great, and the features are lacking. I would not use it. I'm still working. But, feel free to look around and give feedback.

# What is it trying to do?

Ultimately, the goal is to turn a GraphQL query like this

```graphql
query ListMovies($first: Int, $offset: Int, $nameMatch: String) {
  movies(first: $first, offset: $offset, filter: { nameMatch: $nameMatch }) {
    id
    title
    actorCount
    actors {
      id
      name
    }
  }
}
```
```
ListMovies($first: 10, $offset: 0, $nameMatch: "Star")
```

Into a GraphQL+- query like this

```graphql+-
{
  movies(func: anyofterms(name, "Star"), first: 10, offset: 0) @filter(has(Movie)) {
    id
    name@en
    actorCount: count(starring)
    starring {
      id
      name
    }
  }
}
```

Although GraphQL and GraphQL+- are visually similar, there's actually a good number of translations which have to happen to close the gap. That's the focus of this library.

# Usage

Current pre-beta usage looks like this:

```ts
const typeDefs = gql`
  type Person {
    id: ID!
    name: String!
    starredIn: [Movie!]!
    directed: [Movie!]!
    directedCount: Int!
    roleCount: Int!
  }

  type Movie {
    id: ID!
    title: String!
    releaseDate: String!
    revenue: Int
    runningTime: Int
    starring: [Person!]!
    director: Person!
  }

  input ArbitraryNestedInput {
    a: String
  }

  input MovieFilterInput {
    titleMatch: String
    revenueGt: Int
    revenueLt: Int
    arbitrary: ArbitraryNestedInput
  }

  type Query {
    movies(
      input: MovieFilterInput = {
        titleMatch: ""
        revenueGt: 0
        arbitrary: { a: "foo" }
      }
      first: Int = 10
      offset: Int = 0
    ): [Movie!]!
    person(id: ID!): Person
  }
`;

const dgraphql = new DGraphQL(dgraphClient, { debug: true });

const resolvers = {
  Query: {
    movies: dgraphql.createQueryResolver(argNames => {
      const orderedFilters = [
        argNames.input.titleMatch &&
          dgraphql.filters.anyOfTerms('title', argNames.input.titleMatch),
        argNames.input.revenueGt &&
          dgraphql.filters.greaterThan('revenue', argNames.input.revenueGt),
        argNames.input.revenueLt &&
          dgraphql.filters.lessThan('revenue', argNames.input.revenueLt),
      ].filter(Boolean); // filter out falsy values
      const [func, ...filters] = orderedFilters;
      return {
        typeName: 'Movie',
        func,
        filter: dgraphql.filters.and(...filters),
        first: argNames.first,
        offset: argNames.offset,
      };
    }),

    person: dgraphql.createQueryResolver(args => ({
      typeName: 'Person',
      func: dgraphql.filters.uid(args.id),
    })),
  },

  Movie: {
    id: dgraphql.createQueryResolver(_argNames => ({
      value: 'uid',
    })),
    title: dgraphql.createQueryResolver(_argNames => ({
      value: 'name',
    })),
  },

  Person: {
    id: dgraphql.createQueryResolver(_argNames => ({
      value: 'uid',
    })),
  },
};

dgraphql.readResolvers(resolvers);
```

Not the most terse thing in the world! I'd like to improve the overall DX without sacrificing much of the specificity or flexibility of using JS to define the outcomes in the resolvers.

# DGraphQL Lifcycle

Here's how DGraphQL works right now:

## 1. Register DGraphQL resolvers

The user constructs a `dgraphl` instance and uses it to define resolvers for any fields they want to be powered by their Dgraph database.

## 2. Read resolver tree to discover structure

Due to a current design limitation, DGraphQL must then read the resolver tree itself to 'discover' the exact type/field usages of each of the registered resolvers so that it knows which resolver corresponds to which field.

## 3. Receive a GraphQL request

When a DGraphQL resolver is called, we begin processing the request and constructing a single Dgraph query AST for the requested data. This AST will later be used to construct the Dgraph query. I stole this trick from [Join Monster](https://github.com/acarl005/join-monster) in hopes that it will create a less brittle system which can iterate more easily to add new features and fix bugs.

## 4. Create query block AST nodes

Using the top-level field of the query, we create query block(s) in our AST. We call the functions users provided in their original resolver definitions to gather `func`, `filter`, and other Dgraph parameters (even aliases and computed predicate values) based on the args passed to the field itself.

## 5. Create predicate block AST nodes

Query blocks and predicate blocks are ultimately pretty similar. We again call the functions users provided in their resolvers. This is an interesting thing, though, because we are still actually running the root-field resolver, not the nested ones. We use the provided `resolveInfo` AST for the GraphQL query to anticipate 'where the query is going' and gather any user-provided data at those levels.

## 6. Assemble the final AST and generate a query

Once we process all nested fields, we finalize the AST and send it to a processor to create a text query.

## 7. Run the query through Dgraph and return the result

Now the easy part... just pass it along to the Dgraph-JS client and send the result on.

## 8. No-op any nested resolvers

If the user has defined more `dgraphql` resolvers further down the tree, we tell them to just return the data they receive from their `parent`, since the collected query has already been resolved at the top level. However, if the user has defined their own non-dgraphql resolvers, we will run those as usual.
