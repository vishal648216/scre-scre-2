# Build Stage
FROM rust:bookworm AS builder
WORKDIR /app

# Copy source code, manifests, and assets
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY fonts ./fonts

# Build production release binary
RUN cargo build --release --bin backend

# Runtime Stage
FROM debian:bookworm-slim
WORKDIR /app

# Install SSL certificates and basic runtime libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create uploads directory
RUN mkdir -p /app/uploads

# Copy compiled binary and fonts from builder
COPY --from=builder /app/target/release/backend /app/backend
COPY --from=builder /app/fonts /app/fonts

# Render injects PORT env variable automatically
ENV PORT=10000
EXPOSE 10000

CMD ["/app/backend"]
