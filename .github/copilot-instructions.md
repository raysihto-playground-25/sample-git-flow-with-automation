# Copilot Instructions

## Contributing Guidelines

Always read and follow the guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md) when making changes to this repository.

## Key Requirements

- **Commit Messages**: Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification
- **PR Titles**: Must also follow Conventional Commits format

## Code Formatting

**CRITICAL**: Always ensure your code passes all CI checks before committing to prevent CI failures.

When working on TypeScript/JavaScript code (especially in `.github/actions/`):

1. After making code changes, verify all checks locally that will run in CI
2. Review the corresponding CI workflow to understand what checks will be performed
3. Run the same checks locally before committing
4. Only after all checks pass, commit your changes

**Why this matters**: The CI pipeline will fail if checks don't pass. This wastes time and resources. Running checks locally is a mandatory step in the development workflow, not optional.

**Example workflow for lysbot-merge action**:

For changes to `.github/actions/lysbot-merge/`, ensure you pass all checks that run in the CI workflow (`.github/workflows/lysbot-merge-action-test.yml`):

```bash
cd .github/actions/lysbot-merge
npm ci
# Make your code changes...
npm run format:check # Verify formatting
npm run lint         # Check code style
npm run test:coverage # Run tests with coverage
npm run bundle       # Build and package the action
# Now commit
```

## Configuration Files

**CRITICAL**: Do NOT change the file extension of configuration files in `.github/actions/lysbot-merge/`:

- `prettier.config.mjs` - **MUST remain as `.mjs`** extension (do NOT change to `.ts`, `.js`, or `.cjs`)
- `eslint.config.mjs` - **MUST remain as `.mjs`** extension
- `rollup.config.mjs` - **MUST remain as `.mjs`** extension
- `vitest.config.mjs` - **MUST remain as `.mjs`** extension

**Why this matters**: These configuration files use ES modules (`.mjs`) to ensure compatibility with GitHub Copilot and various tooling. The `.mjs` extension was specifically chosen to resolve compatibility issues with GitHub Copilot that existed with the previous `.ts` configuration files. Changing extensions will break the configuration loading and cause CI/build failures.

**Historical Context**: This project originally used `.ts` extensions for configuration files, which worked well with Node.js 24+ but caused issues with GitHub Copilot. The migration to `.mjs` was a pragmatic decision to resolve the Copilot compatibility issues, though it was not the originally preferred approach. As a side effect, the `.mjs` files happen to work with older Node.js versions, but supporting those versions was not a goal of the migration.

## Development Environment

**CRITICAL**: Development for `.github/actions/lysbot-merge/` should be performed using Node.js 24.x to match the production runtime environment.

**Production Runtime**: This action runs on Node.js 24 in production:
- `action.yml` specifies `runs.using: 'node24'`
- CI workflow (`.github/workflows/lysbot-merge-action-test.yml`) uses `node-version: '24'`

### Supported Node.js Versions

- **Node.js 24.x (REQUIRED / STANDARD)**

  - This is the **required and standard development environment** and matches the production runtime.
  - Full compatibility, including ES module configuration loading, linting, formatting, and packaging, is guaranteed on Node.js 24.x.
  - All development work **must** be performed using Node.js 24.x.

- **Node.js 22.x (NOT RECOMMENDED / FALLBACK ONLY)**

  - Node.js 22.x is **not recommended** for development, although it may work in limited cases.
  - This version does **not** match the production runtime.
  - Use Node.js 22.x **only if Node.js 24.x cannot be used**, and upgrade to Node.js 24.x as soon as possible.
  - Relying on Node.js 22.x may result in behavioral differences from production.

- **Node.js 20.x (STRONGLY DISCOURAGED / UNSUPPORTED)**

  - Node.js 20.x is **strongly discouraged** and effectively **unsupported**.
  - Any current compatibility is incidental and **not a design goal**.
  - Compatibility **may break at any time** without notice.
  - The significant version gap from the production runtime (Node.js 24) can lead to serious and hard-to-debug issues.
  - **Upgrade directly to Node.js 24.x**.

### npm Version

- Use an npm version compatible with the selected Node.js version above.
- Always follow the versions defined in `package.json` and CI workflows.

### Why Node.js 24 Is Required

This project is designed for and runs on Node.js 24 in production:

- **Production runtime**: `action.yml` specifies `runs.using: 'node24'`
- **CI environment**: `.github/workflows/lysbot-merge-action-test.yml` uses `node-version: '24'`
- **Target runtime behavior**: Node.js 24+ features and capabilities
- **Native ESM handling**: Modern ES module support
- **Modern tooling ecosystem**: Latest JavaScript tooling and best practices

Development on Node.js 24 ensures your local environment matches production, preventing runtime issues and ensuring consistent behavior.

### Configuration File Format Rationale

The `.mjs` extension for configuration files was adopted to resolve GitHub Copilot compatibility issues:

1. **Resolve GitHub Copilot compatibility issues**: The previous `.ts` configuration files caused problems with GitHub Copilot's analysis and suggestions. This was the primary driver for the migration.
2. **Ensure consistent tooling behavior**: Provide predictable behavior across different Node.js versions without requiring additional environment variables or workarounds.
3. **Side effect - Node.js 20 compatibility**: As a side effect of using `.mjs`, tooling currently works on Node.js 20, though this is not a design goal and may change.

**Note**: This was a pragmatic decision prioritizing developer experience and GitHub Copilot compatibility over the original preference for TypeScript configuration files. The `.mjs` approach resolves the Copilot issues while maintaining reliable behavior on Node.js 24 (the production runtime).

**Important**: The `.mjs` migration was **not** intended to support Node.js 20 development. Any Node.js 20 compatibility is incidental and should not be relied upon.

### Development Environment Setup

**Standard approach (Node.js 24.x):**

1. Use Node.js 24.x to match the production runtime
2. All npm scripts work without additional configuration
3. No environment variable workarounds needed
4. Ensures consistency with CI and production environments

**If you must use Node.js 22.x (not recommended):**

1. Be aware you are not using the production runtime version
2. All tooling works correctly with the `.mjs` configuration files
3. Upgrade to Node.js 24.x as soon as possible
4. Test thoroughly as runtime behavior may differ from production

**If you are on Node.js 20.x:**

1. **Strongly recommended**: Upgrade to Node.js 24.x immediately
2. Continuing on Node.js 20 may lead to unexpected issues
3. There is no guarantee of continued compatibility
4. The production runtime is Node.js 24 - significant version gap may cause problems
