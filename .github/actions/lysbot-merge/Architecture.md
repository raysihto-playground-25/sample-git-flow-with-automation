# Architecture Guidelines

## Overview
This document defines the architecture policy for our TypeScript modulith-based application using Pure Dependency Injection (DI).
The goal is to maintain clear module boundaries, enforce encapsulation, and provide flexibility for testing and future extension.

This document is also intended to serve as a **refactoring and re-organization guide**.
Any structural changes to the codebase should conform to the principles defined here.

---

## Source Tree Structure

```
src/
  ├── main.ts                  # Composition Root
  ├── modules/
  │     ├── order/
  │     │     ├── index.ts     # Public entry point for the module
  │     │     └── internal/    # Internal implementation (non-public)
  │     │           ├── configurator.ts
  │     │           ├── order-service.ts
  │     │           └── default-order-service.ts
  │     └── customer/
  │           ├── index.ts
  │           └── internal/
  │                 ├── configurator.ts
  │                 ├── customer-service.ts
  │                 └── default-customer-service.ts
```

---

## Module Design Principles

### 1. **Module Boundary**
- Each module resides under `src/modules/{module-name}`.
- **Public API**: Only `index.ts` is exposed externally.
- **Internal Implementation**: All other files are placed under `internal/` and must not be imported outside the module.

### 2. **Dependency Injection**
- Pure DI is used (no external DI container).
- Each module provides a `configure{ModuleName}()` function in `internal/configurator.ts`.
- The configurator is responsible **only for wiring dependencies within the module**.

### 3. **Composition Root**
- `src/main.ts` acts as the composition root.
- It imports each module's configurator via `index.ts` and assembles the application.

---

## Module Granularity and Boundary Definition

### 1. **Primary Criterion: Business / User Value**
Module boundaries **must be defined based on _what the system does_**, not _how it is implemented_.

Concretely:
- A module represents a **cohesive unit of business value or user-facing responsibility**
- Boundaries should align with:
  - User intent
  - Business capability
  - Action-level responsibility

Examples of valid boundary questions:
- "What value does this provide to the user?"
- "What responsibility does this code own from a business perspective?"

### 2. **Anti-Criteria: Implementation or Technical Concerns**
Modules **must not** be split based on:
- Technical layers (e.g. API / service / logic / util)
- Implementation details (e.g. GitHub API wrapper vs formatter)
- Reuse convenience
- File size or code length alone

Splitting modules based on "how it works" instead of "what it does" leads to:
- Artificial boundaries
- Leaky abstractions
- Increased cognitive load without architectural benefit

### 3. **Implication for GitHub TypeScript Actions**
In many GitHub TypeScript Actions, the application:
- Delivers a single, well-defined user-facing behavior
- Has a narrow business responsibility
- Is not a long-lived, multi-capability system

Therefore, **it is often architecturally correct to have only a single module**.

In such cases:
- The entire Action is treated as **one module**
- Internal structure (`internal/`) is still used to maintain encapsulation
- Additional modules should be introduced **only when a new, distinct business responsibility emerges**

This guideline is intentional:
> Fewer modules with strong semantic cohesion are preferred over many modules with weak or technical separation.

### 4. **When to Introduce Additional Modules**
Introducing a new module is justified only when:
- There is a clearly distinct business or user value
- The responsibility can be explained independently
- The boundary would still make sense even if the implementation details change

If the rationale for a new module is primarily technical, it should remain an internal concern within an existing module.

---

## Naming Conventions

### Files
- **Entry point**: `index.ts` (lowercase, by convention).
- **Other files**: Use **kebab-case** for file names.
  - Example: `order-service.ts`, `default-order-service.ts`, `configurator.ts`.

### Types and Classes
- **Interfaces**: No `I` prefix. Use descriptive names.
  - Example: `OrderService` (interface), `DefaultOrderService` (implementation).
- **Classes**: PascalCase.
- **Variables and Functions**: camelCase.

---

## Public API Policy
- `index.ts` is responsible for:
  - Exporting the configurator function.
  - Exporting public interfaces or types required by consumers.
- Internal classes and implementations must **not** be exported.

Example:
```typescript
// index.ts
export type { OrderService, OrderModuleDeps } from './internal/order-service';
export { configureOrderModule } from './internal/configurator';
```

---

## Example: Pure DI Pattern

### internal/order-service.ts
```typescript
export interface OrderService {
  getOrder(id: string): { id: string; status: string };
}
```

### internal/default-order-service.ts
```typescript
import { OrderService } from './order-service';

export class DefaultOrderService implements OrderService {
  getOrder(id: string) {
    return { id, status: 'pending' };
  }
}
```

### internal/configurator.ts
```typescript
import { OrderService } from './order-service';
import { DefaultOrderService } from './default-order-service';

export interface OrderModuleDeps {
  orderService: OrderService;
}

export function configureOrderModule(): OrderModuleDeps {
  const service: OrderService = new DefaultOrderService();
  return { orderService: service };
}
```

### index.ts
```typescript
export type { OrderService, OrderModuleDeps } from './internal/order-service';
export { configureOrderModule } from './internal/configurator';
```

### main.ts
```typescript
import { configureOrderModule } from './modules/order';

function main() {
  const orderModule = configureOrderModule();
  console.log(orderModule.orderService.getOrder('123'));
}

main();
```

---

## Testing and Extensibility
- Consumers should depend on **interfaces**, not concrete implementations.
- Mock implementations can be easily created for testing:
```typescript
const mockOrderService: OrderService = {
  getOrder: (id) => ({ id, status: 'mocked' }),
};
```

---

## Summary of Key Rules
- **Boundary by Value**: Modules are split by business / user value, not by implementation.
- **Encapsulation**: Internal details stay in `internal/`.
- **Public API**: Only `index.ts` exports what is needed.
- **Naming**: kebab-case for files, PascalCase for types/classes.
- **DI**: Pure DI, configurator per module.
- **Granularity**: Prefer fewer, semantically strong modules; a single-module architecture is often appropriate for GitHub Actions.
