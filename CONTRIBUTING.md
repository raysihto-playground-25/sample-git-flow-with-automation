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
- `fix`: A bug fix (also used for runtime dependency updates; see below)
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

### Dependency Updates

Runtime (production) dependency updates use the `fix` type rather than `build` or `chore`. This is a deliberate design choice for the following reasons:

1. **Treating dependency updates as potential bug fixes**: Runtime dependency updates may contain implicit bug fixes or security patches that are not always explicitly documented. By treating them as `fix`, we err on the safe side.

2. **Ensuring security fixes reach users promptly**: Using `fix` ensures that vulnerability patches trigger patch version increments, making it easier to release security updates to users.

3. **Enabling fine-grained patch releases**: This approach allows for more granular patch releases, ensuring that any behavioral changes or fixes in dependencies are properly versioned.

While the Conventional Commits specification defines `build` for changes affecting the build system or external dependencies, it does not strictly prohibit using `fix` when dependency updates may contain bug fixes. Since runtime dependencies can directly affect application behavior and stability, treating their updates as `fix` is a pragmatic choice that prioritizes safety and proper versioning.
