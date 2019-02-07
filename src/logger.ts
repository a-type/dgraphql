export const debug = (...args) => {
  if (process.env.DEBUG.includes('dgraphql') || ['*', 'true'].includes(process.env.DEBUG)) {
    console.debug(...args);
  }
}
