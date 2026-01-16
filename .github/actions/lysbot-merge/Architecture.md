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

Those responsibilities belong to the composition root.

### 7. Composition Root

The application has a single **composition root** where:

- All modules are wired together
- Concrete dependency choices are made (e.g., real vs fake GitHub client)
- The runtime object graph is constructed

Location:

- Typically in `src/main.ts` or the entry point
- May delegate to per-module configurators
- Contains no business logic

The composition root is the only place where production vs test configuration diverges.

## Testing Strategy

### 8. Construction-Time Test Doubles

Testing is achieved by constructing alternative object graphs, not by runtime mocking.

Approach:

- Tests call the same configurator as production code
- Tests provide test-specific dependencies as arguments
- No mocking libraries are used at runtime (e.g., no `vi.fn()` in production paths)

Example pattern:

```typescript
// Production
const module = configureModule(realGitHub, realLogger);

// Test
const module = configureModule(fakeGitHub, fakeLogger);
```

Benefits:

- Tests exercise real code paths
- No mocking library lock-in
- Refactoring is safer
- Tests are less brittle

### 9. Minimal Mocking Surface

Mocking should occur only at:

- External system boundaries (GitHub API, file system, network)
- Non-deterministic sources (time, randomness)

Internal application logic should not require mocking.

If internal mocking is needed, it indicates a design problem:

- Dependencies are not properly injected
- Responsibilities are not properly separated
- Module boundaries are incorrect

## Module Design Patterns

### 10. Configurator Pattern

Each module exports a configurator function:

```typescript
export function configureMyModule(dependency1: Dependency1, dependency2: Dependency2): MyModuleAPI {
  // Construct internal objects
  const impl = new MyModuleImpl(dependency1, dependency2);

  // Return public API
  return {
    doSomething: impl.doSomething.bind(impl),
  };
}
```

Key properties:

- Pure function (no side effects)
- Explicit dependencies as parameters
- Returns interface, not class
- Hides implementation details

### 11. Runner Pattern

For modules that perform top-level orchestration:

```typescript
export interface Runner {
  run(): Promise<void>;
}
```

The runner encapsulates:

- High-level workflow
- Error handling
- Logging and instrumentation

It does **not**:

- Contain business logic (delegates to other services)
- Manage its own dependencies (receives them via constructor)

## Architectural Constraints

### 12. No Circular Dependencies

Modules must form a directed acyclic graph (DAG).

Circular dependencies indicate:

- Responsibilities are not properly separated
- Module boundaries are incorrect
- Abstractions are missing

Solution: Extract shared concerns into a new module or interface.

### 13. One-Way Dependencies

High-level modules may depend on low-level modules.

Low-level modules must not depend on high-level modules.

Use dependency inversion (interfaces) when lower layers need to communicate upward.

### 14. Stable Dependencies Principle

A module should only depend on modules that are more stable than itself.

Stability indicators:

- Frequency of change
- Number of dependents
- Scope of responsibility

Violating this principle leads to cascading changes and fragility.

## Refactoring Guidelines

### 15. Module Extraction

Extract a new module when:

- A clear, independent responsibility emerges
- The responsibility has a stable boundary
- Multiple consumers would benefit from the abstraction

Do not extract a module for:

- Code organization alone
- Reducing file size
- Potential future reuse

### 16. Safe Refactoring Process

When refactoring:

1. Keep tests passing at each step
2. Refactor in small, incremental changes
3. Commit frequently
4. Extract interfaces before extracting implementations
5. Use the type system to guide refactoring

The architecture enables safe refactoring by:

- Separating interfaces from implementations
- Using explicit dependency injection
- Maintaining clear module boundaries

## Application to This Codebase

For this GitHub Action:

- Start with a single `action` module
- The module encapsulates all PR merge logic
- `main.ts` serves as the composition root
- Tests construct alternative dependency graphs
- External dependencies (GitHub API, Actions core) are injected

Future module candidates (if needed):

- GitHub client abstraction (if mocking becomes complex)
- Validation logic (if it becomes substantial)
- Notification/formatting (if it grows significantly)

Until those needs emerge, a single module is architecturally correct.
