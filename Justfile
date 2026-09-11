# rackbops-ui-ux-std-lib -- UX/design-standards library (CSS themes + React components)
#
# pnpm workspace (styles/, components/react/). lint fans across the repo's shell
# scripts (.github/scripts/, deploy/) -- no JS/TS linter is configured yet; typecheck
# and test fan across the workspace via pnpm, mirroring CLAUDE.md's own documented
# `pnpm build`/`pnpm test` commands.
#
# Requires: node, pnpm, shellcheck.

set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes
default:
    @just --list

# Install dependencies (pnpm workspace: styles/, components/react/)
install:
    pnpm install

# Run all checks (lint + typecheck + test)
check: lint typecheck test

# Lint shell scripts (.github/scripts/, deploy/) -- no JS/TS linter configured yet.
# --severity=warning: checking each file independently (via xargs) can't
# resolve release-lib.sh's dynamic `source "$(dirname ...)/release-lib.sh"`
# path, so shellcheck emits an unavoidable SC1091 info notice per caller --
# real warnings and errors still fail the recipe.
lint:
    git ls-files '*.sh' | xargs -r shellcheck --severity=warning

# Nothing to auto-fix yet -- no formatter/linter with a --fix mode is configured
fix:
    @echo "no auto-fixable lint/format tooling configured in this repo yet"

# Type-check the React component package
typecheck:
    pnpm --filter @rackbops/ui-react exec tsc -p tsconfig.json --noEmit

# Run tests (every workspace package's own tests, then the root-level node:test suites)
test:
    pnpm test

# Remove installed dependencies
clean:
    rm -rf node_modules

# Reinstall from a clean slate
fresh: clean install
