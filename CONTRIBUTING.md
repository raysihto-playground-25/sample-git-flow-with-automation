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

## Code Style Policy

This project employs a clear separation of concerns between code formatting and code quality analysis. We kindly ask all contributors to familiarize themselves with the following principles before submitting changes.

### Formatting with Prettier

Prettier serves as the sole and authoritative code formatter for this repository. All formatting decisions—including indentation, line length, quote style, and other stylistic concerns—are delegated entirely to Prettier. Contributors are encouraged to configure their development environment to format code with Prettier on save, ensuring consistency across the codebase.

### Linting with ESLint

ESLint is responsible for enforcing semantic, logical, and safety-related rules. Rather than concerning itself with formatting, ESLint focuses on catching potential bugs, enforcing best practices, and maintaining code quality. Our configuration is built upon `@typescript-eslint/recommended` as a foundation, with additional plugins such as `import/order` applied where appropriate to ensure well-organized imports.

### Selective Adoption of Style Guides

While industry-standard style guides such as the Airbnb JavaScript Style Guide offer valuable guidance, we do not adopt them in their entirety. Instead, we selectively incorporate conceptual elements that enhance code safety and maintainability—such as guidelines for safe coding patterns and import organization—while deliberately avoiding any stylistic rules that would conflict with Prettier's formatting decisions.

### Resolving Conflicts Between Prettier and ESLint

To prevent any conflicts between Prettier's formatting rules and ESLint's linting rules, this project uses `eslint-config-prettier`. This configuration disables all ESLint rules that are unnecessary or might conflict with Prettier, ensuring that both tools work harmoniously together.

### Expectations for Contributors

We expect all contributors to:

- Run Prettier before committing code to ensure consistent formatting
- Address any ESLint warnings or errors before submitting pull requests
- Trust Prettier for all formatting decisions and ESLint for code quality concerns

By adhering to these guidelines, you help maintain a clean, consistent, and high-quality codebase. Thank you for your contributions.
