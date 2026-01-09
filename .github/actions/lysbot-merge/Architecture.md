# Architecture Policy (Lightweight Modular Monolith for GitHub Actions)

Version: 1.2 (Strict Isolation & Scalable Structure)
Audience: Humans + AI code generator
Scope: GitHub Action development (TypeScript)

## 0. Intent

Optimize for stateless, short-lived CLI tools (GitHub Actions). The primary goal is to isolate business logic from the GitHub Toolkit (`@actions/*`) to ensure local testability and prevent "dependency rot" where infrastructure details leak into the core.

---

## 1. High-level Approach

1.  **Functional Core, Imperative Shell**: Keep business rules pure; keep I/O at the absolute edges.
2.  **Strict Layering**: Enforce clear boundaries between Action entry points, Orchestration, and Domain logic.
3.  **Progressive Granularity**: Start with flat files within a module; evolve into directories as complexity grows.
4.  **Zero-DI Container**: Use manual constructor/function injection (Pure DI).

---

## 2. Directory Layout & Roles

### 2.1 Top-level Structure

```
/src
  /modules
    /<feature>/           (Feature-based module)
      action.ts           (Entry: Maps inputs/outputs, calls App/Domain)
      app.ts              (Orchestration: Workflows & Port definitions)
      domain.ts           (Logic: Pure business rules & entities)
      infra.ts            (Adapters: Octokit/FS implementations)
      index.ts            (Public API for the module)
  /shared
    /kernel               (Pure: Result types, Errors, Constants. All layers OK)
    /infra-shared         (Impure: @actions/* wrappers. ONLY Infra/Action layers OK)
/tests
  /doubles                (Fakes/Mocks for Octokit, Context, and FS)
/main.ts                  (Composition Root: Assembles dependencies and runs)
```

_Note: As a feature grows, files like `domain.ts` can be promoted to directories (e.g., `domain/`)._

---

## 3. Strict Boundary Rules

### 3.1 Dependency Inversion

- **Domain/App**: Must NEVER import from `@actions/*` or `shared/infra-shared`.
- **Infra**: May only import from `app` (to implement ports) or `shared/kernel`. It must not import internal domain entities directly; use plain interfaces/contracts if needed.

### 3.2 Public API

- Other modules must ONLY import from `modules/<feature>/index.ts`. Deep imports into internal files are forbidden.

---

## 4. Responsibility Boundaries

### 4.1 Action Layer (`action.ts`)

- Responsible for parsing `core.getInput` and calling `core.setOutput/setFailed`.
- Acts as a translator between GitHub-specific strings and Domain-friendly types (e.g., converting a comma-separated string to a `string[]`).

### 4.2 Composition Root (`main.ts`)

- Responsible for **wiring**. It instantiates `infra` adapters and passes them to the `action` or `app` layers.
- Should remain thin: "Initialize, Inject, and Run."

---

## 5. External Dependencies (Ports & Adapters)

- **Define Ports in App**: All external side effects (Octokit, FS, Clock) must have an interface defined in `app.ts` (or `app/ports.ts`).
- **Implement in Infra**: Concrete implementations reside in `infra.ts`.
- **No Direct Octokit**: Do not pass the `Octokit` instance into Domain/App. Pass an interface that performs specific actions (e.g., `IssueRepository`).

---

## 6. Testing Strategy

1.  **Domain/App (Unit)**: 100% pure TS. Use **Fakes** (not mocks) for infra ports.
2.  **Action (Smoke)**: Verify input-to-output mapping.
3.  **No Mocking @actions/core**: Design the code so that the logic is independent of the Toolkit's global state.

---

## 7. AI Instructions (Mandatory)

1.  **Dependency Check**: Before adding an import, verify it doesn't violate the "Domain is Pure" rule. No `@actions/*` in `domain.ts` or `app.ts`.
2.  **Prefer Fakes**: When generating tests, implement a simple in-memory version of the infra interface instead of using complex mocking frameworks.
3.  **Flat to Deep**: Start with `domain.ts`, `infra.ts`, etc., within the module folder. Only suggest splitting into sub-directories if the file exceeds 200-300 lines.
4.  **Centralize Inputs**: Ensure `core.getInput` is ONLY called within `action.ts` or `main.ts`.
5.  **Result Type**: Always return a `Result<T, E>` from App/Domain logic instead of throwing exceptions for business failures.
