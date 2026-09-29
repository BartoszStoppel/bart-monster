FROM oven/bun:1.3.14-slim AS web-build
WORKDIR /build/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

FROM rust:1.97.1-bookworm AS rust-build
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY rust/ ./rust/
COPY api/ ./api/
RUN cargo build --locked --release --bin bart-monster

FROM debian:bookworm-slim
RUN apt-get update && apt-get install --no-install-recommends -y ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home-dir /app app
WORKDIR /app
COPY --from=rust-build /build/target/release/bart-monster /usr/local/bin/bart-monster
COPY --from=web-build /build/web/dist ./web/dist
ENV BIND_ADDRESS=0.0.0.0 PORT=8000
USER app
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/bart-monster"]
