import { ApolloServer, gql } from 'apollo-server';

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

const resolvers = {};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
