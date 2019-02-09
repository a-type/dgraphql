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

  input MovieFilterInput {
    titleMatch: String
    revenueGt: Int
    revenueLt: Int
  }

  type Query {
    movies(input: MovieFilterInput, first: Int, offset: Int): [Movie!]!
    person(id: ID!): Person
  }
`;

const dgraphql = new DGraphQL(client);

const resolvers = {
  Query: {
    movies: dgraphql.createQueryResolver(argNames => {
      const orderedFilters =
    }),
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
