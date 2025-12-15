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

> [!IMPORTANT]
>
> This project uses `fix` for runtime dependency updates instead of the more common `build` or `chore` types.

1. **Treating dependency updates as potential bug fixes**: Runtime dependency updates may contain implicit bug fixes or security patches that are not always explicitly documented. By treating them as `fix`, we err on the safe side.

2. **Ensuring security fixes reach users promptly**: Using `fix` ensures that vulnerability patches trigger patch version increments, making it easier to release security updates to users.

3. **Enabling fine-grained patch releases**: This approach allows for more granular patch releases, ensuring that any behavioral changes or fixes in dependencies are properly versioned.

The Conventional Commits specification only mandates `feat` and `fix` types; other types such as `build`, `chore`, and `ci` are conventions adopted from sources like the Angular convention, not requirements of the specification itself. This project chooses to use `fix` for runtime dependency updates because these updates can directly affect application behavior and stability. Treating them as potential bug fixes is a pragmatic choice that prioritizes safety and proper versioning.

## Documentation and PR Guidelines

### Avoiding Specific Metrics in Documentation

To reduce maintenance burden and prevent documentation drift, **do not include specific metrics** such as test counts, file line numbers, coverage percentages, or other quantitative details in documentation files (e.g., README.md, guides, or other markdown documentation) **or in code comments**.

**Rationale**: These specific numbers change frequently as the codebase evolves. Maintaining them accurately requires ongoing effort with minimal benefit. Outdated metrics can mislead readers and create unnecessary maintenance overhead.

**Examples of what to avoid**:

- ❌ "The project has 150 tests"
- ❌ "The main file is 1,088 lines"
- ❌ "There are 25 TypeScript files"
- ❌ "This module has 94% test coverage" (in code comments)
- ❌ "80+ tests validate this functionality" (in code comments)

**Examples of acceptable alternatives**:

- ✅ "The project has comprehensive test coverage"
- ✅ "The codebase follows modular design principles"
- ✅ "Multiple TypeScript files implement the functionality"
- ✅ "This module has high test coverage" (in code comments)
- ✅ "Extensive tests validate this functionality" (in code comments)

> [!NOTE]
>
> Quantitative metrics should appear in CI or generated reports, not in manually-maintained documentation or code comments.

### Specific Metrics in PR Descriptions

While specific metrics should be avoided in documentation, **PR descriptions are exempt from this policy**. You may (and should) include specific details about "this change" or "at this time" in PR descriptions.

**Rationale**: PR descriptions capture a snapshot of changes at a specific point in time. They serve as historical records and do not require ongoing maintenance.

**Examples of acceptable PR description content**:

- ✅ "This PR splits a 1,088-line file into 15 smaller modules"
- ✅ "Added 23 new test cases to improve coverage"
- ✅ "Reduced file size from 500 lines to 150 lines"

### Responding to Review Comments

When addressing individual review comments in a PR conversation, **always reference the commit hash** that addresses each specific comment.

**Rationale**: This creates clear traceability in the GitHub PR conversation, making it easy to verify that each piece of feedback has been addressed.

**How to respond**:

- Reply to each conversation thread with the commit hash (short or full form) that addresses that specific feedback
- A simple hash-only reply is acceptable (e.g., `abc1234`)
- If the comment is addressed across multiple commits, reference all relevant hashes or provide a brief explanation (e.g., "Fixed across a1b2c3d and b2c3d4e due to refactoring split")
- Do not resolve the review thread until the reviewer has confirmed the fix

**Examples**:

- ✅ `a1b2c3d`
- ✅ `a1b2c3d - refactored as suggested`
- ✅ `Fixed in a1b2c3d and b2c3d4e`

## Code Quality Guidelines

### Refactoring Principles

When refactoring code in this repository, follow these principles to maintain code quality:

1. **Single Responsibility Principle (SRP)**
   - Each module has one clear reason to change
   - Pure logic is separated from I/O operations
   - Business rules are isolated from infrastructure

2. **Testing Strategy**
   - GitHub Actions runtime integration code should be tested using vitest mocks
   - All business logic should be extracted to separate modules for comprehensive testing
   - This separation maximizes maintainability and test coverage

3. **Dependency Direction**
   - Dependencies flow inward: infrastructure → orchestration → logic → types
   - No circular dependencies
   - Pure modules (validation) don't depend on I/O modules (github-api)

4. **Testability**
   - Pure functions are in separate modules for easy unit testing
   - API interactions are grouped for easy mocking
   - Orchestration logic can be tested with mocked dependencies
   - Runtime integration is tested using vitest mocks for the GitHub Actions environment

### Naming Conventions

The codebase follows these naming conventions:

1. **Constants**
   - `SCREAMING_SNAKE_CASE` for module-level constants and schemas
   - Examples: `OPTIONS_SCHEMA`, `DEFAULT_OPTIONS`, `COMMAND_REGEX`, `VALID_FLAGS`
   - Rationale: Makes constants immediately recognizable and distinguishable from variables

2. **Functions and Variables**
   - `camelCase` for functions, variables, and parameters
   - Examples: `parseOptions`, `buildConfig`, `optionsYaml`

3. **Types and Interfaces**
   - `PascalCase` for type names and interfaces
   - Examples: `ParsedOptions`, `ActionConfig`, `EventContext`

4. **Files and Modules**
   - `kebab-case` for file names
   - Examples: `options-parser.ts`, `github-api.ts`, `action.test.ts`

### Module Organization Guidelines

When adding new features or making changes, follow these guidelines:

1. **When to Create a New Module**
   - When a logical grouping exceeds ~300 lines
   - When a distinct new responsibility emerges (e.g., notification system, metrics)
   - When multiple files start duplicating similar code

2. **When NOT to Split Further**
   - Don't create modules with fewer than ~50 lines
   - Don't split functions that are tightly coupled (modify together frequently)
   - Don't create "utils" grab-bags without clear responsibility

3. **Testing Requirements**
   - All business logic MUST be testable and have tests
   - Runtime integration logic should be tested with vitest mocks
   - Business logic should be tested comprehensively without mocks
   - Target 80%+ coverage for all modules

4. **Breaking Changes**
   - Update tests when splitting modules
   - Update README.md to reflect structural changes
   - Document architectural decisions in commit messages

## GitHub Actions Development

### Input Handling Guideline for GitHub Actions

Defines rules for writing `description` fields for inputs in GitHub Actions to ensure clarity, consistency, and quick recognition of input status.

#### Mandatory & Permanent Rules

Apply to **all inputs without exception** and must be followed permanently.

> [!IMPORTANT]
>
> Prefixes `DEPRECATED: ` and `OPTIONAL: ` in `description` are **mandatory and permanent** for clarity and consistency.

##### 1. `DEPRECATED: ` Prefix

- **Rule:**
  - Add `DEPRECATED: ` (including one trailing space) at the beginning of `description` for all deprecated inputs.
  - Do not prepend `OPTIONAL: ` redundantly.
- **Purpose:**
  - Indicate non-recommended usage at first glance, regardless of runtime warnings.

##### 2. `OPTIONAL: ` Prefix

- **Rule:**
  - Add `OPTIONAL: ` (including one trailing space) at the beginning of `description` for all inputs where `required: false`.
  - Do not apply this prefix to deprecated inputs.
- **Purpose:**
  - Make it immediately clear that the input is optional, even outside the YAML context.

###### Example:

```yaml
# Optional input
description: "OPTIONAL: Path to the file"
required: false

# Deprecated input
description: "DEPRECATED: Old configuration option"
required: false
deprecationMessage: "'old_option' is deprecated and will be removed in a future release."
```

---

#### Temporary & Emergency Measures (Quick Fix)

Provide quick mechanical steps for urgent situations when detailed consideration is not possible.

> [!NOTE]
>
> Use these steps only when there is no time for detailed review.
> They are **not mandatory** and can be replaced by better wording if time allows.

##### Quick Conversion Template:

```yaml
## Prefix with `DEPRECATED: ` for deprecated inputs
description: "DEPRECATED: {{old-description}}"
## `required` is always `false` for deprecated inputs
required: false
## Remove `default` to avoid implicit usage
# default:  // removed
## Simple warning without migration details
deprecationMessage: "'{{input_id}}' is deprecated and will be removed in a future release."
```
