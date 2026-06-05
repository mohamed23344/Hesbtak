FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application files
COPY . .

# Generate Prisma client and build application
RUN npx prisma generate
RUN npm run build

EXPOSE 3000