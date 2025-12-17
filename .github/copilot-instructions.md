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

- **Node.js 24.x (STANDARD / PRINCIPLE)**

  - **This is the standard development environment** and matches the production runtime.
  - Development on Node.js 24.x is the **principle** (原則) for this project.
  - Full compatibility, including ES module configuration loading, linting, formatting, and packaging, is guaranteed on Node.js 24.x.
  - All developers should use Node.js 24.x for development work.

- **Node.js 22.x (SHOULD BE AVOIDED)**

  - Node.js 22.x **should be avoided** for development, though it is technically possible.
  - While all tooling works correctly with the `.mjs` configuration files, this version does not match the production runtime.
  - **Strongly recommended**: Upgrade to Node.js 24.x (not just to Node.js 22.x) to match production.
  - Use only if you cannot upgrade to Node.js 24.x, and be aware of potential runtime differences.

- **Node.js 20.x (STRONGLY DISCOURAGED)**
  - Node.js 20.x **should be strongly avoided** for development.
  - While the migration to `.mjs` configuration files currently allows tooling to work on Node.js 20, this is a side effect, not a design goal.
  - **This may break at any time**: There is no guarantee that future changes will maintain Node.js 20 compatibility.
  - The production runtime is Node.js 24, creating a significant version gap that may lead to unexpected issues.
  - **Strongly recommended**: Upgrade directly to Node.js 24.x (skip Node.js 22) to match production and ensure reliable development.

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
