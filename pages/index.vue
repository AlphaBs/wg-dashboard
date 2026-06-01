<script setup lang="ts">
type LastOperation = null | {
  action: string
  time: string
}

type WgStatus = {
  interface: string
  systemdService: string
  activeState?: string
  endpoint?: string | null
  lastOperation: LastOperation
}

type Ec2Status = {
  instanceId: string
  region: string
  state: string
  name: string | null
  instanceType: string | null
  publicIpAddress: string | null
  privateIpAddress: string | null
  launchTime: string | null
  lastOperation: null | {
    action: 'start' | 'stop'
    previousState: string
    currentState: string
  }
}

const password = ref('')
const authenticated = ref(false)
const status = ref<WgStatus | null>(null)
const ec2Status = ref<Ec2Status | null>(null)
const endpointInput = ref('')
const loading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

const stateTone = computed(() => {
  switch (status.value?.activeState) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800 ring-emerald-200'
    case 'inactive':
    case 'failed':
      return 'bg-rose-100 text-rose-800 ring-rose-200'
    default:
      return 'bg-zinc-100 text-zinc-700 ring-zinc-200'
  }
})

const ec2StateTone = computed(() => {
  switch (ec2Status.value?.state) {
    case 'running':
      return 'bg-emerald-100 text-emerald-800 ring-emerald-200'
    case 'stopped':
    case 'stopping':
    case 'shutting-down':
    case 'terminated':
      return 'bg-rose-100 text-rose-800 ring-rose-200'
    case 'pending':
      return 'bg-amber-100 text-amber-800 ring-amber-200'
    default:
      return 'bg-zinc-100 text-zinc-700 ring-zinc-200'
  }
})

const lastOperationText = computed(() => {
  if (!status.value?.lastOperation) {
    return 'None'
  }

  const time = new Date(status.value.lastOperation.time)
  const formatted = Number.isNaN(time.getTime())
    ? status.value.lastOperation.time
    : time.toLocaleString()

  return `${status.value.lastOperation.action.toUpperCase()} at ${formatted}`
})

const ec2LastOperationText = computed(() => {
  if (!ec2Status.value?.lastOperation) {
    return 'None'
  }

  const operation = ec2Status.value.lastOperation
  return `${operation.action.toUpperCase()} ${operation.previousState} -> ${operation.currentState}`
})

onMounted(async () => {
  password.value = sessionStorage.getItem('wg-dashboard-password') || ''
  if (password.value) {
    await verifyPassword()
  }
})

async function verifyPassword() {
  await withRequest(async () => {
    await dashboardFetch('/api/auth/verify', { method: 'POST' })
    sessionStorage.setItem('wg-dashboard-password', password.value)
    authenticated.value = true
    infoMessage.value = ''
    await refreshAllStatus()
  })
}

async function refreshAllStatus() {
  await withRequest(async () => {
    status.value = await dashboardFetch<WgStatus>('/api/wg/status')
    syncEndpointInput()
    ec2Status.value = await dashboardFetch<Ec2Status>('/api/ec2/status')
  })
}

async function refreshStatus() {
  await withRequest(async () => {
    status.value = await dashboardFetch<WgStatus>('/api/wg/status')
    syncEndpointInput()
  })
}

async function refreshEc2Status() {
  await withRequest(async () => {
    ec2Status.value = await dashboardFetch<Ec2Status>('/api/ec2/status')
  })
}

async function runAction(action: 'up' | 'down') {
  await withRequest(async () => {
    status.value = await dashboardFetch<WgStatus>(`/api/wg/${action}`, { method: 'POST' })
    syncEndpointInput()
    infoMessage.value = `wg ${action} completed`
    window.setTimeout(() => {
      infoMessage.value = ''
    }, 2500)
  })
}

async function runEc2Action(action: 'start' | 'stop') {
  await withRequest(async () => {
    ec2Status.value = await dashboardFetch<Ec2Status>(`/api/ec2/${action}`, { method: 'POST' })
    infoMessage.value = `EC2 ${action} requested`
    window.setTimeout(() => {
      infoMessage.value = ''
    }, 2500)
  })
}

async function updateEndpoint() {
  const endpoint = endpointInput.value.trim()
  await withRequest(async () => {
    await dashboardFetch('/api/wg/endpoint', {
      method: 'POST',
      body: { endpoint },
    })
    status.value = await dashboardFetch<WgStatus>('/api/wg/status')
    syncEndpointInput()
    infoMessage.value = 'wg endpoint updated'
    window.setTimeout(() => {
      infoMessage.value = ''
    }, 2500)
  })
}

function lock() {
  sessionStorage.removeItem('wg-dashboard-password')
  password.value = ''
  authenticated.value = false
  status.value = null
  ec2Status.value = null
  endpointInput.value = ''
  errorMessage.value = ''
  infoMessage.value = ''
}

async function withRequest(task: () => Promise<void>) {
  loading.value = true
  errorMessage.value = ''

  try {
    await task()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    errorMessage.value = message
    if (message.includes('401') || message.toLowerCase().includes('invalid password')) {
      authenticated.value = false
      sessionStorage.removeItem('wg-dashboard-password')
    }
  } finally {
    loading.value = false
  }
}

function dashboardFetch<T>(url: string, options: Parameters<typeof $fetch>[1] = {}) {
  return $fetch<T>(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'x-wg-dashboard-password': password.value,
    },
  })
}

function syncEndpointInput() {
  endpointInput.value = status.value?.endpoint || ''
}
</script>

<template>
  <main class="min-h-screen bg-[#f6f7f9] text-zinc-950">
    <div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header class="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 class="text-xl font-semibold tracking-normal">WireGuard Dashboard</h1>
          <p class="mt-1 text-sm text-zinc-500">wgctl local control</p>
        </div>
        <button
          v-if="authenticated"
          type="button"
          class="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="lock"
        >
          Lock
        </button>
      </header>

      <section v-if="!authenticated" class="flex flex-1 items-center">
        <form class="w-full max-w-sm" @submit.prevent="verifyPassword">
          <label for="password" class="block text-sm font-medium text-zinc-700">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 shadow-sm outline-none ring-0 transition focus:border-zinc-950"
          >
          <button
            type="submit"
            class="mt-4 h-11 w-full rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loading || password.length === 0"
          >
            Unlock
          </button>
          <p v-if="errorMessage" class="mt-3 text-sm text-rose-700">{{ errorMessage }}</p>
        </form>
      </section>

      <section v-else class="grid flex-1 gap-5 py-6 lg:grid-cols-[1fr_20rem]">
        <div class="space-y-8">
          <div class="border-b border-zinc-200 pb-5">
            <h2 class="mb-4 text-sm font-semibold uppercase tracking-normal text-zinc-500">WireGuard</h2>
            <div class="flex flex-wrap items-center gap-3">
              <span
                class="inline-flex h-8 items-center rounded-md px-3 text-sm font-semibold ring-1 ring-inset"
                :class="stateTone"
              >
                {{ status?.activeState || 'unknown' }}
              </span>
              <button
                type="button"
                class="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loading"
                @click="refreshStatus"
              >
                Refresh
              </button>
            </div>
            <dl class="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-zinc-500">Interface</dt>
                <dd class="mt-1 font-mono text-base text-zinc-950">{{ status?.interface || '-' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-zinc-500">Systemd unit</dt>
                <dd class="mt-1 font-mono text-base text-zinc-950">{{ status?.systemdService || '-' }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-sm text-zinc-500">Endpoint</dt>
                <dd class="mt-1 break-all font-mono text-base text-zinc-950">{{ status?.endpoint || '-' }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-sm text-zinc-500">Last operation</dt>
                <dd class="mt-1 text-base text-zinc-950">{{ lastOperationText }}</dd>
              </div>
            </dl>
          </div>

          <form class="grid gap-3 border-b border-zinc-200 pb-5 sm:grid-cols-[1fr_auto]" @submit.prevent="updateEndpoint">
            <label class="block">
              <span class="text-sm text-zinc-500">Set endpoint</span>
              <input
                v-model="endpointInput"
                type="text"
                inputmode="url"
                autocomplete="off"
                placeholder="vpn.example.com:51820"
                class="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 font-mono text-base text-zinc-950 shadow-sm outline-none ring-0 transition focus:border-zinc-950"
              >
            </label>
            <button
              type="submit"
              class="h-11 self-end rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="loading || endpointInput.trim().length === 0"
            >
              Update endpoint
            </button>
          </form>

          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="h-12 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="loading"
              @click="runAction('up')"
            >
              Start wg
            </button>
            <button
              type="button"
              class="h-12 rounded-md bg-rose-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="loading"
              @click="runAction('down')"
            >
              Stop wg
            </button>
          </div>

          <div class="border-b border-zinc-200 pb-5">
            <h2 class="mb-4 text-sm font-semibold uppercase tracking-normal text-zinc-500">EC2 Instance</h2>
            <div class="flex flex-wrap items-center gap-3">
              <span
                class="inline-flex h-8 items-center rounded-md px-3 text-sm font-semibold ring-1 ring-inset"
                :class="ec2StateTone"
              >
                {{ ec2Status?.state || 'unknown' }}
              </span>
              <button
                type="button"
                class="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loading"
                @click="refreshEc2Status"
              >
                Refresh
              </button>
            </div>
            <dl class="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-zinc-500">Instance</dt>
                <dd class="mt-1 font-mono text-base text-zinc-950">{{ ec2Status?.instanceId || '-' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-zinc-500">Region</dt>
                <dd class="mt-1 font-mono text-base text-zinc-950">{{ ec2Status?.region || '-' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-zinc-500">Name</dt>
                <dd class="mt-1 text-base text-zinc-950">{{ ec2Status?.name || '-' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-zinc-500">Type</dt>
                <dd class="mt-1 font-mono text-base text-zinc-950">{{ ec2Status?.instanceType || '-' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-zinc-500">Public IP</dt>
                <dd class="mt-1 font-mono text-base text-zinc-950">{{ ec2Status?.publicIpAddress || '-' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-zinc-500">Private IP</dt>
                <dd class="mt-1 font-mono text-base text-zinc-950">{{ ec2Status?.privateIpAddress || '-' }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-sm text-zinc-500">Last EC2 operation</dt>
                <dd class="mt-1 text-base text-zinc-950">{{ ec2LastOperationText }}</dd>
              </div>
            </dl>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="h-12 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="loading"
              @click="runEc2Action('start')"
            >
              Start EC2
            </button>
            <button
              type="button"
              class="h-12 rounded-md bg-rose-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="loading"
              @click="runEc2Action('stop')"
            >
              Stop EC2
            </button>
          </div>
        </div>

        <aside class="border-l border-zinc-200 pl-5">
          <h2 class="text-sm font-semibold text-zinc-700">Backend routes</h2>
          <ol class="mt-3 space-y-3 text-sm text-zinc-600">
            <li>Frontend</li>
            <li>Nuxt server API</li>
            <li>wgctl daemon socket</li>
            <li>AWS EC2 API</li>
          </ol>
          <div class="mt-6 space-y-2 text-sm">
            <p v-if="infoMessage" class="text-emerald-700">{{ infoMessage }}</p>
            <p v-if="errorMessage" class="text-rose-700">{{ errorMessage }}</p>
            <p v-if="loading" class="text-zinc-500">Working...</p>
          </div>
        </aside>
      </section>
    </div>
  </main>
</template>
