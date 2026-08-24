# Docker environments

CertiChain separates local development from production deployment.

## Local development

The default `docker-compose.yml` uses `NODE_ENV=development` unless `NODE_ENV` is explicitly supplied.

1. Copy `.env.example` to `.env`.
2. Configure local credentials.
3. Keep `CORS_ORIGIN=http://localhost:8080` and `VITE_API_URL=http://localhost:4000` for local Docker testing.
4. Start the stack:

```bash
docker compose up -d
```

The web application is exposed at `http://localhost:8080` and the API at `http://localhost:4000`.

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
- `VITE_API_URL`

`CORS_ORIGIN` and `VITE_API_URL` must use the real deployed origins. Localhost is intentionally rejected by the API in production.

Never commit real private keys, JWT secrets, administrator passwords, RPC credentials, or production IPFS tokens.
