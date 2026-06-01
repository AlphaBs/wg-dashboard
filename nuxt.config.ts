export default defineNuxtConfig({
  compatibilityDate: '2026-05-26',
  modules: ['@nuxtjs/tailwindcss'],
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    dashboardPasswordSha256: process.env.WG_DASHBOARD_PASSWORD_SHA256 || '',
    wgctlSocketPath: process.env.WGCTL_SOCKET_PATH || '/run/wgctl/wgctl.sock',
    wgctlInterface: process.env.WGCTL_INTERFACE || 'wg1',
    awsRegion: process.env.AWS_REGION || '',
    ec2InstanceId: process.env.EC2_INSTANCE_ID || '',
  },
})
