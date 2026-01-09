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
    * **Entities:** Business data structures (e.g., `PullRequest`, `ReleaseVersion`).
    * **Value Objects:** Objects defined by their value (e.g., `SemVer`, `LabelName`).
    * **Domain Services:** Logic that spans multiple entities (e.g., `VersionCalculator`).
* **DO NOT place here:**
    * References to `core.getInput()` or `github.context`.

### `src/usecases` (UseCase Layer)
**Role:** Describes the specific workflows of **this Action**.
* The UseCase layer represents application-specific behavior, **not reusable domain rules**.
* It orchestrates the flow of data to achieve a specific goal (e.g., "Label a PR based on title").

**Dependencies:** Depends only on `domain`. Does NOT depend on `adapters`.

* **Code to place here:**
    * **Interactors / UseCase Classes:** Orchestrate domain objects.
    * **Ports (Interfaces):** Interface definitions for external interactions (e.g., `GitHubClient`, `FileSystem`).
        * **Important:** Ports must be defined from the **UseCase's perspective**, not as a mirror of external APIs. Avoid creating a generic `OctokitWrapper`; instead, create `PullRequestReader` with only the methods the UseCase needs.
    * **Input/Output DTOs:** Data structures defining what the UseCase needs and returns.

### `src/adapters` (Adapter Layer)
**Role:** Converts data between the external world (GitHub Context, Inputs, API) and the internal world.
**Dependencies:** Depends on `usecases` and `domain`.

* **Code to place here:**
    * **Gateways:** Implementations of Ports using actual libraries (e.g., `OctokitGitHubClient`, `NodeFileSystem`).
    * **Presenters (Optional):** Formatting logic if complex output is needed (e.g., generating a Markdown summary for a PR comment).
    * **Entry Points:** Code that handles `core.getInput` and triggers UseCases (often located in `main.ts` or `adapters/handlers`).

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
| **Interface: `GitHubClient`** | `src/usecases` | The UseCase needs this capability. |
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
├── entities/           # e.g., PullRequest.ts
├── value-objects/      # e.g., SemVer.ts
└── services/           # e.g., VersionPolicy.ts
```

### 6.2 Structure of `src/usecases`
```text
src/usecases/
├── autolabel/                  # Grouped by feature
│   ├── AutoLabelUseCase.ts
│   └── GitHubClient.ts         # Port definition (collocated)
└── release/
    └── CreateReleaseUseCase.ts
```

### 6.3 Structure of `src/adapters`
```text
src/adapters/
├── gateways/           # API/DB Implementations
│   ├── OctokitGitHubClient.ts  # Implements GitHubClient using Octokit
│   └── ActionLogger.ts
└── presenters/         # Output Formatting (if logic is complex)
    └── MarkdownReportPresenter.ts
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

**Rule:** No other file is allowed to instantiate concrete adapters (e.g., `new OctokitGitHubClient(...)`) except `main.ts`.

### 8.2 Implementation Example

**`src/main.ts`**:

```typescript
import * as core from '@actions/core';
import { OctokitGitHubClient } from './adapters/gateways/OctokitGitHubClient';
import { AutoLabelUseCase } from './usecases/autolabel/AutoLabelUseCase';

async function run() {
  try {
    // 1. Setup Adapters (Infrastructure)
    const token = core.getInput('token');
    const client = new OctokitGitHubClient(token); // Implements GitHubClient

    // 2. Setup UseCase (Injecting Dependencies)
    const useCase = new AutoLabelUseCase(client);

    // 3. Execution
    const prNumber = parseInt(core.getInput('pr_number'));
    await useCase.execute(prNumber);

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
| **I-Prefix (e.g., `IUser`)** | Considered legacy in TypeScript. | Use `User` for interface, `UserImpl` or `SpecificUser` for class. |
| **Importing `@actions/core` in Domain** | Makes logic untestable without the runner environment. | Use return values or Exceptions to propagate state. |
| **Interface Mirroring API** | Creating `Port` that exactly matches `octokit.rest.issues...`. | Define `Port` based on what the UseCase *needs* (e.g., `addLabel(id, name)`). |
| **Logic in `main.ts`** | `main.ts` becomes a "God Object" and cannot be tested. | Move logic to a UseCase; keep `main.ts` for wiring only. |
| **"Utils" Drawer** | Creating `src/utils` or `src/shared` for everything. | Place code near where it is used (Collocation). |
| **Instantiating Adapters in UseCase** | `const client = new OctokitGitHubClient()` inside a UseCase. | Pass the client instance via constructor (Dependency Injection). |
