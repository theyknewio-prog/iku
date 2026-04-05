# ============================================
# Stage 1: Build
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build with high memory for the 353K+ pages
COPY . .

# NEXT_PUBLIC_* env vars must be present at build time — Next.js bakes them
# into the client bundle. Coolify passes these via --build-arg when is_buildtime=true.
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

ENV NODE_OPTIONS="--max-old-space-size=6144"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================
# Stage 2: Production runtime
# ============================================
FROM node:22-slim AS runner

# Install python3 + yt-dlp for on-demand video URL resolution
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python3 python3-pip ca-certificates && \
    pip3 install yt-dlp --break-system-packages && \
    apt-get purge -y python3-pip && \
    apt-get autoremove -y && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    echo "yt-dlp installed at: $(which yt-dlp)" && \
    yt-dlp --version

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
# Runtime heap: 3GB max (not 6GB) — leave room for OS + yt-dlp on 8GB server
ENV NODE_OPTIONS="--max-old-space-size=3072"

# Install wget for cache warmup script
RUN apt-get update -qq && apt-get install -y --no-install-recommends wget && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy standalone output (much smaller than full node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# NOTE: Video data is in PostgreSQL now — no JSON files needed at runtime
# Copy warmup script
COPY scripts/warmup.sh ./warmup.sh
RUN chmod +x warmup.sh

EXPOSE 3000

# Start server + run warmup in background to pre-populate ISR cache
CMD sh -c "node server.js & sh warmup.sh & wait"
