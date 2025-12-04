# exec-merge Action

A TypeScript-based GitHub Action that provides automated PR merging via the `/exec merge` command in PR comments.

## Features

- 🔐 **Permission validation** - Only authorized users can trigger merges
- ✅ **PR status checks** - Validates PR is open, unlocked, and not a draft
- 💬 **Review validation** - Ensures all conversations are resolved and approval exists
- 🔀 **Smart merge method** - Automatically selects squash or merge commit based on branch patterns
- 🔒 **Stale approval handling** - Dismisses approvals on outdated commits
- 📊 **Detailed feedback** - Posts clear status messages to PR comments
- ✅ **Unit tested** - Comprehensive test suite with 60+ test cases

## Quick Start

Create a caller workflow in your project (e.g., `.github/workflows/on-comment-exec.yml`):

```yaml
name: on-comment-exec

on:
  issue_comment:
    types: [created]

concurrency:
  group: exec-merge-pr-${{ github.event.issue.number }}
  cancel-in-progress: false

jobs:
  exec-merge:
    if: github.event.issue.pull_request
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: {ORG}/{REPO}/.github/actions/exec-merge@master
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          release_branch_prefix: "release/"
          develop_branch: "develop"
          sync_branch_prefix: "fix/sync/"
```

> **Note:** Replace `{ORG}` with the organization or user name and `{REPO}` with the repository name where this action is hosted.

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

Comment `/exec merge` on any PR to trigger the merge action.

## Merge Method Selection

The action automatically selects the appropriate merge method:

| Condition | Merge Method | Reason |
|-----------|--------------|--------|
| Head branch is `release/*` | Merge commit | Preserve release history |
| Head branch is `fix/sync/*` | Merge commit | Preserve back-merge history |
| Base branch is `release/*` | Squash | Clean release branch history |
| Base branch is `develop` | Squash | Clean develop branch history |
| Otherwise | Merge commit | Default behavior |

## Pre-merge Checks

Before merging, the action validates:

1. ✅ PR is open (not closed)
2. ✅ PR is unlocked
3. ✅ PR is ready for review (not a draft)
4. ✅ All review conversations are resolved
5. ✅ At least one valid approval from another user
6. ✅ No merge conflicts

## Permissions Required

The workflow must have the following permissions:

- `contents: write` - For performing merges
- `pull-requests: write` - For posting comments and dismissing reviews
- `issues: write` - For adding reactions to comments

## Limitations

- **Fork PRs are NOT supported**: `GITHUB_TOKEN` has limited write permissions for fork-originated PRs
- **Authorization required**: Only organization owners, members, or collaborators with write access can use the command

## Development

To work on the exec-merge action:

```bash
cd .github/actions/exec-merge
npm install
npm test        # Run unit tests
npm run lint    # Run ESLint
npm run build   # Build with ncc
```

## Testing

### Test Overview

This action uses **Vitest** for unit testing. The test suite focuses on testing pure logic functions and mocking GitHub API interactions for isolation.

| Test Type | Status | Description |
|-----------|--------|-------------|
| **Unit Tests** | ✅ Implemented | 75+ test cases covering core business logic |
| **Integration Tests** | ❌ Not implemented | Would test GitHub API interactions with real tokens |
| **E2E Tests** | ❌ Not implemented | Would test full workflow execution on real PRs |

### Current Coverage

Run `npm test -- --coverage` to generate a coverage report:

```
File           | % Stmts | % Branch | % Funcs | % Lines
---------------|---------|----------|---------|--------
exec-merge.ts  |   ~96%  |   ~85%   |   100%  |   ~96%
```

### Test Categories

The test suite (`src/exec-merge.test.ts`) covers:

1. **Command Parsing** - Validates `/exec merge` command recognition
2. **User Validation** - Tests bot detection, author association, and permissions
3. **Merge Method Selection** - Tests branch pattern matching logic
4. **PR State Validation** - Tests open/locked/draft state checks
5. **Mergeable State Description** - Tests human-readable state messages
6. **Markdown Building** - Tests check result formatting
7. **GitHub API Functions** - Tests with mocked Octokit instance
8. **Main Orchestration** - Tests `execMerge` function end-to-end (with mocks)

### Remaining Uncovered Code Paths

The following code paths have limited coverage due to their complex async nature:

| Code Path | Lines | Status | Notes |
|-----------|-------|--------|-------|
| Self-approval skip | 754 | Partial | Requires specific test setup |
| TOCTOU during retry | 882-889 | Partial | Hard to simulate race condition |
| Mergeability error paths | 898-901 | Partial | Various edge cases |

All major code paths including `sleep()`, stale approval dismissal, TOCTOU detection, mergeable retry, and merge failure handling are now covered by unit tests.

### Adding Integration or E2E Tests

**Integration tests** would require:
- A GitHub token with appropriate permissions
- A test repository with configurable PRs
- Mocking or stubbing network calls at a higher level

**E2E tests** would require:
- A dedicated test repository
- Actual PR creation and `/exec merge` comment triggers
- Verification of merge results

To add integration tests, consider:

```typescript
// Example integration test structure (not implemented)
describe('Integration: GitHub API', () => {
  // Would require GITHUB_TOKEN environment variable
  // Would make real API calls to a test repository
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/exec-merge.test.ts
```

## Third-Party Licenses

- **Twemoji graphics** ([github.com/twitter/twemoji](https://github.com/twitter/twemoji)) are used for emoji display compatibility. Licensed under CC-BY 4.0. Copyright 2020 Twitter, Inc and other contributors.
