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
- **Contribute to or debug the Action** &#x279C; See **[Development](./Development.md)**

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
>
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
4. ✅ Mergeable state is clean
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
          # release_branch_prefix: "release/"
          # develop_branch: "develop"
          # sync_branch_prefix: "fix/sync/"
```

> [!NOTE]
>
> - Replace `{ORG}` with the organization or user name and `{REPO}` with the repository name where this action is hosted.
> - This Action has no stable release yet. Please use `@develop` until the first versioned tag becomes available.

## Inputs

| Input                      | Type   | Required | Default     | Valid Range | Description                                        |
| -------------------------- | ------ | -------- | ----------- | ----------- | -------------------------------------------------- |
| `github-token`             | string | Yes      | -           | -           | GitHub token for API authentication                |
| `release_branch_prefix`    | string | No       | `release/`  | -           | Prefix for release branches                        |
| `develop_branch`           | string | No       | `develop`   | -           | Name of the develop branch                         |
| `sync_branch_prefix`       | string | No       | `fix/sync/` | -           | Prefix for sync branches (back-merges)             |
| `mergeable_retry_count`    | number | No       | `5`         | 1-20        | Number of retries for mergeable status calculation |
| `mergeable_retry_interval` | number | No       | `10`        | 1-60        | Interval in seconds between retries                |

> [!NOTE]
>
> **Input Validation**: Out-of-range values for `mergeable_retry_count` and `mergeable_retry_interval` will cause the action to fail with a clear error message indicating the valid range.

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

### User Authorization

Only users with **write access** or higher can execute the `/lysbot merge` command. Specifically, the following user types are authorized:

- **Repository owners** - Full repository ownership
- **Organization members** - Members of the organization owning the repository
- **Collaborators with write access** - External collaborators explicitly granted write permissions

Users without sufficient permissions will receive a clear error message when attempting to use the command.

## Limitations

> [!WARNING]
>
> **Fork PRs are NOT supported**: GitHub's security model blocks write operations (including merges) on fork PRs when using `GITHUB_TOKEN`. This is a fundamental security boundary to prevent untrusted code from external contributors from executing with elevated repository permissions. To merge fork PRs, repository maintainers must use the GitHub web interface or push the fork branch to the main repository first.
