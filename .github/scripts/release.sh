#!/usr/bin/env bash
# .github/scripts/release.sh
#
# Cut a release when publishable code changed since the last v* tag:
#   1. Detect commits since the last release tag that touch styles/ or
#      components/ (excluding docs) — site, skills, and CI changes don't
#      warrant a package release.
#   2. Bump the version in both package.json files (kept in lockstep).
#   3. Generate a changelog grouped by conventional-commit type.
#   4. Commit the bump, tag vX.Y.Z, and create the GitHub release.
#      The tag push triggers publish.yml, which publishes both packages.
#
# Rerun-safe (issue #32): a rerun after a partial failure resumes from
# wherever the previous run actually stopped, rather than re-bumping (a
# failed tag push) or reporting "nothing to do" (a failed release create) —
# including when a genuinely new commit lands before the retry, which moves
# HEAD past the stuck release entirely (a plain "is HEAD our own bump
# commit" check alone can't see that; see "Backfill" below). Recovery is a
# fresh trigger — a new push, or workflow_dispatch — not GitHub Actions'
# "Re-run failed jobs", which re-checks-out the pre-bump commit and will
# fail to push non-fast-forward against the bump this script already made.

set -euo pipefail

# Files that carry the release version, bumped in lockstep.
VERSION_FILES=(styles/package.json components/react/package.json)

# Only commits touching these paths (minus markdown docs) trigger a release
# and appear in the changelog.
PATHSPEC=(styles/ components/ ":(exclude,glob)styles/**/*.md" ":(exclude,glob)components/**/*.md")

# Matches this script's own bump commit subject ("chore(release): vX.Y.Z"),
# excluded from both the unreleased-change check and the changelog so a
# resumed run doesn't mistake its own past bump for new work. Not a regex
# special char here: git log --grep uses basic regex by default, where "("
# and ")" are already literal.
BUMP_GREP='^chore(release): v'

# ── Commit-type display config ────────────────────────────────────────────────

# Ordered list controls section order in the changelog.
COMMIT_TYPES_ORDER=(feat fix perf refactor chore docs style test build ci)

declare -A COMMIT_TYPE_NAMES=(
  [feat]="Features"
  [fix]="Bug Fixes"
  [perf]="Performance"
  [refactor]="Refactoring"
  [chore]="Maintenance"
  [docs]="Documentation"
  [style]="Style"
  [test]="Tests"
  [build]="Build"
  [ci]="CI"
)

# Prints a changelog for the commits in $1 (a git log revision expression,
# e.g. "v0.1.0..v0.1.1" or just "v0.1.1" for "everything up to it"), scoped
# to PATHSPEC and excluding this script's own bump commits. Shared by both
# the backfill path below and the normal release path, since either may
# need to build notes for a range that isn't ..HEAD.
build_changelog() {
  local range="$1"
  local commit_log
  commit_log=$(git log "$range" --invert-grep --grep="$BUMP_GREP" --pretty=format:"%s" -- "${PATHSPEC[@]}" || true)

  local -A type_entries
  local t
  for t in "${COMMIT_TYPES_ORDER[@]}"; do type_entries[$t]=""; done
  local other_entries=""
  local msg matched pattern

  while IFS= read -r msg; do
    [[ -z "$msg" ]] && continue
    matched=false
    for t in "${COMMIT_TYPES_ORDER[@]}"; do
      # Matches: type(optional-scope)(optional !): description
      # The optional ! keeps breaking commits (feat!:, feat(scope)!:) under
      # their own type instead of dropping them into "Other Changes".
      pattern="^${t}(\([^)]*\))?!?:[[:space:]]+(.+)$"
      if [[ "$msg" =~ $pattern ]]; then
        type_entries[$t]+="- ${BASH_REMATCH[2]}"$'\n'
        matched=true
        break
      fi
    done
    if [[ "$matched" == false ]]; then
      other_entries+="- ${msg}"$'\n'
    fi
  done <<< "$commit_log"

  local notes=""
  for t in "${COMMIT_TYPES_ORDER[@]}"; do
    if [[ -n "${type_entries[$t]}" ]]; then
      notes+="### ${COMMIT_TYPE_NAMES[$t]}"$'\n'
      notes+="${type_entries[$t]}"$'\n'
    fi
  done
  if [[ -n "$other_entries" ]]; then
    notes+="### Other Changes"$'\n'
    notes+="${other_entries}"$'\n'
  fi
  printf '%s' "$notes"
}

# Writes $1 (changelog text) to a fresh temp file and creates the GitHub
# release named $2 from it. The temp file is removed immediately after —
# not deferred to a script-wide trap, since this can run twice in one
# invocation (once to backfill, once for a new release) and each call's
# file is done with as soon as `gh release create` returns.
publish_release() {
  local notes="$1" tag="$2" notes_file
  notes_file=$(mktemp)
  printf '%s' "$notes" > "$notes_file"
  gh release create "$tag" --title "$tag" --notes-file "$notes_file"
  rm -f "$notes_file"
}

# ── Version ────────────────────────────────────────────────────────────────
# All packages share one version; read it from the first file and verify the
# rest agree.

current_version=$(node -p "require('./${VERSION_FILES[0]}').version")

for f in "${VERSION_FILES[@]}"; do
  v=$(node -p "require('./$f').version")
  if [[ "$v" != "$current_version" ]]; then
    echo "ERROR: version mismatch — ${VERSION_FILES[0]} is ${current_version} but $f is ${v}" >&2
    exit 1
  fi
done

current_tag="v${current_version}"

# ── Backfill: the most recent tag, if any, missing a GitHub release ────────
# Checked independently of HEAD's own commit, and before anything else: a
# `gh release create` failure followed by a genuinely new commit (rather
# than an immediate retry) moves HEAD past the stuck release entirely —
# "is HEAD our own bump commit" can no longer see it, since HEAD isn't that
# commit anymore. Left unfixed, the run scoped to the new HEAD would just
# treat that already-tagged version as its own new base and move on,
# stranding the missing release for good. This only ever fires for the tag
# right before whatever this run goes on to do below, since a release is
# always created (or backfilled) before the next bump ever happens.
latest_tag=$(git tag -l "v*" | sort -V | tail -1 || true)

if [[ -n "$latest_tag" ]] && ! gh release view "$latest_tag" >/dev/null 2>&1; then
  echo "Tag ${latest_tag} has no GitHub release yet — backfilling it first."
  # A harmless no-op if the tag already reached origin (the expected case on
  # a fresh checkout, since a tag can only exist locally if it was fetched
  # from there); otherwise exactly what still needs to happen for it.
  git push origin "$latest_tag"
  prior_tag=$(git tag -l "v*" | grep -Fxv "$latest_tag" | sort -V | tail -1 || true)
  backfill_range="$latest_tag"
  [[ -n "$prior_tag" ]] && backfill_range="${prior_tag}..${latest_tag}"
  publish_release "$(build_changelog "$backfill_range")" "$latest_tag"
fi

# ── Resume state ───────────────────────────────────────────────────────────
# HEAD being our own bump commit for the version package.json already has,
# with no tag for it yet, is the one remaining case backfill (above) can't
# already cover: a failed tag push, retried before any further commit lands.

skip_bump=false

if [[ "$(git log -1 --pretty=format:%s)" == "chore(release): ${current_tag}" ]] &&
   ! git rev-parse -q --verify "refs/tags/${current_tag}" >/dev/null; then
  echo "Resuming ${current_tag}: bump committed, not yet tagged."
  skip_bump=true
fi

# The base to diff commits against, for both the unreleased-change check and
# the changelog. Never current_tag itself: in a resumed run that tag may
# already exist, and the base must stay the release BEFORE this one — the
# same base the original, now-resumed run computed.
if [[ "$skip_bump" == true ]]; then
  last_tag=$(git tag -l "v*" | grep -Fxv "$current_tag" | sort -V | tail -1 || true)
else
  last_tag=$(git tag -l "v*" | sort -V | tail -1 || true)
fi

# ── Detect unreleased changes ─────────────────────────────────────────────────

range="HEAD"
[[ -n "$last_tag" ]] && range="${last_tag}..HEAD"
commit_log=$(git log "$range" --invert-grep --grep="$BUMP_GREP" --pretty=format:"%s" -- "${PATHSPEC[@]}" || true)

if [[ -z "$commit_log" ]] && [[ "$skip_bump" == false ]]; then
  echo "No unreleased package changes since ${last_tag:-the beginning}. Nothing to do."
  exit 0
fi

# ── Bump version ──────────────────────────────────────────────────────────────
# The bump level comes from the unreleased commit messages (next-version.sh):
# a breaking marker bumps the minor while major is 0; anything else bumps the
# patch. Skipped entirely when resuming — the version was already decided (and
# already committed) by the run this one is resuming.

if [[ "$skip_bump" == false ]]; then
  commit_bodies=$(git log "$range" --invert-grep --grep="$BUMP_GREP" --pretty=format:"%B" -- "${PATHSPEC[@]}" || true)
  new_version=$(.github/scripts/next-version.sh "$current_version" <<< "$commit_bodies")

  for f in "${VERSION_FILES[@]}"; do
    sed -i "s|\"version\": \"${current_version}\"|\"version\": \"${new_version}\"|" "$f"
  done
  echo "Version: ${current_version} -> ${new_version}"
else
  new_version="$current_version"
fi

tag="v${new_version}"

# ── Commit, tag, and publish ──────────────────────────────────────────────────

if [[ "$skip_bump" == false ]]; then
  git add "${VERSION_FILES[@]}"
  git commit -m "chore(release): ${tag}"
  git push
fi

# Create the tag only if it doesn't already exist locally — a resumed run
# can find one a prior run created before failing to push it, and re-running
# `git tag` on an existing name is an error. The push always runs regardless:
# it's a harmless no-op against a tag the remote already has, and is exactly
# what needs to (re-)happen against one it doesn't.
if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  git tag "$tag"
fi
git push origin "$tag"

publish_release "$(build_changelog "$range")" "$tag"

echo "Released ${tag}."
