export default defineEventHandler((event) => {
  assertNoQuery(event)
  requirePassword(event)

  return callWgctl(event, 'POST', wgctlPath(event, 'down'))
})
