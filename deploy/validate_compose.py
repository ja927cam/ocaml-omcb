#!/usr/bin/env python3
"""Validate the resolved production Compose configuration.

Reads `docker compose config --format json` on stdin. The deploy script uses
this before replacing the app container, so an image's embedded compose file
cannot silently publish the app, change the data bind mount, add privileged
services, or mount the Docker socket.
"""

from __future__ import annotations

import json
import os
import sys

EXPECTED_IMAGE = "ghcr.io/ja927cam/ocaml-omcb"
LEGACY_IMAGE = "ghcr.io/ja927cam/sim-map"
CADDY_IMAGE = "caddy:2.8.4-alpine"
APP_DATA_SOURCE = "/srv/chess/data"
APP_DATA_TARGET = "/var/lib/ocaml-omcb/data"
LEGACY_APP_DATA_TARGET = "/var/lib/sim-map/data"
CADDY_DATA_SOURCE = "/srv/chess/caddy/data"
CADDY_CONFIG_SOURCE = "/srv/chess/caddy/config"
APP_STOP_GRACE = "45s"


def bind_mounts(service: dict) -> set[tuple[str, str | None, str | None]]:
    return {
        (mount.get("type"), mount.get("source"), mount.get("target"))
        for mount in service.get("volumes") or []
    }


def validate(
    config: dict,
    project_dir: str,
    tag: str,
    expected_image: str = EXPECTED_IMAGE,
) -> list[str]:
    errors: list[str] = []
    project_dir = os.path.abspath(project_dir)
    services = config.get("services")
    if not isinstance(services, dict):
        return ["compose has no services object"]
    if set(services) != {"app", "caddy"}:
        errors.append("compose must contain exactly the app and caddy services")

    for name, service in services.items():
        if service.get("privileged"):
            errors.append(f"{name} must not be privileged")
        if service.get("cap_add"):
            errors.append(f"{name} must not add Linux capabilities")
        for mount in service.get("volumes") or []:
            if mount.get("source") == "/var/run/docker.sock":
                errors.append(f"{name} must not mount the Docker socket")

    app = services.get("app")
    if not isinstance(app, dict):
        return errors + ["compose has no app service"]
    if app.get("cap_drop") != ["ALL"]:
        errors.append("app must drop all Linux capabilities")

    expected_app_image = f"{expected_image}:{tag}"
    allowed_app_images = {
        expected_app_image,
        f"{EXPECTED_IMAGE}:{tag}",
        f"{LEGACY_IMAGE}:{tag}",
    }
    if app.get("image") not in allowed_app_images:
        errors.append(
            f"app image must be one of {sorted(allowed_app_images)!r}, "
            f"got {app.get('image')!r}"
        )
    if app.get("ports"):
        errors.append("app must not publish host ports")
    if app.get("network_mode") == "host":
        errors.append("app must not use host networking")
    if app.get("deploy", {}).get("replicas", 1) != 1:
        errors.append("app must have exactly one replica")
    if app.get("user") is not None:
        user = str(app.get("user")).split(":", 1)[0]
        if user in {"0", "root"}:
            errors.append("app must not run as root")
    if app.get("stop_grace_period") != APP_STOP_GRACE:
        errors.append(f"app stop_grace_period must be {APP_STOP_GRACE!r}")
    security = app.get("security_opt") or []
    if not any("no-new-privileges" in option for option in security):
        errors.append("app must set no-new-privileges")
    app_binds = bind_mounts(app)
    if app_binds not in (
        {("bind", APP_DATA_SOURCE, APP_DATA_TARGET)},
        {("bind", APP_DATA_SOURCE, LEGACY_APP_DATA_TARGET)},
    ):
        errors.append(
            f"app volumes must be {APP_DATA_SOURCE} -> "
            f"{APP_DATA_TARGET} or {LEGACY_APP_DATA_TARGET}"
        )

    environment = app.get("environment") or {}
    if environment.get("OCAML_OMCB_DATA_DIR") not in {
        APP_DATA_TARGET,
        LEGACY_APP_DATA_TARGET,
    }:
        errors.append(
            "app OCAML_OMCB_DATA_DIR must be "
            f"{APP_DATA_TARGET!r} or {LEGACY_APP_DATA_TARGET!r}"
        )
    if environment.get("OCAML_OMCB_PORT") != "8080":
        errors.append("app OCAML_OMCB_PORT must be '8080'")
    if environment.get("OCAML_OMCB_INTERFACE") != "0.0.0.0":
        errors.append("app OCAML_OMCB_INTERFACE must be '0.0.0.0'")

    caddy = services.get("caddy")
    if not isinstance(caddy, dict):
        return errors + ["compose has no caddy service"]

    if caddy.get("image") != CADDY_IMAGE:
        errors.append(
            f"caddy image must be {CADDY_IMAGE!r}, got {caddy.get('image')!r}"
        )
    published = {
        (str(port.get("published")), int(port.get("target", 0)))
        for port in caddy.get("ports") or []
        if isinstance(port, dict)
    }
    if published != {("80", 80), ("443", 443)}:
        errors.append("caddy must publish exactly host 80->80 and 443->443")
    expected_caddy = {
        ("bind", os.path.join(project_dir, "caddy"), "/etc/caddy"),
        ("bind", CADDY_DATA_SOURCE, "/data"),
        ("bind", CADDY_CONFIG_SOURCE, "/config"),
    }
    if bind_mounts(caddy) != expected_caddy:
        errors.append(
            "caddy volumes must be exactly ./caddy, "
            f"{CADDY_DATA_SOURCE} and {CADDY_CONFIG_SOURCE}"
        )

    return errors


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(
            "usage: validate_compose.py <project-dir> <image-tag> "
            "[expected-image]",
            file=sys.stderr,
        )
        return 2
    project_dir, tag = argv[1], argv[2]
    expected_image = argv[3] if len(argv) > 3 else EXPECTED_IMAGE
    try:
        config = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError) as exc:
        print(f"invalid compose JSON: {exc}", file=sys.stderr)
        return 2
    if not isinstance(config, dict):
        print("compose JSON is not an object", file=sys.stderr)
        return 2
    errors = validate(config, project_dir, tag, expected_image)
    if errors:
        for error in errors:
            print(f"validate_compose: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
