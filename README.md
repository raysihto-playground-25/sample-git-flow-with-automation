# sample-git-flow-with-automation

Automated Git Flow workflow implementation for GitHub repositories.

## Overview

This repository provides reusable GitHub Actions workflows and actions for automating Git Flow operations.

### Workflows

- **feature-freeze**: Creates a new release branch from develop and initiates the release process.
- **release-automation**: Handles automatic RC (Release Candidate) tagging and back-merge PR creation when changes are pushed to release branches.

### Actions

For details on actions that encapsulate specific automation logic, see [`.github/actions/`](.github/actions/).

- **lysbot-comm**: A TypeScript-based action for handling automation commands via PR comments. See [lysbot-comm README](.github/actions/lysbot-comm/README.md) for details.

## License

See [LICENSE](LICENSE) for details.

### Third-Party Licenses

- **Twemoji graphics** ([github.com/twitter/twemoji](https://github.com/twitter/twemoji)) are used for emoji display compatibility. Licensed under CC-BY 4.0. Copyright 2020 Twitter, Inc and other contributors.
