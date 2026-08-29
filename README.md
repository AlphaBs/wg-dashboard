# wg-dashboard

Nuxt dashboard for controlling WireGuard through the local `wgctl-api` daemon.

Request flow:

```text
browser frontend
  -> Nuxt server API
  -> wgctl daemon over Unix socket / Lambda instance-controller
```

The browser never calls the wgctl daemon directly.

The authenticated dashboard also looks up the browser's current public IPv4 or
IPv6 address directly from `https://api64.ipify.org`. This lookup does not pass
through the Nuxt server, so it reflects the user's own internet connection.

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
