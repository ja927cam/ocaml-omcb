# ---------------------------------------------------------------------------
# Build: OCaml switch, patched httpun-ws, server and WASM client.
# ---------------------------------------------------------------------------
FROM ocaml/opam:debian-12-ocaml-5.4 AS build

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      libev-dev \
      libssl-dev \
      m4 \
      patch \
      pkg-config \
      zlib1g-dev \
 && rm -rf /var/lib/apt/lists/* \
 && install -d -o opam -g opam /home/opam/sim-map

USER opam
WORKDIR /home/opam/sim-map

# Keep the dependency layer stable: only the manifests and the websocket pin
# are copied before opam runs.
COPY --chown=opam:opam dune-project sim_map.opam ./
COPY --chown=opam:opam scripts/pin-httpun-ws.sh scripts/pin-httpun-ws.sh
COPY --chown=opam:opam vendor/httpun-ws-wsd.patch vendor/httpun-ws-wsd.patch

RUN opam update \
 && ./scripts/pin-httpun-ws.sh \
 && opam install --deps-only --yes .

COPY --chown=opam:opam . .

RUN dune build --profile release

# ---------------------------------------------------------------------------
# Runtime: only the server binary, its shared libraries and the static client.
# The server resolves server/static and _build/default/client relative to cwd.
# ---------------------------------------------------------------------------
FROM debian:12-slim AS runtime

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      libbrotli1 \
      libev4 \
      libssl3 \
      libzstd1 \
      zlib1g \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 10001 sim-map \
 && useradd --uid 10001 --gid 10001 --home-dir /var/lib/sim-map \
      --shell /usr/sbin/nologin --no-create-home sim-map \
 && install -d -o sim-map -g sim-map /var/lib/sim-map/data \
 && install -d /opt/sim-map/server/static

WORKDIR /opt/sim-map

COPY --from=build /home/opam/sim-map/_build/default/server/server.exe ./server.exe
COPY --from=build /home/opam/sim-map/server/static ./server/static
COPY --from=build /home/opam/sim-map/_build/default/client ./_build/default/client

ENV SIM_MAP_DATA_DIR=/var/lib/sim-map/data \
    SIM_MAP_PORT=8080 \
    SIM_MAP_INTERFACE=0.0.0.0

EXPOSE 8080
VOLUME ["/var/lib/sim-map/data"]

USER sim-map
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${SIM_MAP_PORT}/healthz" || exit 1

ENTRYPOINT ["/opt/sim-map/server.exe"]
