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

  describe('ast with predicate languages', () => {
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
                language: 'en',
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
                    language: 'jp:en:.'
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
        variables: [],
        blocks: [
          {
            kind: 'QueryBlock',
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

  describe('ast with variables', () => {
    test('generates a valid query', () => {
      const ast: Query = {
        name: 'Test',
        variables: [
          {
            name: 'foo',
            type: 'string',
          },
          {
            name: 'bar',
            type: 'int',
            defaultValue: 0
          }
        ],
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
(
  $foo: string,
  $bar: int = 0
)
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

  describe('ast with func, filter, pagination, sorting', () => {
    test('generates a valid query', () => {
      const ast: Query = {
        name: 'Test',
        variables: [
          {
            name: 'foo',
            type: 'string',
          },
          {
            name: 'bar',
            type: 'int',
            defaultValue: 0
          }
        ],
        blocks: [
          {
            kind: 'QueryBlock',
            name: 'outer',
            func: `eq("a", $foo)`,
            filter: [`gt("b", $bar)`],
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
                name: 'inner',
                filter: [`lt("c", $bar)`],
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
  $foo: string,
  $bar: int = 0
)
{
  outer
    (func: eq("a", $foo), first: 10, offset: 20, after: 0x40, orderasc: "a")
    @filter(gt("b", $bar))
  {
    id
    enum
    inner
      (first: 100, offset: 0, after: 0x20, orderdesc: "c")
      @filter(lt("c", $bar))
    {
      id
      foo
    }
  }
}`);
    });
  });
});
