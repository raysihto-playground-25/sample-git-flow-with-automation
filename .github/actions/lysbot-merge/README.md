# lysbot-merge Action

A TypeScript-based GitHub Action that provides automated PR merging via the `/lysbot merge` command in PR comments.

## Features

- 🔐 **Permission validation** - Only authorized users can trigger merges
- ✅ **PR status checks** - Validates PR is open, unlocked, and not a draft
- 💬 **Review validation** - Ensures all conversations are resolved and approval exists
- 🔀 **Smart merge method** - Automatically selects squash or merge commit based on branch patterns
- 🔒 **Stale approval handling** - Dismisses approvals on outdated commits
- 📊 **Detailed feedback** - Posts clear status messages to PR comments
- ✅ **Unit tested** - Comprehensive test suite with extensive test coverage

## Next Steps

Depending on what you want to do next:

- **Use `/lysbot merge` on an existing project** &#x279C; See **[Usage](#usage)**
- **Integrate this Action into your repository** &#x279C; See **[Quick Start](#quick-start)**
- **Contribute to or debug the Action** &#x279C; See **[Development](#development)**

## Usage

Comment `/lysbot merge` on any PR to trigger the merge action.

### Command Options

| Option                            | Description                                                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--override-approval-requirement` | **Exceptional/privileged option**: Skip the review approval requirement for this merge only. The command executor acts as a reviewer proxy, taking responsibility for approving the changes. All other checks (status checks, merge conflicts, unresolved threads, etc.) still apply. |

**Example with flag:**

```
/lysbot merge --override-approval-requirement
```

> [!CAUTION]
> **Important Notes on `--override-approval-requirement`:**
>
> - **This is an exceptional, privileged option**: Use this option sparingly and only when you have a valid reason to bypass the normal approval workflow.
> - **Command executor takes reviewer responsibility**: By using this flag, you are acting as a reviewer proxy and asserting that you have reviewed and approved the changes yourself.
> - **Temporary and explicit**: This override applies only to the current merge command invocation and does not change repository settings or branch protection rules.
> - **Limited scope**: This flag only bypasses the approval requirement. All other checks (merge conflicts, unresolved conversations, status checks, etc.) must still pass.
> - **Commit message marker**: When this flag is used and actually takes effect (i.e., when there are no valid approvals), the merge commit message will include a marker indicating the exceptional approval override.

## Merge Method Selection

The action automatically selects the appropriate merge method:

| Condition                   | Merge Method | Reason                       |
| --------------------------- | ------------ | ---------------------------- |
| Head branch is `release/*`  | Merge commit | Preserve release history     |
| Head branch is `fix/sync/*` | Merge commit | Preserve back-merge history  |
| Base branch is `release/*`  | Squash       | Clean release branch history |
| Base branch is `develop`    | Squash       | Clean develop branch history |
| Otherwise                   | Merge commit | Default behavior             |

## Commit Message Behavior

lysbot-merge **explicitly specifies** both commit title and body to ensure consistent behavior regardless of repository settings for `merge_commit_title` and `merge_commit_message`.

### Merge Commits

For merge commits (used for `release/*` and `fix/sync/*` branches):

**Title (first line):**

```
Merge pull request #{PR_NUMBER} from {PR_MERGE_HEAD}
```

**Body (after blank line):**

```
{PR_TITLE}

{ADDITIONAL_MESSAGES}
```

**Example:**

```
Merge pull request #123 from release/v1.0.0

chore(release): Release v1.0.0

Merged-by: lysbot-merge (on behalf of @username)
```

### Squash Merges

For squash merges (used for PRs targeting `develop` or `release/*` branches):

**Title (first line):**

```
{PR_TITLE} (#{PR_NUMBER})
```

**Body (after blank line):**

```
* {COMMIT_TITLE_01}
* {COMMIT_TITLE_02}
* {COMMIT_TITLE_03}
...

Co-authored-by: {AUTHOR_NAME_01} <{AUTHOR_EMAIL_01}>
Co-authored-by: {AUTHOR_NAME_02} <{AUTHOR_EMAIL_02}>
...

{ADDITIONAL_MESSAGES}
```

**Notes:**

- Only commit titles (first line of each commit message) are listed, not full commit messages
- Each commit title is prefixed with `* ` (bullet point)
- Co-authors are extracted from all commits in the PR and listed in commit order (oldest ancestor &#x279C; most recent)
- Duplicate authors are included only once (first occurrence)
- Co-authored-by entries follow the Git trailer format: `Co-authored-by: Name <email>`

**Example:**

```
feat: add new authentication system (#456)

* feat: implement OAuth2 provider
* fix: handle token expiration
* docs: update authentication guide

Co-authored-by: Alice Developer <alice@example.com>
Co-authored-by: Bob Contributor <bob@example.com>

Merged-by: lysbot-merge (on behalf of @username)
```

### Special Commit Message Markers

When the `--override-approval-requirement` flag is used **and actually takes effect** (i.e., when there are no valid approvals), the merge commit message will include a marker in the additional messages section:

```
⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement
```

This marker is **not** added if the override flag was specified but didn't take effect (e.g., when there were already valid approvals).

## Pre-merge Checks

Before merging, the action validates:

1. ✅ PR is ready for review (open, unlocked, and not a draft)
2. ✅ All review conversations are resolved
3. ✅ At least one valid approval from another user
4. ✅ No merge conflicts
5. ✅ PR title follows Conventional Commits

### Check Status Icons

The merge check comment uses three icon states:

| Icon | Meaning                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------- |
| ✅   | Check passed                                                                                                     |
| ❌   | Check failed and blocks merge                                                                                    |
| ⚠️   | Check did not pass but is explicitly tolerated (e.g., overridden approval requirement or accepted title warning) |

## Quick Start

Create a caller workflow in your project (e.g., `.github/workflows/on-comment.yml`):

```yaml
name: on-comment

on:
  issue_comment:
    types: [created]

concurrency:
  group: on-comment-${{ github.event.issue.number }}
  cancel-in-progress: false

jobs:
  lysbot-merge:
    if: github.event.issue.pull_request
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: {ORG}/{REPO}/.github/actions/lysbot-merge@develop
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          options: |
            release-branch-prefix: "release/"
            develop-branch: "develop"
            sync-branch-prefix: "fix/sync/"
```

The `options` parameter accepts YAML format key-value pairs. All options are optional and can be omitted if you want to use the defaults. Comments are also supported:

```yaml
steps:
  - uses: {ORG}/{REPO}/.github/actions/lysbot-merge@develop
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      options: |
        ## Project-specific branch naming configuration
        release-branch-prefix: release/
        develop-branch: develop
        sync-branch-prefix: fix/sync/
        ## Optional: customize retry behavior for mergeable status
        # mergeable-retry-count: 5
        # mergeable-retry-interval: 10
```

You can also omit the `options` parameter entirely to use all defaults:

```yaml
steps:
  - uses: {ORG}/{REPO}/.github/actions/lysbot-merge@develop
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

> [!NOTE]
>
> - Replace `{ORG}` with the organization or user name and `{REPO}` with the repository name where this action is hosted.
> - This Action has no stable release yet. Please use `@develop` until the first versioned tag becomes available.

## Inputs

| Input          | Type   | Required | Default | Description                                                                                                                                                                                                     |
| -------------- | ------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token` | string | Yes      | -       | GitHub token for API authentication                                                                                                                                                                             |
| `options`      | string | No       | -       | Optional configuration in YAML format with key-value pairs. Supports: `release-branch-prefix`, `develop-branch`, `sync-branch-prefix`, `mergeable-retry-count`, `mergeable-retry-interval`. See examples above. |

### Default Values

When options are not specified, the following defaults are used:

| Option                     | Default     | Description                                        |
| -------------------------- | ----------- | -------------------------------------------------- |
| `release-branch-prefix`    | `release/`  | Prefix for release branches                        |
| `develop-branch`           | `develop`   | Name of the develop branch                         |
| `sync-branch-prefix`       | `fix/sync/` | Prefix for sync branches (back-merges)             |
| `mergeable-retry-count`    | `5`         | Number of retries for mergeable status calculation |
| `mergeable-retry-interval` | `10`        | Interval in seconds between retries                |

## Outputs

| Output         | Description                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `result`       | Result of the operation: `merged`, `skipped`, `failed`, or `already_merged` |
| `merge_method` | Merge method used: `squash` or `merge` (only set when merged)               |

## Permissions Required

The workflow must have the following permissions:

- `contents: write` - For performing merges
- `pull-requests: write` - For posting comments and dismissing reviews
- `issues: write` - For adding reactions to comments

## Limitations

> [!WARNING]
> **Fork PRs are NOT supported**: `GITHUB_TOKEN` has limited write permissions for fork-originated PRs

> [!NOTE]
> **Authorization required**: Only organization owners, members, or collaborators with write access can use the command

## Development

To work on the lysbot-merge action:

```bash
cd .github/actions/lysbot-merge
npm ci
npm run test:coverage  # Run unit tests with coverage
npm run format:write   # Run formatter (format:check for checking only)
npm run lint           # Run ESLint
npm run bundle         # Bundle with ncc
```

### Code Structure

The codebase has been modularized for better maintainability and testability, following the **Single Responsibility Principle**. Each module focuses on a specific concern:

#### Current File Structure

```
src/
├── action.ts         # Core business logic (executeAction, buildSummaryMarkdown)
├── constants.ts      # Configuration constants and regex patterns
├── github-api.ts     # GitHub API interaction wrappers
├── main.ts           # GitHub Actions runtime integration (tested with mocks)
├── options-parser.ts # YAML options parser with zod validation
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
   - Parses options YAML with deprecated input fallbacks
   - Constructs context from GitHub runtime (`github.context`, `process.env`)
   - Delegates to `action.ts` for merge business logic
   - Writes outputs and summaries to GitHub Actions (`core.setOutput`, `core.summary`)
   - Tested using vitest mocks to verify input handling, options parsing, and error handling
   - Contains conditional logic for backward compatibility with deprecated inputs

5. **`options-parser.ts`** (YAML parsing and validation)
   - Parses YAML options input using `yaml` library
   - Validates option types using `zod` schema
   - Provides default values for missing options
   - Pure functions with comprehensive test coverage
   - Depends on: types, yaml (for parsing), zod (for validation)

6. **`types.ts`**
   - All TypeScript type definitions and interfaces
   - No runtime logic, purely type declarations
   - Imported by all other modules as needed

7. **`validation.ts`**
   - Pure functions for validation and business logic
   - Command parsing, permission checks, merge method determination
   - Easily testable with no side effects
   - Depends on: types, constants

#### Refactoring Principles

The refactoring follows these principles to maintain code quality:

1. **Single Responsibility Principle (SRP)**
   - Each module has one clear reason to change
   - Pure logic is separated from I/O operations
   - Business rules are isolated from infrastructure

2. **Testing Strategy**
   - GitHub Actions runtime integration code in main.ts is tested using vitest mocks
   - All merge business logic is extracted to action.ts for comprehensive testing
   - This separation maximizes maintainability and test coverage

3. **Dependency Direction**
   - Dependencies flow inward: infrastructure &#x279C; orchestration &#x279C; logic &#x279C; types
   - No circular dependencies
   - Pure modules (validation) don't depend on I/O modules (github-api)

4. **Testability**
   - Pure functions are in separate modules for easy unit testing
   - API interactions are grouped for easy mocking
   - Orchestration logic in action.ts can be tested with mocked dependencies
   - Runtime integration in main.ts is tested using vitest mocks for the GitHub Actions environment

#### Naming Conventions

The codebase follows these naming conventions:

1. **Constants**
   - `SCREAMING_SNAKE_CASE` for module-level constants and schemas
   - Examples: `OPTIONS_SCHEMA`, `DEFAULT_OPTIONS`, `COMMAND_REGEX`, `VALID_FLAGS`
   - Rationale: Makes constants immediately recognizable and distinguishable from variables

2. **Functions and Variables**
   - `camelCase` for functions, variables, and parameters
   - Examples: `parseOptions`, `buildConfig`, `optionsYaml`

3. **Types and Interfaces**
   - `PascalCase` for type names and interfaces
   - Examples: `ParsedOptions`, `ActionConfig`, `EventContext`

4. **Files and Modules**
   - `kebab-case` for file names
   - Examples: `options-parser.ts`, `github-api.ts`, `action.test.ts`

#### Future Refactoring Guidelines

When adding new features or making changes, follow these guidelines:

1. **When to Create a New Module**
   - When a logical grouping exceeds ~300 lines
   - When a distinct new responsibility emerges (e.g., notification system, metrics)
   - When multiple files start duplicating similar code

2. **When NOT to Split Further**
   - Don't create modules with fewer than ~50 lines
   - Don't split functions that are tightly coupled (modify together frequently)
   - Don't create "utils" grab-bags without clear responsibility

3. **Maintaining the Structure**
   - Keep types centralized in `types.ts`
   - Keep constants centralized in `constants.ts`
   - Add new pure functions to `validation.ts` or create domain-specific validation modules
   - Add new API calls to `github-api.ts` or create endpoint-specific modules
   - Keep testable orchestration in `action.ts` focused on business logic
   - Keep main.ts focused on GitHub Actions runtime integration with tested backward compatibility logic

4. **Testing Strategy**
   - All business logic MUST be testable and have tests
   - main.ts contains runtime integration logic tested with vitest mocks
   - Merge business logic should be in action.ts for comprehensive testing without mocks
   - Target 80%+ coverage for all modules (action.ts, validation.ts, main.ts, etc.)

5. **Breaking Changes**
   - Update tests when splitting modules
   - Update README.md to reflect structural changes
   - Document architectural decisions in commit messages

## Testing

This action uses **Vitest** for unit testing. The test suite focuses on testing pure logic functions and mocking GitHub API interactions for isolation.

| Test Type             | Status             | Description                                                            |
| --------------------- | ------------------ | ---------------------------------------------------------------------- |
| **Unit Tests**        | ✅ Implemented     | Covers command parsing, permissions, merge logic, and API interactions |
| **Integration Tests** | ❌ Not implemented | Would test GitHub API interactions with real tokens                    |
| **E2E Tests**         | ❌ Not implemented | Would test full workflow execution on real PRs                         |

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Third-Party Licenses

- **Twemoji graphics** ([github.com/twitter/twemoji](https://github.com/twitter/twemoji)) are used for emoji display compatibility. Licensed under CC-BY 4.0. Copyright 2020 Twitter, Inc and other contributors.
