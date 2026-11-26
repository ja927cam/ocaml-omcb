#!/usr/bin/env python3
"""Static production-policy checks for files that need Docker or a VPS.

These complement the registry/Compose unit tests by guarding the deployment
invariants that cannot be executed locally: no GitHub-to-VPS SSH, a root-only
pull service/timer, no destructive data commands, and the pull agent's fixed
deploy invocation.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def text(relative: str) -> str:
    return (ROOT / relative).read_text()


class DeploymentPolicyTests(unittest.TestCase):
    def test_pull_agent_has_no_shell_or_sudo(self) -> None:
        agent = text("deploy/pull_agent.py")
        self.assertIn('DEPLOY_SCRIPT = str(Path(__file__).resolve().parent / "deploy.sh")', agent)
        self.assertNotIn("shell=True", agent)
        self.assertNotIn('"sudo"', agent)
        self.assertNotIn("'sudo'", agent)
        self.assertNotIn("os.system", agent)

    def test_deploy_script_has_no_data_destruction(self) -> None:
        script = text("deploy/deploy.sh")
        self.assertNotIn("down -v", script)
        self.assertNotIn("docker volume rm", script)
        for line in script.splitlines():
            if re.search(r"\brm\b", line):
                self.assertNotIn("/srv/chess", line)
        self.assertIn('DATA_DIR="/srv/chess/data"', script)

    def test_systemd_units_are_root_and_interval_bounded(self) -> None:
        service = text("deploy/ocaml-omcb-pull.service")
        timer = text("deploy/ocaml-omcb-pull.timer")
        self.assertIn("User=root", service)
        self.assertIn("ExecStart=/usr/bin/python3 /opt/ocaml-omcb/pull_agent.py", service)
        self.assertIn("EnvironmentFile=-/etc/ocaml-omcb/ghcr.env", service)
        self.assertIn("OnUnitInactiveSec=5min", timer)
        self.assertIn("OnBootSec=2min", timer)
        self.assertIn("Persistent=true", timer)
        self.assertIn("Unit=ocaml-omcb-pull.service", timer)

    def test_workflow_has_no_vps_ssh_or_secrets(self) -> None:
        workflow = text(".github/workflows/deploy.yml")
        for forbidden in (
            "VPS_HOST",
            "VPS_USER",
            "VPS_PORT",
            "VPS_SSH_KEY",
            "VPS_KNOWN_HOSTS",
            "ssh ",
        ):
            self.assertNotIn(forbidden, workflow)
        self.assertIn("packages: write", workflow)
        self.assertIn("git/ref/heads/main", workflow)
        self.assertIn("GITHUB_SHA", workflow)
        self.assertIn("Publish latest (current main head only)", workflow)

    def test_builder_provides_compatible_binaryen(self) -> None:
        dockerfile = text("Dockerfile")
        self.assertIn("BINARYEN_VERSION=119", dockerfile)
        self.assertIn("BINARYEN_SHA256", dockerfile)
        self.assertIn("binaryen", dockerfile)
        self.assertIn("/usr/local/bin/wasm-opt", dockerfile)
        self.assertIn("wasm-opt --version", dockerfile)
        self.assertIn('ENV PATH="/usr/local/bin:${PATH}"', dockerfile)

    def test_metrics_endpoints_are_public(self) -> None:
        caddyfile = text("deploy/Caddyfile")
        self.assertNotIn("path /metrics", caddyfile)
        self.assertIn("@internal path /state-hash /debug/*", caddyfile)
        server = text("server/server.ml")
        self.assertIn('Dream.get "/metrics.prom"', server)
        self.assertIn('Dream.get "/metrics"', server)

    def test_docker_runs_dune_through_opam_exec(self) -> None:
        dockerfile = text("Dockerfile")
        self.assertIn(
            "RUN opam exec -- dune build --profile release", dockerfile
        )
        self.assertIn(
            "RUN opam exec -- dune runtest --profile release", dockerfile
        )
        self.assertNotIn("RUN dune build", dockerfile)
        self.assertNotIn("RUN dune runtest", dockerfile)

    def test_runtime_image_contains_deploy_files(self) -> None:
        dockerfile = text("Dockerfile")
        self.assertIn("FROM build AS test", dockerfile)
        self.assertIn("dune runtest --profile release", dockerfile)
        self.assertIn(
            "COPY --from=build /home/opam/ocaml-omcb/deploy ./deploy", dockerfile
        )

    def test_agent_enforces_expected_repository_and_source(self) -> None:
        agent = text("deploy/pull_agent.py")
        self.assertIn(
            'EXPECTED_IMAGE = "ghcr.io/ja927cam/ocaml-omcb"', agent
        )
        self.assertIn(
            'EXPECTED_SOURCE = "https://github.com/ja927cam/ocaml-omcb"', agent
        )
        self.assertIn("image == EXPECTED_IMAGE", agent)
        self.assertIn("image == LEGACY_IMAGE", agent)
        self.assertIn("source not in {EXPECTED_SOURCE, LEGACY_SOURCE}", agent)
        self.assertIn("DIGEST_RE", agent)


if __name__ == "__main__":
    unittest.main(verbosity=2)
