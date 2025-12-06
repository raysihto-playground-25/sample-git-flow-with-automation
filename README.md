# sample-git-flow-with-automation

Automated Git Flow workflow implementation for GitHub repositories.

## Overview

This repository provides reusable GitHub Actions workflows and actions for automating Git Flow operations.

### Workflows

- **feature-freeze**: Creates a new release branch from develop and initiates the release process.
- **release-automation**: Handles automatic RC (Release Candidate) tagging and back-merge PR creation when changes are pushed to release branches.

### Actions

For details on actions that encapsulate specific automation logic, see [`.github/actions/`](.github/actions/).

- **lysbot-merge**: A TypeScript-based action for automated PR merging via the `/lysbot merge` command in PR comments. See [lysbot-merge README](.github/actions/lysbot-merge/README.md) for details.

## License

See [LICENSE](LICENSE) for details.

### Third-Party Licenses

- **Twemoji graphics** ([github.com/twitter/twemoji](https://github.com/twitter/twemoji)) are used for emoji display compatibility. Licensed under CC-BY 4.0. Copyright 2020 Twitter, Inc and other contributors.
