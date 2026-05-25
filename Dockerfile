FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN go build -o server .

FROM alpine:3.21
WORKDIR /app
COPY --from=builder /app/backend/server ./server
COPY --from=frontend /app/frontend/dist ./dist
EXPOSE 8080
CMD ["./server"]
