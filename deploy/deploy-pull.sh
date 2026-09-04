#!/usr/bin/env bash
# rackbops-ui-ux-std-lib auto-deploy -- pull the latest showcase from GitHub onto nucbox.
#
# Runs as a systemd system timer (see the paired .service/.timer in this directory). The box holds
# a clone of this repo AS its Dockge stack dir (/opt/stacks/rackbops-ui-ux-std-lib) -- a pull ships
# whatever's committed: site content, but also compose.yaml, nginx.conf, and this directory's own
# units, each of which needs a DIFFERENT action on the box. This script diffs the pull and logs the
# action needed as a reminder rather than doing it unattended, keeping the timer privilege-light
# (no docker, no sudo).
#
# Adapted from https://github.com/Rackbops/rackbops-web-deploy-template's
# servers/nginx-static/publish/deploy-pull.sh.example -- see that file's header and the linked
# README sections for the reasoning behind each guard below; not restated here.
#
# The whole body is wrapped in main() so bash parses it before running: a pull that updates this
# very file mid-run can't trip over a half-read script.
set -euo pipefail

REPO_DIR="/opt/stacks/rackbops-ui-ux-std-lib"

main() {
  cd "$REPO_DIR" || exit 1

  local before after
  before="$(git rev-parse HEAD)"

  if ! git pull --ff-only --quiet; then
    local lock status_out ahead
    lock="$(git rev-parse --absolute-git-dir)/index.lock"
    status_out="$(git status --porcelain 2>/dev/null || true)"
    ahead="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
    if [[ -e "$lock" || -n "$status_out" || "$ahead" != 0 ]]; then
      echo "rackbops-ui-ux-std-lib: pull failed. Git's reason is above; this clone's own local"
      echo "rackbops-ui-ux-std-lib:   state, which may or may not be why:"
      if [[ -e "$lock" ]]; then
        echo "rackbops-ui-ux-std-lib:   * stale lock from a killed run. If no git is running here:  rm $lock"
      fi
      if [[ -n "$status_out" ]]; then
        echo "rackbops-ui-ux-std-lib:   * local changes (M/D = tracked, ?? = untracked -- either can block a pull):"
        sed -n "1,10{s|^|rackbops-ui-ux-std-lib:       |;p;}" <<< "$status_out"
        local n_more
        n_more=$(( $(wc -l <<< "$status_out") - 10 ))
        (( n_more > 0 )) && echo "rackbops-ui-ux-std-lib:       ... and $n_more more"
      fi
      if (( ahead > 0 )); then
        echo "rackbops-ui-ux-std-lib:   * $ahead commit(s) here that upstream lacks -- never commit on the box."
      fi
      echo "rackbops-ui-ux-std-lib:   To force this clone to exactly match upstream:"
      echo "rackbops-ui-ux-std-lib:     git -C $REPO_DIR reset --hard @{u}"
      echo "rackbops-ui-ux-std-lib:   DESTROYS tracked edits and box-side commits, and overwrites an"
      echo "rackbops-ui-ux-std-lib:   untracked file sitting at a path upstream wants to create."
    fi
    return 1
  fi

  after="$(git rev-parse HEAD)"

  local worktree_drift
  worktree_drift="$(git status --porcelain -uno || true)"
  if [[ -n "$worktree_drift" ]]; then
    echo "rackbops-ui-ux-std-lib: NOTE -- these tracked files do not match HEAD, so the web root is"
    echo "rackbops-ui-ux-std-lib:   serving them in that state:"
    sed -n "1,10{s|^|rackbops-ui-ux-std-lib:       |;p;}" <<< "$worktree_drift"
    local n_more_ok
    n_more_ok=$(( $(wc -l <<< "$worktree_drift") - 10 ))
    (( n_more_ok > 0 )) && echo "rackbops-ui-ux-std-lib:       ... and $n_more_ok more"
    echo "rackbops-ui-ux-std-lib:   To make the tree match upstream exactly (DESTROYS local edits):"
    echo "rackbops-ui-ux-std-lib:     git -C $REPO_DIR reset --hard @{u}"
  fi

  if [[ "$before" == "$after" ]]; then
    echo "rackbops-ui-ux-std-lib: up to date at ${after:0:7}, nothing to do."
    return 0
  fi

  echo "rackbops-ui-ux-std-lib: updated ${before:0:7} -> ${after:0:7}."

  # === POST-ARRIVAL (per-server) ===
  local changed_files needs_up=0 needs_restart=0 needs_reload_units=0 content_only=1
  changed_files="$(git diff --no-renames --name-only "$before" "$after")"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    case "$f" in
      compose.yaml)
        needs_up=1
        content_only=0
        ;;
      nginx.conf)
        needs_restart=1
        content_only=0
        ;;
      deploy/*.service|deploy/*.timer)
        needs_reload_units=1
        content_only=0
        ;;
    esac
  done <<< "$changed_files"

  (( needs_up )) && echo "rackbops-ui-ux-std-lib: compose.yaml changed -- run 'docker compose up -d' in $REPO_DIR to apply it."
  (( needs_restart )) && echo "rackbops-ui-ux-std-lib: nginx.conf changed -- run 'docker compose restart rackbops-ui-ux-std-lib-web' in $REPO_DIR to apply it (a reload will NOT pick this up after a pull)."
  (( needs_reload_units )) && echo "rackbops-ui-ux-std-lib: a deploy/*.service or *.timer unit changed -- re-copy it to /etc/systemd/system/ and run 'sudo systemctl daemon-reload' to apply it."
  (( content_only )) && echo "rackbops-ui-ux-std-lib: site content updated; no restart needed (nginx serves the mounted files)."

  return 0
}

main
