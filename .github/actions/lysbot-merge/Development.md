# Development

To work on the lysbot-merge action:

```bash
cd .github/actions/lysbot-merge
npm ci
npm run test:coverage  # Run unit tests with coverage
npm run format:write   # Run formatter (format:check for checking only)
npm run lint           # Run ESLint
npm run bundle         # Bundle with ncc
```

## Code Structure

The codebase has been modularized for better maintainability and testability, following the **Single Responsibility Principle**. Each module focuses on a specific concern:

### Current File Structure

```
src/
├── action.ts         # Core business logic (executeAction, buildSummaryMarkdown)
├── constants.ts      # Configuration constants and regex patterns
├── github-api.ts     # GitHub API interaction wrappers
├── main.ts           # GitHub Actions runtime integration (tested with mocks)
├── options-parser.ts # YAML options parser with zod validation
├── types.ts          # Type definitions and interfaces
└── validation.ts     # Pure validation and business logic functions
```

**Module Responsibilities:**

1. **`action.ts`** (testable business logic)
   - Main `executeAction()` function that orchestrates the merge flow
   - Pure `buildSummaryMarkdown()` function for generating summaries
   - All business logic that can be tested without GitHub Actions runtime
   - Depends on: types, validation, github-api

2. **`constants.ts`**
   - Configuration constants (regex patterns, valid flags, emoji)
   - Immutable reference data
   - No dependencies on other modules except types

3. **`github-api.ts`**
   - All functions that interact with GitHub API
   - API calls, data fetching, mutations (reactions, comments, merges)
   - Depends on: types

4. **`main.ts`** (GitHub Actions runtime integration - tested with mocks)
   - Integration layer with GitHub Actions runtime
   - Reads inputs from GitHub Actions environment (`core.getInput`)
   - Handles deprecated input parameters with warnings
   - Parses options YAML with deprecated input fallbacks
   - Constructs context from GitHub runtime (`github.context`, `process.env`)
   - Delegates to `action.ts` for merge business logic
   - Writes outputs and summaries to GitHub Actions (`core.setOutput`, `core.summary`)
   - Tested using vitest mocks to verify input handling, options parsing, and error handling
   - Contains conditional logic for backward compatibility with deprecated inputs

5. **`options-parser.ts`** (YAML parsing and validation)
   - Parses YAML options input using `yaml` library
   - Validates option types using `zod` schema
   - Provides default values for missing options
   - Pure functions with comprehensive test coverage
   - Depends on: types, yaml (for parsing), zod (for validation)

6. **`types.ts`**
   - All TypeScript type definitions and interfaces
   - No runtime logic, purely type declarations
   - Imported by all other modules as needed

7. **`validation.ts`**
   - Pure functions for validation and business logic
   - Command parsing, permission checks, merge method determination
   - Easily testable with no side effects
   - Depends on: types, constants

### Refactoring Principles

The refactoring follows these principles to maintain code quality:

1. **Single Responsibility Principle (SRP)**
   - Each module has one clear reason to change
   - Pure logic is separated from I/O operations
   - Business rules are isolated from infrastructure

2. **Testing Strategy**
   - GitHub Actions runtime integration code in main.ts is tested using vitest mocks
   - All merge business logic is extracted to action.ts for comprehensive testing
   - This separation maximizes maintainability and test coverage

3. **Dependency Direction**
   - Dependencies flow inward: infrastructure &#x279C; orchestration &#x279C; logic &#x279C; types
   - No circular dependencies
   - Pure modules (validation) don't depend on I/O modules (github-api)

4. **Testability**
   - Pure functions are in separate modules for easy unit testing
   - API interactions are grouped for easy mocking
   - Orchestration logic in action.ts can be tested with mocked dependencies
   - Runtime integration in main.ts is tested using vitest mocks for the GitHub Actions environment

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

### Future Refactoring Guidelines

When adding new features or making changes, follow these guidelines:

1. **When to Create a New Module**
   - When a logical grouping exceeds ~300 lines
   - When a distinct new responsibility emerges (e.g., notification system, metrics)
   - When multiple files start duplicating similar code

2. **When NOT to Split Further**
   - Don't create modules with fewer than ~50 lines
   - Don't split functions that are tightly coupled (modify together frequently)
   - Don't create "utils" grab-bags without clear responsibility

3. **Maintaining the Structure**
   - Keep types centralized in `types.ts`
   - Keep constants centralized in `constants.ts`
   - Add new pure functions to `validation.ts` or create domain-specific validation modules
   - Add new API calls to `github-api.ts` or create endpoint-specific modules
   - Keep testable orchestration in `action.ts` focused on business logic
   - Keep main.ts focused on GitHub Actions runtime integration with tested backward compatibility logic

4. **Testing Strategy**
   - All business logic MUST be testable and have tests
   - main.ts contains runtime integration logic tested with vitest mocks
   - Merge business logic should be in action.ts for comprehensive testing without mocks
   - Target 80%+ coverage for all modules (action.ts, validation.ts, main.ts, etc.)

5. **Breaking Changes**
   - Update tests when splitting modules
   - Update README.md to reflect structural changes
   - Document architectural decisions in commit messages

## Input Handling Guideline for GitHub Actions

Defines rules for writing `description` fields for inputs in GitHub Actions to ensure clarity, consistency, and quick recognition of input status.

### Mandatory & Permanent Rules

Apply to **all inputs without exception** and must be followed permanently.

> [!IMPORTANT]
> Prefixes `DEPRECATED: ` and `OPTIONAL: ` in `description` are **mandatory and permanent** for clarity and consistency.

#### 1. `DEPRECATED: ` Prefix
- **Rule:**
    - Add `DEPRECATED: ` (including one trailing space) at the beginning of `description` for all deprecated inputs.
    - Do not prepend `OPTIONAL: ` redundantly.
- **Purpose:**
    - Indicate non-recommended usage at first glance, regardless of runtime warnings.

#### 2. `OPTIONAL: ` Prefix
- **Rule:**
    - Add `OPTIONAL: ` (including one trailing space) at the beginning of `description` for all inputs where `required: false`.
    - Do not apply this prefix to deprecated inputs.
- **Purpose:**
    - Make it immediately clear that the input is optional, even outside the YAML context.

##### Example:
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

### Temporary & Emergency Measures (Quick Fix)

Provide quick mechanical steps for urgent situations when detailed consideration is not possible.

> [!NOTE]
> Use these steps only when there is no time for detailed review.
> They are **not mandatory** and can be replaced by better wording if time allows.

#### Quick Conversion Template:
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

# Testing

This action uses **Vitest** for unit testing. The test suite focuses on testing pure logic functions and mocking GitHub API interactions for isolation.

| Test Type             | Status             | Description                                                            |
| --------------------- | ------------------ | ---------------------------------------------------------------------- |
| **Unit Tests**        | ✅ Implemented     | Covers command parsing, permissions, merge logic, and API interactions |
| **Integration Tests** | ❌ Not implemented | Would test GitHub API interactions with real tokens                    |
| **E2E Tests**         | ❌ Not implemented | Would test full workflow execution on real PRs                         |

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```
