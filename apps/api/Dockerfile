FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY blockchain ./blockchain

RUN npm ci
RUN npm run build -w @certichain/api

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S certichain \
  && adduser -S certichain -G certichain \
  && mkdir -p /app/.data \
  && chown certichain:certichain /app /app/.data

COPY --from=build --chown=certichain:certichain /app/node_modules ./node_modules
COPY --from=build --chown=certichain:certichain /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=certichain:certichain /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=certichain:certichain /app/apps/api/assets ./apps/api/assets
COPY --from=build --chown=certichain:certichain /app/apps/web/public/branding/certichain-isotipo.png ./apps/web/public/branding/certichain-isotipo.png

USER certichain
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
