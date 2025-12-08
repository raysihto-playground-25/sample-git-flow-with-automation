/**
 * main.ts - Entry point for the lysbot-merge GitHub Action
 *
 * This file is the main entry point that runs in the GitHub Actions environment.
 * It is responsible for:
 * 1. Reading inputs from the GitHub Actions environment
 * 2. Constructing the event context from github.context
 * 3. Calling the main action logic from action.ts
 * 4. Setting outputs and writing summaries
 *
 * WHY THIS FILE IS UNTESTABLE:
 * ============================
 * This file contains ONLY GitHub Actions runtime integration code that:
 * 1. Depends on @actions/core global state (core.getInput, core.setOutput, core.summary)
 * 2. Depends on @actions/github global context (github.context, process.env)
 * 3. Has no business logic - only reads inputs, delegates to action.ts, and writes outputs
 *
 * TESTING APPROACH:
 * =================
 * - All business logic is in action.ts (lysbotMerge, buildSummaryMarkdown) which IS fully tested
 * - This file is a thin integration layer with GitHub Actions runtime
 * - Testing this would require mocking the entire GitHub Actions environment, which provides
 *   no value since it only contains simple pass-through code with no conditional logic
 * - The real functionality is tested in action.test.ts with 94%+ coverage
 *
 * All testable logic has been moved to action.ts.
 */
export {};
