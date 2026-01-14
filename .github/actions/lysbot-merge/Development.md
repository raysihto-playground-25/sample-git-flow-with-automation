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

## Code Structure

The codebase follows a **Lightweight Modulith** architecture as documented in [Architecture.md](./Architecture.md). This design prioritizes high testability and maintainability through the **Dependency Inversion Principle (DIP)** while avoiding excessive boilerplate.

### Current File Structure

```
src/
├── index.ts              # Entry point: Env setup & calling main.ts
├── main.ts               # Composition Root: DI wiring & orchestration
├── common/               # Shared utilities and shared types
│   ├── types.ts          # Common type definitions
│   ├── constants.ts      # Shared constants
│   └── utils.ts          # Pure utility functions
└── modules/
    └── merge/            # Merge feature module
        ├── merge.action.ts      # Pure business logic (The entry to the feature)
        ├── merge.repository.ts  # Interfaces for external I/O
        ├── merge.service.ts     # Reusable logic shared by actions
        └── infra/               # Concrete implementations
            └── github.infra.ts  # GitHub API implementation
```

**Module Responsibilities:**

1. **`index.ts`** - Extremely thin entry point
   - Only calls `main()` function
   - No business logic

2. **`main.ts`** - Composition Root (DI Container)
   - Wires dependencies together
   - Creates instances of infrastructure classes
   - Injects dependencies into actions
   - Handles top-level error handling and outputs

3. **`common/`** - Shared code across modules
   - `types.ts`: Type definitions used across modules
   - `constants.ts`: Shared constants (regex patterns, emojis, etc.)
   - `utils.ts`: Pure utility functions (no I/O)

4. **`modules/merge/`** - Merge feature module
   - **`merge.action.ts`**: Contains the main business logic for merge operations
     - Depends only on repository interfaces (DIP)
     - Pure business logic with no direct I/O
   - **`merge.repository.ts`**: Defines interfaces for all external operations
     - Abstract contracts for GitHub API operations
   - **`merge.service.ts`**: Reusable logic for commit message formatting
     - Shared logic used by the action
   - **`infra/github.infra.ts`**: Concrete GitHub API implementation
     - Implements repository interfaces using Octokit
     - Only file that directly calls GitHub APIs

### Code Quality and Naming

For general refactoring principles, naming conventions, and module organization guidelines, see the **[Code Quality Guidelines](../../../CONTRIBUTING.md#code-quality-guidelines)** section in CONTRIBUTING.md.

### Maintaining the lysbot-merge Structure

When modifying lysbot-merge specifically:

- **Add new features as modules** under `src/modules/[module_name]/`
- **Keep actions pure**: Actions should only depend on repository interfaces, never on infrastructure
- **Update interfaces**: When adding new external operations, define them in `*.repository.ts` first
- **Implement in infrastructure**: Create concrete implementations in `infra/*.infra.ts`
- **Wire in main.ts**: Update the composition root to inject the new dependencies
- **Test with mocks**: Write unit tests for actions using mocked repositories

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
