# Use Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy server source code
COPY . .

# Copy shared backend (needed for business logic)
# Note: shared_backend will be mounted as volume in docker-compose

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S apiserver -u 1001

# Change ownership of app directory and logs
RUN chown -R apiserver:nodejs /app
RUN chmod -R 777 /app/logs

# Switch to non-root user (temporarily disabled for testing)
# USER apiserver

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]