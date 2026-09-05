'use strict'

module.exports = {
  apps: [
    {
      name: 'wg-dashboard',
      cwd: __dirname,
      script: '.output/server/index.mjs',
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 2000,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
