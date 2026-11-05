FROM node:20-alpine AS build
WORKDIR /app

# Empty by default: the bundle calls the API on its own origin (/api), proxied by nginx.
# Set it only when the API is served from a different origin.
ARG VITE_API_URL=""
ARG VITE_DEMO_MODE="false"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE

COPY package*.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY blockchain ./blockchain

RUN npm ci
RUN npm run build -w @certichain/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
