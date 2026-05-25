# wg-dashboard

Nuxt dashboard for controlling WireGuard through the local `wgctl-api` daemon.

Request flow:

```text
browser frontend
  -> Nuxt server API
  -> wgctl daemon over Unix socket
```

The browser never calls the wgctl daemon directly.

## Configuration

| Variable | Default |
| --- | --- |
| `WG_DASHBOARD_PASSWORD_SHA256` | required |
| `WGCTL_SOCKET_PATH` | `/run/wgctl/wgctl.sock` |
| `WGCTL_INTERFACE` | `wg1` |

Generate the password hash:

```sh
npm run hash-password -- your-password
```

Create `.env`:

```sh
WG_DASHBOARD_PASSWORD_SHA256=<sha256-hex>
WGCTL_SOCKET_PATH=/run/wgctl/wgctl.sock
WGCTL_INTERFACE=wg1
```

The frontend stores the password in `sessionStorage` and sends it to every Nuxt
server API call with the `x-wg-dashboard-password` header. The server validates
that password on every call before forwarding to wgctl.

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
