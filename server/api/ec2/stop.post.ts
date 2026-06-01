export default defineEventHandler((event) => {
  assertNoQuery(event)
  requirePassword(event)

  return runEc2Action(event, 'stop')
})
