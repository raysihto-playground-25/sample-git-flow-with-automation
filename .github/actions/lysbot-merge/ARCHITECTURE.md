# Software Architecture and Directory Structure Guidelines (for TypeScript Actions)

This project adopts a directory structure based on **Clean Architecture**, tailored for TypeScript GitHub Actions.
The primary goal is "Separation of Concerns," isolating business logic from external elements such as the GitHub Actions Toolkit (`@actions/core`, `@actions/github`) and third-party APIs.

## 1. Directory Structure Overview

Code is categorized into three layers based on its "Role" and "Reason for Change."

```text
src/
├── domain/     (Core: Enterprise Business Rules)
├── usecases/   (App : Application Business Rules)
└── adapters/   (IO  : Interface Adapters)
```

---

## 2. Responsibilities and Placement Rules

### `src/domain` (Domain Layer)
**Role:** Represents the pure concepts and rules of the problem area.
**Dependencies:** Must NOT depend on any other directory or external infrastructure libraries (like `@actions/core`).

* **Code to place here:**
    * **Entities:** Business data structures (e.g., `PullRequest`, `MergeCheck`, `Review`).
    * **Value Objects:** Objects defined by their value (e.g., `MergeMethod`, `MergeResult`).
    * **Domain Services:** Logic that spans multiple entities (e.g., `MergeMethodPolicy`, `PullRequestValidator`).
* **DO NOT place here:**
    * References to `core.getInput()` or `github.context`.

### `src/usecases` (UseCase Layer)
**Role:** Describes the specific workflows of **this Action**.
* The UseCase layer represents application-specific behavior, **not reusable domain rules**.
* It orchestrates the flow of data to achieve a specific goal (e.g., "Merge a PR based on command").

**Dependencies:** Depends only on `domain`. Does NOT depend on `adapters`.

* **Code to place here:**
    * **Interactors / UseCase Classes:** Orchestrate domain objects (e.g., `MergeUseCase`).
    * **Ports (Interfaces):** Interface definitions for external interactions (e.g., `IGitHubClient`, `ILogger`).
        * **Important:** Ports must be defined from the **UseCase's perspective**, not as a mirror of external APIs. Avoid creating a generic `IOctokitWrapper`; instead, create `IGitHubClient` with only the methods the UseCase needs.
    * **Input/Output DTOs:** Data structures defining what the UseCase needs and returns (e.g., `MergeConfig`, `EventContext`).

### `src/adapters` (Adapter Layer)
**Role:** Converts data between the external world (GitHub Context, Inputs, API) and the internal world.
**Dependencies:** Depends on `usecases` and `domain`.

* **Code to place here:**
    * **Gateways:** Implementations of Ports using actual libraries (e.g., `GitHubClient`, `ActionLogger`).
    * **Presenters (Optional):** Formatting logic if complex output is needed (e.g., `SummaryPresenter`).
    * **Entry Points:** Code that handles `core.getInput` and triggers UseCases (located in `main.ts`).

---

## 3. Dependency Rule

**"Source code dependencies must point only inward."**

`Adapters -> Usecases -> Domain`

* **Crucial for Actions:** Your business logic (`domain`/`usecases`) must run locally without needing the actual GitHub Action runner environment. This is achieved by mocking the interfaces defined in `usecases`.

---

## 4. Code Placement Decision Chart

| Feature / Code to Implement | Target Directory | Reason |
| :--- | :--- | :--- |
| **Logic: "Version string must follow SemVer"** | `src/domain` | Pure business rule. |
| **Flow: "Fetch PR -> Check Title -> Add Label"** | `src/usecases` | The workflow (UseCase) of this Action. |
| **Calling GitHub API (`octokit.rest...`)** | `src/adapters` | Detailed technical implementation. |
| **Parsing Inputs (`core.getInput`)** | `src/adapters` | External input mechanism. |
| **Interface: `IGitHubClient`** | `src/usecases` | The UseCase needs this capability. |
| **Formatting a Markdown Report** | `src/adapters` | Output presentation detail. |

---

## 5. Logging Strategy

### Interface-Based Logging
To keep domain logic testable and clean of `@actions/core`:

1.  **Define:** In most cases, define the `Logger` interface in the **`usecases`** layer.
    * *Note:* Only define it in `domain` if the logging represents a critical domain concept (e.g., Audit Trails).
2.  **Implement:** `ActionLogger` in `adapters` using `core.info()`, `core.error()`.
3.  **Inject:** Pass the logger implementation to UseCases.

---

## 6. Internal Structure and Naming Conventions

### 6.1 Structure of `src/domain`
```text
src/domain/
├── entities/           # e.g., PullRequest.ts, MergeCheck.ts, Review.ts
├── value-objects/      # e.g., MergeMethod.ts, MergeResult.ts
└── services/           # e.g., MergeMethodPolicy.ts, PullRequestValidator.ts
```

### 6.2 Structure of `src/usecases`
```text
src/usecases/
└── merge/                      # Grouped by feature
    ├── MergeUseCase.ts
    ├── IGitHubClient.ts        # Port definition (collocated)
    ├── ILogger.ts              # Port definition (collocated)
    └── MergeUseCaseInput.ts    # Input DTOs
```

### 6.3 Structure of `src/adapters`
```text
src/adapters/
├── gateways/           # API/DB Implementations
│   ├── GitHubClient.ts
│   └── ActionLogger.ts
└── presenters/         # Output Formatting (if logic is complex)
    └── SummaryPresenter.ts
```

---

## 7. Auxiliary Elements (Constants, Types, & Shared)

**Do not use a root `src/constants`.** Distribute them by layer.

* **Domain Constants:** Default timeout values, regex patterns for validation (`src/domain`).
* **Adapter Constants:** Input names defined in `action.yml`, specific API endpoints (`src/adapters`).

### `src/shared` (Strictly Exceptional)
`src/shared` should be treated as an **exception, not a default**.

* **Rule:** If a utility has a clear domain meaning (e.g., date calculation for business rules), place it in `domain` instead.
* **Rule:** Only use `shared` for truly generic utilities (e.g., pure string manipulation) that are used across multiple layers and have **zero** domain or infrastructure knowledge.

---

## 8. Dependency Injection Strategy (Pure DI)

For GitHub Actions, we adopt **Pure DI (Manual Dependency Injection)**.

### 8.1 Composition Root (`src/main.ts`)
The `main.ts` file is the **only** place where all layers are coupled. It acts as the "Composition Root."

**Rule:** No other file is allowed to instantiate concrete adapters (e.g., `new GitHubClient(...)`) except `main.ts`.

### 8.2 Implementation Example

**`src/main.ts`**:

```typescript
import * as core from '@actions/core';
import * as github from '@actions/github';

import { MergeUseCase } from './usecases/merge/MergeUseCase.js';
import { GitHubClient } from './adapters/gateways/GitHubClient.js';
import { ActionLogger } from './adapters/gateways/ActionLogger.js';

async function run() {
  try {
    // 1. Setup Adapters (Infrastructure)
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);
    const gitHubClient = new GitHubClient(octokit, github.context.repo.owner, github.context.repo.repo);
    const logger = new ActionLogger(core);

    // 2. Setup UseCase (Injecting Dependencies)
    const config = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
    };
    const useCase = new MergeUseCase(gitHubClient, logger, config);

    // 3. Execution
    const context = { /* build from github.context and payload */ };
    const result = await useCase.execute(context, config);

    // 4. Set outputs
    core.setOutput('result', result.status);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
```

---

## 9. Anti-Patterns (What NOT to do)

| Anti-Pattern | Why it's bad | Correction |
| :--- | :--- | :--- |
| **Importing `@actions/core` in Domain** | Makes logic untestable without the runner environment. | Use return values or Exceptions to propagate state. |
| **Interface Mirroring API** | Creating `IPort` that exactly matches `octokit.rest.issues...`. | Define `IPort` based on what the UseCase *needs* (e.g., `postComment(prNumber, body)`). |
| **Logic in `main.ts`** | `main.ts` becomes a "God Object" and cannot be tested. | Move logic to a UseCase; keep `main.ts` for wiring only. |
| **"Utils" Drawer** | Creating `src/utils` or `src/shared` for everything. | Place code near where it is used (Collocation). |
| **Instantiating Adapters in UseCase** | `const client = new GitHubClient()` inside a UseCase. | Pass the client instance via constructor (Dependency Injection). |

---

## 10. Actual Implementation in This Project

### Current Structure

```text
.github/actions/lysbot-merge/src/
├── domain/
│   ├── entities/
│   │   ├── PullRequest.ts        # Pull request domain entity
│   │   ├── MergeCheck.ts         # Merge check result entity
│   │   ├── MergeCommand.ts       # Parsed merge command entity
│   │   └── Review.ts             # Code review entity
│   ├── value-objects/
│   │   ├── MergeMethod.ts        # Merge method decision (squash/merge)
│   │   └── MergeResult.ts        # Result of merge operation
│   └── services/
│       ├── MergeMethodPolicy.ts          # Determines merge method based on branches
│       ├── PullRequestValidator.ts       # Validates PR state
│       ├── ConventionalCommitsValidator.ts # Validates commit format
│       ├── CommandParser.ts              # Parses merge commands
│       └── PermissionChecker.ts          # Checks user permissions
├── usecases/
│   └── merge/
│       ├── MergeUseCase.ts           # Main merge orchestration logic
│       ├── IGitHubClient.ts          # Port for GitHub API
│       ├── ILogger.ts                # Port for logging
│       └── MergeUseCaseInput.ts      # Input DTOs (MergeConfig, EventContext)
├── adapters/
│   ├── gateways/
│   │   ├── GitHubClient.ts       # Implements IGitHubClient using Octokit
│   │   └── ActionLogger.ts       # Implements ILogger using @actions/core
│   └── presenters/
│       └── SummaryPresenter.ts   # Formats summary markdown
├── main.ts                       # Composition root (wires everything together)
└── index.ts                      # Entry point (calls main.run())
```

### Key Points

1. **Domain Layer** contains all business rules with no external dependencies
2. **UseCase Layer** orchestrates the merge workflow and defines ports for external dependencies
3. **Adapter Layer** implements the ports using actual libraries (Octokit, @actions/core)
4. **main.ts** is the only file that instantiates concrete adapters and wires them together
5. All dependencies point inward: `Adapters -> Usecases -> Domain`

---

## 11. Testing Strategy

### Domain Layer Tests
- Test domain services in isolation
- No mocking needed (pure functions/classes)
- Example: Test `MergeMethodPolicy.determine()` with various branch names

### UseCase Layer Tests
- Mock the port interfaces (`IGitHubClient`, `ILogger`)
- Test the orchestration logic
- Example: Test `MergeUseCase.execute()` with mocked GitHub client

### Adapter Layer Tests
- Test that adapters correctly implement the port interfaces
- Mock external dependencies (Octokit, @actions/core)
- Example: Test `GitHubClient.fetchPullRequest()` with mocked Octokit

### Integration Tests
- Test the full flow with real (or realistic) adapters
- Use the composition root pattern
- Example: Test end-to-end merge flow with test doubles

---

## 12. Benefits of This Architecture

1. **Testability**: Business logic can be tested without GitHub Actions runtime
2. **Maintainability**: Clear separation of concerns makes changes easier
3. **Flexibility**: Easy to swap implementations (e.g., different GitHub API client)
4. **Understandability**: Each layer has a clear purpose and responsibility
5. **Independence**: Domain logic is independent of frameworks and libraries

---

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture (Ports and Adapters)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
