import runAstQuery from '../runAstQuery';
import { Query } from '../types';
import { DgraphClient } from 'dgraph-js';
import convertToDGraphQuery from '../convertToDGraphQuery';

describe('runAstQuery', () => {
  describe('basic query', () => {
    test('passes correct values', async () => {
      const ast: Query = {
        name: 'Test',
        blocks: [
          {
            kind: 'QueryBlock',
            name: 'outer',
            typeName: 'Outer',
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
                typeName: 'Inner',
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

      const mockTxn = {
        query: jest.fn().mockResolvedValue({
          getJson: () => Promise.resolve({}),
        }),
        commit: jest.fn().mockResolvedValue(null),
        discard: jest.fn().mockResolvedValue(null),
      };

      const mockClient = ({
        newTxn: () => mockTxn,
      } as any) as DgraphClient;

      const result = await runAstQuery(ast, mockClient);

      expect(mockTxn.query).toHaveBeenCalledWith(convertToDGraphQuery(ast));
    });
  });
});
