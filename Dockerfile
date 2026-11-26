# ---------------------------------------------------------------------------
# Build: OCaml switch, patched httpun-ws, server and WASM client.
# ---------------------------------------------------------------------------
FROM ocaml/opam:debian-12-ocaml-5.4 AS build

# wasm_of_ocaml-compiler 6.4 requires binaryen 119+, while Debian bookworm
# ships binaryen 108. The distro package satisfies opam's depext check; the
# pinned static release below is the wasm-opt actually used by the build.
ARG BINARYEN_VERSION=119
ARG BINARYEN_SHA256=716bcf9f5f36a6f466239fbb09a925eeaf54c46411ccefac979ec649e7c06d2d

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      binaryen \
      libev-dev \
      libssl-dev \
      m4 \
      patch \
      pkg-config \
      zlib1g-dev \
 && rm -rf /var/lib/apt/lists/* \
 && install -d -o opam -g opam /home/opam/ocaml-omcb

# Make the pinned tool win over Debian's older /usr/bin/wasm-opt for every
# later opam build step.
ENV PATH="/usr/local/bin:${PATH}"

RUN curl -fsSL -o /tmp/binaryen.tar.gz \
      "https://github.com/WebAssembly/binaryen/releases/download/version_${BINARYEN_VERSION}/binaryen-version_${BINARYEN_VERSION}-x86_64-linux.tar.gz" \
 && echo "${BINARYEN_SHA256}  /tmp/binaryen.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/binaryen.tar.gz -C /tmp \
 && install -m 0755 "/tmp/binaryen-version_${BINARYEN_VERSION}/bin/wasm-opt" /usr/local/bin/wasm-opt \
 && install -m 0755 "/tmp/binaryen-version_${BINARYEN_VERSION}/bin/wasm-metadce" /usr/local/bin/wasm-metadce \
 && install -m 0755 "/tmp/binaryen-version_${BINARYEN_VERSION}/bin/wasm-merge" /usr/local/bin/wasm-merge \
 && rm -rf /tmp/binaryen.tar.gz "/tmp/binaryen-version_${BINARYEN_VERSION}" \
 && wasm-opt --version | grep -q "version ${BINARYEN_VERSION}"

USER opam
WORKDIR /home/opam/ocaml-omcb

# Keep the dependency layer stable: only the manifests and the websocket pin
# are copied before opam runs.
COPY --chown=opam:opam dune-project ocaml-omcb.opam ./
COPY --chown=opam:opam scripts/pin-httpun-ws.sh scripts/pin-httpun-ws.sh
COPY --chown=opam:opam vendor/httpun-ws-wsd.patch vendor/httpun-ws-wsd.patch

RUN opam update \
 && ./scripts/pin-httpun-ws.sh \
 && opam install --deps-only --with-test --yes .

COPY --chown=opam:opam . .

# Docker RUN does not use the base image's `opam exec --` entrypoint, so the
# switch bin directory is not on PATH here. Invoke dune through opam exec.
RUN opam exec -- dune build --profile release

# CI target: run the OCaml unit/integration tests without building the runtime
# image. The production image still targets the `runtime` stage only.
FROM build AS test
RUN opam exec -- dune runtest --profile release

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
 && groupadd --system --gid 10001 ocaml-omcb \
 && useradd --uid 10001 --gid 10001 --home-dir /var/lib/ocaml-omcb \
      --shell /usr/sbin/nologin --no-create-home ocaml-omcb \
 && install -d -o ocaml-omcb -g ocaml-omcb /var/lib/ocaml-omcb/data \
 && install -d -o ocaml-omcb -g ocaml-omcb /var/lib/sim-map/data \
 && install -d /opt/ocaml-omcb/server/static \
 && ln -s /opt/ocaml-omcb /opt/sim-map

WORKDIR /opt/ocaml-omcb

COPY --from=build /home/opam/ocaml-omcb/_build/default/server/server.exe ./server.exe
COPY --from=build /home/opam/ocaml-omcb/server/static ./server/static
COPY --from=build /home/opam/ocaml-omcb/_build/default/client ./_build/default/client
COPY --from=build /home/opam/ocaml-omcb/deploy ./deploy

ENV OCAML_OMCB_DATA_DIR=/var/lib/ocaml-omcb/data \
    OCAML_OMCB_PORT=8080 \
    OCAML_OMCB_INTERFACE=0.0.0.0

EXPOSE 8080
VOLUME ["/var/lib/ocaml-omcb/data"]

USER ocaml-omcb
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${OCAML_OMCB_PORT}/healthz" || exit 1

ENTRYPOINT ["/opt/ocaml-omcb/server.exe"]
