#!/usr/bin/env python3
"""Local tests for the GHCR pull agent's registry/label logic.

Uses a loopback HTTP mock registry; no Docker, GHCR or VPS access.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(__file__))
import pull_agent  # noqa: E402

REVISION = "0123456789abcdef0123456789abcdef01234567"


class Handler(BaseHTTPRequestHandler):
    routes: dict[str, tuple[int, dict[str, str], bytes]] = {}

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        route = self.routes.get(path)
        if route is None:
            self.send_response(404)
            self.end_headers()
            return
        status, headers, body = route
        self.send_response(status)
        for name, value in headers.items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_: object) -> None:
        pass


class Registry:
    def __init__(self) -> None:
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    @property
    def base(self) -> str:
        host, port = self.server.server_address
        return f"http://{host}:{port}"

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()


def json_response(value: dict, headers: dict[str, str] | None = None):
    body = json.dumps(value).encode()
    merged = {"Content-Type": "application/json"}
    if headers:
        merged.update(headers)
    return 200, merged, body


def blob(value: dict):
    return json_response(value)


class PullAgentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = Registry()

    def tearDown(self) -> None:
        self.registry.close()

    def install_single_manifest(self) -> None:
        config_digest = "sha256:config"
        Handler.routes = {
            "/token": json_response({"token": "test-token"}),
            "/v2/test/repo/manifests/latest": json_response(
                {
                    "schemaVersion": 2,
                    "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
                    "config": {
                        "mediaType": "application/vnd.docker.container.image.v1+json",
                        "digest": config_digest,
                    },
                    "layers": [],
                },
                {"Docker-Content-Digest": "sha256:latest"},
            ),
            f"/v2/test/repo/blobs/{config_digest}": blob(
                {
                    "config": {
                        "Labels": {
                            "org.opencontainers.image.revision": REVISION
                        }
                    }
                }
            ),
        }

    def install_index(self) -> None:
        platform = pull_agent.host_arch()
        platform_digest = "sha256:platform"
        config_digest = "sha256:config"
        Handler.routes = {
            "/token": json_response({"token": "test-token"}),
            "/v2/test/repo/manifests/latest": json_response(
                {
                    "schemaVersion": 2,
                    "mediaType": "application/vnd.oci.image.index.v1+json",
                    "manifests": [
                        {
                            "mediaType": "application/vnd.oci.image.manifest.v1+json",
                            "digest": platform_digest,
                            "platform": {"os": "linux", "architecture": platform},
                        }
                    ],
                },
                {"Docker-Content-Digest": "sha256:index"},
            ),
            f"/v2/test/repo/manifests/{platform_digest}": json_response(
                {
                    "schemaVersion": 2,
                    "mediaType": "application/vnd.oci.image.manifest.v1+json",
                    "config": {
                        "mediaType": "application/vnd.oci.image.config.v1+json",
                        "digest": config_digest,
                    },
                    "layers": [],
                }
            ),
            f"/v2/test/repo/blobs/{config_digest}": blob(
                {
                    "config": {
                        "Labels": {
                            "org.opencontainers.image.revision": REVISION
                        }
                    }
                }
            ),
        }

    def test_single_manifest(self) -> None:
        self.install_single_manifest()
        digest, revision = pull_agent.fetch_latest(self.registry.base, "test/repo")
        self.assertEqual(digest, "sha256:latest")
        self.assertEqual(revision, REVISION)

    def test_manifest_index(self) -> None:
        self.install_index()
        digest, revision = pull_agent.fetch_latest(self.registry.base, "test/repo")
        self.assertEqual(digest, "sha256:index")
        self.assertEqual(revision, REVISION)

    def test_missing_revision_label(self) -> None:
        self.install_single_manifest()
        route = Handler.routes["/v2/test/repo/blobs/sha256:config"]
        Handler.routes["/v2/test/repo/blobs/sha256:config"] = (
            route[0],
            route[1],
            json.dumps({"config": {"Labels": {}}}).encode(),
        )
        with self.assertRaisesRegex(RuntimeError, "revision"):
            pull_agent.fetch_latest(self.registry.base, "test/repo")

    def test_parse_image(self) -> None:
        self.assertEqual(
            pull_agent.parse_image("ghcr.io/ja927cam/sim-map"),
            ("ghcr.io", "ja927cam/sim-map"),
        )
        self.assertEqual(
            pull_agent.parse_image("ghcr.io/ja927cam/sim-map:latest"),
            ("ghcr.io", "ja927cam/sim-map"),
        )
        with self.assertRaises(ValueError):
            pull_agent.parse_image("docker.io/example/image")


if __name__ == "__main__":
    unittest.main(verbosity=2)
