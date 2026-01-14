# Architecture.md

## 1. Overview

This project follows a **Lightweight Modulith** architecture. It prioritizes high testability and maintainability through the **Dependency Inversion Principle (DIP)** while avoiding the excessive boilerplate of full-scale frameworks.

## 2. Core Principles

- **Module-Based Separation**: Organize code by domain/feature (Modules). Avoid generic layers like "domain" or "usecases".
- **Dependency Inversion (DIP)**: High-level logic (Actions) must depend on abstractions (Interfaces), not on low-level implementation (Infrastructure).
- **Extremely Thin Entry Point**: `index.ts` and `main.ts` are strictly for orchestration and dependency injection.
- **Minimalist Terminology**: Use `action` for logic and `infra` for I/O. Do not use "adapters" or "ports" to keep it lightweight.

---

## 3. Directory Structure

```text
project-root/
├── src/
│   ├── index.ts              # Entry point: Env setup & calling main.ts
│   ├── main.ts               # Composition Root: DI wiring & orchestration
│   ├── common/               # Shared utilities and shared types
│   └── modules/
│       └── [module_name]/    # e.g., "user", "order"
│           ├── [name].action.ts      # Pure business logic (The entry to the feature)
│           ├── [name].repository.ts  # Interfaces for external I/O
│           ├── [name].service.ts     # (Optional) Reusable logic shared by actions
│           └── infra/                # Concrete implementations (e.g., Database, API)
│               └── [name].infra.ts
└── __tests__/                # Mirroring src/ directory structure
    ├── main.test.ts
    └── modules/
        └── [module_name]/
            ├── [name].action.test.ts
            ├── [name].repository.test.ts
            ├── [name].service.test.ts
            └── infra/
                └── [name].infra.test.ts
```

---

## 4. Layer Responsibilities

### 4.1. Action Layer (`*.action.ts`)

- Represents a single operation or command.
- **Must depend on Interfaces** for any I/O operations.
- **No I/O implementation allowed**.

### 4.2. Infrastructure Layer (`infra/`)

- Contains concrete implementations of interfaces defined by the module (e.g., DB access, HTTP clients).
- This layer is hidden from the Action's business logic.

---

## 5. Dependency Rule

1.  **Strict DIP**: Actions only import Interfaces. They never import from `infra/`.
2.  **DI Pattern**: Use Constructor Injection or Function Injection.
3.  **Composition Root**: Only `main.ts` is allowed to import from `infra/` to wire dependencies.

---

## 6. Testing Strategy

- **Unit Tests (`__tests__/*.action.test.ts`)**: Focus on Actions using Mocks. Aim for 100% logic coverage.
- **Integration Tests (`__tests__/infra/*.test.ts`)**: Verify that Infrastructure classes correctly interact with actual external systems.
- **Separation**: Business logic tests must be runnable without any external dependencies.

---

## 7. Guidelines for AI & Developers

- **Avoid "usecase" or "domain" folders**: Keep the structure flat under the module directory.
- **Keep it Simple**: If an Action is small, don't create a Service. Only extract to a Service when logic is shared.
- **Mocking**: Always use the interface definition to create mocks for testing Actions.
