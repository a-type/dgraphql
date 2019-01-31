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
