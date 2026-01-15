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

The codebase follows a **modulith architecture with Pure Dependency Injection (DI)**. For complete architectural guidelines, see [Architecture.md](./Architecture.md).

### Current File Structure

```
src/
  ├── index.ts                           # Entry point (calls main.ts)
  ├── main.ts                            # Composition Root - wires dependencies
  └── modules/
        └── merge/                        # Merge automation module
              ├── index.ts                # Public API for the module
              └── internal/               # Internal implementation (encapsulated)
                    ├── configurator.ts          # DI configuration
                    ├── merge-service.ts         # Service interface
                    ├── default-merge-service.ts # Default implementation
                    ├── types.ts                 # Shared types and constants
                    ├── github-client.ts         # GitHub API interactions
                    ├── validators.ts            # Validation logic
                    └── formatters.ts            # Formatting utilities
```

**Module Responsibilities:**

1. **`main.ts`** - Composition Root
   - Reads GitHub Action inputs
   - Configures the merge module via Pure DI
   - Orchestrates the execution flow
   - Handles outputs and error reporting

2. **`modules/merge/`** - Merge Automation Module
   - Provides the complete merge automation logic
   - Public API (`index.ts`) exports only necessary interfaces and configurator
   - Internal implementation (`internal/`) is encapsulated and not exposed
   - Single module design reflects the single business responsibility: automated PR merging

### Architecture Principles

This action follows the architecture guidelines defined in [Architecture.md](./Architecture.md):

- **Pure Dependency Injection**: No DI container, explicit wiring in `configurator.ts`
- **Module Boundary by Value**: Single module for single business responsibility
- **Encapsulation**: `internal/` directory keeps implementation details hidden
- **Interface-based Design**: Depend on abstractions (`MergeService`), not implementations
- **Naming Conventions**: kebab-case for files, PascalCase for types/classes

### Code Quality and Naming

For general refactoring principles, naming conventions, and module organization guidelines, see:

- **[Architecture.md](./Architecture.md)** for this action's specific architecture
- **[Code Quality Guidelines](../../../CONTRIBUTING.md#code-quality-guidelines)** in CONTRIBUTING.md for general guidelines

### Maintaining the lysbot-merge Structure

When modifying lysbot-merge specifically:

- Keep all business logic inside the `merge` module's `internal/` directory
- Only expose what's necessary through `modules/merge/index.ts`
- Follow Pure DI pattern: wire dependencies in `configurator.ts`
- Use interface-based design for testability
- Keep `main.ts` focused on composition, not business logic
- Consult [Architecture.md](./Architecture.md) before introducing new modules

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
