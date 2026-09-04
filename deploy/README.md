# Hosting the showcase: `styles.rackbops.com`

The `site/` gallery (theme switcher over the twelve themes) is also reachable at a gated hosted
URL, in addition to the local `pnpm showcase` dev server (`site/serve.mjs` -- unrelated, untouched
by this).

## Shape

- **Origin**: `nginx:alpine` (`compose.yaml`'s `web` service), repo root mounted read-only as the
  web root -- `site/index.html` imports `../styles/all.css`, a sibling of `site/`, so nginx must
  serve the whole repo root for that import to resolve. `nginx.conf` denies `.git/`, this repo's own
  `compose.yaml`/`nginx.conf`, and `deploy/` despite the repo-root mount, and redirects a bare `/`
  to `/site/` (there is no root `index.html`).
- **No published host port.** Unlike the generic loopback-bound-port pattern, `web` publishes
  nothing at all -- it's reachable only in-network by the `cloudflared` sidecar in the same compose
  project.
- **Gate**: a **per-app, remotely-managed Cloudflare Tunnel** (token-based, entirely API-managed),
  running as the `cloudflared` sidecar in this same compose project -- *not* nucbox's shared,
  locally-managed tunnel that fronts `rackbops.com`/`dockge.rackbops.com`/etc. That shared tunnel's
  ingress lives in a hand-edited file on the box; a new app-specific endpoint uses its own tunnel
  instead so nothing there is ever touched. Access policy reuses the same allow-listed-emails policy
  every other Rackbops internal tool uses.
- **Deploy**: pull model. The box holds a clone of this repo AS its Dockge stack dir
  (`/opt/stacks/rackbops-ui-ux-std-lib`), and `deploy/rackbops-ui-ux-std-lib-deploy.timer` polls
  GitHub every 5 minutes via `deploy/deploy-pull.sh`. Public repo, so a plain HTTPS clone -- no
  deploy key needed.

Sources this was adapted from:
- `Rackbops/rackbops-web-deploy-template` `servers/nginx-static/*.example` -- the repo-root
  web-root knob and the pull-model deploy trio.
- `Rackbops/Tooling`'s `docs/per-app-cloudflare-access-tunnel.md` -- the per-app token-sidecar
  pattern (why a new tunnel instead of the shared one, the Cloudflare API call shapes).

## Updating

- **Site content** (anything under `site/`, `components/`, `styles/`) -- reaches the box on the next
  pull, live immediately, no restart (nginx re-reads files per request).
- **`nginx.conf`** -- needs `docker compose restart rackbops-ui-ux-std-lib-web` on the box after it
  pulls; `deploy-pull.sh` flags this in its log. A plain `nginx -s reload` does **not** pick up a
  git-pulled change (the checkout replaces the file via a new inode; Docker's single-file bind mount
  keeps watching the old one).
- **`compose.yaml`** -- needs `docker compose up -d` on the box after it pulls; also flagged in the
  deploy log.
- **`deploy/*.service` / `*.timer`** -- needs re-copying to `/etc/systemd/system/` +
  `sudo systemctl daemon-reload` on the box; also flagged in the deploy log.

## Bringing up a fresh box (reference; already done for nucbox)

1. Clone this repo to `/opt/stacks/rackbops-ui-ux-std-lib` as the user the systemd units will run
   as (avoids a `git pull` "dubious ownership" refusal later).
2. Create a Cloudflare Tunnel (`config_src: cloudflare`), an Access app for the target hostname
   reusing an existing allow policy, the tunnel's ingress rule (`service: http://web:80`, its own
   `originRequest.access` block, trailing 404 catch-all), and a proxied DNS CNAME to
   `<tunnel-id>.cfargotunnel.com` -- in that order (Access app before DNS). See
   `Tooling/docs/per-app-cloudflare-access-tunnel.md` for the exact API bodies.
3. Copy the tunnel token into `.env` in the stack dir (see `.env.example`) -- never commit it.
4. `docker compose up -d` in the stack dir.
5. Install the timer: copy `deploy/rackbops-ui-ux-std-lib-deploy.service` and `.timer` to
   `/etc/systemd/system/`, `daemon-reload`, `enable --now`.
6. Verify: an unauthenticated `curl` to the hostname returns `302`; a logged-in allow-listed browser
   reaches the showcase.
