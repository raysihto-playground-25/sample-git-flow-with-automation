# Contributing Guidelines

## Commit Messages

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages and PR titles.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit
- `ux`: User experience improvements (project-specific additional custom type)

### Examples

```
feat(auth): add login functionality
fix(api): resolve null pointer exception in user service
docs(readme): update installation instructions
ci(workflow): add automated testing pipeline
```

## Pull Request Titles

PR titles must also follow the Conventional Commits format. This ensures consistency in the project history and enables automated changelog generation.

### Examples

```
feat(mergebot): add PR merge automation workflow
fix(release): correct version bump logic
docs(contributing): add commit message guidelines
```

## JavaScript / TypeScript Style and Linting

This repository contains JavaScript/TypeScript code in reusable GitHub Actions under `.github/actions/**`.
All of these follow the same style and linting policy.

### Baseline and Goals

Our configuration employs a clear separation of concerns between code formatting and code quality analysis:

- **Prettier** serves as the sole and authoritative code formatter. All formatting decisions—including indentation, line length, quote style, and other stylistic concerns—are delegated entirely to Prettier.
- **ESLint** is responsible for enforcing semantic, logical, and safety-related rules. It is based on the **official recommended presets** (ESLint and TypeScript-ESLint). We only add a **small number of project-specific rules** when they clearly improve **readability, correctness, or maintainability**.
- **eslint-config-prettier** disables all ESLint rules that are unnecessary or might conflict with Prettier, ensuring that both tools work harmoniously together.

We do **not** aim for strict compliance with large third-party style presets (e.g., "Airbnb config") across this repository. For a relatively small, Node-focused TypeScript codebase and GitHub Actions, mirroring such presets in full tends to add complexity without a proportional benefit.

Our primary goals are:

- A predictable, easy-to-understand rule set
- Consistent style across all JS/TS code (including `.github/actions/**`)
- Fewer opportunities for subtle bugs (especially around types and async code)

### What This Means in Practice

When working on JavaScript/TypeScript code (including Actions under `.github/actions/**`), please:

- Follow the existing ESLint and formatter configuration instead of introducing your own personal style.
- Avoid adding new rules or presets purely for aesthetic reasons (e.g., "I prefer this quote style" is not sufficient).
- Prefer **small, targeted rule changes** that demonstrably:
  - prevent a real class of bugs, or
  - make the code easier to read and maintain for others.

If you propose changes to the linting or formatting setup, your PR description should explain:

1. **What problem** the change is trying to solve, and
2. **Why this rule/preset** is an appropriate solution for this project.

Large stylistic rewrites that do not clearly improve correctness or maintainability are generally not accepted.

### AI Coding Assistants (e.g. GitHub Copilot)

If you use AI tools such as GitHub Copilot or other code assistants:

- Treat the generated code as if you had written it yourself.
- Ensure the suggestions **conform to this policy** and to the existing code style in the repository.
- Do not accept suggestions that introduce new formatting styles, new lint presets, or opinionated patterns that conflict with our configuration.

In short: AI tools are welcome, but they must **follow** the project's style and linting policy, not define it.

### Expectations for Contributors

We expect all contributors to:

- Run Prettier before committing code to ensure consistent formatting
- Address any ESLint warnings or errors before submitting pull requests
- Trust Prettier for all formatting decisions and ESLint for code quality concerns

By adhering to these guidelines, you help maintain a clean, consistent, and high-quality codebase. Thank you for your contributions.
