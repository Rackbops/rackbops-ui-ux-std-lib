#!/usr/bin/env bash
# .github/scripts/release-lib.sh
#
# Shared release/publish machinery -- sourced (never executed) by release.sh,
# release-notes.sh, and publish-release.sh, so the three scripts can't drift
# on what counts as a shipped change or how a changelog is grouped. Callers
# already run under `set -euo pipefail` themselves before sourcing this, so
# it doesn't set that again.

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
#  - scripts/bundle-css.mjs is the other prepack step (issue #52): it flattens
#    each theme's index.css into the shipped <theme>/bundle.css + all.bundle.css,
#    so editing it rewrites every published bundle and must trigger a release,
#    the same way copy-license.mjs does. The generated bundles are gitignored and
#    never appear in the log, so the generator stands in for them here.
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
  scripts/bundle-css.mjs
  LICENSE
  NOTICE
)

# Matches this script's own bump commit SUBJECT ("chore(release): vX.Y.Z"),
# excluded from the unreleased-change check and the changelog so release.sh's
# own prior bump is never mistaken for new work. Applied with `grep` over a
# --pretty=%s stream (subjects only), NOT `git log --grep`, which matches the
# WHOLE message: a genuine commit that merely quotes "chore(release): vX" in
# its body would otherwise be dropped -- skipping its release, mis-scoping the
# changelog, or hiding a breaking marker (issue #87). "(" and ")" need no
# escaping: grep's basic regex treats them as literal.
BUMP_GREP='^chore(release): v'

# ── Commit-type display config ────────────────────────────────────────────────

# Ordered list controls section order in the changelog.
COMMIT_TYPES_ORDER=(feat fix revert perf refactor chore docs style test build ci)

declare -A COMMIT_TYPE_NAMES=(
  [feat]="Features"
  [fix]="Bug Fixes"
  [revert]="Reverts"
  [perf]="Performance"
  [refactor]="Refactoring"
  [chore]="Maintenance"
  [docs]="Documentation"
  [style]="Style"
  [test]="Tests"
  [build]="Build"
  [ci]="CI"
)

# Prints a changelog from already-fetched commit subjects in $1 (newline-
# separated "%s" lines, already scoped to PATHSPEC and with this script's own
# bump-commit subjects excluded -- exactly what release.sh's unreleased-change
# check and release-notes.sh each already walk `git log` once to produce).
# Takes the log text itself rather than a revision range so neither caller
# re-walks a range it has already walked.
build_changelog_from_log() {
  local commit_log="$1"

  local -A type_entries
  local t
  for t in "${COMMIT_TYPES_ORDER[@]}"; do type_entries[$t]=""; done
  local other_entries=""
  local msg
  # Matches: type(optional-scope)(optional !): description -- groups are
  # type (1), scope (2), bang (3), description (4). The bang is captured as
  # its own group so a breaking subject (feat!:, feat(scope)!:) is both kept
  # under its own type instead of dropping into "Other Changes" AND marked
  # "BREAKING:" in the notes (issue #113). Only the subject is visible here
  # (both callers pass a %s subjects-only stream), so a "BREAKING CHANGE:"
  # footer cannot be seen by the changelog -- it is visible only to
  # next-version.sh, which reads full bodies for the bump. Stored in a
  # variable (rather than written inline in the [[ =~ ]] below) since bash's
  # conditional parser doesn't reliably handle literal parens inside an
  # inline regex there.
  local pattern='^([a-z]+)(\([^)]*\))?(!?):[[:space:]]+(.+)$'

  while IFS= read -r msg; do
    [[ -z "$msg" ]] && continue
    # COMMIT_TYPES_ORDER is ordering-only here; COMMIT_TYPE_NAMES decides
    # real-type membership, so a lookalike like "feature:"/"cix:" still
    # falls through to Other Changes exactly as it did when compared
    # type-by-type.
    if [[ "$msg" =~ $pattern ]] && [[ -n "${COMMIT_TYPE_NAMES[${BASH_REMATCH[1]}]+x}" ]]; then
      local marker=""
      [[ -n "${BASH_REMATCH[3]}" ]] && marker="BREAKING: "
      type_entries[${BASH_REMATCH[1]}]+="- ${marker}${BASH_REMATCH[4]}"$'\n'
    else
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
