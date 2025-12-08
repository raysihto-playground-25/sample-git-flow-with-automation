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
      - uses: {ORG}/{REPO}/.github/actions/lysbot-merge@master
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          release_branch_prefix: "release/"
          develop_branch: "develop"
          sync_branch_prefix: "fix/sync/"
```

> [!NOTE]
> Replace `{ORG}` with the organization or user name and `{REPO}` with the repository name where this action is hosted.

## Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `github-token` | string | Yes | - | GitHub token for API authentication |
| `release_branch_prefix` | string | No | `release/` | Prefix for release branches |
| `develop_branch` | string | No | `develop` | Name of the develop branch |
| `sync_branch_prefix` | string | No | `fix/sync/` | Prefix for sync branches (back-merges) |
| `mergeable_retry_count` | number | No | `5` | Number of retries for mergeable status calculation |
| `mergeable_retry_interval` | number | No | `10` | Interval in seconds between retries |

## Outputs

| Output | Description |
|--------|-------------|
| `result` | Result of the operation: `merged`, `skipped`, `failed`, or `already_merged` |
| `merge_method` | Merge method used: `squash` or `merge` (only set when merged) |

## Usage

Comment `/lysbot merge` on any PR to trigger the merge action.

### Command Options

| Option | Description |
|--------|-------------|
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

| Condition | Merge Method | Reason |
|-----------|--------------|--------|
| Head branch is `release/*` | Merge commit | Preserve release history |
| Head branch is `fix/sync/*` | Merge commit | Preserve back-merge history |
| Base branch is `release/*` | Squash | Clean release branch history |
| Base branch is `develop` | Squash | Clean develop branch history |
| Otherwise | Merge commit | Default behavior |

## Commit Message Behavior

The action's commit message behavior is **equivalent to GitHub's default merge behavior**:

- **For merge commits**: GitHub generates a default commit message with the PR title and description. The action appends additional metadata to this default message (e.g., `Merged-by: lysbot-merge (on behalf of @username)`).
- **For squash merges**: GitHub uses the PR title as the commit title and the PR body as the commit message, with the action's metadata appended.

This ensures that merge commits created by lysbot-merge are consistent with those created through GitHub's web interface.

### Special Commit Message Markers

When the `--override-approval-requirement` flag is used **and actually takes effect** (i.e., when there are no valid approvals), the merge commit message will include a marker:

```
⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement
```

This marker is **not** added if the override flag was specified but didn't take effect (e.g., when there were already valid approvals).

## Pre-merge Checks

Before merging, the action validates:

1. ✅ PR is open (not closed)
2. ✅ PR is unlocked
3. ✅ PR is ready for review (not a draft)
4. ✅ All review conversations are resolved
5. ✅ At least one valid approval from another user
6. ✅ No merge conflicts

### Check Status Icons

The merge check comment uses three icon states:

| Icon | Meaning |
|------|---------|
| ✅ | Check passed |
| ❌ | Check failed and blocks merge |
| ⚠️ | Check did not pass but is explicitly tolerated (e.g., overridden approval requirement or accepted title warning) |

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
npm install
npm test        # Run unit tests
npm run format  # Run formatter (format:check for checking only)
npm run lint    # Run ESLint
npm run build   # Build with ncc
```

### Code Structure

The codebase has been modularized for better maintainability and testability, following the **Single Responsibility Principle** and **Humble Object Pattern**. Each module focuses on a specific concern:

#### Current File Structure

```
src/
├── constants.ts + constants.test.ts    # Configuration constants and regex patterns
├── types.ts                            # Type definitions and interfaces
├── validation.ts + validation.test.ts  # Pure validation and business logic functions
├── github-api.ts + github-api.test.ts  # GitHub API interaction wrappers
├── action.ts + action.test.ts          # Core business logic (lysbotMerge, buildSummaryMarkdown)
└── main.ts                             # GitHub Actions runtime integration (untestable)
```

**Module Responsibilities:**

1. **`types.ts`**
   - All TypeScript type definitions and interfaces
   - No runtime logic, purely type declarations
   - Imported by all other modules as needed

2. **`constants.ts`**
   - Configuration constants (regex patterns, valid flags, emoji)
   - Immutable reference data
   - No dependencies on other modules except types

3. **`validation.ts`**
   - Pure functions for validation and business logic
   - Command parsing, permission checks, merge method determination
   - Easily testable with no side effects
   - Depends on: types, constants

4. **`github-api.ts`**
   - All functions that interact with GitHub API
   - API calls, data fetching, mutations (reactions, comments, merges)
   - Depends on: types

5. **`action.ts`** (testable business logic)
   - Main `lysbotMerge()` function that orchestrates the merge flow
   - Pure `buildSummaryMarkdown()` function for generating summaries
   - All business logic that can be tested without GitHub Actions runtime
   - Depends on: types, validation, github-api
   - **94%+ test coverage** via action.test.ts

6. **`main.ts`** (GitHub Actions runtime integration - untestable)
   - Thin integration layer with GitHub Actions runtime
   - Reads inputs from GitHub Actions environment (`core.getInput`)
   - Constructs context from GitHub runtime (`github.context`, `process.env`)
   - Delegates to `action.ts` for all business logic
   - Writes outputs and summaries to GitHub Actions (`core.setOutput`, `core.summary`)
   - **0% test coverage by design** - follows "Humble Object" pattern
   - Contains no business logic, only runtime integration
   - See comments in main.ts for detailed explanation of why it's untestable

#### Refactoring Principles

The refactoring follows these principles to maintain code quality:

1. **Single Responsibility Principle (SRP)**
   - Each module has one clear reason to change
   - Pure logic is separated from I/O operations
   - Business rules are isolated from infrastructure

2. **Humble Object Pattern**
   - Untestable code (GitHub Actions runtime integration) is isolated in main.ts
   - All testable business logic is extracted to action.ts
   - This maximizes test coverage where it matters most

3. **Dependency Direction**
   - Dependencies flow inward: infrastructure → orchestration → logic → types
   - No circular dependencies
   - Pure modules (validation) don't depend on I/O modules (github-api)

4. **Testability**
   - Pure functions are in separate modules for easy unit testing
   - API interactions are grouped for easy mocking
   - Orchestration logic in action.ts can be tested with mocked dependencies
   - Runtime integration in main.ts is intentionally untested (0% coverage)

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
   - Keep main.ts minimal - only GitHub Actions runtime integration, no business logic

4. **Testing Strategy**
   - All business logic MUST be testable and have tests
   - Extract any logic from main.ts to action.ts if it needs testing
   - main.ts should remain a thin adapter with 0% coverage
   - Target 80%+ coverage for all testable modules (action.ts, validation.ts, etc.)

5. **Breaking Changes**
   - Update tests when splitting modules
   - Update README.md to reflect structural changes
   - Document architectural decisions in commit messages

## Testing

This action uses **Vitest** for unit testing. The test suite focuses on testing pure logic functions and mocking GitHub API interactions for isolation.

| Test Type | Status | Description |
|-----------|--------|-------------|
| **Unit Tests** | ✅ Implemented | Covers command parsing, permissions, merge logic, and API interactions |
| **Integration Tests** | ❌ Not implemented | Would test GitHub API interactions with real tokens |
| **E2E Tests** | ❌ Not implemented | Would test full workflow execution on real PRs |

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Third-Party Licenses

- **Twemoji graphics** ([github.com/twitter/twemoji](https://github.com/twitter/twemoji)) are used for emoji display compatibility. Licensed under CC-BY 4.0. Copyright 2020 Twitter, Inc and other contributors.
