# Build Stage
FROM rust:1.85-bookworm AS builder
WORKDIR /app

# Copy source code and manifests
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Build production release binary
RUN cargo build --release --bin backend

# Runtime Stage
FROM debian:bookworm-slim
WORKDIR /app

# Install SSL certificates and basic runtime libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create uploads directory
RUN mkdir -p /app/uploads

# Copy compiled binary from builder
COPY --from=builder /app/target/release/backend /app/backend

# Render injects PORT env variable automatically
ENV PORT=10000
EXPOSE 10000

CMD ["/app/backend"]
