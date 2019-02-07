import {
  Query,
  QueryBlockNode,
  PredicateNode,
  ScalarPredicateNode,
  EdgePredicateNode,
  FilterableNode,
  QueryVariable,
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

const lines = (lines: string[]) =>
  lines
    .filter(Boolean)
    .join(`\n`);

const level = (items, lineCreator) => items.reduce((all, item) => all.concat(lineCreator(item).filter(Boolean)), []).map(indent);

const handleEdgePredicate = (
  predicate: EdgePredicateNode,
): string[] => {
  const value = predicate.value ? `: ${predicate.value}` : '';
  const filter = predicate.filter ? `@filter(${predicate.filter})` : '';
  const params = createPaginationParams(predicate).filter(Boolean);
  return  [
      `${predicate.name}${value}`,
      params.length && `  (${params.join(', ')})`,
      filter && `  ${filter}`,
      `{`,
      ...level(predicate.predicates, handlePredicate),
      `}`,
    ];
};

const handleScalarPredicate = (
  predicate: ScalarPredicateNode,
): string[] => {
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
    block.func ? `func: ${block.func}` : null,
    ...createPaginationParams(block),
  ].filter(Boolean);

  const filter = block.filter ? `@filter(${block.filter})` : '';
  return [
      `${block.name}`,
      params.length && `  (${params.join(', ')})`,
      filter && `  ${filter}`,
      `{`,
      ...level(block.predicates, handlePredicate),
      `}`,
    ];
};

const handleVariables = (variables: QueryVariable[]) => {
  const formatter = v => [`$${v.name}: ${v.type}${v.defaultValue !== undefined ? ` = ${v.defaultValue}` : ''}`];
  if (variables.length) {
    return [
      `(`,
      ...level(variables, formatter).map((s, i) => i !== variables.length - 1 ? `${s},` : s),
      `)`
    ];
  }
  return [];
}

const convertToDGraphQuery = (ast: Query): string => {
  return lines([
    `query ${ast.name}`,
    ...handleVariables(ast.variables),
    `{`,
    ...level(ast.blocks, handleQueryBlock),
    `}`,
  ]);
};

export default convertToDGraphQuery;
