export default defineEventHandler(async (event) => {
  assertNoQuery(event)
  requirePassword(event)

  const body = await readBody<{ endpoint?: unknown }>(event)
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : ''
  if (endpoint === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'endpoint is required',
    })
  }

  return callWgctl(event, 'POST', wgctlPath(event, 'endpoint'), { endpoint })
})
