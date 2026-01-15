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

---

## Architectural Goals

The architecture is designed to achieve the following goals:

- Clear and enforceable module boundaries
- Strong encapsulation of implementation details
- Explicit and predictable dependency relationships
- High testability through construction-time dependency substitution
- Refactorability without cascading changes
- Suitability for small, focused TypeScript applications (e.g. GitHub Actions)

---

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

---

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

---

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

---

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

---

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

---

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

This separation ensures that modules remain:

- Internally coherent
- Externally composable
- Testable through dependency substitution

---

### 7. Composition Root

The application has a single composition root.

The composition root:

- Wires modules together
- Supplies external or environment-dependent dependencies
- Defines the final application behavior

All application-level decisions occur here.

---

## Testability as an Architectural Property

### 8. Testability Without Runtime Mocking

This architecture explicitly requires that:

- All behavior can be tested **without runtime mocking**
- Dependencies can be substituted at construction time
- Tests rely on explicit dependency injection, not interception

This is not a testing guideline—it is an architectural constraint.

Implications:

- External dependencies must be expressed as interfaces
- Business logic must depend only on abstractions
- The same construction mechanisms used in production must be usable in tests

If a component cannot be tested without mocking runtime behavior, the architecture is considered violated.

---

## Example (Illustrative Only)

The following example demonstrates how these principles may be applied.

This example:

- Is intentionally minimal
- Exists solely to illustrate the concepts
- Does not prescribe mandatory structure or naming

Actual implementations may simplify, inline, or restructure as appropriate, provided the architectural principles are preserved.

(Example code omitted here for brevity in this summary.)

---

## Summary of Architectural Rules

- Modules are defined by business or user value
- A single module is preferred unless clear value boundaries exist
- Each module has one explicit public entry point
- Implementation details remain internal
- Public APIs expose contracts, not implementations
- Dependencies are injected explicitly (Pure DI)
- Object creation is separated from object usage
- The system must be testable without runtime mocking

These rules define the architectural foundation of the system and must remain stable even as implementations evolve.
