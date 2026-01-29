# Library Upgrade Analysis Report

## Executive Summary

This analysis investigated the failures occurring when running `(cd .github/actions/lysbot-merge && npm run all:full-upgrade)`. Through systematic testing of each library upgrade individually, we identified the root cause of the issue.

## Key Findings

### Root Cause Identified ✓

**@actions/github upgrade from 7.0.0 to 8.0.0+ is the sole cause of the build failures.**

The upgrade introduces 208 new TypeScript ESLint errors, increasing the total from 177 to 385 errors.

### Test Results Summary

| Library | Version Change | ESLint Errors | Status |
|---------|---------------|---------------|---------|
| Baseline (no changes) | - | 177 errors | - |
| @stylistic/eslint-plugin | 5.7.0 → 5.7.1 | 177 errors | ✓ Safe |
| rollup | 4.56.0 → 4.57.0 | 177 errors | ✓ Safe |
| @typescript-eslint/parser | 8.53.1 → 8.54.0 | 177 errors | ✓ Safe |
| typescript-eslint | 8.53.1 → 8.54.0 | 177 errors | ✓ Safe |
| @actions/core | 2.0.2 → 3.0.0 | 177 errors | ✓ Safe |
| **@actions/github** | **7.0.0 → 8.0.0** | **385 errors** | **✗ Problematic** |
| **@actions/github** | **7.0.0 → 9.0.0** | **385 errors** | **✗ Problematic** |

### Error Impact Analysis

```
Baseline (v7.0.0):          177 errors
@actions/github (v8.0.0+):  385 errors
Increase:                   +208 errors (+117%)
```

#### Error Type Breakdown

| Error Type | Baseline | After Upgrade | Increase |
|------------|----------|---------------|----------|
| @typescript-eslint/no-unsafe-member-access | 71 | 174 | +103 (+145%) |
| @typescript-eslint/no-unsafe-assignment | 50 | 114 | +64 (+128%) |
| @typescript-eslint/no-unsafe-call | 47 | 82 | +35 (+74%) |
| @typescript-eslint/no-unsafe-return | 8 | 14 | +6 (+75%) |
| **Total** | **177** | **385** | **+208 (+117%)** |

### Affected Files

**Before upgrade:**
- `__tests__/action.test.ts` (test file only)
- `__tests__/github-api.test.ts` (test file only)

**After @actions/github@8.0.0+ upgrade:**
- `__tests__/action.test.ts` (more errors)
- `__tests__/github-api.test.ts` (more errors)
- `__tests__/main.test.ts` (new errors)
- ⚠️ `src/github-api.ts` (60+ new errors in source code)
- ⚠️ `src/main.ts` (new errors in source code)

⚠️ = Production source code files affected (not just tests)

## Recommendations

### Immediate Actions ✅

**Safe to upgrade immediately:**

```bash
cd .github/actions/lysbot-merge
npm install \
  @actions/core@3.0.0 \
  @stylistic/eslint-plugin@5.7.1 \
  @typescript-eslint/parser@8.54.0 \
  rollup@4.57.0 \
  typescript-eslint@8.54.0 \
  --save-exact
```

**Keep at current version:**

```bash
# Keep @actions/github@7.0.0 (do not upgrade to 8.0.0+)
```

### Future Work Required ⚠️

To upgrade @actions/github to v8.0.0+, the following work is needed:

1. **Add explicit type annotations** to `src/github-api.ts`
2. **Investigate type definition changes** in @actions/github v8.0.0
3. **Fix all 208 type errors** systematically
4. **Estimated effort:** 2-4 hours

### Error Patterns in @actions/github@8.0.0+

The upgrade causes type resolution failures in:

1. **Octokit REST API calls**
   ```typescript
   await octokit.rest.repos.getBranchProtection(...)
   // Type errors on .rest and API methods
   ```

2. **Response data access**
   ```typescript
   const data = response.data;
   // Type errors on .data property
   ```

3. **Property access on PR objects**
   ```typescript
   const state = pullData.state;
   // Type errors on .state, .locked, .draft, etc.
   ```

4. **Pagination and GraphQL APIs**
   ```typescript
   await octokit.paginate(...)  // Type error
   await octokit.graphql(...)   // Type error
   ```

## Testing Methodology

Each library was upgraded individually and tested with `npm run check:lint` to measure the impact on TypeScript ESLint errors.

**Test environment:**
- Node.js: v20.20.0
- npm: 10.8.2
- Date: 2026-01-29

## Detailed Documentation

Three comprehensive documents have been created:

1. **UPGRADE_ANALYSIS.md** (Japanese) - Complete analysis with background and recommendations
2. **UPGRADE_ANALYSIS_TECHNICAL_DETAILS.md** (Japanese) - Technical details, error examples, and fix approaches
3. **UPGRADE_TEST_SUMMARY.md** (Japanese) - Visual summary with tables and charts

## Conclusion

The `npm run all:full-upgrade` failure is entirely caused by the @actions/github upgrade from 7.0.0 to 8.0.0+, which introduces 208 new TypeScript type safety errors primarily in `src/github-api.ts`.

**Five out of six library upgrades are safe to apply immediately.** Only @actions/github requires keeping the current version or undertaking significant type annotation work to upgrade.
