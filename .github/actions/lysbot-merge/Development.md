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

The codebase has been modularized following **hexagonal architecture** principles (also known as ports and adapters) for better maintainability, testability, and separation of concerns. Each layer has specific responsibilities:

### Current File Structure

```
src/
├── adapters/                    # Adapters layer - external system interactions
│     └── github-api.ts         # GitHub API communication
├── domain/                      # Core business logic (independent of external systems)
│     ├── types.ts              # Type definitions and interfaces
│     ├── constants.ts          # Constants, regex patterns, and enumerations
│     ├── validators.ts         # Business rules validation (commands, permissions, PR state)
│     └── merge-strategy.ts     # Merge method determination logic
├── index.ts                     # Entry point (unchanged)
├── main.ts                      # Presentation layer - GitHub Actions input/output
└── usecases/                    # Use cases layer - orchestration and workflows
      ├── action-executor.ts     # Main action execution flow and orchestration
      └── formatters.ts          # Output formatting (markdown, summaries)

__tests__/
├── action-executor.test.ts      # Tests for usecases and domain layers
└── main.test.ts                 # Tests for presentation layer (main.ts)
```

### Module Responsibilities

#### **Domain Layer** (`src/domain/`)

Pure business logic with no external dependencies. This layer is the heart of the application.

1. **`constants.ts`** - Enumerations and constants
   - Command patterns: `COMMAND_REGEX`, `VALID_FLAGS`
   - Permission/association lists: `VALID_AUTHOR_ASSOCIATIONS`, `VALID_PERMISSIONS`
   - Conventional commit types and patterns: `CONVENTIONAL_COMMIT_TYPES`, `CONVENTIONAL_COMMIT_REGEX`
   - UI elements: `TWEMOJI` icons

2. **`merge-strategy.ts`** - Merge strategy determination
   - `determineMergeMethod()` - Determines merge vs squash based on branch patterns

3. **`types.ts`** - Type definitions
   - Core interfaces: `ActionConfig`, `EventContext`, `PullRequestData`, `CheckResult`, `ActionResult`
   - GitHub type aliases: `Octokit`, `Review`, `ReviewsArray`

4. **`validators.ts`** - Business rules validation
   - Command parsing: `parseCommand()`, `isCommand()`
   - User validation: `isBot()`, `hasValidAuthorAssociation()`, `hasValidPermission()`
   - PR state validation: `validatePRState()`, `isConventionalCommitTitle()`
   - Helper functions: `getMergeableStateDescription()`

#### **Use Cases Layer** (`src/usecases/`)

Orchestrates business logic and coordinates workflows between domain and adapters.

1. **`action-executor.ts`** - Main use case orchestration
   - `executeAction()` - Coordinates the entire merge workflow
   - Validates permissions and PR state
   - Manages approval checks and stale review dismissal
   - Handles TOCTOU protection and mergeability retries
   - Constructs commit messages and executes merge

2. **`formatters.ts`** - Output formatting
   - `buildCheckResultsMarkdown()` - Formats validation check results
   - `getResultMessage()` - Maps action result status to user-friendly messages
   - `buildSummaryMarkdown()` - Creates GitHub Actions job summary

#### **Adapters Layer** (`src/adapters/`)

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
- Delegates to use cases layer
- Writes outputs and summary

### Architectural Principles

1. **Dependency Rule**: Dependencies only point inward
   - Adapters → Use Cases → Domain
   - Domain has no dependencies on outer layers
   - Use Cases may depend on Domain
   - Adapters may depend on Use Cases and Domain

2. **Testability**: Each layer can be tested independently
   - Domain: Pure functions, easy to test
   - Use Cases: Mock adapters dependencies
   - Adapters: Mock external APIs
   - Presentation: Mock use cases layer

3. **Separation of Concerns**
   - **Domain**: What the system does (business rules)
   - **Use Cases**: How the system orchestrates (workflows)
   - **Adapters**: How the system talks to external systems (I/O)
   - **Presentation**: How the system receives/returns data (entry point)

### Code Quality and Naming

For general refactoring principles, naming conventions, and module organization guidelines, see the **[Code Quality Guidelines](../../../CONTRIBUTING.md#code-quality-guidelines)** section in CONTRIBUTING.md.

### Maintaining the lysbot-merge Structure

When modifying lysbot-merge specifically:

- **Keep domain logic pure**: Domain layer should have no external dependencies (no `@actions/core`, no API calls)
- **One responsibility per file**: Each file should focus on a single aspect of functionality
- **Minimal main.ts**: Keep presentation layer thin - only input/output, no business logic or domain logic
- **Test at the right layer**:
  - Test business logic at domain layer (fast, pure functions)
  - Test orchestration at use cases layer (with mocked adapters)
  - Test I/O at presentation layer (with mocked use cases)
- **Types in domain**: All interfaces and types belong in `domain/types.ts`
- **Constants in domain**: All constants, enums, and regex patterns in `domain/constants.ts`
- **API calls in adapters**: All external system calls in `adapters/github-api.ts`

**When adding new features**:

1. Define types in `domain/types.ts`
2. Add business logic to appropriate domain files
3. Add orchestration to `usecases/action-executor.ts` if needed
4. Add API calls to `adapters/github-api.ts` if needed
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
# Run all tests with coverage
npm run check:test

# Run tests in watch mode
npm run test:watch
```
