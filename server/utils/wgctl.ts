import http from 'node:http'
import type { H3Event } from 'h3'

export type WgctlAction = 'up' | 'down'

export interface WgctlResponse {
  ok?: boolean
  interface: string
  systemdService: string
  activeState?: string
  lastOperation: null | {
    action: string
    time: string
  }
}

export function callWgctl(event: H3Event, method: 'GET' | 'POST', path: string) {
  const config = useRuntimeConfig(event)
  const socketPath = process.env.WGCTL_SOCKET_PATH || String(config.wgctlSocketPath)

  return new Promise<WgctlResponse>((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        method,
        path,
      },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          data += chunk
        })
        res.on('end', () => {
          const statusCode = res.statusCode || 500
          const body = parseJSON(data)

          if (statusCode >= 400) {
            reject(
              createError({
                statusCode,
                statusMessage: typeof body?.error === 'string' ? body.error : 'wgctl daemon request failed',
              }),
            )
            return
          }

          resolve(body as unknown as WgctlResponse)
        })
      },
    )

    req.on('error', (error) => {
      reject(
        createError({
          statusCode: 502,
          statusMessage: `wgctl daemon unavailable: ${error.message}`,
        }),
      )
    })

    req.end()
  })
}

export function wgctlPath(event: H3Event, action: WgctlAction | 'status') {
  const config = useRuntimeConfig(event)
  const interfaceName = process.env.WGCTL_INTERFACE || String(config.wgctlInterface)
  return `/${interfaceName}/${action}`
}

function parseJSON(data: string): Record<string, unknown> | null {
  if (data.trim() === '') {
    return null
  }

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}
