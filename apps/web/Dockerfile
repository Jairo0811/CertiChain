FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL

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
