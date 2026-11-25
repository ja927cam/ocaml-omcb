#!/usr/bin/env python3
"""Tests for the production Compose validator.

The positive case comes from the real `docker compose config` output. No
Docker daemon is required; only the Compose CLI.
"""

from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
import validate_compose  # noqa: E402

DEPLOY_DIR = Path(__file__).resolve().parent
COMPOSE = DEPLOY_DIR / "docker-compose.prod.yml"
TAG = "0123456789abcdef0123456789abcdef01234567"


def resolved_config() -> dict:
    env = dict(os.environ)
    env.update(
        {
            "IMAGE_TAG": TAG,
            "APP_IMAGE": validate_compose.EXPECTED_IMAGE,
            "ACME_EMAIL": "ci@example.com",
        }
    )
    result = subprocess.run(
        [
            "docker",
            "compose",
            "--project-directory",
            str(DEPLOY_DIR),
            "-f",
            str(COMPOSE),
            "config",
            "--format",
            "json",
        ],
        env=env,
        check=True,
        capture_output=True,
    )
    return json.loads(result.stdout)


class ComposeValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.base = resolved_config()
        self.assertEqual(
            validate_compose.validate(
                self.base, str(DEPLOY_DIR), TAG
            ),
            [],
        )

    def assert_rejected(self, mutate, fragment: str) -> None:
        config = copy.deepcopy(self.base)
        mutate(config)
        errors = validate_compose.validate(config, str(DEPLOY_DIR), TAG)
        self.assertTrue(errors, "mutated config was accepted")
        self.assertTrue(
            any(fragment in error for error in errors),
            f"expected {fragment!r} in {errors!r}",
        )

    def test_wrong_app_image(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__(
                "image", "ghcr.io/attacker/sim-map:" + TAG
            ),
            "app image",
        )

    def test_app_host_port(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__(
                "ports", [{"published": "8080", "target": 8080}]
            ),
            "must not publish",
        )

    def test_app_extra_volume(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"]["volumes"].append(
                {
                    "type": "bind",
                    "source": "/opt/sim-map",
                    "target": "/opt/sim-map",
                }
            ),
            "app volumes",
        )

    def test_data_mount_changed(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"]["volumes"][0].__setitem__(
                "source", "/tmp/other-data"
            ),
            "app volumes",
        )

    def test_app_docker_socket(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"]["volumes"].append(
                {
                    "type": "bind",
                    "source": "/var/run/docker.sock",
                    "target": "/var/run/docker.sock",
                }
            ),
            "Docker socket",
        )

    def test_app_root_user(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__("user", "0:0"),
            "must not run as root",
        )

    def test_app_privileged(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__("privileged", True),
            "privileged",
        )

    def test_app_cap_add(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__(
                "cap_add", ["NET_ADMIN"]
            ),
            "capabilities",
        )

    def test_app_cap_drop_removed(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__("cap_drop", []),
            "drop all",
        )

    def test_app_no_new_privileges_removed(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__("security_opt", []),
            "no-new-privileges",
        )

    def test_app_stop_grace_changed(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__(
                "stop_grace_period", "1s"
            ),
            "stop_grace_period",
        )

    def test_app_environment_data_dir_changed(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"]["environment"].__setitem__(
                "SIM_MAP_DATA_DIR", "/tmp"
            ),
            "SIM_MAP_DATA_DIR",
        )

    def test_app_host_networking(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__(
                "network_mode", "host"
            ),
            "host networking",
        )

    def test_app_replicas(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["app"].__setitem__(
                "deploy", {"replicas": 2}
            ),
            "one replica",
        )

    def test_caddy_image_changed(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["caddy"].__setitem__(
                "image", "attacker/proxy:latest"
            ),
            "caddy image",
        )

    def test_caddy_wrong_port(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["caddy"].__setitem__(
                "ports", [{"published": "8080", "target": 80}]
            ),
            "caddy must publish",
        )

    def test_caddy_extra_mount(self) -> None:
        self.assert_rejected(
            lambda c: c["services"]["caddy"]["volumes"].append(
                {"type": "bind", "source": "/", "target": "/host"}
            ),
            "caddy volumes",
        )

    def test_extra_service(self) -> None:
        self.assert_rejected(
            lambda c: c["services"].__setitem__(
                "helper", {"image": "alpine:latest"}
            ),
            "exactly the app and caddy",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
