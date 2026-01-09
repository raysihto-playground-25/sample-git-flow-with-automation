# Architecture Policy (Lightweight Modular Monolith for GitHub Actions)

Version: 1.4 (Strict Single-file Modules & Pure Logic Guard)  
Audience: Humans + AI code generator  
Scope: GitHub Action development (TypeScript)

## 0. Intent

Optimize for high **Locality of Change (>50% single-file probability)**. By keeping features in a single file (`mod.ts`) while enforcing strict logical "Section Contracts," we ensure rapid development without sacrificing testability or architectural integrity.

---

## 1. High-level Approach

1. **Mod-in-a-File**: Co-locate Action, App, Domain, and Infra in `modules/<feature>/mod.ts`.
2. **Functional Core (Domain)**: Pure functions only. No classes, no side effects.
3. **Section Contracts**: Explicitly mark sections within the file to prevent dependency leaking.
4. **Minimal Ports**: Define small, task-specific interfaces to isolate I/O.

---

## 2. Directory Layout

```
/src
  /modules
    /<feature>/
      mod.ts              (Logical Sections: Action -> App -> Domain -> Infra)
      index.ts            (Public API: Exports only necessary functions)
  /shared
    /kernel               (Pure: Results, Errors, Constants. All layers OK)
    /infra-shared         (Impure: @actions/* wrappers. ONLY Infra/Action OK)
  index.ts                (Execution Root: Triggers main.run())
  main.ts                 (Composition Root: Manual DI & Assembly)
/__tests__                (Tests: Mirrored structure of src)
```

---

## 3. Section Contracts (Inside mod.ts)

Every `mod.ts` must use comments to define boundaries and respect the following prohibitions:

### [SECTION: DOMAIN] (Pure Logic)

- **Allowed**: `type`, `interface`, `const`, `function`.
- **Prohibited**: `class`, `process.env`, `Date.now()`, `Math.random()`, `@actions/*`, and any I/O.
- **Dependency**: Pass all external needs (time, IDs) as function arguments.

### [SECTION: APP] (Orchestration & Ports)

- **Allowed**: Workflow logic, Result mapping, Port (interface) definitions.
- **Port Rule**: Keep ports small and specific (e.g., `IssueCreator` instead of `GitHubClient`). One use-case should ideally use < 3 ports.

### [SECTION: ACTION & INFRA] (Bridges & Adapters)

- **Action**: Maps `core.getInput` to domain types. Only this section calls `core.setOutput`.
- **Infra**: Implements the Ports defined in App using `@actions/*` or Node.js APIs.

---

## 4. Module Evolution (Splitting Triggers)

Move from a single `mod.ts` to separate files (`domain.ts`, `app.ts`, etc.) only when **ANY** of these qualitative thresholds are met:

1. **Complexity**: Use-cases > 3 OR Domain functions > 10.
2. **External Load**: Dependency Ports > 3 types (e.g., GitHub, FS, and Slack).
3. **Test Fatigue**: Test doubles/fakes in `__tests__` become too complex to manage in one file.
4. **Volume**: Total lines in `mod.ts` exceed 400.

---

## 5. Execution & Assembly

- **src/index.ts**: Calls `run()` in `main.ts`.
- **src/main.ts**:
  1. Reads environment/global state if necessary.
  2. Instantiates Infra adapters.
  3. Injects them into the Feature's Entry function.

---

## 6. AI Instructions (Strict Mandatory)

1. **Enforce Section Contracts**: When writing `mod.ts`, start by defining the `[SECTION]` headers.
2. **Domain is Pure Functions**: Never use `class` inside the Domain section. Use pure functions that take data and return data (or a `Result` type).
3. **No Global State in Domain**: Do not allow `process.env` or direct I/O calls to creep into the Domain section.
4. **Manual DI**: Always ensure that Infra implementations are passed into the App/Workflow functions from the outside (`main.ts`).
5. **Test Placement**: Always place tests in `/__tests__/modules/<feature>/mod.test.ts`.
