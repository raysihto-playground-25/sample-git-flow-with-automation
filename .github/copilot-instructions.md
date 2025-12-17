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

- `prettier.config.mjs` - **MUST remain as `.mjs`** extension (do NOT change to `.ts`, `.js`, or `.cjs`)
- `eslint.config.mjs` - **MUST remain as `.mjs`** extension
- `rollup.config.mjs` - **MUST remain as `.mjs`** extension
- `vitest.config.mjs` - **MUST remain as `.mjs`** extension

**Why this matters**: These configuration files use ES modules (`.mjs`) to ensure compatibility across different Node.js versions and development environments. The `.mjs` extension was specifically chosen to resolve compatibility issues with GitHub Copilot and various tooling, while maintaining support for Node.js 20 environments (though deprecated). Changing extensions will break the configuration loading and cause CI/build failures.

**Historical Context**: This project originally used `.ts` extensions for configuration files, which worked well with Node.js 24+ but caused issues with GitHub Copilot and older Node.js versions. The migration to `.mjs` was a pragmatic decision to improve developer experience and tooling compatibility, though it was not the originally preferred approach.

## Development Environment

**CRITICAL**: Development for `.github/actions/lysbot-merge/` **MUST** be performed in an environment that matches the Node.js version specified in `package.json` and the GitHub Actions workflows.

### Supported Node.js Versions

- **Node.js 24.x (RECOMMENDED)**

  - This project is developed and validated primarily on Node.js 24.x.
  - Full compatibility, including ES module configuration loading, linting, formatting, and packaging, is guaranteed on Node.js 24.x.
  - This is the recommended version for all development work.

- **Node.js 22.x (SUPPORTED)**

  - Node.js 22.x is fully supported for local development.
  - All tooling (ESLint, Prettier, Vitest, Rollup) works correctly with the `.mjs` configuration files.

- **Node.js 20.x (DEPRECATED BUT SUPPORTED)**
  - Node.js 20.x is **deprecated** but currently supported for local development.
  - The migration to `.mjs` configuration files was made specifically to maintain compatibility with Node.js 20 environments, addressing issues that existed with the previous `.ts` configuration files.
  - While all tooling works correctly with Node.js 20, this support is considered deprecated and may be removed in future versions.
  - **Production runtime**: The action itself still targets Node.js 24+ for production use (as specified in `package.json` engines field).
  - Developers are encouraged to upgrade to Node.js 22 or 24 when possible.

### npm Version

- Use an npm version compatible with the selected Node.js version above.
- Always follow the versions defined in `package.json` and CI workflows.

### Why Node.js 24 Is Recommended

This project is designed for:

- Node.js 24+ runtime behavior
- Native ESM handling
- Modern JavaScript tooling ecosystem

While Node.js 20 is currently supported through `.mjs` configuration files, Node.js 24 provides the best development experience.

### Configuration File Format Rationale

The `.mjs` extension for configuration files was adopted to:

1. **Resolve GitHub Copilot compatibility issues**: The previous `.ts` configuration files caused problems with GitHub Copilot's analysis and suggestions.
2. **Support Node.js 20 environments**: Enable development on Node.js 20 for teams with version constraints, though this support is deprecated.
3. **Ensure consistent tooling behavior**: Provide predictable behavior across different Node.js versions without requiring additional environment variables or workarounds.

**Note**: This was a pragmatic decision prioritizing developer experience and compatibility over the original preference for TypeScript configuration files. The `.mjs` approach works reliably across Node.js 20, 22, and 24 without requiring special workarounds.

### Development Environment Setup

**Recommended approach:**

1. Use Node.js 24.x for the best experience
2. All npm scripts work without additional configuration
3. No environment variable workarounds needed

**For Node.js 20/22 environments:**

1. All tooling works correctly with the `.mjs` configuration files
2. No special setup or workarounds required
3. Simply run `npm ci` and use the npm scripts as documented
