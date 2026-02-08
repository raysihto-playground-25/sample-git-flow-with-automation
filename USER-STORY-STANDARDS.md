# User Story-Driven Development Standards

## Status

This document is **normative** for this project.

All items labeled as MUST are mandatory.
Items labeled as SHOULD are strongly recommended unless a justified exception is approved.
Items labeled as MAY are optional practices.

Any deviation from MUST requirements requires explicit approval and documentation.

## Requirement Levels

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174.html) when, and only when, they appear in all capitals, as shown here.

The following terms are used throughout this document:

- **MUST**: absolute requirement
- **MUST NOT**: absolute prohibition
- **SHOULD**: recommended best practice (deviations require justification)
- **SHOULD NOT**: not recommended (use requires justification)
- **MAY**: optional

## Scope

This standard applies to:

- All User Stories managed as Product Backlog Items (PBIs) within this project
- All contributors participating in design, development, and review activities
- All acceptance criteria and definition of done processes

This standard does NOT cover:

- Infrastructure provisioning standards
- Security policy standards
- Release management policy
- Deployment procedures

---

# Part I – Normative Standards

This section contains binding requirements that MUST be followed.

## 1. Terminology

### 1.1 User Story

A **User Story** is a lightweight requirement specification that describes functionality from an end-user perspective.

### 1.2 Story Card

A **Story Card** is the textual representation of a User Story following a specific format.

### 1.3 Acceptance Criteria (AC)

**Acceptance Criteria** are specific, testable conditions that MUST be satisfied for a User Story to be considered complete.

### 1.4 Definition of Done (DoD)

The **Definition of Done** is a comprehensive checklist of requirements that MUST be satisfied before a User Story is marked as complete.

## 2. Story Card Format

### 2.1 Standard Format

The Story Card format MUST be:

```
{role} は、 {action} したい。 {benefit} のために。
```

Where:
- `{role}` is the user role or persona
- `{action}` is the desired action or capability
- `{benefit}` is the business value or reason

### 2.2 Formatting Rules

- Spacing MUST follow the pattern shown above:
  - Single space after "は、" (topic marker with comma)
  - Single space after "したい。" before the benefit clause
  - Single space after "のために" before the period
- Punctuation MUST use the specified Japanese punctuation marks (、。)
- The three components MUST appear in the specified order

### 2.3 Role Selection

- Roles MUST represent actual user types or personas in the system
- Generic roles (e.g., "ユーザー") SHOULD be avoided when more specific roles exist
- Role definitions SHOULD be documented in the project's user persona documentation

## 3. Acceptance Criteria

### 3.1 Requirements

Each User Story MUST have at least one Acceptance Criterion.

### 3.2 Properties

Acceptance Criteria MUST be:

- **Specific**: Clearly defined without ambiguity
- **Testable**: Can be verified through testing or demonstration
- **Measurable**: Has clear pass/fail conditions

### 3.3 Format

Acceptance Criteria SHOULD follow a consistent format such as:

- Given-When-Then format
- Scenario-based descriptions
- Checklist of verifiable conditions

## 4. Definition of Done (DoD)

### 4.1 Completion Hierarchy

```
User Story Completion
└── MUST satisfy DoD
      ├── MUST satisfy all Acceptance Criteria
      ├── MUST pass required tests
      └── MUST meet process criteria
```

### 4.2 Core Requirements

Each User Story MUST satisfy the Definition of Done before being marked as complete.

The Definition of Done MUST include:

1. All Acceptance Criteria are satisfied
2. Required tests are passing
3. Code review is completed (if applicable)
4. Documentation is updated (if applicable)

### 4.3 Insufficiency of AC Alone

Satisfaction of Acceptance Criteria alone is NOT sufficient for User Story completion. All DoD requirements MUST be met.

## 5. Compliance Validation

### 5.1 Pre-Completion Checklist

Before a User Story is marked complete, the following MUST be verified:

- [ ] DoD checklist has been reviewed and all items are satisfied
- [ ] AC checklist has been reviewed and all criteria are met
- [ ] A reviewer has confirmed compliance with this standard

### 5.2 Reviewer Responsibilities

A reviewer MUST:

- Verify that all Acceptance Criteria are met
- Verify that all Definition of Done items are satisfied
- Confirm that the Story Card follows the required format
- Document any approved deviations

---

# Part II – Recommended Practices

This section contains non-binding guidance and best practices.

## 6. Role Management Heuristics

### 6.1 Role Identification

When identifying roles for Story Cards:

- Consider the primary user who benefits from the functionality
- Use existing persona definitions when available
- Create new personas when representing genuinely different user types
- Document role definitions for team reference

### 6.2 Role Granularity

- Roles SHOULD be specific enough to capture meaningful differences in needs
- Roles SHOULD NOT be so granular that they create unnecessary complexity
- Consider consolidating similar roles when their needs and behaviors align

## 7. Examples and Templates

### 7.1 Story Card Example

```
開発者は、コードレビューを自動化したい。レビュー時間を短縮するために。
```

(Developer wants to automate code reviews in order to reduce review time.)

### 7.2 Acceptance Criteria Example

**Given-When-Then Format:**

```
Given: A pull request is created
When: The automated review is triggered
Then: The review completes within 5 minutes
And: Findings are posted as comments
```

**Checklist Format:**

- [ ] Review completes within 5 minutes
- [ ] Findings are posted as PR comments
- [ ] Review status is updated
- [ ] Notifications are sent to relevant parties

## 8. Evolution of Definition of Done

### 8.1 Continuous Improvement

The Definition of Done MAY evolve over time as the project matures.

### 8.2 Adding New Requirements

When adding requirements to the DoD:

- Consider the impact on work in progress
- Communicate changes to all team members
- Provide a transition period when appropriate
- Document the rationale for changes

### 8.3 Team Retrospectives

Teams SHOULD review the effectiveness of the DoD regularly and propose improvements based on experience.

## 9. Relationship to 5W2H

The Story Card format aligns with key aspects of the 5W2H framework:

- **Who** (誰が): Captured in the `{role}` component
- **What** (何を): Captured in the `{action}` component
- **Why** (なぜ): Captured in the `{benefit}` component
- **How** (どのように): Detailed in Acceptance Criteria
- **When/Where**: Context-dependent, specified in AC when relevant

This alignment helps ensure User Stories capture essential information while remaining concise.

---

## Appendix: References

- [RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](https://www.rfc-editor.org/rfc/rfc2119.html)
- [RFC 8174: Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words](https://www.rfc-editor.org/rfc/rfc8174.html)

---

*Document Version: 1.0.0*
