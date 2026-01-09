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

The codebase has been modularized following **hexagonal architecture** principles (also known as ports and adapters) for better maintainability, testability, and separation of concerns. Each layer has specific responsibilities:

### Current File Structure

```
src/
├── index.ts                      # Entry point (unchanged)
├── main.ts                       # Presentation layer - GitHub Actions input/output
├── domain/                       # Core business logic (independent of external systems)
│   ├── types.ts                  # Type definitions and interfaces
│   ├── constants.ts              # Constants, regex patterns, and enumerations
│   ├── validators.ts             # Business rules validation (commands, permissions, PR state)
│   └── merge-strategy.ts         # Merge method determination logic
├── application/                  # Application layer - use cases and orchestration
│   ├── action-executor.ts        # Main action execution flow and orchestration
│   └── formatters.ts             # Output formatting (markdown, summaries)
└── infrastructure/               # External interactions (adapters)
    └── github-api.ts             # GitHub API communication

__tests__/
├── main.test.ts                  # Tests for presentation layer (main.ts)
└── action-executor.test.ts       # Tests for application and domain layers
```

### Module Responsibilities

#### **Domain Layer** (`src/domain/`)

Pure business logic with no external dependencies. This layer is the heart of the application.

1. **`types.ts`** - Type definitions
   - Core interfaces: `ActionConfig`, `EventContext`, `PullRequestData`, `CheckResult`, `ActionResult`
   - GitHub type aliases: `Octokit`, `Review`, `ReviewsArray`

2. **`constants.ts`** - Enumerations and constants
   - Command patterns: `COMMAND_REGEX`, `VALID_FLAGS`
   - Permission/association lists: `VALID_AUTHOR_ASSOCIATIONS`, `VALID_PERMISSIONS`
   - Conventional commit types and patterns: `CONVENTIONAL_COMMIT_TYPES`, `CONVENTIONAL_COMMIT_REGEX`
   - UI elements: `TWEMOJI` icons

3. **`validators.ts`** - Business rules validation
   - Command parsing: `parseCommand()`, `isCommand()`
   - User validation: `isBot()`, `hasValidAuthorAssociation()`, `hasValidPermission()`
   - PR state validation: `validatePRState()`, `isConventionalCommitTitle()`
   - Helper functions: `getMergeableStateDescription()`

4. **`merge-strategy.ts`** - Merge strategy determination
   - `determineMergeMethod()` - Determines merge vs squash based on branch patterns

#### **Application Layer** (`src/application/`)

Orchestrates business logic and coordinates between domain and infrastructure.

1. **`action-executor.ts`** - Main use case orchestration
   - `executeAction()` - Coordinates the entire merge workflow
   - Validates permissions and PR state
   - Manages approval checks and stale review dismissal
   - Handles TOCTOU protection and mergeability retries
   - Constructs commit messages and executes merge

2. **`formatters.ts`** - Output formatting
   - `buildCheckResultsMarkdown()` - Formats validation check results
   - `buildSummaryMarkdown()` - Creates GitHub Actions job summary

#### **Infrastructure Layer** (`src/infrastructure/`)

Handles external system interactions (GitHub API).

1. **`github-api.ts`** - GitHub API communication
   - User interaction: `addReaction()`, `postComment()`
   - Permission checks: `getCollaboratorPermission()`
   - PR data: `fetchPullRequestData()`, `fetchPullRequestCommits()`
   - Review management: `fetchApprovedReviews()`, `dismissReview()`, `countUnresolvedThreads()`
   - Merge operations: `mergePullRequest()`
   - Utilities: `waitBeforeRetryMs()`

#### **Presentation Layer** (`src/main.ts`)

GitHub Actions entry point - kept minimal for easy testing.

- Reads GitHub Actions inputs
- Constructs configuration and context
- Delegates to application layer
- Writes outputs and summary

### Architectural Principles

1. **Dependency Rule**: Dependencies only point inward
   - Infrastructure → Application → Domain
   - Domain has no dependencies on outer layers
   - Application may depend on Domain
   - Infrastructure may depend on Application and Domain

2. **Testability**: Each layer can be tested independently
   - Domain: Pure functions, easy to test
   - Application: Mock infrastructure dependencies
   - Infrastructure: Mock external APIs
   - Presentation: Mock application layer

3. **Separation of Concerns**
   - **Domain**: What the system does (business rules)
   - **Application**: How the system orchestrates (use cases)
   - **Infrastructure**: How the system talks to external systems (adapters)
   - **Presentation**: How the system receives/returns data (I/O)

### Code Quality and Naming

For general refactoring principles, naming conventions, and module organization guidelines, see the **[Code Quality Guidelines](../../../CONTRIBUTING.md#code-quality-guidelines)** section in CONTRIBUTING.md.

### Maintaining the lysbot-merge Structure

When modifying lysbot-merge specifically:

- **Keep domain logic pure**: Domain layer should have no external dependencies (no `@actions/core`, no API calls)
- **One responsibility per file**: Each file should focus on a single aspect of functionality
- **Minimal main.ts**: Keep presentation layer thin - only input/output, no business logic
- **Test at the right layer**:
  - Test business logic at domain layer (fast, pure functions)
  - Test orchestration at application layer (with mocked infrastructure)
  - Test I/O at presentation layer (with mocked application)
- **Types in domain**: All interfaces and types belong in `domain/types.ts`
- **Constants in domain**: All constants, enums, and regex patterns in `domain/constants.ts`
- **API calls in infrastructure**: All external system calls in `infrastructure/github-api.ts`

**When adding new features**:

1. Define types in `domain/types.ts`
2. Add business logic to appropriate domain files
3. Add orchestration to `application/action-executor.ts` if needed
4. Add API calls to `infrastructure/github-api.ts` if needed
5. Update `main.ts` only if new inputs/outputs are required
6. Write tests at the appropriate layer

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
