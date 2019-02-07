import runAstQuery from '../runAstQuery';
import { Query } from '../types';
import { DgraphClient } from 'dgraph-js';
import convertToDGraphQuery from '../convertToDGraphQuery';

describe('runAstQuery', () => {
  describe('basic query with nested vars', () => {
    test('flattens vars and passes correct values', async () => {
    const ast: Query = {
      name: 'Test',
      variables: [
        {
          name: 'foo_nested',
          type: 'string',
        },
        {
          name: 'bar',
          type: 'int',
          defaultValue: 0
        }
      ],
      variableNameMap: {
        foo: {
          nested: '$foo_nested',
        },
        bar: '$bar',
      },
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
    };

    const variables = {
      foo: {
        nested: 'hello',
      },
      bar: 1,
    };

    const mockTxn = {
      queryWithVars: jest.fn().mockResolvedValue(null),
      commit: jest.fn().mockResolvedValue(null),
      discard: jest.fn().mockResolvedValue(null),
    };

    const mockClient = {
      newTxn: () => mockTxn,
    } as any as DgraphClient;

    const result = await runAstQuery(ast, variables, mockClient);

    expect(mockTxn.queryWithVars).toHaveBeenCalledWith(
      convertToDGraphQuery(ast),
      {
        foo_nested: 'hello',
        bar: 1
      }
    );
  });
  });
});
