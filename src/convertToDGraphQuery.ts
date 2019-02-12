import {
  Query,
  QueryBlockNode,
  PredicateNode,
  ScalarPredicateNode,
  EdgePredicateNode,
  FilterableNode,
} from './types';

const isScalarPredicate = (
  predicate: PredicateNode,
): predicate is ScalarPredicateNode => predicate.kind === 'ScalarPredicate';

const createPaginationParams = (node: FilterableNode) => [
  node.first !== undefined ? `first: ${node.first}` : null,
  node.offset !== undefined ? `offset: ${node.offset}` : null,
  node.after !== undefined ? `after: ${node.after}` : null,
  node.orderasc !== undefined ? `orderasc: ${node.orderasc}` : null,
  node.orderdesc !== undefined ? `orderdesc: ${node.orderdesc}` : null,
];

const indent = (line: string) => `  ${line}`;

const lines = (lines: string[]) => lines.filter(Boolean).join('\n');

const level = (items, lineCreator) =>
  items
    .reduce((all, item) => all.concat(lineCreator(item).filter(Boolean)), [])
    .map(indent);

const handleEdgePredicate = (predicate: EdgePredicateNode): string[] => {
  const value = predicate.value ? `: ${predicate.value}` : '';
  const filter = predicate.filter
    ? `@filter(${[`has(${predicate.typeName})`, predicate.filter].join(
        ' AND ',
      )})`
    : `@filter(has${predicate.typeName})`;
  const params = createPaginationParams(predicate).filter(Boolean);
  return [
    `${predicate.name}${value}`,
    params.length && `  (${params.join(', ')})`,
    filter && `  ${filter}`,
    `{`,
    ...level(predicate.predicates, handlePredicate),
    `}`,
  ];
};

const handleScalarPredicate = (predicate: ScalarPredicateNode): string[] => {
  const lang = predicate.language ? `@${predicate.language}` : '';
  const value = predicate.value ? `: ${predicate.value}` : '';
  return [`${predicate.name}${value}${lang}`];
};

const handlePredicate = (predicate: PredicateNode): string[] => {
  if (isScalarPredicate(predicate)) {
    return handleScalarPredicate(predicate);
  } else {
    return handleEdgePredicate(predicate);
  }
};

const handleQueryBlock = (block: QueryBlockNode): string[] => {
  const params = [
    // use user func, or if they don't specify one, assert type
    block.func ? `func: ${block.func}` : `func: has(${block.typeName})`,
    ...createPaginationParams(block),
  ].filter(Boolean);

  // if user did specify a func, we should assert type as part of their filter
  let filter = '';
  if (block.filter) {
    if (block.func) {
      filter = `@filter(${[`has(${block.typeName})`, block.filter].join(
        ' AND ',
      )})`;
    } else {
      filter = `@filter(${block.filter})`;
    }
  } else if (block.func) {
    filter = `@filter(has(${block.typeName}))`;
  }
  return [
    `${block.name}`,
    `  (${params.join(', ')})`,
    filter && `  ${filter}`,
    `{`,
    ...level(block.predicates, handlePredicate),
    `}`,
  ];
};

const convertToDGraphQuery = (ast: Query): string => {
  return lines([`{`, ...level(ast.blocks, handleQueryBlock), `}`]);
};

export default convertToDGraphQuery;
