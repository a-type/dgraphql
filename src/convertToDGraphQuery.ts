import {
  Query,
  QueryBlockNode,
  PredicateNode,
  ScalarPredicateNode,
  EdgePredicateNode,
  FilterableNode,
} from './types';

/**
 * What are we trying to do?
 *
 * Ultimately, the goal is to turn a GraphQL query like this
 *
 * query GetFooWithBar($fooId: ID!, $barNameMatch: String) {
 *   foo(id: $fooId) {
 *     id
 *     name
 *     bar(filter: { name: $barNameMatch }) {
 *       id
 *       name
 *       type
 *       etc
 *     }
 *   }
 * }
 *
 * Into a GraphQL+- query like this
 *
 * query GetFooWithBar($fooId: string!, $barNameMatch: string) {
 *   foo(func: eq(id, $fooId)) {
 *     id
 *     name
 *     bar @filter(anyofterms(name, $barNameMatch)) {
 *       id
 *       name
 *       type
 *       etc
 *     }
 *   }
 * }
 */

const isScalarPredicate = (
  predicate: PredicateNode,
): predicate is ScalarPredicateNode => predicate.kind === 'ScalarPredicate';

const createPaginationParams = (node: FilterableNode) => [
  node.first ? `first: ${node.first}` : null,
  node.offset ? `offset: ${node.offset}` : null,
  node.after ? `after: ${node.after}` : null,
  node.orderasc ? `orderasc: ${node.orderasc}` : null,
  node.orderdesc ? `orderdesc: ${node.orderdesc}` : null,
];

const spaces = (count: number) => new Array(count).fill('  ').join('');

const lines = (lines: string[], level: number = 0) =>
  lines
    .filter(Boolean)
    .map(line => `${spaces(level)}${line}`)
    .join(`\n`);

const handleEdgePredicate = (
  predicate: EdgePredicateNode,
  level: number,
): string => {
  const alias = predicate.alias ? `${predicate.alias}: ` : '';
  const filter = predicate.filter ? `@filter(${predicate.filter})` : '';
  const params = createPaginationParams(predicate).filter(Boolean);
  return lines(
    [
      `${alias}${predicate.name}`,
      params.length && `  (${params.join(', ')})`,
      filter && `  ${filter}`,
      `{`,
      ...predicate.predicates.map(p => handlePredicate(p, level + 1)),
      `}`,
    ],
    level,
  );
};

const handleScalarPredicate = (
  predicate: ScalarPredicateNode,
  level: number,
): string => {
  const lang = predicate.language ? `@${predicate.language}` : '';
  const alias = predicate.alias ? `${predicate.alias}: ` : '';
  return `${spaces(level)}${alias}${predicate.name}${lang}`;
};

const handlePredicate = (predicate: PredicateNode, level: number): string => {
  if (isScalarPredicate(predicate)) {
    return handleScalarPredicate(predicate, level);
  } else {
    return handleEdgePredicate(predicate, level);
  }
};

const handleQueryBlock = (block: QueryBlockNode, level: number): string => {
  const params = [
    block.func ? `func: ${block.func}` : null,
    ...createPaginationParams(block),
  ].filter(Boolean);

  const filter = block.filter ? ` @filter(${block.filter})` : '';
  return lines(
    [
      `${block.name}`,
      params.length && `  (${params.join(', ')})`,
      filter && `  ${filter}`,
      `{`,
      ...block.predicates.map(p => handlePredicate(p, level + 1)),
      `}`,
    ],
    level,
  );
};

const convertToDGraphQuery = (ast: Query): string => {
  return lines([
    `query ${ast.name}`,
    `{`,
    ...ast.blocks.map(b => handleQueryBlock(b, 1)),
    `}`,
  ]);
};

export default convertToDGraphQuery;
