# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Khai báo biến môi trường cho môi trường Build
ENV NODE_ENV=development

# Copy package files
COPY package*.json ./

# Cài đặt toàn bộ module
RUN npm install

# Copy source code và Prisma schema
COPY prisma ./prisma/
COPY . .

# Khởi tạo Prisma Client
RUN npx prisma generate

# Build ứng dụng NestJS
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Cỉ cài đặt prod dependencies để giảm kích thước image
RUN npm install --omit=dev

# Copy thư mục build từ stage 1
COPY --from=builder /app/dist ./dist
# Copy thư viện prisma generated code từ stage 1
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Khởi chạy Prisma Migrate (Push schema) trước khi bật server
# Lưu ý: docker-compose sẽ ghi đè biến DATABASE_URL lúc runtime
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main"]
