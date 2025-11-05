# Use official Node.js runtime as base image
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install dependencies as root
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies using yarn
RUN yarn install --frozen-lockfile --production && yarn cache clean --all

# Copy application code
COPY . .

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (assuming billing service runs on 3002)
EXPOSE 3002

# Health check (adjust endpoint if different)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application
CMD ["node", "server.js"]