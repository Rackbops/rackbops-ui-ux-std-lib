#!/usr/bin/env bash
# .github/scripts/release.sh
#
# Cut a release when publishable code changed since the last v* tag:
#   1. Detect commits since the last release tag that touch what each
#      package actually ships (see PATHSPEC below) — site, skills, CI, and
#      non-shipped test/config changes don't warrant a package release.
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

# Only commits touching what each package actually ships trigger a release
# and appear in the changelog (issue #34):
#  - styles/ ships whole theme directories -- design.md included -- plus its
#    root manifest files (styles/package.json's "files"); styles/test/ isn't
#    shipped.
#  - components/react ships `dist`, built by `tsc -p tsconfig.build.json`
#    (which extends tsconfig.json). `dist` itself is gitignored and can't be a
#    git pathspec, so its build inputs stand in for it: `src/` (tsconfig.json's
#    rootDir), plus package.json (the published manifest -- its
#    "exports"/"peerDependencies" are shipped-relevant), plus BOTH tsconfig
#    files. The tsconfigs govern every emitted byte and which files are emitted
#    -- compilerOptions (target/module/jsx/declaration) and the exclude list --
#    so a build-config change alone changes what ships and must trigger a
#    release (issue #87; e.g. flipping target to ES2017 rewrites most of dist).
#    Test files under src/ (tsconfig.build.json's excludes) aren't shipped and
#    are excluded below; the tsconfig FILE listing them still is, since editing
#    that list changes the output.
#  - scripts/copy-license.mjs, and the root LICENSE/NOTICE it copies, are
#    shipped-relevant even though they live outside both package directories:
#    copy-license.mjs is the prepack step that puts LICENSE/NOTICE into each
#    tarball (issue #38), and both package "files" allowlists include them, so
#    a change to any of the three alters what is published and must trigger a
#    release -- same gap as issue #34 (a package's "files" reach stops at its
#    own directory), now closed for this script (issue #87 for LICENSE/NOTICE).
PATHSPEC=(
  styles/
  ":(exclude)styles/test/"
  components/react/src/
  components/react/package.json
  components/react/tsconfig.json
  components/react/tsconfig.build.json
  ":(exclude,glob)components/react/src/**/*.test.ts"
  ":(exclude,glob)components/react/src/**/*.test.tsx"
  ":(exclude)components/react/src/test-dom.ts"
  scripts/copy-license.mjs
  LICENSE
  NOTICE
)

# Matches this script's own bump commit SUBJECT ("chore(release): vX.Y.Z"),
# excluded from the unreleased-change check and the changelog so a resumed run
# doesn't mistake its own past bump for new work. Applied with `grep` over a
# --pretty=%s stream (subjects only), NOT `git log --grep`, which matches the
# WHOLE message: a genuine commit that merely quotes "chore(release): vX" in
# its body would otherwise be dropped -- skipping its release, mis-scoping the
# changelog, or hiding a breaking marker (issue #87). "(" and ")" need no
# escaping: grep's basic regex treats them as literal.
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
  commit_log=$(git log "$range" --pretty=format:"%s" -- "${PATHSPEC[@]}" | grep -v "$BUMP_GREP" || true)

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

# $notes_file is script-scoped, not local to publish_release() below: the
# EXIT trap needs to see whichever file is currently in flight, since a run
# can call publish_release() twice (once to backfill, once for a new
# release) and `gh release create` failing is the exact failure mode this
# script exists to survive -- set -e means that failure skips any cleanup
# written to run *after* the call, so only a trap (which fires regardless
# of how the script exits) actually guarantees the file doesn't leak.
notes_file=""
trap 'rm -f "$notes_file"' EXIT

# Writes $1 (changelog text) to a fresh temp file and creates the GitHub
# release named $2 from it, then clears $notes_file back out on success so
# the EXIT trap has nothing left to do for this call by the time the next
# one (if any) starts.
publish_release() {
  local notes="$1" tag="$2"
  notes_file=$(mktemp)
  printf '%s' "$notes" > "$notes_file"
  gh release create "$tag" --title "$tag" --notes-file "$notes_file"
  rm -f "$notes_file"
  notes_file=""
}

# Lists this repo's release tags (strict vX.Y.Z only), version-sorted
# ascending. `git tag -l "v*"` alone also matches pre-release tags
# (v0.2.0-rc1) and unrelated v-prefixed tags (vendor-snapshot, v2-experiment),
# any of which `sort -V` can rank ABOVE a real release -- basing a release on
# one skips or mis-scopes the next real one (issue #87). The anchored grep is
# load-bearing: the glob "v[0-9]*.[0-9]*.[0-9]*" is not enough on its own, its
# trailing wildcard still admits v0.2.0-rc1. The `|| true` keeps an empty tag
# set (grep matching nothing) from failing the pipe under `set -o pipefail`.
list_release_tags() {
  git tag -l 'v[0-9]*' | { grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' || true; } | sort -V
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
latest_tag=$(list_release_tags | tail -1 || true)

if [[ -n "$latest_tag" ]]; then
  # gh exits 1 for ANY failure, so a bare `! gh release view` reads a transient
  # 5xx / rate-limit / auth blip as "no release exists": it then backfills,
  # `gh release create` hits the already-existing release with a 422, and
  # set -e aborts the run before the genuinely new version is ever bumped --
  # blaming the wrong step (issue #87). Distinguish a real 404 ("release not
  # found" on stderr, exactly what gh prints) from every other failure, which
  # is fatal here rather than silently treated as a missing release.
  if release_view_err=$(gh release view "$latest_tag" 2>&1 >/dev/null); then
    : # the release already exists -- nothing to backfill
  elif [[ "$release_view_err" == *"release not found"* ]]; then
    echo "Tag ${latest_tag} has no GitHub release yet — backfilling it first."
    # A harmless no-op if the tag already reached origin (the expected case on
    # a fresh checkout, since a tag can only exist locally if it was fetched
    # from there); otherwise exactly what still needs to happen for it.
    git push origin "$latest_tag"
    prior_tag=$(list_release_tags | grep -Fxv "$latest_tag" | tail -1 || true)
    backfill_range="$latest_tag"
    [[ -n "$prior_tag" ]] && backfill_range="${prior_tag}..${latest_tag}"
    publish_release "$(build_changelog "$backfill_range")" "$latest_tag"
  else
    echo "ERROR: gh release view ${latest_tag} failed, and not with 'release not found' — refusing to assume the release is missing: ${release_view_err}" >&2
    exit 1
  fi
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
  last_tag=$(list_release_tags | grep -Fxv "$current_tag" | tail -1 || true)
else
  last_tag=$(list_release_tags | tail -1 || true)
fi

# ── Detect unreleased changes ─────────────────────────────────────────────────

range="HEAD"
[[ -n "$last_tag" ]] && range="${last_tag}..HEAD"
commit_log=$(git log "$range" --pretty=format:"%s" -- "${PATHSPEC[@]}" | grep -v "$BUMP_GREP" || true)

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
  # Full bodies (not just subjects) so next-version.sh sees BREAKING CHANGE:
  # footers. No bump-commit filtering here, unlike the changelog/unreleased
  # checks above: this script creates its own bump commits as a single
  # `git commit -m "chore(release): vX"` (below) with no "!" subject and no
  # footer, so re-including one can never change the computed level -- whereas
  # a `git log --grep` filter would risk dropping a real commit's breaking
  # marker by matching its body (issue #87).
  commit_bodies=$(git log "$range" --pretty=format:"%B" -- "${PATHSPEC[@]}" || true)
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
