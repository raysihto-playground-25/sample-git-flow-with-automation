# Copilot Instructions

## Contributing Guidelines

Always read and follow the guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md) when making changes to this repository.

## Key Requirements

- **Commit Messages**: Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification
- **PR Titles**: Must also follow Conventional Commits format

## Code Formatting

**CRITICAL**: Always run the formatter before committing code changes to prevent CI failures.

When working on TypeScript/JavaScript code (especially in `.github/actions/`):

1. After making code changes, **ALWAYS** run the formatter: `npm run format`
2. Verify formatting passes: `npm run format:check`
3. Then run linter: `npm run lint`
4. Then run tests: `npm test`
5. Then build: `npm run build`
6. Only after all checks pass, commit your changes

**Why this matters**: The CI pipeline will fail if code is not properly formatted. This wastes time and resources. Running the formatter is a mandatory step in the development workflow, not optional.

**Example workflow for lysbot-merge action**:

```bash
cd .github/actions/lysbot-merge
npm install
# Make your code changes...
npm run format      # REQUIRED: Format code
npm run format:check # Verify formatting
npm run lint        # Check code style
npm test            # Run tests
npm run build       # Build the action
# Now commit
```

## Configuration Files

**CRITICAL**: Do NOT change the file extension of configuration files in `.github/actions/lysbot-merge/`:

- `prettier.config.ts` - **MUST remain as `.ts`** extension (do NOT change to `.mjs`, `.js`, or `.cjs`)
- `eslint.config.ts` - **MUST remain as `.ts`** extension
- `rollup.config.ts` - **MUST remain as `.ts`** extension
- `vitest.config.ts` - **MUST remain as `.ts`** extension

**Why this matters**: These configuration files use TypeScript and are loaded correctly with the `.ts` extension in the project's environment (Node.js 24+ with proper tooling). Changing extensions will break the configuration loading and cause CI/build failures.

## Development Environment

**CRITICAL**: Development for `.github/actions/lysbot-merge/` **MUST** be performed in an environment that matches the Node.js version specified in `package.json` and the GitHub Actions workflows.

### Supported Node.js Versions

- **Node.js 24.x (REQUIRED)**

  - This project is developed and validated primarily on Node.js 24.x.
  - Full compatibility, including TypeScript-based configuration loading, linting, formatting, and packaging, is guaranteed **only** on Node.js 24.x.

- **Node.js 22.x (MINIMUM / DEGRADED SUPPORT)**

  - Node.js 22.x is the **absolute minimum** version allowed for local development **only when Node.js 24.x cannot be used**.
  - In this environment, additional workarounds are required, and some tooling (especially ESLint) may still behave inconsistently.

- **Node.js 20.x and earlier (UNSUPPORTED)**
  - Node.js 20.x and older versions are **completely unsupported**.
  - Development, linting, or formatting using these versions is **not allowed** and will lead to inconsistent or broken behavior.

### npm Version

- Use an npm version compatible with the selected Node.js version above.
- Always follow the versions defined in `package.json` and CI workflows.

### Why Node.js 24 Is Required

This project relies on:

- Node.js 24+ runtime behavior
- Native ESM handling
- TypeScript configuration files (`.ts`) being loaded directly by tooling

These features are **not reliably supported** in older Node.js versions.

### Node.js 22 Workaround (Limited Support Only)

When using **Node.js 22.x**, you **must** enable TypeScript config loading explicitly using `tsx` (already included in `devDependencies`):

```bash
    env 'NODE_OPTIONS=--import tsx' npm run format:check
    env 'NODE_OPTIONS=--import tsx' npm run lint   # ESLint may still fail in some cases
```

This workaround exists **only** to unblock development in constrained environments.
It is **not** equivalent to full Node.js 24 compatibility.

### Mandatory Requirements

If you are unable to run all checks locally due to environment limitations:

1. You **must still** run `npm test` and `npm run package`
2. You **must** manually review changes for obvious lint or style violations
3. You **must** clearly state in the commit message that validation relies on CI with Node.js 24
4. You **must not** treat this as a substitute for setting up a proper Node.js 24 environment

**Developers are expected to provision Node.js 24.x, or at minimum Node.js 22.x, by any means necessary.**
