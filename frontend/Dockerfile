# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build the React application using Vite
RUN npm run build

# --- Production Stage ---
FROM nginx:1.25-alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (standard HTTP port)
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
