# sample-git-flow-with-automation

Automated Git Flow workflow implementation for GitHub repositories.

## Overview

This repository provides reusable GitHub Actions workflows and actions for automating Git Flow operations.

### Reusable Workflows

For documentation on reusable workflows that can be shared across projects, see [`.github/workflows/README.md`](.github/workflows/README.md).

- **feature-freeze**: Creates a new release branch from develop and initiates the release process.
- **release-automation**: Handles automatic RC (Release Candidate) tagging and back-merge PR creation when changes are pushed to release branches.

### Actions

For details on actions that encapsulate specific automation logic, see [`.github/actions/`](.github/actions/).

- **exec-merge**: A TypeScript-based action for automated PR merging via the `/exec merge` command in PR comments. See [exec-merge README](.github/actions/exec-merge/README.md) for details.

## License

See [LICENSE](LICENSE) for details.

### Third-Party Licenses

- **Twemoji graphics** ([github.com/twitter/twemoji](https://github.com/twitter/twemoji)) are used for emoji display compatibility. Licensed under CC-BY 4.0. Copyright 2020 Twitter, Inc and other contributors.