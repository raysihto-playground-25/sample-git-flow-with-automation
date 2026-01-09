# Architecture Policy (Lightweight Modular Monolith for GitHub Actions)

Version: 1.6  
Audience: Humans + AI code generator  
Scope: Small to mid-scale TypeScript-based GitHub Action development

## 1. Intent

This policy prioritizes **High Locality of Change** and **Strict Logical Isolation**. By centralizing feature logic into a single-file module (`mod.ts`) while enforcing an "Allow-list only" dependency rule, the goal is to ensure >50% of feature changes occur within a single file without allowing infrastructure or shared utilities to erode the Domain core.

---

## 2. Directory Layout & Roles

### 2.1 Project Structure

```
/src
  /modules
    /<feature>/
      mod.ts              (Logical Sections: Action -> App -> Domain -> Infra)
      index.ts            (Public API: Strictly exports only entry functions/types)
  /shared
    /kernel               (Vocabulary Base: Result, Error, ID types. No logic. Universal access)
    /lib                  (Toolbox: Vocabulary-free utilities e.g. string/date-format. No Domain terms)
    /infra-shared         (Global Shell: Common @actions/* wrappers. Access: Action/Infra only)
  index.ts                (Entry Point: Minimal trigger that calls main.run())
  main.ts                 (Composition Root: Manual DI and Assembly)
/__tests__                (Tests)
  /doubles                (Primitive Fakes: Generic stubs like In-memory storage. No Port logic)
  /modules
    /<feature>/
      mod.test.ts         (Feature Tests: Contains port-specific fakes)
```

---

## 3. Section Contracts (Inside mod.ts)

Boundaries in `mod.ts` are enforced via an **Allow-list approach** to ensure the integrity of the Functional Core.

### [SECTION: DOMAIN] (Functional Core)

- **Role**: Business rules and core data shapes.
- **Allowed**: `type`, `interface`, `const`, `function`. **Strictly no `class` usage.**
- **Prohibitions**: No `process.env`, `Date.now()`, `@actions/*`, or direct I/O.
- **Dependency**: May only import from `shared/kernel` and `shared/lib`.

### [SECTION: APP] (Orchestration & Contracts)

- **Role**: Workflow coordination and Port definitions.
- **Dependency**: May import from `Domain`, `shared/kernel`, and `shared/lib`.

### [SECTION: ACTION & INFRA] (Imperative Shell)

- **Action**: Maps GitHub context to App/Domain types. The only layer authorized to call `core.setOutput`.
- **Infra**: Implements Ports.
- **Dependency**: Strictly limited to **App Ports** and **App/Domain Contracts (Interfaces)**. Must not access internal Domain logic or non-contract types.

---

## 4. Reuse vs. Locality Policy

### 4.1 Locality First (Default)

All new logic, utilities, and fakes must originate inside `mod.ts` or `mod.test.ts`.

### 4.2 Promotion to Shared

Logic may be promoted to `shared/` or `__tests__/doubles/` only if:

1. **Redundancy**: The exact same logic is required by 2 or more features.
2. **Vocabulary Check**: For `shared/lib`, the code must be free of any Domain-specific vocabulary.
3. **Primitive Check**: For `__tests__/doubles`, only low-level primitives (e.g., generic HTTP mock) are shared. Port-specific fakes must remain in the feature's test file.

---

## 5. Structural Encapsulation

- **Encapsulation**: `mod.ts` is private. External components (including `main.ts`) must only import from `index.ts`.
- **Minimal Ports**: Ports defined in App must be the smallest possible interface required for the specific use case.

---

## 6. Evolution Triggers

A feature's sections should be promoted to separate files within the feature folder only when:

- **Functional Growth**: Use-cases > 3 OR Domain functions > 10.
- **Dependency Complexity**: Required I/O Ports > 3.
- **Volume**: The `mod.ts` file exceeds 400 lines.

---

## 7. AI Instructions (Mandatory)

1. **Strict Purity**: Maintain the Domain section as a collection of pure functions. Reject any side-effectful global state or classes.
2. **Vocabulary Enforcement**: Do not place any function containing domain-specific terms into `shared/lib`.
3. **Allow-list Dependency**: When writing the Infra section, strictly limit access to the App's Ports and Contracts.
4. **Localize Change**: Fulfill requests by modifying only the target `mod.ts` whenever possible.
5. **Manual DI**: Perform all dependency assembly and injection in `src/main.ts`.
