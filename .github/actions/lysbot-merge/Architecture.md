# Architecture Policy (Lightweight Modular Monolith for GitHub Actions)

**Version:** 1.6  
**Audience:** Humans + AI code generator  
**Scope:** Small to mid-scale TypeScript-based GitHub Action development

## 1. Intent

This policy prioritizes **High Locality of Change** and **Strict Logical Isolation**. By centralizing feature logic into a single-file module (`mod.ts`) while enforcing an "Allow-list only" dependency rule, the goal is to ensure >50% of feature changes occur within a single file without allowing infrastructure or shared utilities to erode the Domain core.

## 2. Directory Layout & Roles

### 2.1 Project Structure

```
/src
  /modules
    /<feature-name>/
      mod.ts              (Logical Sections: Action → App → Domain → Infra)
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
    /<feature-name>/
      mod.test.ts         (Feature Tests: Contains port-specific fakes)
```

## 3. Section Contracts (Inside mod.ts)

Boundaries in `mod.ts` are enforced via an **Allow-list approach** to ensure the integrity of the Functional Core.

### [SECTION: DOMAIN] (Functional Core)

- **Role**: Business rules and core data shapes.
- **Allowed**: `type`, `interface`, `const`, `function`. **Strictly no `class` usage.**
- **Prohibitions**: No `process.env`, `Date.now()`, `@actions/*`, or direct I/O.
- **Dependency**: May only import from `shared/kernel` and `shared/lib`.

**Example:**
```typescript
// [SECTION: DOMAIN] - Pure Logic
export function determineMergeMethod(
  headRef: string,
  baseRef: string,
  config: ActionConfig
): MergeMethodResult {
  // Pure function - all inputs as parameters, deterministic output
  // No side effects, no I/O, no global state
}
```

### [SECTION: APP] (Orchestration & Contracts)

- **Role**: Workflow coordination and Port definitions.
- **Dependency**: May import from `Domain`, `shared/kernel`, and `shared/lib`.

**Example:**
```typescript
// [SECTION: APP] - Orchestration & Ports
export interface GitHubPort {
  fetchPullRequestData(prNumber: number): Promise<PullRequestData>;
  mergePullRequest(...): Promise<{success: boolean}>;
}

export async function executeMergeWorkflow(
  github: GitHubPort,
  context: EventContext,
  config: ActionConfig
): Promise<MergeResult> {
  // Orchestrates domain logic and calls ports
}
```

### [SECTION: ACTION & INFRA] (Imperative Shell)

- **Action**: Maps GitHub context to App/Domain types. The only layer authorized to call `core.setOutput`.
- **Infra**: Implements Ports.
- **Dependency**: Strictly limited to **App Ports** and **App/Domain Contracts (Interfaces)**. Must not access internal Domain logic or non-contract types.

**Example:**
```typescript
// [SECTION: ACTION] - Input/Output Mapping
export function readActionInputs(): ActionConfig {
  return {
    releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
    // ...
  };
}

// [SECTION: INFRA] - Adapters
export class GitHubAdapter implements GitHubPort {
  // Thin wrapper around @actions/* APIs
  async fetchPullRequestData(prNumber: number): Promise<PullRequestData> {
    // GitHub API call
  }
}
```

## 4. Reuse vs. Locality Policy

### 4.1 Locality First (Default)

All new logic, utilities, and fakes must originate inside `mod.ts` or `mod.test.ts`.

### 4.2 Promotion to Shared

Logic may be promoted to `shared/` or `__tests__/doubles/` only if:

1. **Redundancy**: The exact same logic is required by 2 or more features.
2. **Vocabulary Check**: For `shared/lib`, the code must be free of any Domain-specific vocabulary.
3. **Primitive Check**: For `__tests__/doubles`, only low-level primitives (e.g., generic HTTP mock) are shared. Port-specific fakes must remain in the feature's test file.

## 5. Structural Encapsulation

- **Encapsulation**: `mod.ts` is private. External components (including `main.ts`) must only import from `index.ts`.
- **Minimal Ports**: Ports defined in App must be the smallest possible interface required for the specific use case.

**Example:**
```typescript
// ❌ Bad: Generic, kitchen-sink interface
interface GitHubClient {
  createIssue(...): Promise<...>;
  createPullRequest(...): Promise<...>;
  mergePullRequest(...): Promise<...>;
  // ... 20 more methods
}

// ✅ Good: Specific, minimal interface
interface MergePort {
  fetchPullRequestData(prNumber: number): Promise<PullRequestData>;
  mergePullRequest(prNumber: number, method: string): Promise<MergeResult>;
}
```

## 6. Evolution Triggers

A feature's sections should be promoted to separate files within the feature folder only when:

- **Functional Growth**: Use-cases > 3 OR Domain functions > 10.
- **Dependency Complexity**: Required I/O Ports > 3.
- **Volume**: The `mod.ts` file exceeds 400 lines.

**Evolution Path:**
```
# Initial (< 400 lines)
modules/feature/
  mod.ts        # All sections in one file
  index.ts

# After threshold
modules/feature/
  domain.ts     # Pure logic
  app.ts        # Orchestration + ports
  infra.ts      # Adapters
  action.ts     # I/O mapping
  index.ts
```

## 7. Composition Root (main.ts)

`main.ts` is the **Composition Root** and must be kept extremely thin. Its sole responsibility is:

1. **Construct dependencies** (read inputs, create adapters)
2. **Inject dependencies** (pass them to feature entry points)
3. **Execute** (call the feature)
4. **Handle errors** (top-level exception handling)

**Example:**
```typescript
// src/main.ts - Pure DI only
export async function run(): Promise<void> {
  try {
    // Construct dependencies
    const config = readActionInputs();
    const context = readEventContext();
    const githubAdapter = new GitHubAdapter(createOctokit());

    // Execute business logic
    const result = await executeMerge(githubAdapter, context, config);

    // Delegate I/O operations
    writeOutputs(result);
    await writeSummary(result, context);
    logResult(result);
  } catch (error) {
    // Handle exceptions
    logError(error);
  }
}
```

**Prohibited in main.ts:**
- ❌ Business logic
- ❌ `core.getInput()` calls (delegate to `action.ts`)
- ❌ `core.setOutput()` calls (delegate to `action.ts`)
- ❌ Result formatting (delegate to `formatters`)
- ❌ Config construction (delegate to `action.ts`)

## 8. Testing Strategy

### 8.1 Test Structure

Tests must mirror the source structure 1:1:

```
__tests__/
  modules/
    <feature-name>/
      mod.test.ts         # Tests for mod.ts with port fakes
```

### 8.2 Testing Approach

- **Domain/App (Unit)**: 100% pure TS. Use **Fakes** (not mocks) for infra ports.
- **Action (Smoke)**: Verify input-to-output mapping.
- **No Mocking @actions/core**: Design the code so that the logic is independent of the Toolkit's global state.

**Example:**
```typescript
// Fake implementation (in test file)
class FakeGitHubPort implements GitHubPort {
  private mockData: Map<number, PullRequestData> = new Map();

  setPullRequestData(prNumber: number, data: PullRequestData): void {
    this.mockData.set(prNumber, data);
  }

  async fetchPullRequestData(prNumber: number): Promise<PullRequestData> {
    return this.mockData.get(prNumber)!;
  }
}

// Test
it('should execute merge workflow', async () => {
  const fakeGitHub = new FakeGitHubPort();
  fakeGitHub.setPullRequestData(1, { state: 'open', mergeable: true });

  const result = await executeMergeWorkflow(fakeGitHub, context, config);

  expect(result.status).toBe('success');
});
```

## 9. AI Instructions (Mandatory)

When implementing or modifying code, AI agents must:

1. **Strict Purity**: Maintain the Domain section as a collection of pure functions. Reject any side-effectful global state or classes.

2. **Vocabulary Enforcement**: Do not place any function containing domain-specific terms into `shared/lib`.

3. **Allow-list Dependency**: When writing the Infra section, strictly limit access to the App's Ports and Contracts.

4. **Localize Change**: Fulfill requests by modifying only the target `mod.ts` whenever possible.

5. **Manual DI**: Perform all dependency assembly and injection in `src/main.ts`.

6. **Section Headers**: Always use explicit section markers in `mod.ts`:
   ```typescript
   // [SECTION: DOMAIN]
   // [SECTION: APP]
   // [SECTION: ACTION]
   // [SECTION: INFRA]
   ```

7. **Evolution Checks**: Before splitting a file, verify it meets at least one evolution trigger threshold.

## 10. Design Principles

### 10.1 Functional Core, Imperative Shell

- **Core**: Pure functions with no side effects (Domain + App logic)
- **Shell**: All I/O at the edges (Action + Infra layers)

### 10.2 Dependency Rule

**"Source code dependencies must point only inward."**

```
main.ts → index.ts → mod.ts (Action → App → Domain)
                           ↓
                      shared/kernel
```

### 10.3 Port-Adapter Pattern

- **Ports** (interfaces): Defined in App layer, represent what the business logic needs
- **Adapters** (implementations): Defined in Infra layer, implement ports using actual libraries

### 10.4 Explicit over Implicit

- Use explicit section markers
- Use explicit type definitions
- Use explicit port interfaces
- Avoid "clever" abstractions

## 11. Code Placement Decision Chart

| Feature / Code to Implement | Target Location | Reason |
|:---|:---|:---|
| Logic: "Version string must follow SemVer" | `mod.ts` [SECTION: DOMAIN] | Pure business rule |
| Flow: "Fetch PR → Check Title → Add Label" | `mod.ts` [SECTION: APP] | Workflow orchestration |
| Calling GitHub API (`octokit.rest...`) | `mod.ts` [SECTION: INFRA] | Technical implementation |
| Parsing Inputs (`core.getInput`) | `mod.ts` [SECTION: ACTION] | External input mechanism |
| Interface: `GitHubPort` | `mod.ts` [SECTION: APP] | Port definition |
| Formatting a Markdown Report | `mod.ts` [SECTION: APP] or `shared/lib` | Depends on domain terms |
| Pure string utilities | `shared/lib` | No domain vocabulary |
| Result/Error types | `shared/kernel` | Universal vocabulary |

## 12. Common Pitfalls to Avoid

1. **❌ Domain Impurity**: Adding `@actions/core` imports to Domain section
2. **❌ Premature Abstraction**: Creating `shared/lib` utilities before they're needed by 2+ features
3. **❌ Fat main.ts**: Adding business logic or formatting to `main.ts`
4. **❌ Generic Ports**: Creating kitchen-sink interfaces instead of minimal, specific ports
5. **❌ Breaking Encapsulation**: Importing directly from `mod.ts` instead of `index.ts`
6. **❌ Premature Splitting**: Splitting files before reaching evolution thresholds

## 13. Migration Guide

### From Monolith to Modular Monolith

1. Create `modules/<feature-name>/mod.ts`
2. Add section markers
3. Move pure logic to [SECTION: DOMAIN]
4. Move orchestration to [SECTION: APP]
5. Extract ports as interfaces in [SECTION: APP]
6. Move GitHub API calls to [SECTION: INFRA]
7. Move I/O operations to [SECTION: ACTION]
8. Clean up `main.ts` to pure DI
9. Update tests to use port fakes

### From Split Files to Single-File Module

1. Create `modules/<feature-name>/mod.ts`
2. Copy sections in order: DOMAIN → APP → ACTION → INFRA
3. Add section markers
4. Update imports in `main.ts` to use `modules/<feature-name>/index.ts`
5. Remove old files
6. Update tests

## 14. Examples

See the following for reference implementations:
- PR #106: Full implementation of this architecture policy
- PR #113: Alternative implementation with I/O adapter pattern
- This document's inline examples throughout

## 15. Version History

- **v1.6** (Current): Added explicit AI instructions, evolution triggers, code placement chart
- **v1.4**: Introduced section contracts within single files
- **v1.2**: Initial modular monolith with strict layering

---

**Note**: This architecture policy is designed to evolve with the project. When the action grows in complexity, revisit the evolution triggers and adjust the structure accordingly. The goal is always to maintain high locality of change while preventing architectural drift.
