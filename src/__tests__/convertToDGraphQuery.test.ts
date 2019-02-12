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

      expect(convertToDGraphQuery(ast)).toEqual(`{
  outer
    (func: has(Outer))
  {
    id
    enum
    inner
      @filter(has(Inner))
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

      expect(convertToDGraphQuery(ast)).toEqual(`{
  outer
    (func: has(Outer))
  {
    id
    enum@en
    inner
      @filter(has(Inner))
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

      expect(convertToDGraphQuery(ast)).toEqual(`{
  outer
    (func: has(Outer))
  {
    uuid: id
    enum
    thing: inner
      @filter(has(Inner))
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

      expect(convertToDGraphQuery(ast)).toEqual(`{
  outer
    (func: eq("a", false), first: 10, offset: 20, after: 0x40, orderasc: "a")
    @filter(has(Outer) AND gt("b", 3))
  {
    id
    enum
    inner
      (first: 100, offset: 0, after: 0x20, orderdesc: "c")
      @filter(has(Inner) AND lt("c", 3))
    {
      id
      foo
    }
  }
}`);
    });
  });
});
