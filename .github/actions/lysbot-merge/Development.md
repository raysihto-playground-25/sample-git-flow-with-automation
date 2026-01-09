# Development

To work on the lysbot-merge action:

```bash
cd .github/actions/lysbot-merge
npm ci
# Make your code changes...
npm run all     # Run all fix, check, and package steps
```

Individual commands for specific tasks:

```bash
npm run test:coverage  # Run unit tests with coverage
npm run format:write   # Run formatter (format:check for checking only)
npm run lint           # Run ESLint
npm run bundle         # Bundle with rollup
```

## Architecture

This action follows a **Lightweight Modular Monolith** architecture optimized for GitHub Actions. See [Architecture.md](./Architecture.md) for detailed policy and guidelines.

## Code Structure

The codebase has been modularized for better maintainability and testability, following the **Single Responsibility Principle**. Each module focuses on a specific concern:

### Current File Structure

```
src/
├── action.ts         # Core business logic (executeAction, buildSummaryMarkdown)
├── constants.ts      # Configuration constants and regex patterns
├── github-api.ts     # GitHub API interaction wrappers
├── index.ts          # Action entry point for bundler
├── main.ts           # GitHub Actions runtime integration (tested with mocks)
├── types.ts          # Type definitions and interfaces
└── validation.ts     # Pure validation and business logic functions
```

**Module Responsibilities:**

1. **`action.ts`** (testable business logic)
   - Main `executeAction()` function that orchestrates the merge flow
   - Pure `buildSummaryMarkdown()` function for generating summaries
   - All business logic that can be tested without GitHub Actions runtime
   - Depends on: types, validation, github-api

2. **`constants.ts`**
   - Configuration constants (regex patterns, valid flags, emoji)
   - Immutable reference data
   - No dependencies on other modules except types

3. **`github-api.ts`**
   - All functions that interact with GitHub API
   - API calls, data fetching, mutations (reactions, comments, merges)
   - Depends on: types

4. **`main.ts`** (GitHub Actions runtime integration - tested with mocks)
   - Integration layer with GitHub Actions runtime
   - Reads inputs from GitHub Actions environment (`core.getInput`)
   - Handles deprecated input parameters with warnings
   - Constructs context from GitHub runtime (`github.context`, `process.env`)
   - Delegates to `action.ts` for merge business logic
   - Writes outputs and summaries to GitHub Actions (`core.setOutput`, `core.summary`)
   - Tested using vitest mocks to verify input handling, options parsing, and error handling
   - Contains conditional logic for backward compatibility with deprecated inputs

5. **`types.ts`**
   - All TypeScript type definitions and interfaces
   - No runtime logic, purely type declarations
   - Imported by all other modules as needed

6. **`validation.ts`**
   - Pure functions for validation and business logic
   - Command parsing, permission checks, merge method determination
   - Easily testable with no side effects
   - Depends on: types, constants

### Code Quality and Naming

For general refactoring principles, naming conventions, and module organization guidelines, see the **[Code Quality Guidelines](../../../CONTRIBUTING.md#code-quality-guidelines)** section in CONTRIBUTING.md.

### Maintaining the lysbot-merge Structure

When modifying lysbot-merge specifically:

- Keep types centralized in `types.ts`
- Keep constants centralized in `constants.ts`
- Add new pure functions to `validation.ts` or create domain-specific validation modules
- Add new API calls to `github-api.ts` or create endpoint-specific modules
- Keep testable orchestration in `action.ts` focused on business logic
- Keep main.ts focused on GitHub Actions runtime integration with tested backward compatibility logic

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
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```
