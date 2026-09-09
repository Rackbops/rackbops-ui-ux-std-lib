#!/usr/bin/env bash
# .github/scripts/release-notes.sh <tag>
#
# Prints <tag>'s changelog to stdout: the PATHSPEC-scoped, bump-commit-
# excluded commit subjects between the release tag just below <tag>
# (version-sorted) and <tag> itself -- or everything up to <tag> if there is
# no earlier release tag. Pure output, no side effects (no git writes, no
# `gh` calls) -- publish-release.sh uses this as the GitHub release body, and
# it's safe to run by hand to preview a release's notes before it's cut.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/release-lib.sh"

tag="${1:?usage: release-notes.sh <tag>}"

# Walk the version-sorted tag list looking for $tag; whatever immediately
# precedes it is the prior release. $tag itself must already exist as a real
# tag for this to find it (true by the time publish.yml runs this, since it
# triggers on the tag push) -- if it's absent from the list (not yet pushed,
# or not a real vX.Y.Z tag), prior_tag stays empty and the range below falls
# back to "$tag alone", same as when there's genuinely no earlier release.
prior_tag=""
prev=""
while IFS= read -r t; do
  [[ "$t" == "$tag" ]] && { prior_tag="$prev"; break; }
  prev="$t"
done < <(list_release_tags)

range="$tag"
[[ -n "$prior_tag" ]] && range="${prior_tag}..${tag}"

commit_log=$(git log "$range" --pretty=format:"%s" -- "${PATHSPEC[@]}" | grep -v "$BUMP_GREP" || true)
build_changelog_from_log "$commit_log"
