import convertToDGraphQuery from '../convertToDGraphQuery';
import { Query } from '../types';

describe('convertToDGraphQuery', () => {
  describe('simple ast', () => {
    test('generates a valid query', () => {
      const ast: Query = {
        name: 'Test',
        variables: [],
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

      expect(convertToDGraphQuery(ast)).toEqual(`query Test
{
  outer
  {
    id
    enum
    inner
    {
      id
      foo
    }
  }
}`);
    });
  });
});
