# wg-dashboard

Nuxt dashboard for controlling WireGuard through the local `wgctl-api` daemon.

Request flow:

```text
browser frontend
  -> Nuxt server API
  -> wgctl daemon over Unix socket / Lambda instance-controller
```

The browser never calls the wgctl daemon directly.

The authenticated dashboard looks up the browser's current public IPv4 and IPv6
addresses in parallel from `https://api.ipify.org` and
`https://api6.ipify.org`. These lookups do not pass through the Nuxt server, so
they reflect the user's own internet connection.

## Configuration

| Variable | Default |
| --- | --- |
| `WG_DASHBOARD_PASSWORD_SHA256` | required |
| `WGCTL_SOCKET_PATH` | `/run/wgctl/wgctl.sock` |
| `WGCTL_INTERFACE` | `wg1` |
| `INSTANCE_CONTROLLER_URL` | Lambda instance-controller Function URL |
| `INSTANCE_CONTROLLER_USERNAME` | instance-controller Basic Auth username |
| `INSTANCE_CONTROLLER_PASSWORD` | instance-controller Basic Auth password |

Generate the password hash:

```sh
npm run hash-password -- your-password
```

Create `.env`:

```sh
HOST=127.0.0.1
PORT=3000
WG_DASHBOARD_PASSWORD_SHA256=<sha256-hex>
WGCTL_SOCKET_PATH=/run/wgctl/wgctl.sock
WGCTL_INTERFACE=wg1
INSTANCE_CONTROLLER_URL=https://example.lambda-url.ap-northeast-2.on.aws
INSTANCE_CONTROLLER_USERNAME=admin
INSTANCE_CONTROLLER_PASSWORD=replace-with-a-long-random-password
```

The frontend stores the password in `sessionStorage` and sends it to every Nuxt
server API call with the `x-wg-dashboard-password` header. The server validates
that password on every call before forwarding to wgctl.

EC2 controls are proxied by the Nuxt server to `instance-controller` using HTTP
Basic Authentication. The controller credentials stay in private Nuxt runtime
configuration and are never sent to the browser. AWS credentials and EC2 IAM
permissions are required only by the Lambda execution role.

## Development

```sh
npm install
npm run dev
```

## Verification

```sh
npm run typecheck
npm run build
```

## PM2 production

The ecosystem file runs the built Nuxt server as one forked process and loads
private runtime configuration from the ignored `.env` file using Node's
`--env-file` option. Node.js 20.6 or newer is required.

Install, build, and start:

```sh
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

`HOST=127.0.0.1` is the recommended default when Caddy or another reverse
proxy runs on the same server. Change it to `0.0.0.0` only when the Nuxt port
must be reachable directly from another host.

After pulling a new version:

```sh
git pull --ff-only
npm ci
npm run build
pm2 reload ecosystem.config.cjs --update-env
pm2 save
```

To configure startup after reboot, run `pm2 startup` once and execute the sudo
command it prints, then run `pm2 save` again.
