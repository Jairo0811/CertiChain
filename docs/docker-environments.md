# Docker environments

CertiChain separates local development from production deployment.

## Local development

The default `docker-compose.yml` uses `NODE_ENV=development` unless `NODE_ENV` is explicitly supplied.

1. Copy `.env.example` to `.env`.
2. Configure local credentials.
3. Keep `CORS_ORIGIN=http://localhost:8080` and leave `VITE_API_URL` empty: the web container's nginx proxies `/api` and `/health` to the API, so the browser only talks to `http://localhost:8080`.
4. Start the stack:

```bash
docker compose up -d
```

The web application is exposed at `http://localhost:8080` and the API at `http://localhost:4000` (published for Expo clients and debugging). The API trusts `X-Forwarded-For` only from private addresses (`TRUST_PROXY=uniquelocal`), i.e. from nginx on the Docker network.

## Production

Production uses the base Compose file plus `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The production override forces `NODE_ENV=production` and requires explicit values for:

- `CORS_ORIGIN`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `PUBLIC_VERIFY_URL`

`VITE_API_URL` is optional: leave it empty to serve the API on the same origin through nginx, or set it to the real API origin (then add that origin to the CSP `connect-src` in `apps/web/nginx.conf`). `CORS_ORIGIN` must be the real deployed web origin. Localhost is intentionally rejected by the API in production.

Never commit real private keys, JWT secrets, administrator passwords, RPC credentials, or production IPFS tokens.
