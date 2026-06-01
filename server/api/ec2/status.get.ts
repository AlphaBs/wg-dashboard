export default defineEventHandler((event) => {
  assertNoQuery(event)
  requirePassword(event)

  return getEc2Status(event)
})
