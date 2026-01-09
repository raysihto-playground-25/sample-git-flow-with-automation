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

This action follows **Clean Architecture** principles to achieve separation of concerns and testability. For detailed architectural guidelines and design principles, see **[Architecture.md](./Architecture.md)**.

### Current File Structure

The codebase is organized into three layers:

```
src/
├── domain/              # Pure business logic and rules
│   ├── entities/        # Business data structures (PullRequest entity)
│   ├── value-objects/   # Value objects (MergeMethod, etc.)
│   └── services/        # Domain services (validation logic)
├── usecases/            # Application workflows and ports
│   ├── merge/           # Merge use case orchestration
│   └── ports/           # Interface definitions (GitHubClient, Logger)
├── adapters/            # External integrations
│   ├── gateways/        # API implementations (GitHub API client)
│   └── presenters/      # Output formatting (Markdown presenter)
└── main.ts              # Composition root (DI setup)
```

**Layer Responsibilities:**

1. **`domain/`** (Enterprise Business Rules)
   - Pure domain logic with no external dependencies
   - Contains entities, value objects, and domain services
   - Independent of GitHub Actions runtime or external libraries
   - Examples: PR title validation, merge method determination

2. **`usecases/`** (Application Business Rules)
   - Orchestrates domain objects to achieve specific goals
   - Defines ports (interfaces) for external interactions
   - Contains application-specific workflows
   - Examples: Merge PR use case, check approval use case

3. **`adapters/`** (Interface Adapters)
   - Implements ports using actual external libraries
   - Handles GitHub API calls, input parsing, output formatting
   - Converts between external data formats and domain models
   - Examples: Octokit GitHub client, Action logger, Markdown presenter

4. **`main.ts`** (Composition Root)
   - Only place where all layers are coupled together
   - Sets up dependency injection
   - Reads inputs and creates adapter instances
   - Wires up use cases with their dependencies

### Code Quality and Naming

For general refactoring principles, naming conventions, and module organization guidelines, see the **[Code Quality Guidelines](../../../CONTRIBUTING.md#code-quality-guidelines)** section in CONTRIBUTING.md.

For architectural patterns and dependency rules, see **[Architecture.md](./Architecture.md)**.

### Maintaining the lysbot-merge Structure

When modifying lysbot-merge specifically:

- **Domain logic** goes in `domain/` - must have no external dependencies
- **Ports (interfaces)** go in `usecases/ports/` - define what the use case needs
- **Port implementations** go in `adapters/gateways/` - use external libraries
- **Use case orchestration** goes in `usecases/` - coordinates domain objects
- **Dependency injection** happens only in `main.ts` - the composition root
- Follow the **Dependency Rule**: `Adapters -> Usecases -> Domain`

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
