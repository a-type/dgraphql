import constructAst from '../constructAst';
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

  type Inner {
    id: ID!
    foo: String
  }

  type Outer {
    id: ID!
    enum: TestEnum
    inner: Inner
  }

  type Query {
    outer(input: TestInput): Outer!
  }
`;

describe('constructAst', () => {
  describe('without query definitions', () => {
    const query =
  });
});
