#!/usr/bin/env bash
# .github/scripts/publish-release.sh <tag>
#
# Idempotent: creates the GitHub release for <tag> from release-notes.sh's
# output if it doesn't already exist. Run from publish.yml, LAST, after the
# npm publish step -- so a failed npm publish withholds the release, and
# re-running the job completes both (this step is a no-op if the release
# already exists; npm's own already-published skip loop is already
# idempotent too).
set -euo pipefail
source "$(dirname "$0")/release-lib.sh"

tag="${1:?usage: publish-release.sh <tag>}"

# gh exits 1 for ANY failure, so a bare `! gh release view` reads a
# transient 5xx / rate-limit / auth blip as "no release exists": it would
# then try to create one, `gh release create` would hit the already-existing
# release with a 422, and the run fails blaming the wrong step (issue #87).
# Distinguish a real 404 ("release not found" on stderr, exactly what gh
# prints) from every other failure, which is fatal here rather than
# silently treated as a missing release.
if release_view_err=$(gh release view "$tag" 2>&1 >/dev/null); then
  echo "Release ${tag} already exists."
  exit 0
elif [[ "$release_view_err" != *"release not found"* ]]; then
  echo "ERROR: gh release view ${tag} failed, and not with 'release not found' -- refusing to assume the release is missing: ${release_view_err}" >&2
  exit 1
fi

notes_file=$(mktemp)
trap 'rm -f "$notes_file"' EXIT
"$(dirname "$0")/release-notes.sh" "$tag" > "$notes_file"
gh release create "$tag" --title "$tag" --notes-file "$notes_file"
echo "Created release ${tag}."
