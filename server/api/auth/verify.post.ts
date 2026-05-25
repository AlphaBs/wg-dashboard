export default defineEventHandler((event) => {
  assertNoQuery(event)
  requirePassword(event)

  return {
    ok: true,
  }
})
