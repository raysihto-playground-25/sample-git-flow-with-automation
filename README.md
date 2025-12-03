# sample-git-flow-with-automation

Automated Git Flow workflow implementation for GitHub repositories.

## Workflows Overview

This repository provides reusable GitHub Actions workflows for automating Git Flow operations.

### exec-merge: PR Merge Automation

The `exec-merge` workflow provides automated PR merging triggered by the `/exec merge` command in PR comments. This is particularly useful for repositories where branch protection rules are unavailable (e.g., GitHub Free plan) or when additional merge controls are needed.

#### Architecture

The workflow is split into two files for maximum reusability:

1. **`exec-merge.yml`** (Reusable Workflow)
   - Contains all the core merge logic
   - Can be shared across multiple projects
   - Accepts project-specific configuration via inputs

2. **`exec-commands.yml`** (Project-Specific Caller)
   - Minimal configuration file for each project
   - Calls exec-related reusable workflows with project-specific settings
   - Defines branch naming conventions

#### Usage

##### Using the Shared Workflow

To use the shared workflow in your project, create an `exec-commands.yml` file:

```yaml
name: exec-commands

on:
  issue_comment:
    types: [created]

concurrency:
  group: exec-commands-pr-${{ github.event.issue.number }}
  cancel-in-progress: false

jobs:
  exec-merge:
    if: github.event.issue.pull_request
    uses: <owner>/<repo>/.github/workflows/exec-merge.yml@<ref>
    with:
      # Required: Configure your branch naming conventions
      release_branch_prefix: "release/"
      develop_branch: "develop"
      sync_branch_prefix: "fix/sync/"
    secrets: inherit
    permissions:
      contents: write
      pull-requests: write
      issues: write
```

##### Available Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `release_branch_prefix` | Prefix for release branches | `release/` |
| `develop_branch` | Name of the develop branch | `develop` |
| `sync_branch_prefix` | Prefix for sync branches (back-merges) | `fix/sync/` |
| `command_regex` | Regex pattern for the merge command | `^[[:space:]]*/exec[[:space:]]+merge[[:space:]]*$` |
| `mergeable_retry_count` | Number of retries for mergeable status | `5` |
| `mergeable_retry_interval` | Interval between retries (seconds) | `10` |

##### Triggering a Merge

Comment `/exec merge` on any PR to trigger the merge workflow. The workflow will:

1. ✅ Validate the command and user permissions
2. ✅ Check that the PR is open, unlocked, and not a draft
3. ✅ Verify all review conversations are resolved
4. ✅ Ensure at least one valid approval from another user
5. ✅ Confirm there are no merge conflicts
6. ✅ Perform the merge with the appropriate method (squash or merge commit)

##### Merge Method Selection

The workflow automatically selects the merge method based on branch patterns:

| Condition | Merge Method | Reason |
|-----------|--------------|--------|
| Head is `release/*` | Merge commit | Preserve release history |
| Head is `fix/sync/*` | Merge commit | Preserve back-merge history |
| Base is `release/*` | Squash | Clean release branch history |
| Base is `develop` | Squash | Clean develop branch history |
| Otherwise | Merge commit | Default behavior |

#### Limitations

- **Fork PRs are NOT supported**: GITHUB_TOKEN has limited write permissions for fork-originated PRs
- **Permission required**: Only organization owners, members, or collaborators with write access can use the command

### feature-freeze: Release Branch Creation

Creates a new release branch from develop and initiates the release process.

### release-automation: Release Branch Automation

Handles automatic RC (Release Candidate) tagging and back-merge PR creation when changes are pushed to release branches.

## License

See [LICENSE](LICENSE) for details.

### Third-Party Licenses

- **Twemoji graphics** ([github.com/twitter/twemoji](https://github.com/twitter/twemoji)) are used for emoji display compatibility. Licensed under CC-BY 4.0. Copyright 2020 Twitter, Inc and other contributors.