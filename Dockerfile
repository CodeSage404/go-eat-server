# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code and config
COPY . .

# Build the application
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine AS runtime

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm install --omit=dev

# Copy compiled code from build stage
COPY --from=build /app/dist ./dist

# Create a non-root user for security
# Alpine already has a 'node' user
USER node

# Expose the application port
EXPOSE 5000

# Start the application
CMD ["node", "dist/index.js"]
