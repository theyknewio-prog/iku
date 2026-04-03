FROM node:22-slim

# Install python3 + yt-dlp for on-demand video URL resolution
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    pip3 install yt-dlp --break-system-packages && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=6144"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Run
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
