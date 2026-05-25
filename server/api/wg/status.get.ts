export default defineEventHandler((event) => {
  assertNoQuery(event)
  requirePassword(event)

  return callWgctl(event, 'GET', wgctlPath(event, 'status'))
})
