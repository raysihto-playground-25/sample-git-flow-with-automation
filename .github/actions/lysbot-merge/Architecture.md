# Architecture Policy (Lightweight Modular Monolith for GitHub Actions)

**Version:** 2.0  
**Audience:** Humans + AI code generator  
**Scope:** Small to mid-scale TypeScript-based GitHub Action development

## 1. Intent

This policy prioritizes **High Locality of Change** and **Strict Logical Isolation**. By organizing feature logic into module directories while enforcing clear boundaries, the goal is to ensure >50% of feature changes occur within a single module without allowing infrastructure or shared utilities to erode the Domain core.

## 2. Architecture Overview

### Design Philosophy: Modular Monolith

The lysbot-merge action follows a **Modular Monolith** architecture pattern optimized for GitHub Actions:

- **Module-based organization**: Features encapsulated in `/modules` directory
- **Clear module boundaries** without microservices complexity
- **Strong encapsulation** through well-defined interfaces
- **Simple deployment** as a single bundled artifact
- **Future flexibility** to extract modules if needed

References:
- [Martin Fowler - MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)
- [Modular Monolith Architecture](https://zenn.dev/loglass/articles/d2ea268a7522be)

### Top-Level Dependency Injection

The architecture enforces **Pure DI (Dependency Injection)** at the composition root:

- `main.ts` acts as the **composition root** - ONLY DI and execution
- All I/O operations delegated to adapters
- Business logic functions receive all dependencies as parameters
- **No direct I/O in business logic** - all I/O handled at the boundary

## 3. Directory Layout & Roles

### 3.1 Project Structure

```
/src
  /modules
    /lysbot-merge-core        # Core merge automation module
      mod.ts                  # Module entry point (business logic)
      io-adapter.ts          # I/O adapter (GitHub Actions integration)
  /types                      # Shared types (allow-listed dependency)
    index.ts
  /constants                  # Shared constants (allow-listed dependency)
    index.ts
  /github-api                 # Infrastructure: GitHub API clients
    reactions.ts
    comments.ts
    pull-requests.ts
    reviews.ts
    commits.ts
    threads.ts
    permissions.ts
    merge.ts
  /validation                 # Infrastructure: Validation utilities
    command-parser.ts
    user-checks.ts
    pr-state.ts
    merge-checks.ts
  /merge-logic                # Infrastructure: Merge decision logic
    merge-method.ts
    commit-builder.ts
  /formatting                 # Infrastructure: Output formatting
    markdown.ts
  main.ts                     # Composition root (DI ONLY)
  action.ts                   # Re-export for backward compatibility
  index.ts                    # Entry point (unchanged)
```

### 3.2 Module Responsibilities

#### **`/modules/lysbot-merge-core/`** - Core Module

**Purpose**: Encapsulates the core merge automation business logic

**Files**:
- `mod.ts` - Module entry point containing `executeAction()` function
  - Orchestrates the entire merge workflow
  - Calls infrastructure functions
  - Returns action result
  - **Dependencies**: Can import from infrastructure directories (github-api, validation, merge-logic, formatting)
  
- `io-adapter.ts` - I/O Adapter
  - Handles all GitHub Actions I/O operations
  - Isolates `@actions/core` and `@actions/github` dependencies
  - Provides functions: `readConfig()`, `readToken()`, `readContext()`, `writeOutputs()`, `writeSummary()`, `logResult()`, `logError()`
  - **Dependencies**: Can import from types, formatting

**Rationale for Consolidation**:
- For this scale (796 lines → ~300 lines in mod.ts), a single `mod.ts` file provides optimal maintainability
- Splitting into smaller files would create navigation overhead without clarity benefits
- All merge logic is cohesive and changes together
- Easy to locate all business logic in one place

#### **`main.ts`** - Composition Root (PURE DI)

**Responsibilities** (ONLY):
1. Construct dependencies (Octokit, config, context)
2. Invoke the action function
3. Handle exceptions and log results

**Out-of-Scope** (delegated to io-adapter):
- ❌ Reading configuration (`core.getInput`)
- ❌ Constructing configuration objects
- ❌ Setting action outputs (`core.setOutput`)
- ❌ Building result emoji mapping
- ❌ Writing summaries
- ❌ Logging informational messages

**Allowed Operations**:
- ✅ Call `readToken()`, `readConfig()`, `readContext()` from io-adapter
- ✅ Call `createOctokit()` to construct Octokit instance
- ✅ Call `executeAction()` with dependencies
- ✅ Call `writeOutputs()`, `writeSummary()`, `logResult()` from io-adapter
- ✅ Handle exceptions with `logError()` from io-adapter

**Code Structure**:
```typescript
export async function run(): Promise<void> {
  try {
    // 1. Construct dependencies (DI)
    const token = readToken();
    const config = readConfig();
    const context = readContext();
    const octokit = createOctokit(token);

    // 2. Execute business logic
    const result = await executeAction(octokit, context, config);

    // 3. Delegate I/O operations
    writeOutputs(result);
    await writeSummary(result, context);
    logResult(result);
  } catch (error) {
    // 4. Handle exceptions
    logError(error);
  }
}
```

**File Size**: Target 20-30 lines (currently 35 lines)

#### **`index.ts`** - Entry Point (Unchanged)

- **Responsibility**: Minimal entry point that loads and executes `main.js`
- **Status**: Must remain unchanged per requirements

#### **Infrastructure Directories**

These directories contain reusable infrastructure components:

- **`/github-api/`** - GitHub API client functions (8 modules)
- **`/validation/`** - Validation utilities (4 modules)  
- **`/merge-logic/`** - Merge decision logic (2 modules)
- **`/formatting/`** - Output formatting (1 module)
- **`/types/`** - Shared TypeScript types
- **`/constants/`** - Constants, regexes, rules

**Dependencies**: Infrastructure can import from types and constants ONLY

## 4. Dependency Rules

### 4.1 Allow-List Only

Each layer may only import from explicitly allowed dependencies:

```
main.ts
  ↓ (can import)
  - modules/*/io-adapter.ts
  - modules/*/mod.ts

modules/*/mod.ts
  ↓ (can import)
  - github-api/*
  - validation/*
  - merge-logic/*
  - formatting/*
  - types/*
  - constants/*

modules/*/io-adapter.ts
  ↓ (can import)
  - types/*
  - formatting/*
  - @actions/core
  - @actions/github

Infrastructure (github-api, validation, merge-logic, formatting)
  ↓ (can import)
  - types/*
  - constants/*
```

### 4.2 Prohibited Dependencies

- ❌ Infrastructure MUST NOT import from modules
- ❌ main.ts MUST NOT import from infrastructure directly
- ❌ main.ts MUST NOT import @actions/core or @actions/github
- ❌ Business logic (mod.ts) MUST NOT import @actions/core or @actions/github

## 5. File Size Guidelines

To prevent excessive fragmentation:

- **Module entry point (mod.ts)**: 200-500 lines acceptable
  - Core business logic is cohesive
  - Splitting reduces locality of change
  
- **I/O Adapter**: 50-150 lines
  - Simple delegation functions
  
- **main.ts**: 20-40 lines
  - Pure DI only
  
- **Infrastructure files**: 50-200 lines each
  - Single responsibility
  - Reusable across features

**Rationale**: For this scale (~1500 LOC total), having 20+ micro-files creates navigation overhead. Module consolidation optimizes for:
1. Locality of change (most edits in one file)
2. Ease of understanding (see full feature in context)
3. Reduced mental overhead (fewer files to track)

## 6. Testing Strategy

### Test Structure

Tests mirror the module structure:

```
__tests__/
├── main.test.ts                    # Tests for main.ts (DI)
├── action.test.ts                  # Integration tests for core module
├── constants/
│   └── index.test.ts
├── github-api/
│   └── [future: API tests]
├── validation/
│   ├── command-parser.test.ts
│   ├── user-checks.test.ts
│   ├── pr-state.test.ts
│   └── merge-checks.test.ts
├── merge-logic/
│   ├── merge-method.test.ts
│   └── commit-builder.test.ts
└── formatting/
    └── markdown.test.ts
```

### Testing Approach

- **Unit tests**: Test infrastructure functions with mocked dependencies
- **Integration tests**: Test module's `executeAction()` with mocked GitHub API
- **Main tests**: Test `main.ts` orchestration with mocked io-adapter and module

## 7. Adding New Features

### When to Create a New Module

Create a new module when:
- Feature is >500 lines of business logic
- Feature has distinct I/O requirements
- Feature can be developed independently

### When to Extend Existing Module

Extend existing module when:
- Feature is <200 lines
- Feature shares >50% of dependencies
- Feature is tightly coupled to existing logic

### Example: Adding Approval Workflow Feature

```
/src/modules/approval-workflow/
  mod.ts              # Approval logic
  io-adapter.ts       # Approval-specific I/O (notifications, etc.)
```

Update `main.ts`:
```typescript
import { executeApprovalWorkflow } from './modules/approval-workflow/mod.js';

// In run():
if (config.enableApprovalWorkflow) {
  await executeApprovalWorkflow(octokit, context, config);
}
```

## 8. Migration from Old Structure

### What Changed

**Before** (Flat structure):
```
src/
├── main.ts          # DI + I/O + config construction  (74 lines)
├── action.ts        # Business logic                  (320 lines)
└── [infrastructure directories]
```

**After** (Modular structure):
```
src/
├── main.ts                               # Pure DI only (35 lines)
├── action.ts                             # Re-export     (1 line)
├── modules/lysbot-merge-core/
│   ├── mod.ts                           # Business logic (320 lines)
│   └── io-adapter.ts                    # I/O operations (95 lines)
└── [infrastructure directories]
```

### Benefits

1. **Thinner composition root**: main.ts reduced from 74 to 35 lines (53% reduction)
2. **Clear I/O boundary**: All @actions/* imports in io-adapter only
3. **Better testability**: Can test mod.ts without mocking @actions/core
4. **Explicit dependencies**: DI at top level makes all dependencies visible
5. **Module isolation**: Core logic in /modules, infrastructure separate

## 9. Maintaining the Structure

### Rules to Follow

1. **Keep main.ts thin**
   - ONLY DI and execution
   - NO business logic
   - NO I/O operations (delegate to io-adapter)
   - Target: <40 lines

2. **Use io-adapter for all I/O**
   - All `core.getInput()` calls
   - All `core.setOutput()` calls  
   - All `core.info()` / `core.setFailed()` calls
   - All `github.context` access

3. **Keep modules cohesive**
   - Module entry point (mod.ts) contains feature logic
   - Avoid splitting into micro-files (<50 lines)
   - Optimize for locality of change

4. **Respect dependency boundaries**
   - Infrastructure can't import from modules
   - Modules can import from infrastructure
   - main.ts only imports from modules

### Adding New Dependencies

1. Add to appropriate layer (infrastructure or module)
2. Pass as parameter from composition root
3. Update type definitions in `types/index.ts`
4. Mock in tests

## 10. Benefits of This Architecture

1. **Extreme DI purity**: main.ts is pure DI with zero business logic
2. **Clear I/O boundary**: All @actions/* dependencies isolated
3. **High locality of change**: Module changes contained to /modules directory
4. **Maintainability**: Right-sized files prevent fragmentation
5. **Testability**: Pure functions easy to test
6. **Type safety**: Strong TypeScript typing throughout
7. **Simplicity**: No complex frameworks, just functions and modules
8. **Scalability**: Easy to add new modules as features grow

## 11. Future Considerations

- If core module exceeds 1000 lines, consider splitting into sub-modules
- If new features emerge, create additional modules under `/modules`
- For shared business logic, create a `/modules/shared` module
- Keep watching for infrastructure bloat - refactor if needed
  - `ActionConfig`: Configuration from inputs
  - `EventContext`: GitHub event context data
  - `PullRequestData`: Normalized PR data
  - `CheckResult`: Individual check result
  - `MergeMethodResult`: Merge method decision
  - `ActionResult`: Final action result
  - `MergeOptions`: Parsed command options
  - `Octokit`: Octokit client type
  - `Review`, `ReviewsArray`: Review types

#### **4. `constants/index.ts`** (Constants and Rules)

- **Exports**: Constants, regex patterns, validation rules
  - `COMMAND_REGEX`: Command matching pattern
  - `VALID_FLAGS`: Allowed command flags
  - `TWEMOJI`: Emoji SVG constants
  - `VALID_AUTHOR_ASSOCIATIONS`: Allowed author associations
  - `VALID_PERMISSIONS`: Allowed permission levels
  - `CONVENTIONAL_COMMIT_TYPES`: Allowed commit types
  - `CONVENTIONAL_COMMIT_REGEX`: Conventional commit validation pattern

#### **5. `github-api/` modules** (GitHub API Interactions)

All functions in this module accept `Octokit` as the first parameter and return promises.

- **`reactions.ts`**:
  - `addReaction()`: Add reaction to comment
- **`comments.ts`**:
  - `postComment()`: Post comment to PR
- **`pull-requests.ts`**:
  - `fetchPullRequestData()`: Get and normalize PR data
- **`reviews.ts`**:
  - `fetchApprovedReviews()`: Get approved reviews
  - `dismissReview()`: Dismiss a review
- **`commits.ts`**:
  - `fetchPullRequestCommits()`: Get PR commits
- **`threads.ts`**:
  - `countUnresolvedThreads()`: Count unresolved review threads via GraphQL
- **`permissions.ts`**:
  - `getCollaboratorPermission()`: Get user's permission level
- **`merge.ts`**:
  - `mergePullRequest()`: Execute merge operation

#### **6. `validation/` modules** (Validation and Checking)

Pure functions that validate data and return check results.

- **`command-parser.ts`**:
  - `parseCommand()`: Parse command and flags
  - `isCommand()`: Check if text is a valid command
- **`user-checks.ts`**:
  - `isBot()`: Check if user is a bot
  - `hasValidAuthorAssociation()`: Check author association
  - `hasValidPermission()`: Check permission level
- **`pr-state.ts`**:
  - `validatePRState()`: Validate PR is ready (open, not draft, not locked)
  - `getMergeableStateDescription()`: Get human-readable mergeable state
- **`merge-checks.ts`**:
  - `isConventionalCommitTitle()`: Validate conventional commit format

#### **7. `merge-logic/` modules** (Merge Decision Logic)

Pure functions that determine merge strategy and construct commit messages.

- **`merge-method.ts`**:
  - `determineMergeMethod()`: Determine merge method based on branch patterns
- **`commit-builder.ts`**:
  - `buildCommitTitle()`: Build commit title
  - `buildCommitMessage()`: Build commit message with co-authors

#### **8. `formatting/` modules** (Markdown Formatting)

Pure functions for formatting markdown output.

- **`markdown.ts`**:
  - `buildCheckResultsMarkdown()`: Format check results as markdown list
  - `buildSummaryMarkdown()`: Build action summary markdown table

#### **9. `action.ts`** (Main Action Orchestration)

- **Exports**: `executeAction()` function
- **Responsibility**:
  - Orchestrate the entire merge workflow
  - Call validation functions
  - Call GitHub API functions
  - Make merge decisions
  - Return action result
- **Key Principle**: Pure orchestration - receives all dependencies as parameters
- **No I/O**: Does not call `core.getInput()` or `core.setOutput()`

### Utility Functions

- **`waitBeforeRetryMs()`**: Promise-based delay (in `action.ts`)

## Design Principles

### 1. Separation of Concerns

Each module has a single, well-defined responsibility:

- **API modules**: GitHub API interactions only
- **Validation modules**: Data validation and checking only
- **Merge logic modules**: Merge decision logic only
- **Formatting modules**: Output formatting only
- **Main/Action**: Orchestration only

### 2. Dependency Flow

```
index.ts → main.ts → action.ts → [validation, github-api, merge-logic, formatting]
                                       ↓
                                  [types, constants]
```

- Top-level (`main.ts`) constructs dependencies
- Mid-level (`action.ts`) orchestrates workflow
- Low-level modules are pure functions with explicit dependencies

### 3. Pure Functions Where Possible

- Most functions are pure: given the same inputs, they return the same outputs
- Side effects (API calls, I/O) are isolated in specific modules
- Exceptions: `github-api/` modules (API calls), `main.ts` (I/O)

### 4. Explicit Dependencies

- No hidden dependencies or global state
- All dependencies passed as function parameters
- Makes testing and reasoning easier

### 5. Type Safety

- All modules export and use TypeScript types
- Strict type checking enabled
- Interfaces over implementations

## Testing Strategy

### Test Structure

Tests mirror the `src/` directory structure:

```
__tests__/
├── main.test.ts                    # Tests for main.ts
├── types/
│   └── index.test.ts              # Type tests if needed
├── constants/
│   └── index.test.ts              # Constant validation tests
├── github-api/
│   ├── reactions.test.ts
│   ├── comments.test.ts
│   ├── pull-requests.test.ts
│   ├── reviews.test.ts
│   ├── commits.test.ts
│   ├── threads.test.ts
│   ├── permissions.test.ts
│   └── merge.test.ts
├── validation/
│   ├── command-parser.test.ts
│   ├── user-checks.test.ts
│   ├── pr-state.test.ts
│   └── merge-checks.test.ts
├── merge-logic/
│   ├── merge-method.test.ts
│   └── commit-builder.test.ts
├── formatting/
│   └── markdown.test.ts
└── action.test.ts                 # Integration tests for action.ts
```

### Testing Approach

- **Unit tests**: Test individual functions with mocked dependencies
- **Integration tests**: Test `action.ts` with mocked GitHub API
- **Main tests**: Test `main.ts` orchestration with mocked action function

## Migration from Old Structure

### Old Structure

```
src/
├── index.ts
├── main.ts
└── tmp_untitled_3.ts  (all logic in one file, ~796 lines)
```

### Changes Made

1. **Split `tmp_untitled_3.ts`** into logical modules
2. **Refactored `main.ts`** to be thin (only DI and I/O)
3. **Preserved `index.ts`** unchanged (requirement)
4. **Created modular structure** following separation of concerns
5. **Updated tests** to match new structure

## Maintaining the lysbot-merge Structure

When modifying lysbot-merge, follow these principles:

### Adding New Features

1. Identify which module the feature belongs to:
   - GitHub API interaction? → `github-api/`
   - Validation logic? → `validation/`
   - Merge decision? → `merge-logic/`
   - Output formatting? → `formatting/`
2. Create new module file if needed
3. Export pure functions with explicit dependencies
4. Update `main.ts` only if new inputs are needed
5. Update `action.ts` to orchestrate new feature

### Modifying Existing Features

1. Locate the appropriate module
2. Modify the pure function
3. Update tests in corresponding test file
4. Ensure `main.ts` remains thin (no logic added)

### Adding New Dependencies

1. Add to appropriate module
2. Pass as parameter from `main.ts`
3. Update type definitions in `types/index.ts`
4. Mock in tests

### Rules to Follow

- **Never add business logic to `main.ts`** - only DI and I/O
- **Never add I/O to business logic modules** - receive data as parameters
- **Always use explicit dependencies** - no hidden globals
- **Keep modules small** - split when a file exceeds ~200 lines
- **Test each module independently** - one test file per source file

## Benefits of This Architecture

1. **Maintainability**: Clear module boundaries make changes easier
2. **Testability**: Pure functions are easy to test
3. **Readability**: Each file has a clear purpose
4. **Flexibility**: Modules can be refactored independently
5. **Scalability**: Easy to add new features without affecting existing code
6. **Type Safety**: Strong TypeScript typing throughout
7. **Simplicity**: No complex frameworks or patterns - just functions and modules

## Future Considerations

- If the codebase grows significantly (>5000 lines), consider:
  - Extracting core logic to a separate package
  - Adding more sophisticated DI framework
  - Splitting into multiple actions
- For now, the Modular Monolith is optimal for this size and use case
