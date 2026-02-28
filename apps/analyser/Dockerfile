FROM node:20-alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@^2.3.3
COPY . .
RUN turbo prune --scope=@hardwave/analyser-app --docker

FROM base AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm ci --legacy-peer-deps
COPY --from=builder /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build --workspace=apps/analyser

FROM base AS runner
WORKDIR /app/apps/analyser
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
# standalone tree contains apps/analyser/server.js — copy it to monorepo root
COPY --from=installer --chown=nextjs:nodejs /app/apps/analyser/.next/standalone /app/
# static assets and public must sit next to server.js
COPY --from=installer --chown=nextjs:nodejs /app/apps/analyser/.next/static ./.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/analyser/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
