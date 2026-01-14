# Development

To work on the lysbot-merge action:

```bash
cd .github/actions/lysbot-merge
npm ci
# Make your code changes...
npm run all     # Run all fix, check, and package steps
```

Individual commands for specific tasks for example:

```bash
npm run check:test  # Run unit tests with coverage
npm run fix:format  # Run formatter (check:format for checking only)
npm run check:lint  # Run ESLint
npm run package     # Build package with rollup
```

## Code Structure

The codebase has been modularized for better maintainability and testability, following the **Single Responsibility Principle**. Each module focuses on a specific concern:

### Current File Structure

```
src/
└── ([TBD])    # TBD
```

**Module Responsibilities:**

1. **`xxx.ts`** (TBD)
   - TBD

### Code Quality and Naming

For general refactoring principles, naming conventions, and module organization guidelines, see the **[Code Quality Guidelines](../../../CONTRIBUTING.md#code-quality-guidelines)** section in CONTRIBUTING.md.

### Maintaining the lysbot-merge Structure

When modifying lysbot-merge specifically:

- TBD

## Input Handling

For GitHub Actions input handling guidelines (including DEPRECATED and OPTIONAL prefix rules), see the **[GitHub Actions Development](../../../CONTRIBUTING.md#github-actions-development)** section in CONTRIBUTING.md.

# Testing

This action uses **Vitest** for unit testing. The test suite focuses on testing pure logic functions and mocking GitHub API interactions for isolation.

| Test Type             | Status             | Description                                                            |
| --------------------- | ------------------ | ---------------------------------------------------------------------- |
| **Unit Tests**        | ✅ Implemented     | Covers command parsing, permissions, merge logic, and API interactions |
| **Integration Tests** | ❌ Not implemented | Would test GitHub API interactions with real tokens                    |
| **E2E Tests**         | ❌ Not implemented | Would test full workflow execution on real PRs                         |

## Running Tests

```bash
# Run all tests with coverage
npm run check:test

# Run tests in watch mode
npm run test:watch
```
