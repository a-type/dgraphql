export default {
  and(...filters: string[]) {
    return filters.join(' AND ');
  },
  or(...filters: string[]) {
    return filters.join(' OR ');
  },
  not(...filters: string[]) {
    return filters.join(' NOT ');
  }
}
