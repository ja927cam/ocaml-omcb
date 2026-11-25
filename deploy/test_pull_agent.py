#!/usr/bin/env python3
"""Local tests for the GHCR pull agent's registry/label logic.

Uses a loopback HTTP mock registry; no Docker, GHCR or VPS access. Manifest
and config digests are computed from the actual response bodies, so the
agent's digest verification is exercised too.
"""

from __future__ import annotations

import copy
import hashlib
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
SOURCE = "https://github.com/ja927cam/sim-map"


def body(value: dict) -> bytes:
    return json.dumps(value).encode()


def digest(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def raw_response(value: bytes, digest_value: str | None = None):
    headers = {"Content-Type": "application/json"}
    if digest_value is not None:
        headers["Docker-Content-Digest"] = digest_value
    return 200, headers, value


def json_response(value: dict):
    return raw_response(body(value))


class Handler(BaseHTTPRequestHandler):
    routes: dict[str, tuple[int, dict[str, str], bytes]] = {}

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        route = self.routes.get(path)
        if route is None:
            self.send_response(404)
            self.end_headers()
            return
        status, headers, value = route
        self.send_response(status)
        for name, header_value in headers.items():
            self.send_header(name, header_value)
        self.send_header("Content-Length", str(len(value)))
        self.end_headers()
        self.wfile.write(value)

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


class PullAgentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = Registry()
        self.original_routes = Handler.routes

    def tearDown(self) -> None:
        Handler.routes = self.original_routes
        self.registry.close()

    def install_single_manifest(
        self,
        *,
        source: str = SOURCE,
        revision: str = REVISION,
        manifest_header: str | None = None,
        config_body_override: bytes | None = None,
    ) -> tuple[str, str]:
        config_body = body(
            {
                "config": {
                    "Labels": {
                        "org.opencontainers.image.revision": revision,
                        "org.opencontainers.image.source": source,
                    }
                }
            }
        )
        config_digest = digest(config_body)
        manifest_body = body(
            {
                "schemaVersion": 2,
                "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
                "config": {
                    "mediaType": "application/vnd.docker.container.image.v1+json",
                    "digest": config_digest,
                },
                "layers": [],
            }
        )
        manifest_digest = digest(manifest_body)
        Handler.routes = {
            "/token": json_response({"token": "test-token"}),
            "/v2/test/repo/manifests/latest": raw_response(
                manifest_body, manifest_header or manifest_digest
            ),
            f"/v2/test/repo/blobs/{config_digest}": raw_response(
                config_body_override or config_body
            ),
        }
        return manifest_digest, config_digest

    def install_index(self) -> tuple[str, str]:
        config_body = body(
            {
                "config": {
                    "Labels": {
                        "org.opencontainers.image.revision": REVISION,
                        "org.opencontainers.image.source": SOURCE,
                    }
                }
            }
        )
        config_digest = digest(config_body)
        platform_manifest = body(
            {
                "schemaVersion": 2,
                "mediaType": "application/vnd.oci.image.manifest.v1+json",
                "config": {
                    "mediaType": "application/vnd.oci.image.config.v1+json",
                    "digest": config_digest,
                },
                "layers": [],
            }
        )
        platform_digest = digest(platform_manifest)
        index = body(
            {
                "schemaVersion": 2,
                "mediaType": "application/vnd.oci.image.index.v1+json",
                "manifests": [
                    {
                        "mediaType": "application/vnd.oci.image.manifest.v1+json",
                        "digest": platform_digest,
                        "platform": {
                            "os": "linux",
                            "architecture": pull_agent.host_arch(),
                        },
                    }
                ],
            }
        )
        index_digest = digest(index)
        Handler.routes = {
            "/token": json_response({"token": "test-token"}),
            "/v2/test/repo/manifests/latest": raw_response(index, index_digest),
            f"/v2/test/repo/manifests/{platform_digest}": raw_response(
                platform_manifest, platform_digest
            ),
            f"/v2/test/repo/blobs/{config_digest}": raw_response(config_body),
        }
        return index_digest, platform_digest

    def test_single_manifest(self) -> None:
        expected_digest, _ = self.install_single_manifest()
        digest_value, revision = pull_agent.fetch_latest(
            self.registry.base, "test/repo"
        )
        self.assertEqual(digest_value, expected_digest)
        self.assertEqual(revision, REVISION)

    def test_manifest_index(self) -> None:
        expected_digest, _ = self.install_index()
        digest_value, revision = pull_agent.fetch_latest(
            self.registry.base, "test/repo"
        )
        self.assertEqual(digest_value, expected_digest)
        self.assertEqual(revision, REVISION)

    def test_missing_revision_label(self) -> None:
        self.install_single_manifest(revision="")
        with self.assertRaisesRegex(RuntimeError, "revision"):
            pull_agent.fetch_latest(self.registry.base, "test/repo")

    def test_wrong_source_label(self) -> None:
        self.install_single_manifest(source="https://github.com/attacker/repo")
        with self.assertRaisesRegex(RuntimeError, "source"):
            pull_agent.fetch_latest(self.registry.base, "test/repo")

    def test_manifest_digest_mismatch(self) -> None:
        self.install_single_manifest(manifest_header="sha256:" + "0" * 64)
        with self.assertRaisesRegex(RuntimeError, "manifest digest"):
            pull_agent.fetch_latest(self.registry.base, "test/repo")

    def test_config_digest_mismatch(self) -> None:
        self.install_single_manifest(
            config_body_override=body({"config": {"Labels": {}}})
        )
        with self.assertRaisesRegex(RuntimeError, "config blob digest"):
            pull_agent.fetch_latest(self.registry.base, "test/repo")

    def test_index_without_matching_platform(self) -> None:
        self.install_index()
        route = Handler.routes["/v2/test/repo/manifests/latest"]
        index = json.loads(route[2])
        for entry in index["manifests"]:
            entry["platform"] = {"os": "linux", "architecture": "riscv64"}
        index_body = body(index)
        Handler.routes["/v2/test/repo/manifests/latest"] = raw_response(
            index_body, digest(index_body)
        )
        with self.assertRaisesRegex(RuntimeError, "no linux/"):
            pull_agent.fetch_latest(self.registry.base, "test/repo")

    def test_invalid_platform_digest(self) -> None:
        self.install_index()
        route = Handler.routes["/v2/test/repo/manifests/latest"]
        index = json.loads(route[2])
        index["manifests"][0]["digest"] = "../../blobs/sha256:evil"
        index_body = body(index)
        Handler.routes["/v2/test/repo/manifests/latest"] = raw_response(
            index_body, digest(index_body)
        )
        with self.assertRaisesRegex(RuntimeError, "no linux/"):
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
            pull_agent.parse_image("ghcr.io/attacker/sim-map")
        with self.assertRaises(ValueError):
            pull_agent.parse_image("docker.io/ja927cam/sim-map")

    def test_failure_state_backoff_is_temporary(self) -> None:
        failure = {"digest": "sha256:" + "1" * 64, "failed_at": 1000.0}
        self.assertTrue(
            pull_agent.within_backoff(failure, now=1100.0, backoff=1800)
        )
        self.assertFalse(
            pull_agent.within_backoff(failure, now=4000.0, backoff=1800)
        )
        self.assertFalse(pull_agent.within_backoff(None, now=4000.0))
        self.assertFalse(
            pull_agent.within_backoff(
                {"failed_at": "not-a-number"}, now=4000.0, backoff=1800
            )
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
