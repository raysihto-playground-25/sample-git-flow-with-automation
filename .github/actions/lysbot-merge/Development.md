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

The codebase has been modularized for better maintainability and testability, following the **Single Responsibility Principle** and **Dependency Inversion Principle (DIP)**. Each module focuses on a specific concern:

### Current File Structure

```
src/
├── action.ts         # Core business logic (executeAction, buildSummaryMarkdown)
├── constants.ts      # Configuration constants and regex patterns
├── github-api.ts     # GitHub API interaction wrappers
├── index.ts          # Action entry point for bundler
├── main.ts           # GitHub Actions runtime integration with DI
├── types.ts          # Type definitions and DI interfaces
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

4. **`main.ts`** (GitHub Actions runtime integration with Dependency Injection)
   - Integration layer with GitHub Actions runtime using DI/DIP pattern
   - Accepts `RunDependencies` parameter for all external dependencies
   - Helper functions: `parseConfig()`, `buildEventContext()`, `createProductionDependencies()`
   - `parseConfig()` validates inputs with strict bounds checking (rejects out-of-range values)
   - Delegates to `action.ts` for merge business logic
   - Writes outputs and summaries to GitHub Actions
   - Tested using direct dependency injection (no vi.mock)
   - Production uses actual modules; tests inject test doubles

5. **`types.ts`**
   - All TypeScript type definitions and interfaces
   - DI interfaces: `ActionsCore`, `GitHubContext`, `GetOctokitFunction`, `RuntimeEnvironment`, `RunDependencies`
   - Domain models and result types
   - No runtime logic, purely type declarations

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

This action uses **Vitest** for unit testing with **Dependency Injection** for testability.

## Testing Strategy

The test suite uses **direct dependency injection** instead of vi.mock for better maintainability:

- **No vi.mock**: Tests inject test doubles directly via `RunDependencies`
- **Clear contracts**: Minimal interfaces document actual dependencies
- **Better type safety**: TypeScript validates injected dependencies
- **Explicit mocking**: Each test constructs only the mocks it needs

## Test Coverage

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

## Testing Example

Tests use dependency injection instead of vi.mock:

```typescript
// Create test doubles
const mockCore = createMockCore();
const mockContext = createMockContext();
const mockOctokit = createMockOctokit();
const mockGetOctokit = vi.fn().mockReturnValue(mockOctokit);

// Inject dependencies
const deps: RunDependencies = {
  core: mockCore,
  context: mockContext,
  getOctokit: mockGetOctokit,
  env: { serverUrl: 'https://github.com' },
};

// Execute with injected dependencies
await run(deps);
```
