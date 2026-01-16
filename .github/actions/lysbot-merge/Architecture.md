# Architecture Guidelines

## Purpose and Scope

This document defines the **architectural principles** of our TypeScript application.

Its purpose is to describe:

- How responsibilities are structured
- How dependencies are managed
- How module boundaries are defined and enforced
- What architectural properties the system must maintain over time

This document intentionally **does not** prescribe:

- Concrete implementation techniques
- File-by-file coding rules
- Testing frameworks, tools, or directory layouts

Those belong to separate implementation or testing guides.

However, this architecture **explicitly requires** that the system be designed in a way that enables **testing without runtime mocking**, as an architectural property.

## Architectural Goals

The architecture is designed to achieve the following goals:

- Clear and enforceable module boundaries
- Strong encapsulation of implementation details
- Explicit and predictable dependency relationships
- High testability through construction-time dependency substitution
- Refactorability without cascading changes
- Suitability for small, focused TypeScript applications (e.g. GitHub Actions)

## Core Architectural Principles

### 1. Value-Oriented Module Boundaries

Modules are defined by **business or user-facing value**, not by technical or implementation concerns.

A module represents:

- A cohesive responsibility
- A capability that can be explained independently
- A unit of behavior that delivers value to the user

Valid questions when defining a module boundary include:

- "What does this do for the user?"
- "What responsibility does this code own?"

Modules **must not** be created based on:

- Technical layers (API / service / util)
- Reuse convenience
- File size or organizational preference
- Implementation details that may change

### 2. Prefer a Single Module by Default

For many TypeScript applications—especially GitHub Actions—the system often has:

- A single, narrow user-facing responsibility
- A limited lifespan or scope
- No independent business sub-capabilities

In such cases, the **architecturally correct choice is a single module**.

Key implications:

- Start with one module
- Use internal structure for encapsulation
- Introduce additional modules **only** when a clearly distinct business responsibility emerges

Module proliferation requires justification; a single-module architecture does not.

### 3. Explicit Encapsulation via Module Structure

Each module is structured as follows:

- The module root defines the boundary
- Only one public entry point exists
- All implementation details remain internal

```
src/modules/{module-name}/
  ├── index.ts        # Public API (the boundary)
  └── internal/       # Non-public implementation
```

Rules:

- Only `index.ts` may be imported by external code
- Files under `internal/` must not be imported outside the module
- Internal structure may change freely without affecting consumers

This enforces architectural boundaries at the code level.

### 4. Public API as a Stable Contract

The public API of a module represents a **contract**, not an implementation.

Accordingly:

- Public exports should consist primarily of **interfaces and types**
- Concrete implementations must remain internal
- Consumers depend on behavior contracts, not implementations

Rationale:

- Interfaces express intent and stability
- Implementations are expected to change
- This separation enables safe refactoring and substitution

A type or interface should be exported only if:

- It represents a stable concept
- It is meaningful to consumers
- It defines behavior or data shape, not construction details

## Dependency Management

### 5. Pure Dependency Injection (Pure DI)

The architecture follows **Pure Dependency Injection**.

This means:

- All dependencies are provided explicitly
- No service locator or global container is used
- Object creation is separated from object usage

Concretely:

- `new` is allowed only in:
  - Module configurators
  - The application composition root
- Business logic must not instantiate its own dependencies
- Side effects and I/O must be abstracted behind interfaces

Pure DI is an architectural rule, not an implementation detail.

### 6. Configurator Responsibility

Each module exposes a configurator function.

The configurator is responsible for:

- Constructing the module's internal dependency graph
- Selecting concrete implementations for internal use
- Returning the module's public API shape

The configurator is **not** responsible for:

- Environment-specific decisions (production vs test)
- Application-wide policy
- Cross-module orchestration

Those responsibilities belong to the composition root (e.g., `main.ts`).

### 7. Interfaces for External Dependencies

When a module depends on external systems (e.g., GitHub API, file system, network):

- Define an interface representing the required operations
- Accept the interface as a parameter to the configurator
- Use concrete implementations in production
- Use test doubles (fakes, stubs) in tests

This enables:

- Testing without mocking frameworks
- Clear documentation of dependencies
- Flexibility to swap implementations

### 8. Composition Root Responsibility

The composition root (typically `main.ts` or application entry point):

- Is the only place where concrete dependencies are wired together
- Creates all top-level objects
- Calls configurators with appropriate dependencies
- Initiates the application flow

The composition root may:

- Read environment variables
- Construct external clients (e.g., Octokit)
- Pass these to configurators

The composition root should **not**:

- Contain business logic
- Make decisions about merge rules or validation
- Duplicate module responsibilities

## Module Public API Design

### 9. Export Contracts, Not Implementations

Each module's `index.ts` should export:

- Interfaces defining the module's capabilities
- Type definitions consumers need to interact with the module
- The configurator function

Each module's `index.ts` should **not** export:

- Concrete classes (unless they are DTOs or value objects)
- Implementation functions
- Internal utilities

### 10. Runner Pattern for Execution

When a module represents an executable operation (e.g., "run the merge action"), use a **runner interface**:

```typescript
export interface ActionRunner {
  run(): Promise<void>;
}
```

This:

- Provides a clear entry point
- Abstracts the execution from the caller
- Enables testing via substitution

The configurator returns an object implementing the runner interface.

### 11. Self-Contained Module Configuration

Configurators should accept all required dependencies as parameters.

Example:

```typescript
export function configureActionModule(core: CoreDependencies, github: GitHubDependencies): ActionModule {
  // Wire internal dependencies
  // Return public API
}
```

This ensures:

- Dependencies are explicit and visible
- Modules can be tested in isolation
- No hidden global state

## Testing Strategy

### 12. Test Through Public API

Tests should:

- Import only the module's public API (`index.ts`)
- Use the configurator to construct the module
- Provide test doubles for external dependencies
- Verify behavior through the public interface

Tests should **not**:

- Import internal files
- Use mocking frameworks to replace internal functions
- Depend on implementation details

### 13. Test Doubles Over Mocks

Prefer **test doubles** (fakes, stubs, spies) over mocking frameworks.

Rationale:

- Test doubles are explicit and reusable
- They don't require runtime magic
- They can be type-checked
- They document expected behavior

Example:

```typescript
// Good: explicit test double
const fakeGitHubApi: GitHubApi = {
  async getPullRequest() {
    return {
      /* test data */
    };
  },
};

// Avoid: runtime mocking
// vi.mock('./github-api');
```

### 14. Test Coverage Goals

Maintain high test coverage (90%+) through:

- Unit tests for pure functions
- Integration tests for module behavior
- Acceptance tests for end-to-end flows

Coverage should be measured at the module level, not file level.

## Implementation Guidelines

### 15. Keep Modules Cohesive

Each module should have a single, clear purpose.

If a module grows to handle multiple unrelated responsibilities:

- Consider splitting into multiple modules
- Ensure the split is value-oriented (not technical)

### 16. Avoid Premature Abstraction

Do not create interfaces or modules "just in case".

Add abstractions when:

- Multiple implementations exist or are planned
- Testing requires substitution
- The boundary represents a stable concept

### 17. Refactoring Within Modules

Internal structure can change freely without architectural approval, as long as:

- The public API remains stable
- Tests continue to pass
- Module boundaries are respected

This enables continuous improvement without architectural decay.

## Summary

This architecture prioritizes:

1. **Value-oriented module boundaries** over technical layering
2. **Single module by default** over premature modularization
3. **Pure dependency injection** over service locators or globals
4. **Interfaces for dependencies** over concrete coupling
5. **Test doubles** over runtime mocking
6. **Explicit composition** over implicit wiring

Following these principles results in:

- Clear module boundaries
- High testability
- Low coupling
- Easy refactoring
- Maintainable code over time
