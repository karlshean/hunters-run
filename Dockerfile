# ---------- build ----------
FROM node:22.18.0-alpine AS build

# pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Copy only manifests first for better Docker cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# If you have these, they’ll copy; if not, Docker ignores
COPY packages/*/package.json packages/*/
COPY apps/hr-api/package.json apps/hr-api/

# Install workspace deps (not frozen; CI may tweak lockfile)
RUN pnpm -w install --no-frozen-lockfile

# Now copy the rest of the repo
COPY . .

# Ensure hr-api has its local deps linked and build
RUN pnpm --filter @apps/hr-api install --no-frozen-lockfile \
 && pnpm --filter @apps/hr-api run build

# ---------- runtime ----------
FROM node:22.18.0-alpine AS runtime
WORKDIR /app

# Copy only what's needed to run
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/hr-api/dist /app/apps/hr-api/dist
COPY --from=build /app/apps/hr-api/package.json /app/apps/hr-api/package.json

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/hr-api/dist/main.js"]