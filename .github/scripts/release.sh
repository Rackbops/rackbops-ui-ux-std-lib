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
# failed tag push) or reporting "nothing to do" (a failed release create).
# Recovery is a fresh trigger — a new push, or workflow_dispatch — not
# GitHub Actions' "Re-run failed jobs", which re-checks-out the pre-bump
# commit and will fail to push non-fast-forward against the bump this
# script already made.

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

# ── Version & resume state ──────────────────────────────────────────────────
# All packages share one version; read it from the first file and verify the
# rest agree — always, since a mismatch is a real error regardless of which
# state below applies.

current_version=$(node -p "require('./${VERSION_FILES[0]}').version")

for f in "${VERSION_FILES[@]}"; do
  v=$(node -p "require('./$f').version")
  if [[ "$v" != "$current_version" ]]; then
    echo "ERROR: version mismatch — ${VERSION_FILES[0]} is ${current_version} but $f is ${v}" >&2
    exit 1
  fi
done

current_tag="v${current_version}"

# HEAD being our own bump commit for the version package.json already has is
# the one reliable signal that a previous run got at least as far as
# committing it — as opposed to package.json simply reflecting the last
# fully-completed release, which is the normal steady state.
skip_bump=false

if [[ "$(git log -1 --pretty=format:%s)" == "chore(release): ${current_tag}" ]]; then
  skip_bump=true
  if git rev-parse -q --verify "refs/tags/${current_tag}" >/dev/null; then
    if gh release view "$current_tag" >/dev/null 2>&1; then
      echo "Already released ${current_tag}. Nothing to do."
      exit 0
    fi
    echo "Resuming ${current_tag}: tag exists, no GitHub release yet."
  else
    echo "Resuming ${current_tag}: bump committed, not yet tagged."
  fi
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

if [[ -n "$last_tag" ]]; then
  commit_log=$(git log "${last_tag}..HEAD" --invert-grep --grep="$BUMP_GREP" --pretty=format:"%s" -- "${PATHSPEC[@]}" || true)
  commit_bodies=$(git log "${last_tag}..HEAD" --invert-grep --grep="$BUMP_GREP" --pretty=format:"%B" -- "${PATHSPEC[@]}" || true)
else
  commit_log=$(git log --invert-grep --grep="$BUMP_GREP" --pretty=format:"%s" -- "${PATHSPEC[@]}" || true)
  commit_bodies=$(git log --invert-grep --grep="$BUMP_GREP" --pretty=format:"%B" -- "${PATHSPEC[@]}" || true)
fi

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
  new_version=$(.github/scripts/next-version.sh "$current_version" <<< "$commit_bodies")

  for f in "${VERSION_FILES[@]}"; do
    sed -i "s|\"version\": \"${current_version}\"|\"version\": \"${new_version}\"|" "$f"
  done
  echo "Version: ${current_version} -> ${new_version}"
else
  new_version="$current_version"
fi

tag="v${new_version}"

# ── Build changelog ───────────────────────────────────────────────────────────

declare -A type_entries
for t in "${COMMIT_TYPES_ORDER[@]}"; do type_entries[$t]=""; done
other_entries=""

while IFS= read -r msg; do
  [[ -z "$msg" ]] && continue
  matched=false
  for t in "${COMMIT_TYPES_ORDER[@]}"; do
    # Matches: type(optional-scope)(optional !): description
    # The optional ! keeps breaking commits (feat!:, feat(scope)!:) under their
    # own type instead of dropping them into "Other Changes".
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

notes=""
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

notes_file=$(mktemp)
trap 'rm -f "$notes_file"' EXIT
printf '%s' "$notes" > "$notes_file"

# ── Commit, tag, and publish ──────────────────────────────────────────────────

if [[ "$skip_bump" == false ]]; then
  git add "${VERSION_FILES[@]}"
  git commit -m "chore(release): ${tag}"
  git push
fi

# Create the tag only if it doesn't already exist locally -- a resumed run
# can find one a prior run created before failing to push it, and re-running
# `git tag` on an existing name is an error. The push always runs regardless:
# it's a harmless no-op against a tag the remote already has, and is exactly
# what needs to (re-)happen against one it doesn't.
if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  git tag "$tag"
fi
git push origin "$tag"

gh release create "$tag" \
  --title "$tag" \
  --notes-file "$notes_file"

echo "Released ${tag}."
