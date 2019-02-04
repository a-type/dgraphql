import getArgValueNames from '../getArgValueNames';
import gql from 'graphql-tag';
import { DocumentNode, OperationDefinitionNode, FieldNode } from 'graphql';

const getDocumentArgs = (doc: DocumentNode) => {
  const operation = doc.definitions[0] as OperationDefinitionNode;
  return (operation.selectionSet.selections[0] as FieldNode).arguments;
};

describe('getArgValueNames', () => {
  test('scalar args', () => {
    const args = getDocumentArgs(gql`
      query {
        foo(a: "bar", b: 1, c: true, d: null) {
          id
        }
      }
    `);

    expect(getArgValueNames(args)).toEqual({
      a: '"bar"',
      b: 1,
      c: true,
      d: null,
    });
  });

  test('object args', () => {
    const args = getDocumentArgs(gql`
      query {
        foo(a: { b: "bar", c: { d: 1 } }) {
          id
        }
      }
    `);

    expect(getArgValueNames(args)).toEqual({
      a: `{ b: 'bar', c: { d: 1 } }`,
    });
  });

  test('array args', () => {
    const args = getDocumentArgs(gql`
      query {
        foo(a: ["one", "two"], b: { bar: ["three", 4] }) {
          id
        }
      }
    `);

    expect(getArgValueNames(args)).toEqual({
      a: `[ 'one', 'two' ]`,
      b: `{ bar: [ 'three', 4 ] }`,
    });
  });

  test('variable args', () => {
    const args = getDocumentArgs(gql`
      query Test($a: Int!, $b: String) {
        foo(a: $a, b: { baz: $b }) {
          id
        }
      }
    `);

    expect(getArgValueNames(args)).toEqual({
      a: '$a',
      b: `{ baz: $b }`,
    });
  });
});
