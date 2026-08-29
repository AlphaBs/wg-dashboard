import type { H3Event } from 'h3'

export type Ec2Action = 'start' | 'stop'

export interface Ec2Status {
  instanceId: string
  state: string
  publicIpv4Address: string | null
  publicIpv6Addresses: string[]
  lastOperation: null | {
    action: Ec2Action
    previousState: string
    currentState: string
  }
}

interface ControllerInstanceResponse {
  instance_id: string
  state: string
  public_ipv4: string | null
  public_ipv6: string[] | null
}

interface ControllerActionResponse {
  instance_id: string
  action: Ec2Action
  current_state: string
  target_state: string
}

export async function getEc2Status(event: H3Event): Promise<Ec2Status> {
  const context = getControllerContext(event)
  const instance = await controllerFetch<ControllerInstanceResponse>(context, '/api/v1/instance')
  return toEc2Status(instance, null)
}

export async function runEc2Action(event: H3Event, action: Ec2Action): Promise<Ec2Status> {
  const context = getControllerContext(event)
  const operation = await controllerFetch<ControllerActionResponse>(context, '/api/v1/instance/state', {
    method: 'POST',
    body: { action },
  })
  const instance = await controllerFetch<ControllerInstanceResponse>(context, '/api/v1/instance')

  return toEc2Status(instance, {
    action,
    previousState: operation.current_state || 'unknown',
    currentState: operation.target_state || instance.state || 'unknown',
  })
}

function getControllerContext(event: H3Event) {
  const config = useRuntimeConfig(event)
  const rawUrl = String(process.env.INSTANCE_CONTROLLER_URL || config.instanceControllerUrl || '').trim()
  const username = String(process.env.INSTANCE_CONTROLLER_USERNAME || config.instanceControllerUsername || '')
  const password = String(process.env.INSTANCE_CONTROLLER_PASSWORD || config.instanceControllerPassword || '')

  if (!rawUrl) {
    throw createError({ statusCode: 500, statusMessage: 'INSTANCE_CONTROLLER_URL is not configured' })
  }
  if (!username || !password) {
    throw createError({ statusCode: 500, statusMessage: 'Instance controller credentials are not configured' })
  }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'INSTANCE_CONTROLLER_URL is invalid' })
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw createError({ statusCode: 500, statusMessage: 'INSTANCE_CONTROLLER_URL must use HTTP or HTTPS' })
  }

  return {
    baseUrl: url.toString().replace(/\/$/, ''),
    authorization: `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`,
  }
}

async function controllerFetch<T>(
  context: ReturnType<typeof getControllerContext>,
  path: string,
  options: { method?: 'POST', body?: { action: Ec2Action } } = {},
): Promise<T> {
  try {
    const response = await fetch(`${context.baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: context.authorization,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    if (!response.ok) {
      throw Object.assign(new Error('Instance controller returned an error'), { statusCode: response.status })
    }
    return await response.json() as T
  } catch (error) {
    const status = getUpstreamStatus(error)
    throw createError({
      statusCode: 502,
      statusMessage: status
        ? `Instance controller request failed with status ${status}`
        : 'Instance controller request failed',
    })
  }
}

function getUpstreamStatus(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null
  }
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode
  }
  if ('response' in error && typeof error.response === 'object' && error.response !== null
    && 'status' in error.response && typeof error.response.status === 'number') {
    return error.response.status
  }
  return null
}

function toEc2Status(instance: ControllerInstanceResponse, lastOperation: Ec2Status['lastOperation']): Ec2Status {
  return {
    instanceId: instance.instance_id,
    state: instance.state || 'unknown',
    publicIpv4Address: instance.public_ipv4,
    publicIpv6Addresses: instance.public_ipv6 || [],
    lastOperation,
  }
}
