# --- Build Stage ---
FROM golang:1.24-alpine AS builder

# Install system dependencies
RUN apk add --no-cache git gcc musl-dev

WORKDIR /app

# Copy go.mod and go.sum
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build both Go applications
# CGO_ENABLED=0 builds statically linked binaries
RUN CGO_ENABLED=0 GOOS=linux go build -o backend-bin ./cmd/backend
RUN CGO_ENABLED=0 GOOS=linux go build -o migrate-bin ./cmd/migrate

# --- Final Stage ---
FROM alpine:3.19

RUN apk --no-cache add ca-certificates curl

WORKDIR /root/

# Copy the binaries from the build stage
COPY --from=builder /app/backend-bin ./backend
COPY --from=builder /app/migrate-bin ./migrate

# Expose port 8080 to the outer world
EXPOSE 8080

# Command to run the executable (default is backend)
CMD ["./backend"]
