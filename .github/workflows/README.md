# Reusable Workflows

This directory contains reusable GitHub Actions workflows that can be shared across multiple projects.

## exec-merge.yml - PR Merge Automation

A reusable workflow that provides automated PR merging via the `/exec merge` command in PR comments.

### Features

- 🔐 **Permission validation** - Only authorized users can trigger merges
- ✅ **PR status checks** - Validates PR is open, unlocked, and not a draft
- 💬 **Review validation** - Ensures all conversations are resolved and approval exists
- 🔀 **Smart merge method** - Automatically selects squash or merge commit based on branch patterns
- 🔒 **Stale approval handling** - Dismisses approvals on outdated commits
- 📊 **Detailed feedback** - Posts clear status messages to PR comments

### Quick Start

Create a caller workflow in your project (e.g., `.github/workflows/on-comment-exec.yml`):

```yaml
name: on-comment-exec

on:
  issue_comment:
    types: [created]

jobs:
  exec-merge:
    uses: <owner>/<repo>/.github/workflows/exec-merge.yml@<ref>
    with:
      release_branch_prefix: "release/"
      develop_branch: "develop"
      sync_branch_prefix: "fix/sync/"
    secrets: inherit
```

Replace `<owner>/<repo>` with the repository containing the reusable workflow and `<ref>` with a branch, tag, or commit SHA.

### Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `release_branch_prefix` | string | No | `release/` | Prefix for release branches |
| `develop_branch` | string | No | `develop` | Name of the develop branch |
| `sync_branch_prefix` | string | No | `fix/sync/` | Prefix for sync branches (back-merges) |
| `mergeable_retry_count` | number | No | `5` | Number of retries for mergeable status calculation |
| `mergeable_retry_interval` | number | No | `10` | Interval in seconds between retries |

### Usage

Comment `/exec merge` on any PR to trigger the merge workflow.

### Merge Method Selection

The workflow automatically selects the appropriate merge method:

| Condition | Merge Method | Reason |
|-----------|--------------|--------|
| Head branch is `release/*` | Merge commit | Preserve release history |
| Head branch is `fix/sync/*` | Merge commit | Preserve back-merge history |
| Base branch is `release/*` | Squash | Clean release branch history |
| Base branch is `develop` | Squash | Clean develop branch history |
| Otherwise | Merge commit | Default behavior |

### Pre-merge Checks

Before merging, the workflow validates:

1. ✅ PR is open (not closed)
2. ✅ PR is unlocked
3. ✅ PR is ready for review (not a draft)
4. ✅ All review conversations are resolved
5. ✅ At least one valid approval from another user
6. ✅ No merge conflicts

### Permissions Required

The caller workflow must use `secrets: inherit` to pass the `GITHUB_TOKEN`. The reusable workflow internally requests:

- `contents: write` - For performing merges
- `pull-requests: write` - For posting comments and dismissing reviews
- `issues: write` - For adding reactions to comments

### Limitations

- **Fork PRs are NOT supported**: `GITHUB_TOKEN` has limited write permissions for fork-originated PRs
- **Authorization required**: Only organization owners, members, or collaborators with write access can use the command

### Third-Party Licenses

- **Twemoji graphics** ([github.com/twitter/twemoji](https://github.com/twitter/twemoji)) are used for emoji display compatibility. Licensed under CC-BY 4.0. Copyright 2020 Twitter, Inc and other contributors.

---

## Other Files

Other workflow files in this directory are project-specific and are not intended to be reused across projects.
