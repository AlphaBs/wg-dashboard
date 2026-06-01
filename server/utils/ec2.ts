import {
  DescribeInstancesCommand,
  EC2Client,
  type Instance,
  StartInstancesCommand,
  StopInstancesCommand,
  type InstanceStateName,
} from '@aws-sdk/client-ec2'
import type { H3Event } from 'h3'

export type Ec2Action = 'start' | 'stop'

export interface Ec2Status {
  instanceId: string
  region: string
  state: InstanceStateName | 'unknown'
  name: string | null
  instanceType: string | null
  publicIpAddress: string | null
  privateIpAddress: string | null
  launchTime: string | null
  lastOperation: null | {
    action: Ec2Action
    previousState: InstanceStateName | 'unknown'
    currentState: InstanceStateName | 'unknown'
  }
}

export async function getEc2Status(event: H3Event): Promise<Ec2Status> {
  const { client, instanceId, region } = getEc2Context(event)
  const instance = await describeInstance(client, instanceId)

  return toEc2Status(instance, region, null)
}

export async function runEc2Action(event: H3Event, action: Ec2Action): Promise<Ec2Status> {
  const { client, instanceId, region } = getEc2Context(event)
  const change = action === 'start'
    ? (await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }))).StartingInstances?.[0]
    : (await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }))).StoppingInstances?.[0]
  const instance = await describeInstance(client, instanceId)

  return toEc2Status(instance, region, {
    action,
    previousState: change?.PreviousState?.Name || 'unknown',
    currentState: change?.CurrentState?.Name || instance.State?.Name || 'unknown',
  })
}

function getEc2Context(event: H3Event) {
  const config = useRuntimeConfig(event)
  const region = process.env.AWS_REGION || String(config.awsRegion || '')
  const instanceId = process.env.EC2_INSTANCE_ID || String(config.ec2InstanceId || '')

  if (!region) {
    throw createError({
      statusCode: 500,
      statusMessage: 'AWS_REGION is not configured',
    })
  }

  if (!instanceId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'EC2_INSTANCE_ID is not configured',
    })
  }

  return {
    client: new EC2Client({ region }),
    instanceId,
    region,
  }
}

async function describeInstance(client: EC2Client, instanceId: string) {
  try {
    const response = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }))
    const instance = response.Reservations?.flatMap((reservation) => reservation.Instances || [])[0]

    if (!instance) {
      throw createError({
        statusCode: 404,
        statusMessage: `EC2 instance not found: ${instanceId}`,
      })
    }

    return instance
  } catch (error) {
    if (isH3Error(error)) {
      throw error
    }

    throw createError({
      statusCode: 502,
      statusMessage: `EC2 request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    })
  }
}

function toEc2Status(instance: Instance, region: string, lastOperation: Ec2Status['lastOperation']): Ec2Status {
  return {
    instanceId: instance.InstanceId || '',
    region,
    state: instance.State?.Name || 'unknown',
    name: instance.Tags?.find((tag) => tag.Key === 'Name')?.Value || null,
    instanceType: instance.InstanceType || null,
    publicIpAddress: instance.PublicIpAddress || null,
    privateIpAddress: instance.PrivateIpAddress || null,
    launchTime: instance.LaunchTime?.toISOString() || null,
    lastOperation,
  }
}

function isH3Error(error: unknown) {
  return typeof error === 'object' && error !== null && 'statusCode' in error
}
