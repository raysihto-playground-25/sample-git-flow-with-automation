# Architecture

This document describes the architectural design of the lysbot-merge action, following a **Modular Monolith** approach suitable for small-to-medium GitHub Actions.

## Architecture Overview

### Design Philosophy: Modular Monolith

The lysbot-merge action follows a **Modular Monolith** architecture pattern, which is well-suited for small-to-medium TypeScript GitHub Actions. This approach provides:

- **Clear module boundaries** without the complexity of microservices
- **Strong encapsulation** through well-defined interfaces
- **Ease of testing** with isolated, mockable modules
- **Simple deployment** as a single bundled artifact
- **Future flexibility** to extract modules if needed

References:
- [Martin Fowler - MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)
- [Modular Monolith Architecture](https://zenn.dev/loglass/articles/d2ea268a7522be)

### Top-Level Dependency Injection

The architecture enforces **Pure DI (Dependency Injection)** at the top level:

- `main.ts` acts as the **composition root**
- All configuration is gathered from GitHub Actions inputs
- Dependencies (Octokit client, configuration objects) are constructed explicitly
- Business logic functions receive all dependencies as parameters
- **No direct I/O in business logic** - all I/O handled at the boundary

This design ensures:
- **Testability**: Business logic can be tested without mocking `@actions/core`
- **Clarity**: Dependencies are explicit and visible
- **Flexibility**: Easy to swap implementations for testing

## Module Structure

### Current File Structure

```
src/
├── index.ts                    # Entry point (unchanged, loads main.ts)
├── main.ts                     # Composition root (DI + orchestration)
├── types/
│   └── index.ts               # Shared TypeScript types and interfaces
├── constants/
│   └── index.ts               # Constants, regexes, validation rules
├── github-api/
│   ├── reactions.ts           # Reaction management
│   ├── comments.ts            # Comment posting
│   ├── pull-requests.ts       # PR data fetching
│   ├── reviews.ts             # Review management (fetch, dismiss)
│   ├── commits.ts             # Commit fetching
│   ├── threads.ts             # Review thread counting
│   ├── permissions.ts         # Permission checking
│   └── merge.ts               # PR merge execution
├── validation/
│   ├── command-parser.ts      # Command parsing and flag validation
│   ├── user-checks.ts         # Bot detection, author association, permissions
│   ├── pr-state.ts            # PR state validation (open, not draft, etc.)
│   └── merge-checks.ts        # Approval, thread, conflict checks
├── merge-logic/
│   ├── merge-method.ts        # Merge method determination (squash vs merge)
│   └── commit-builder.ts      # Commit title and message construction
├── formatting/
│   └── markdown.ts            # Markdown formatting utilities
└── action.ts                  # Main action orchestration logic
```

### Module Responsibilities

#### **1. `index.ts`** (Entry Point - Unchanged)
- **Responsibility**: Minimal entry point that loads and executes `main.js`
- **Dependencies**: None
- **Imports**: `./main.js`
- **Status**: Must remain unchanged per requirements

#### **2. `main.ts`** (Composition Root)
- **Responsibility**: 
  - Read configuration from GitHub Actions inputs (`core.getInput`)
  - Construct dependencies (Octokit, config objects, context)
  - Invoke the main action function
  - Handle top-level errors and set action outputs
  - Write summary to GitHub Actions
- **Key Principle**: **Thin layer** - only DI, orchestration, and I/O
- **No Business Logic**: Does not contain validation, checking, or merge logic
- **Allowed Operations**:
  - Call `core.getInput()`, `core.setOutput()`, `core.setFailed()`, `core.info()`
  - Construct configuration objects
  - Call action function with dependencies
  - Handle exceptions and log results
  - Write action summary

#### **3. `types/index.ts`** (Type Definitions)
- **Exports**: All shared TypeScript interfaces and types
  - `ActionConfig`: Configuration from inputs
  - `EventContext`: GitHub event context data
  - `PullRequestData`: Normalized PR data
  - `CheckResult`: Individual check result
  - `MergeMethodResult`: Merge method decision
  - `ActionResult`: Final action result
  - `MergeOptions`: Parsed command options
  - `Octokit`: Octokit client type
  - `Review`, `ReviewsArray`: Review types

#### **4. `constants/index.ts`** (Constants and Rules)
- **Exports**: Constants, regex patterns, validation rules
  - `COMMAND_REGEX`: Command matching pattern
  - `VALID_FLAGS`: Allowed command flags
  - `TWEMOJI`: Emoji SVG constants
  - `VALID_AUTHOR_ASSOCIATIONS`: Allowed author associations
  - `VALID_PERMISSIONS`: Allowed permission levels
  - `CONVENTIONAL_COMMIT_TYPES`: Allowed commit types
  - `CONVENTIONAL_COMMIT_REGEX`: Conventional commit validation pattern

#### **5. `github-api/` modules** (GitHub API Interactions)
All functions in this module accept `Octokit` as the first parameter and return promises.

- **`reactions.ts`**: 
  - `addReaction()`: Add reaction to comment
- **`comments.ts`**: 
  - `postComment()`: Post comment to PR
- **`pull-requests.ts`**: 
  - `fetchPullRequestData()`: Get and normalize PR data
- **`reviews.ts`**: 
  - `fetchApprovedReviews()`: Get approved reviews
  - `dismissReview()`: Dismiss a review
- **`commits.ts`**: 
  - `fetchPullRequestCommits()`: Get PR commits
- **`threads.ts`**: 
  - `countUnresolvedThreads()`: Count unresolved review threads via GraphQL
- **`permissions.ts`**: 
  - `getCollaboratorPermission()`: Get user's permission level
- **`merge.ts`**: 
  - `mergePullRequest()`: Execute merge operation

#### **6. `validation/` modules** (Validation and Checking)
Pure functions that validate data and return check results.

- **`command-parser.ts`**:
  - `parseCommand()`: Parse command and flags
  - `isCommand()`: Check if text is a valid command
- **`user-checks.ts`**:
  - `isBot()`: Check if user is a bot
  - `hasValidAuthorAssociation()`: Check author association
  - `hasValidPermission()`: Check permission level
- **`pr-state.ts`**:
  - `validatePRState()`: Validate PR is ready (open, not draft, not locked)
  - `getMergeableStateDescription()`: Get human-readable mergeable state
- **`merge-checks.ts`**:
  - `isConventionalCommitTitle()`: Validate conventional commit format

#### **7. `merge-logic/` modules** (Merge Decision Logic)
Pure functions that determine merge strategy and construct commit messages.

- **`merge-method.ts`**:
  - `determineMergeMethod()`: Determine merge method based on branch patterns
- **`commit-builder.ts`**:
  - `buildCommitTitle()`: Build commit title
  - `buildCommitMessage()`: Build commit message with co-authors

#### **8. `formatting/` modules** (Markdown Formatting)
Pure functions for formatting markdown output.

- **`markdown.ts`**:
  - `buildCheckResultsMarkdown()`: Format check results as markdown list
  - `buildSummaryMarkdown()`: Build action summary markdown table

#### **9. `action.ts`** (Main Action Orchestration)
- **Exports**: `executeAction()` function
- **Responsibility**: 
  - Orchestrate the entire merge workflow
  - Call validation functions
  - Call GitHub API functions
  - Make merge decisions
  - Return action result
- **Key Principle**: Pure orchestration - receives all dependencies as parameters
- **No I/O**: Does not call `core.getInput()` or `core.setOutput()`

### Utility Functions

- **`waitBeforeRetryMs()`**: Promise-based delay (in `action.ts`)

## Design Principles

### 1. Separation of Concerns
Each module has a single, well-defined responsibility:
- **API modules**: GitHub API interactions only
- **Validation modules**: Data validation and checking only
- **Merge logic modules**: Merge decision logic only
- **Formatting modules**: Output formatting only
- **Main/Action**: Orchestration only

### 2. Dependency Flow
```
index.ts → main.ts → action.ts → [validation, github-api, merge-logic, formatting]
                                       ↓
                                  [types, constants]
```

- Top-level (`main.ts`) constructs dependencies
- Mid-level (`action.ts`) orchestrates workflow
- Low-level modules are pure functions with explicit dependencies

### 3. Pure Functions Where Possible
- Most functions are pure: given the same inputs, they return the same outputs
- Side effects (API calls, I/O) are isolated in specific modules
- Exceptions: `github-api/` modules (API calls), `main.ts` (I/O)

### 4. Explicit Dependencies
- No hidden dependencies or global state
- All dependencies passed as function parameters
- Makes testing and reasoning easier

### 5. Type Safety
- All modules export and use TypeScript types
- Strict type checking enabled
- Interfaces over implementations

## Testing Strategy

### Test Structure
Tests mirror the `src/` directory structure:
```
__tests__/
├── main.test.ts                    # Tests for main.ts
├── types/
│   └── index.test.ts              # Type tests if needed
├── constants/
│   └── index.test.ts              # Constant validation tests
├── github-api/
│   ├── reactions.test.ts
│   ├── comments.test.ts
│   ├── pull-requests.test.ts
│   ├── reviews.test.ts
│   ├── commits.test.ts
│   ├── threads.test.ts
│   ├── permissions.test.ts
│   └── merge.test.ts
├── validation/
│   ├── command-parser.test.ts
│   ├── user-checks.test.ts
│   ├── pr-state.test.ts
│   └── merge-checks.test.ts
├── merge-logic/
│   ├── merge-method.test.ts
│   └── commit-builder.test.ts
├── formatting/
│   └── markdown.test.ts
└── action.test.ts                 # Integration tests for action.ts
```

### Testing Approach
- **Unit tests**: Test individual functions with mocked dependencies
- **Integration tests**: Test `action.ts` with mocked GitHub API
- **Main tests**: Test `main.ts` orchestration with mocked action function

## Migration from Old Structure

### Old Structure
```
src/
├── index.ts
├── main.ts
└── tmp_untitled_3.ts  (all logic in one file, ~796 lines)
```

### Changes Made
1. **Split `tmp_untitled_3.ts`** into logical modules
2. **Refactored `main.ts`** to be thin (only DI and I/O)
3. **Preserved `index.ts`** unchanged (requirement)
4. **Created modular structure** following separation of concerns
5. **Updated tests** to match new structure

## Maintaining the lysbot-merge Structure

When modifying lysbot-merge, follow these principles:

### Adding New Features
1. Identify which module the feature belongs to:
   - GitHub API interaction? → `github-api/`
   - Validation logic? → `validation/`
   - Merge decision? → `merge-logic/`
   - Output formatting? → `formatting/`
2. Create new module file if needed
3. Export pure functions with explicit dependencies
4. Update `main.ts` only if new inputs are needed
5. Update `action.ts` to orchestrate new feature

### Modifying Existing Features
1. Locate the appropriate module
2. Modify the pure function
3. Update tests in corresponding test file
4. Ensure `main.ts` remains thin (no logic added)

### Adding New Dependencies
1. Add to appropriate module
2. Pass as parameter from `main.ts`
3. Update type definitions in `types/index.ts`
4. Mock in tests

### Rules to Follow
- **Never add business logic to `main.ts`** - only DI and I/O
- **Never add I/O to business logic modules** - receive data as parameters
- **Always use explicit dependencies** - no hidden globals
- **Keep modules small** - split when a file exceeds ~200 lines
- **Test each module independently** - one test file per source file

## Benefits of This Architecture

1. **Maintainability**: Clear module boundaries make changes easier
2. **Testability**: Pure functions are easy to test
3. **Readability**: Each file has a clear purpose
4. **Flexibility**: Modules can be refactored independently
5. **Scalability**: Easy to add new features without affecting existing code
6. **Type Safety**: Strong TypeScript typing throughout
7. **Simplicity**: No complex frameworks or patterns - just functions and modules

## Future Considerations

- If the codebase grows significantly (>5000 lines), consider:
  - Extracting core logic to a separate package
  - Adding more sophisticated DI framework
  - Splitting into multiple actions
- For now, the Modular Monolith is optimal for this size and use case
