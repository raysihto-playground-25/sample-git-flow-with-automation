/**
 * index.ts - Entry point for the GitHub Action
 *
 * This file is the entry point specified in action.yml.
 * It simply imports and executes the run() function from main.ts.
 */

await (await import('./main.js')).run();
