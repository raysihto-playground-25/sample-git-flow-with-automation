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
