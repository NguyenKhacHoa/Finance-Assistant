# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package info
COPY package*.json ./

# Cài đặt toàn bộ dependencies
RUN npm install

# Copy Source code vào container
COPY . .

# Khai báo và Thiết lập biến mô trường API lúc Build Time để Vite đóng gói tĩnh vào bundle JS
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build ứng dụng Vite tĩnh
RUN npm run build

# Stage 2: Nginx Web Server (Cung cấp file với hiệu suất cực cao)
FROM nginx:alpine

# Xóa trang html mặc định của nginx
RUN rm -rf /usr/share/nginx/html/*

# Copy file cấu hình điều hướng (hỗ trợ refresh React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build folder từ builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Chạy Nginx
CMD ["nginx", "-g", "daemon off;"]
