# Multi-stage build for Bosta Insight Hub v2
FROM node:18-alpine AS deps

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies without canvas first (faster)
RUN npm ci --prefer-offline --no-audit --ignore-scripts

# Install canvas dependencies and build canvas separately (cacheable)
FROM deps AS canvas-builder
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

# Build canvas (this heavy step is isolated)
RUN npm rebuild canvas

# Development dependencies stage
FROM canvas-builder AS builder

# Copy configuration files
COPY . .

# Build frontend and backend
RUN npm run build && npm run build:backend

# Production stage - minimal
FROM node:18-alpine AS production

# Install only runtime dependencies (no dev tools)
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    pixman \
    ttf-dejavu \
    fontconfig \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bosta -u 1001

# Set working directory
WORKDIR /app

# Copy built application and migration files
COPY --from=builder --chown=bosta:nodejs /app/dist ./dist
COPY --from=builder --chown=bosta:nodejs /app/package.json ./package.json
COPY --from=builder --chown=bosta:nodejs /app/mysql ./mysql

# Copy minimal node_modules (only runtime deps)
COPY --from=canvas-builder --chown=bosta:nodejs /app/node_modules ./node_modules

# Clean up and optimize
RUN npm prune --production && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/tmp/* /root/.npm

# Create charts directory and SSL secrets directory
RUN mkdir -p /app/public/charts && \
    mkdir -p /var/secrets/mysql-secrets && \
    chown -R bosta:nodejs /app/public && \
    chown -R bosta:nodejs /var/secrets

# Switch to non-root user
USER bosta

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["node", "dist/server/index.js"]