# Deployment

The application is a single authoritative OCaml process. Production runs
exactly **one** application container behind Caddy on one VPS. The WAL and
snapshots live on a host bind mount and must never be recreated or shared by
multiple writers.

Deployment is **pull-based**:

```
GitHub push to main
  -> GitHub Actions tests, builds and smoke-tests the image
  -> image published to GHCR as :latest and :<full-git-sha>
  -> VPS systemd timer reads the GHCR latest manifest digest about every 5 minutes
  -> if the digest changed, the pull agent verifies/reads the embedded commit SHA label
  -> agent runs /opt/ocaml-omcb/deploy.sh --tag <sha> as root
  -> deploy.sh pulls the SHA image, validates its embedded compose/Caddyfile,
     replaces only the app container, checks /readyz, reloads Caddy
  -> deploy.sh rolls back automatically if readiness fails
```

GitHub Actions never connects to the VPS and no VPS SSH secrets are needed.

**Rename compatibility:** existing VPS installs still live at `/opt/sim-map`
and their pull agent expects `ghcr.io/ja927cam/sim-map`. The image workflow
publishes that legacy image (with the old OCI source label) in addition to
`ghcr.io/ja927cam/ocaml-omcb`, and the server accepts `SIM_MAP_*` environment
variables as fallbacks. Move the host files to `/opt/ocaml-omcb` and update
`/etc/sim-map/pull-agent.env` to the new image when convenient.

**Production URL:** https://chess.jamesashwood.com

**Branch model:** `main` is the only production/deploy branch. `develop` is
for local development and integration; pushes to `develop` do not build or
deploy production. Release by merging `develop` into `main`.

The production files are:

| File | Purpose |
|---|---|
| `deploy/docker-compose.prod.yml` | app + Caddy, GHCR image, persistent data |
| `deploy/Caddyfile` | HTTPS, ACME, reverse proxy and WebSocket upgrades |
| `deploy/deploy.sh` | idempotent root-owned deploy/rollback implementation |
| `deploy/pull_agent.py` | GHCR digest/label check and deploy invocation |
| `deploy/validate_compose.py` | root-owned resolved-Compose security guard |
| `deploy/ocaml-omcb-pull.service` | systemd oneshot service (runs as root) |
| `deploy/ocaml-omcb-pull.timer` | 5-minute systemd timer |
| `deploy/pull-agent.env.example` | `/etc/ocaml-omcb/pull-agent.env` template |
| `deploy/production.env.example` | `/opt/ocaml-omcb/.env` template |
| `deploy/smoke-test.sh` | container HTTP/WS/shutdown/WAL check |
| `deploy/caddy-smoke-test.sh` | real WebSocket move through Caddy |
| `.github/workflows/deploy.yml` | test, build and GHCR publish pipeline |

## DNS

Create these records at your DNS provider:

| Type | Name | Value |
|---|---|---|
| `A` | `chess.jamesashwood.com` | VPS IPv4 address |
| `AAAA` | `chess.jamesashwood.com` | VPS IPv6 address, only if the VPS has IPv6 |

Use a low TTL (300s) while setting up. Caddy needs ports 80 and 443 reachable
from the internet to complete the Let's Encrypt HTTP-01 challenge and renew
certificates.

Verify from a machine outside the VPS:

```bash
dig +short chess.jamesashwood.com
curl -I http://chess.jamesashwood.com/
```

## VPS preparation

The examples assume Ubuntu 24.04, Docker Engine and the Compose plugin are
already installed. Run preparation commands as root or with general sudo.

The pull agent runs as **root** under systemd. It is a fixed root-owned script
with no dedicated login account, no inbound listener and no GitHub access.

### 1. Base packages

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git python3 ufw
docker --version
docker compose version
```

`python3` is required by the pull agent and by `deploy.sh`'s Compose guards.

### 2. Admin SSH

There is no GitHub Actions SSH key and no deployment SSH account. Use your
existing administrator SSH access. If you want to harden it, ensure key login
works first and then apply:

```bash
sudo tee /etc/ssh/sshd_config.d/99-ocaml-omcb.conf >/dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
EOF
sudo sshd -t
sudo systemctl reload ssh
```

Keep an existing session open until a second key-based login succeeds. The
pull agent does not need an SSH account.

### 3. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

If Contabo provides a cloud firewall, allow the same ports there. Do **not**
open 8080. The app container has no published ports; only Caddy publishes
80/443.

### 4. Directories

```bash
sudo install -d -m 0755 /opt/ocaml-omcb /opt/ocaml-omcb/state /opt/ocaml-omcb/caddy
sudo install -d -m 0755 /srv/chess /srv/chess/caddy
sudo install -d -o 10001 -g 10001 -m 0750 /srv/chess/data
sudo install -d -m 0750 /srv/chess/caddy/data /srv/chess/caddy/config
sudo install -d -m 0700 /var/lib/ocaml-omcb-pull
sudo install -d -m 0755 /etc/ocaml-omcb
```

`/srv/chess/data` is the only authoritative application data directory. The
app container runs as UID/GID **10001** and must own it. Never delete,
recreate or `docker volume rm` this directory.

`/var/lib/ocaml-omcb-pull` holds only the agent's digest/SHA/backoff state.

### 5. Install the production files

From your admin machine, copy the files to a temporary location:

```bash
scp deploy/deploy.sh deploy/docker-compose.prod.yml deploy/Caddyfile \
  deploy/production.env.example deploy/pull_agent.py \
  deploy/validate_compose.py deploy/pull-agent.env.example \
  deploy/ocaml-omcb-pull.service deploy/ocaml-omcb-pull.timer \
  admin@<VPS_IP>:/tmp/ocaml-omcb-bootstrap/
```

On the VPS, install them as root:

```bash
sudo install -m 0755 /tmp/ocaml-omcb-bootstrap/deploy.sh /opt/ocaml-omcb/deploy.sh
sudo install -m 0755 /tmp/ocaml-omcb-bootstrap/pull_agent.py \
  /opt/ocaml-omcb/pull_agent.py
sudo install -m 0755 /tmp/ocaml-omcb-bootstrap/validate_compose.py \
  /opt/ocaml-omcb/validate_compose.py
sudo install -m 0644 /tmp/ocaml-omcb-bootstrap/docker-compose.prod.yml \
  /opt/ocaml-omcb/docker-compose.prod.yml
sudo install -m 0644 /tmp/ocaml-omcb-bootstrap/Caddyfile \
  /opt/ocaml-omcb/caddy/Caddyfile
sudo install -m 0600 /tmp/ocaml-omcb-bootstrap/production.env.example \
  /opt/ocaml-omcb/.env
sudo install -m 0600 /tmp/ocaml-omcb-bootstrap/pull-agent.env.example \
  /etc/ocaml-omcb/pull-agent.env
sudo install -m 0644 /tmp/ocaml-omcb-bootstrap/ocaml-omcb-pull.service \
  /etc/systemd/system/ocaml-omcb-pull.service
sudo install -m 0644 /tmp/ocaml-omcb-bootstrap/ocaml-omcb-pull.timer \
  /etc/systemd/system/ocaml-omcb-pull.timer
sudoedit /opt/ocaml-omcb/.env
sudoedit /etc/ocaml-omcb/pull-agent.env
```

Set at least:

```dotenv
# /opt/ocaml-omcb/.env
ACME_EMAIL=you@example.com
```

```dotenv
# /etc/ocaml-omcb/pull-agent.env
APP_IMAGE=ghcr.io/ja927cam/ocaml-omcb
STATE_DIR=/var/lib/ocaml-omcb-pull
```

The agent enforces this exact repository and the image's
`org.opencontainers.image.source=https://github.com/ja927cam/ocaml-omcb` label.
It rejects images from any other repository or source, even if `APP_IMAGE` is
edited.

Ensure ownership:

```bash
sudo chown root:root /opt/ocaml-omcb/deploy.sh /opt/ocaml-omcb/pull_agent.py \
  /opt/ocaml-omcb/validate_compose.py \
  /opt/ocaml-omcb/docker-compose.prod.yml /opt/ocaml-omcb/caddy/Caddyfile \
  /opt/ocaml-omcb/.env /etc/ocaml-omcb/pull-agent.env \
  /etc/systemd/system/ocaml-omcb-pull.service \
  /etc/systemd/system/ocaml-omcb-pull.timer
sudo chmod 0755 /opt/ocaml-omcb/deploy.sh /opt/ocaml-omcb/pull_agent.py \
  /opt/ocaml-omcb/validate_compose.py
sudo chmod 0644 /opt/ocaml-omcb/docker-compose.prod.yml /opt/ocaml-omcb/caddy/Caddyfile \
  /etc/systemd/system/ocaml-omcb-pull.service /etc/systemd/system/ocaml-omcb-pull.timer
sudo chmod 0600 /opt/ocaml-omcb/.env /etc/ocaml-omcb/pull-agent.env
```

Enable the timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ocaml-omcb-pull.timer
systemctl list-timers ocaml-omcb-pull.timer
```

The service itself is `oneshot`, runs as root, and is triggered by the timer.

After the bootstrap, application images carry their own copy of the production
compose and Caddyfile. `deploy.sh` extracts and installs them automatically, so
normal configuration changes deploy with the image. A changed `deploy.sh`,
`pull_agent.py` or `validate_compose.py` is staged as
`/opt/ocaml-omcb/<name>.next`; install it manually when prompted.

### 6. GHCR package visibility and authentication

The workflow pushes:

```
ghcr.io/ja927cam/ocaml-omcb:<full-git-sha>
ghcr.io/ja927cam/ocaml-omcb:latest
```

GitHub Container Registry packages are private by default, even for a public
repository. For the simplest VPS setup, make the package public:

1. Open GitHub -> your profile -> **Packages** -> `ocaml-omcb`.
2. **Package settings** -> link the package to `ja927cam/ocaml-omcb`.
3. **Danger Zone** -> **Change visibility** -> **Public**.

If you keep the package private, create a classic personal access token with
`read:packages` and store it only on the VPS:

```bash
sudo tee /etc/ocaml-omcb/ghcr.env >/dev/null <<'EOF'
GHCR_USERNAME=ja927cam
GHCR_TOKEN=ghp_replace_me
EOF
sudo chmod 0600 /etc/ocaml-omcb/ghcr.env
```

The systemd unit loads `/etc/ocaml-omcb/ghcr.env` as root. The pull agent uses it
to obtain a read-only registry token, and `deploy.sh` uses it for
`docker login ghcr.io`. The credential is never stored in GitHub or in the
repository.

## GitHub configuration

No VPS secrets are required. The workflow uses only the automatic
`GITHUB_TOKEN` with `packages: write` to publish the image. Only
`actions/checkout` is used as an external action.

The workflow runs on every push to `main` (not on `develop`) and can also be
started manually. It:

- runs the pull-agent and Compose-validator tests;
- validates the production Compose file and Caddyfile;
- builds the Docker `test` stage and runs `dune runtest`;
- builds the runtime image with `org.opencontainers.image.revision` set to the
  full Git SHA and `org.opencontainers.image.source` set to the repository;
- runs container/WAL and Caddy/WebSocket smoke tests;
- pushes the immutable `<full-sha>` tag;
- pushes `latest` **only** for a successful `push` to `refs/heads/main`.

A manual `workflow_dispatch` publishes only its immutable SHA tag; it never
moves `latest`. Before moving `latest`, the workflow confirms that the run's
SHA is still the current `main` head. A re-run of an older commit therefore
cannot move `latest` backwards after a newer successful build.

## Initial deployment

1. Complete DNS and VPS preparation.
2. Make the GHCR package public, or install the read-only credential.
3. Enable `ocaml-omcb-pull.timer`.
4. Push a commit to `main`. A manual workflow dispatch publishes only the
   immutable SHA tag and deliberately does not move `latest`, so it will not
   trigger the pull agent.
5. The workflow builds and publishes the image. The VPS timer checks GHCR
   within 5 minutes, sees the new `latest` digest, reads the commit SHA label
   and runs the deploy script.
6. To trigger the first check immediately:

   ```bash
   sudo systemctl start ocaml-omcb-pull.service
   journalctl -u ocaml-omcb-pull.service -f
   ```

7. Verify:

   ```bash
   curl -fsS https://chess.jamesashwood.com/healthz
   curl -fsS https://chess.jamesashwood.com/readyz
   ```

If no image exists yet, the agent logs a registry 404 and exits non-zero; the
timer retries. The running service is untouched.

## Normal automatic deployment

The timer runs 2 minutes after boot and then 5 minutes after each run
(`OnUnitInactiveSec=5min`). It does not call the GitHub API.

The agent:

1. Obtains an anonymous or read-only GHCR token.
2. Reads the `latest` manifest and its `Docker-Content-Digest`, verifying the
   digest against the response body.
3. Handles both Docker manifest lists and OCI image indexes, selecting the
   `linux/<host-arch>` manifest.
4. Compares the digest with `/var/lib/ocaml-omcb-pull/last-digest`.
5. If unchanged, exits without touching Docker.
6. If changed, reads the selected image's config blob, verifies its digest,
   and requires the exact `ghcr.io/ja927cam/ocaml-omcb` source and a valid
   `org.opencontainers.image.revision` full Git SHA.
7. Runs `/opt/ocaml-omcb/deploy.sh --tag <sha>` as root.

`deploy.sh` then:

- refuses to run if more than one app container is running;
- pulls the immutable SHA tag before touching the running service;
- extracts the production Compose file and Caddyfile from that image;
- validates the app data bind mount, no app host ports, one replica, Caddy
  ports 80/443, and no Docker socket mounts;
- installs validated config atomically;
- replaces only the app container with
  `docker compose up -d --no-deps app`;
- waits up to 60 seconds for `/readyz`;
- reloads Caddy so the recreated app container's DNS is re-resolved;
- records `current-tag`/`previous-tag` under `/opt/ocaml-omcb/state`;
- automatically returns to the previous tag if readiness fails.

It never runs `docker compose down`, never removes volumes, and never deletes
or recreates `/srv/chess/data`.

Registry/network failures are logged and leave `last-digest` unchanged, so the
next timer run simply retries. A failed deployment is recorded in
`/var/lib/ocaml-omcb-pull/failure.json`; the same digest is retried after a
30-minute backoff (configurable with `FAILURE_BACKOFF_SECONDS`). To force an
immediate retry of the same digest, remove that file and start the service:

```bash
sudo rm -f /var/lib/ocaml-omcb-pull/failure.json
sudo systemctl start ocaml-omcb-pull.service
```

## Rollback

Automatic rollback happens inside `deploy.sh` when the new image fails
readiness.

Manual rollback to the recorded previous tag:

```bash
sudo /opt/ocaml-omcb/deploy.sh --rollback
```

Rollback to a specific SHA:

```bash
sudo /opt/ocaml-omcb/deploy.sh --tag <full-40-character-sha>
```

Then verify:

```bash
curl -fsS https://chess.jamesashwood.com/readyz
```

A manual rollback sticks: the pull agent only deploys when the GHCR `latest`
digest changes. To return to the latest image after a manual rollback, wait
for the next main-branch release, or remove `/var/lib/ocaml-omcb-pull/last-digest`
and run `sudo systemctl start ocaml-omcb-pull.service` to redeploy the current
`latest`.

Images are not pruned by the deploy path, so previous SHAs usually remain
local. If one has been removed, `deploy.sh` pulls it from GHCR (public package
or `/etc/ocaml-omcb/ghcr.env` credentials).

## Backups and restore

Acknowledged moves are fsynced to the WAL before they are published; snapshots
are written atomically; `SIGTERM` drains the worker and waits for an in-flight
snapshot. A crash replays the WAL and ignores incomplete snapshots.

For a consistent backup, stop Caddy first and then the app:

```bash
cd /opt/ocaml-omcb
sudo docker compose -f docker-compose.prod.yml stop caddy app
```

Back up the data directory and Caddy state:

```bash
sudo install -d -m 0755 /var/backups/chess
sudo tar -C /srv/chess -czf \
  "/var/backups/chess/data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" data caddy
sudo docker compose -f docker-compose.prod.yml up -d
```

Keep backups outside the VPS. The snapshot is about 537 MiB for the standard
world; budget disk space accordingly.

Restore:

```bash
cd /opt/ocaml-omcb
sudo docker compose -f docker-compose.prod.yml stop caddy app

# Never delete the current data: move it aside first.
sudo mv /srv/chess/data "/srv/chess/data.pre-restore.$(date -u +%Y%m%dT%H%M%SZ)"
sudo tar -C /srv/chess -xzf /var/backups/chess/data-YYYYMMDDTHHMMSSZ.tar.gz
sudo chown -R 10001:10001 /srv/chess/data

sudo docker compose -f docker-compose.prod.yml up -d
curl -fsS https://chess.jamesashwood.com/readyz
```

If the restore fails, stop the app and move the `data.pre-restore.*` directory
back. Do not remove it.

## Logs and health

Pull agent:

```bash
systemctl status ocaml-omcb-pull.timer
systemctl list-timers ocaml-omcb-pull.timer
journalctl -u ocaml-omcb-pull.service -f
journalctl -u ocaml-omcb-pull.service --since "1 hour ago"
```

The agent logs the latest digest and revision, whether the image changed,
deployment success/failure, and backoff decisions. `deploy.sh` output is
captured in the same journal.

Manual check without deploying:

```bash
sudo /usr/bin/python3 /opt/ocaml-omcb/pull_agent.py --check-only
```

For a private package, run it through systemd so the credential environment is
loaded, or export `GHCR_USERNAME`/`GHCR_TOKEN` from `/etc/ocaml-omcb/ghcr.env`
first.

Application:

```bash
cd /opt/ocaml-omcb
sudo docker compose -f docker-compose.prod.yml ps
sudo docker compose -f docker-compose.prod.yml logs -f --tail=200 app
sudo docker compose -f docker-compose.prod.yml logs -f --tail=200 caddy

curl -fsS https://chess.jamesashwood.com/healthz
curl -fsS https://chess.jamesashwood.com/readyz

# Public monitoring endpoints.
curl -fsS https://chess.jamesashwood.com/metrics | python3 -m json.tool
curl -fsS https://chess.jamesashwood.com/metrics.prom

# Expensive diagnostics stay internal to the Docker network.
sudo docker compose -f docker-compose.prod.yml exec app \
  curl -fsS http://127.0.0.1:8080/state-hash

sudo docker inspect --format '{{.State.Health.Status}}' \
  "$(sudo docker compose -f docker-compose.prod.yml ps -q app)"
```

WebSockets use `/ws` and are proxied by Caddy's `reverse_proxy`; no special
Caddy directive is required. CI runs a real WebSocket move through a local
Caddy instance before publishing.

## Safe shutdown

Stop Caddy first so no new requests arrive, then drain the app:

```bash
cd /opt/ocaml-omcb
sudo docker compose -f docker-compose.prod.yml stop caddy app
```

The app receives `SIGTERM`, drains the worker, waits up to 30 seconds for an
in-flight snapshot, closes the WAL and exits 0. Compose allows 45 seconds.

Start again:

```bash
sudo docker compose -f docker-compose.prod.yml up -d
```

Avoid `docker compose down -v`; it removes volumes and is never needed here.
`docker compose down` does not delete the bind-mounted data, but the deploy
script uses `up`/`stop` only.

## Security summary

- The pull agent is a root-owned systemd oneshot with no dedicated login
  account, no inbound listener and no SSH access. It runs as root because it
  invokes the root-owned deploy script and Docker.
- GitHub Actions has no VPS credentials and never connects to the VPS.
- The agent itself only makes outbound HTTPS requests to GHCR; the deploy
  script pulls the pinned application and Caddy images.
- The application container runs as UID/GID 10001, drops all capabilities and
  enables `no-new-privileges`.
- The Docker socket is not mounted into any application container.
- Only Caddy publishes host ports 80 and 443. The app uses `expose: 8080`.
- `/opt/ocaml-omcb/.env`, `/etc/ocaml-omcb/pull-agent.env` and
  `/etc/ocaml-omcb/ghcr.env` are root-only.
- If the GHCR package is public, the VPS stores no registry credential. If it
  is private, use a read-only `read:packages` token in
  `/etc/ocaml-omcb/ghcr.env`.
- `deploy.sh` validates the image's resolved Compose config before applying
  it and refuses configs that publish the app, change the data bind mount,
  change the app image/port/interface, add services or capabilities, run the
  app as root, or mount the Docker socket.
- The pull agent verifies registry manifest/config digests, the exact image
  repository and source label, and the full commit SHA before invoking
  `deploy.sh`.

## Local Docker development

The root `Dockerfile` and `docker-compose.yml` are for local development. They
build from source and publish port 8080 directly:

```bash
docker compose up --build -d
# http://localhost:8080/
docker compose down
```

Production uses `deploy/docker-compose.prod.yml`, the immutable GHCR image and
Caddy. Do not use the development Compose file on the VPS.

## Alternative deployment: systemd + nginx

The server can also run directly under systemd behind nginx. This is an
alternative to the Docker production path, not a second service on the same
data directory.

```bash
scripts/pin-httpun-ws.sh
dune build --profile release
```

Install the binary at `/opt/ocaml-omcb/server.exe`, the static files under the
working directory expected by the server, and use `deploy/ocaml-omcb.service` plus
`deploy/nginx.conf.example`. Keep `OCAML_OMCB_DATA_DIR` on persistent local
storage and use only one process.

## Capacity and durability notes

- World RSS is roughly 520–550 MiB before persistence overhead.
- One reusable snapshot buffer adds about 512 MiB. Snapshot writes are about
  537 MiB; the buffer is retained so repeated snapshots do not inflate RSS.
  The final 30-minute soak held RSS around 1.2 GiB. Budget 1.5 GiB plus
  headroom; a 2 GiB service limit is a reasonable starting point.
- The single writer is usually limited by fsync and fan-out, not chess
  validation. Adaptive group commit is the default; fixed-64 is the fallback.
- Acknowledged moves are always past their group fsync. A crash can lose only
  unacknowledged work or live events; clients reconnect and resnapshot.
- Never run two app containers against the same data directory. The application
  is a single authoritative writer.

### Fixed/strict modes

```bash
# Fixed group commit, 64 moves per fsync
OCAML_OMCB_ADAPTIVE=0 OCAML_OMCB_WAL_GROUP=64

# Strict per-move fsync
OCAML_OMCB_ADAPTIVE=0 OCAML_OMCB_WAL_GROUP=1

# Development only: no fsync
OCAML_OMCB_WAL_SYNC=0
```

Set these in `/opt/ocaml-omcb/.env` and redeploy if required.
