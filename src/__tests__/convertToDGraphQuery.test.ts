import convertToDGraphQuery from '../convertToDGraphQuery';
import { Query } from '../types';

describe('convertToDGraphQuery', () => {
  describe('simple ast', () => {
    test('generates a valid query', () => {
      const ast: Query = {
        blocks: [
          {
            kind: 'QueryBlock',
            typeName: 'Outer',
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
                typeName: 'Inner',
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

  describe('ast with predicate languages', () => {
    test('generates a valid query', () => {
      const ast: Query = {
        name: 'Test',
        blocks: [
          {
            kind: 'QueryBlock',
            typeName: 'Outer',
            name: 'outer',
            predicates: [
              {
                kind: 'ScalarPredicate',
                name: 'id',
              },
              {
                kind: 'ScalarPredicate',
                name: 'enum',
                language: 'en',
              },
              {
                kind: 'EdgePredicate',
                typeName: 'Inner',
                name: 'inner',
                predicates: [
                  {
                    kind: 'ScalarPredicate',
                    name: 'id',
                  },
                  {
                    kind: 'ScalarPredicate',
                    name: 'foo',
                    language: 'jp:en:.',
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
    enum@en
    inner
    {
      id
      foo@jp:en:.
    }
  }
}`);
    });
  });

  describe('ast with aliases', () => {
    test('generates a valid query', () => {
      const ast: Query = {
        name: 'Test',
        blocks: [
          {
            kind: 'QueryBlock',
            typeName: 'Outer',
            name: 'outer',
            predicates: [
              {
                kind: 'ScalarPredicate',
                value: 'id',
                name: 'uuid',
              },
              {
                kind: 'ScalarPredicate',
                name: 'enum',
              },
              {
                kind: 'EdgePredicate',
                typeName: 'Inner',
                value: 'inner',
                name: 'thing',
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
    uuid: id
    enum
    thing: inner
    {
      id
      foo
    }
  }
}`);
    });
  });

  describe('ast with func, filter, pagination, sorting', () => {
    test('generates a valid query', () => {
      const ast: Query = {
        name: 'Test',
        blocks: [
          {
            kind: 'QueryBlock',
            typeName: 'Outer',
            name: 'outer',
            func: `eq("a", false)`,
            filter: `gt("b", 3)`,
            first: 10,
            offset: 20,
            after: '0x40',
            orderasc: `"a"`,
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
                typeName: 'Inner',
                name: 'inner',
                filter: `lt("c", 3)`,
                first: 100,
                offset: 0,
                after: '0x20',
                orderdesc: `"c"`,
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
(
  false: string,
  3: int = 0
)
{
  outer
    (func: eq("a", false), first: 10, offset: 20, after: 0x40, orderasc: "a")
    @filter(gt("b", 3))
  {
    id
    enum
    inner
      (first: 100, offset: 0, after: 0x20, orderdesc: "c")
      @filter(lt("c", 3))
    {
      id
      foo
    }
  }
}`);
    });
  });
});
