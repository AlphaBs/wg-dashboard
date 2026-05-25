import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { getHeader, getRequestURL, setResponseStatus } from 'h3'

export function requirePassword(event: H3Event) {
  const config = useRuntimeConfig(event)
  const expectedHash = normalizeHash(process.env.WG_DASHBOARD_PASSWORD_SHA256 || config.dashboardPasswordSha256)

  if (!expectedHash) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Dashboard password hash is not configured',
    })
  }

  const password = getHeader(event, 'x-wg-dashboard-password') || ''
  const actualHash = sha256(password)

  if (!safeEqualHex(actualHash, expectedHash)) {
    setResponseStatus(event, 401)
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid password',
    })
  }
}

export function assertNoQuery(event: H3Event) {
  const url = getRequestURL(event)
  if (url.search !== '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Query parameters are not allowed',
    })
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function normalizeHash(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().toLowerCase()
}

function safeEqualHex(actualHex: string, expectedHex: string) {
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) {
    return false
  }

  const actual = Buffer.from(actualHex, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
