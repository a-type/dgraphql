import { ApolloServer, gql } from 'apollo-server';
import { DGraphQL } from '../../src';
import { DgraphClient, DgraphClientStub } from 'dgraph-js';
import { credentials } from 'grpc';

const clientStub = new DgraphClientStub(
  'localhost:9080',
  credentials.createInsecure(),
);

const client = new DgraphClient(clientStub);
client.setDebugMode(true); // you don't need this in production

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

const dgraphql = new DGraphQL(client, { debug: true });

const resolvers = {
  Query: {
    movies: dgraphql.createQueryResolver(argNames => {
      console.log(argNames);
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
        func,
        filter: dgraphql.filters.and(...filters),
        first: argNames.first,
        offset: argNames.offset,
      };
    }),
  },
};

dgraphql.readResolvers(resolvers);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: err => {
    console.error(err.originalError);
    return err;
  },
});

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});

// for tests to be able to control the server
export default server;
