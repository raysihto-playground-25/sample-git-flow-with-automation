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

**CRITICAL**: When working on code in `.github/actions/lysbot-merge/`, use Node.js 24+ and npm 11+ to match the project requirements and CI environment.

- **Node.js version**: 24.11.1 or higher (as specified in package.json engines)
- **npm version**: 11.6.2 or higher

**Why this matters**: The project uses Node.js 24+ features and TypeScript configuration loading that may not work in older Node.js versions. Using a different version may cause linting, formatting, or build errors that don't occur in the correct environment. Always match the environment specified in package.json and used in GitHub Actions workflows.
