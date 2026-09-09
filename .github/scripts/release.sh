#!/usr/bin/env bash
# .github/scripts/release.sh
#
# Cut a release when publishable code changed since the last v* tag:
#   1. Detect commits since the last release tag that touch what each
#      package actually ships (see release-lib.sh's PATHSPEC) — site,
#      skills, CI, and non-shipped test/config changes don't warrant a
#      package release.
#   2. Bump the version in both package.json files (kept in lockstep).
#   3. Commit the bump and tag vX.Y.Z, pushed together in one atomic push.
#      The tag push triggers publish.yml, which publishes both packages and
#      creates the GitHub release (release-notes.sh / publish-release.sh).
#
# One atomic push (issue #88): `git push --atomic origin main "$tag"` either
# lands the bump commit AND the tag together, or lands neither -- there is no
# partial state to resume from, so this script has no retry/backfill logic
# and never calls `gh`. A rejected push (a race with another push, a branch
# protection rule) leaves main and the local tag exactly as they were before
# this run; a plain re-run (or the next push) recomputes everything from
# scratch and tries again. Nothing here is unsafe to run twice in a row: an
# already-released version has no unreleased commits left to find, and exits
# at the empty-commit-log check below before touching anything.

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/release-lib.sh"

# Files that carry the release version, bumped in lockstep.
VERSION_FILES=(styles/package.json components/react/package.json)

# ── Version ────────────────────────────────────────────────────────────────
# All packages share one version; read it from the first file and verify the
# rest agree.

current_version=$(node -p "require('./${VERSION_FILES[0]}').version")

for f in "${VERSION_FILES[@]}"; do
  v=$(node -p "require('./$f').version")
  if [[ "$v" != "$current_version" ]]; then
    echo "ERROR: version mismatch -- ${VERSION_FILES[0]} is ${current_version} but $f is ${v}" >&2
    exit 1
  fi
done

# ── Detect unreleased changes ─────────────────────────────────────────────────

latest_tag=$(list_release_tags | tail -1 || true)

range="HEAD"
[[ -n "$latest_tag" ]] && range="${latest_tag}..HEAD"
commit_log=$(git log "$range" --pretty=format:"%s" -- "${PATHSPEC[@]}" | grep -v "$BUMP_GREP" || true)

if [[ -z "$commit_log" ]]; then
  echo "No unreleased package changes since ${latest_tag:-the beginning}. Nothing to do."
  exit 0
fi

# ── Bump version ──────────────────────────────────────────────────────────────
# The bump level comes from the unreleased commit messages (next-version.sh):
# a breaking marker bumps the minor while major is 0; anything else bumps the
# patch. Full bodies (not just subjects) so next-version.sh sees BREAKING
# CHANGE: footers. No bump-commit filtering here, unlike the changelog/
# unreleased checks above: this script creates its own bump commits as a
# single `git commit -m "chore(release): vX"` (below) with no "!" subject and
# no footer, so re-including one can never change the computed level --
# whereas a `git log --grep` filter would risk dropping a real commit's
# breaking marker by matching its body (issue #87).
commit_bodies=$(git log "$range" --pretty=format:"%B" -- "${PATHSPEC[@]}" || true)
new_version=$("$(dirname "${BASH_SOURCE[0]}")/next-version.sh" "$current_version" <<< "$commit_bodies")

for f in "${VERSION_FILES[@]}"; do
  sed -i "s|\"version\": \"${current_version}\"|\"version\": \"${new_version}\"|" "$f"
done
echo "Version: ${current_version} -> ${new_version}"

tag="v${new_version}"

# ── Commit, tag, and push atomically ──────────────────────────────────────────
# Both refs land together or neither does -- see the header. A rejected push
# (main moved, or the tag already exists on origin) fails this run outright;
# nothing here needs to distinguish which ref was rejected, since either way
# the fix is the same: re-run from a fresh checkout.

git add "${VERSION_FILES[@]}"
git commit -m "chore(release): ${tag}"
git tag "$tag"
git push --atomic origin main "$tag"

echo "Released ${tag} -- publish.yml creates the GitHub release and publishes."
