# 技術的な詳細情報

## @actions/github@8.0.0 で発生する具体的なエラー

### src/github-api.ts でのエラー例

以下は @actions/github@8.0.0+ で新たに発生するエラーの具体例です:

#### 1. REST API 呼び出しの型エラー

```typescript
// Line 27-28: getBranchProtection()
const response = await octokit.rest.repos.getBranchProtection({
  //                    ^^^^^^^^^^^^^^^^^ 
  // Error: Unsafe call of a type that could not be resolved
  // Error: Unsafe member access .rest on a type that cannot be resolved
```

#### 2. レスポンスデータの型エラー

```typescript
// Line 78-83: getPullRequest()
const response = await octokit.rest.pulls.get({...});
//                    ^^^^^^^^^^^^^^^^^^^^^^^^
// Error: Unsafe assignment of an error typed value

return response.data;
//     ^^^^^^^^^^^^^
// Error: Unsafe return of a value of type error
// Error: Unsafe member access .data on a type that cannot be resolved
```

#### 3. プロパティアクセスの型エラー

```typescript
// Lines 116-127: getPullRequest()
const state = pullData.state;
//            ^^^^^^^^^^^^^^^
// Error: Unsafe assignment of an error typed value
// Error: Unsafe member access .state on a type that cannot be resolved

const locked = pullData.locked;
//             ^^^^^^^^^^^^^^^^
// Error: Unsafe member access .locked on a type that cannot be resolved

const draft = pullData.draft;
//            ^^^^^^^^^^^^^^^
// Error: Unsafe member access .draft on a type that cannot be resolved

// ... and so on for all properties
```

#### 4. Pagination API の型エラー

```typescript
// Line 146: getReviews()
const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
//                    ^^^^^^^^^^^^^^^^
// Error: Unsafe assignment of an error typed value
// Error: Unsafe call of a type that could not be resolved
// Error: Unsafe member access .paginate on a type that cannot be resolved
```

#### 5. GraphQL API の型エラー

```typescript
// Line 238: getMergeableState()
const result = await octokit.graphql<GraphQLResponse>(query, {
//                   ^^^^^^^^^^^^^^^^^^^^
// Error: Unsafe call of a type that could not be resolved
// Error: Unsafe member access .graphql on a type that cannot be resolved
```

## エラー発生箇所の完全リスト (src/github-api.ts)

合計 60+ のエラーが src/github-api.ts で発生しています:

### 関数別エラー数

1. `getBranchProtection()` (lines 20-31): 2 errors
2. `updateBranchProtection()` (lines 44-62): 2 errors
3. `getPullRequest()` (lines 73-133): 38 errors
   - REST API 呼び出し: 3 errors
   - レスポンスデータの型: 2 errors
   - PRプロパティアクセス: 30+ errors
4. `getReviews()` (lines 140-156): 8 errors
5. `addLabels()` (lines 171-180): 2 errors
6. `getMergeableState()` (lines 220-265): 4 errors
7. `getCommits()` (lines 268-279): 6 errors
8. `mergePullRequest()` (lines 297-314): 4 errors

## 型定義の変更内容の推測

@actions/github@8.0.0 では、おそらく以下の変更が行われたと考えられます:

1. **Octokit クライアントの型定義の変更**
   - `octokit.rest` の型が変更され、型推論が効かなくなった
   - `octokit.paginate` の型が変更された
   - `octokit.graphql` の型が変更された

2. **レスポンスオブジェクトの型定義の変更**
   - `.data` プロパティの型が `any` または `unknown` になった可能性
   - 各プロパティアクセスで明示的な型アサーションが必要になった

3. **後方互換性のない型変更**
   - v7.0.0 では暗黙的に推論されていた型が、v8.0.0 では明示的な指定が必要に

## 修正アプローチの提案

### アプローチ 1: 型アノテーションの追加

```typescript
// Before (v7.0.0 で動作)
const response = await octokit.rest.pulls.get({...});
const state = response.data.state;

// After (v8.0.0+ で必要)
const response: { data: PullRequest } = await octokit.rest.pulls.get({...});
const state: string = response.data.state;
```

### アプローチ 2: 型アサーション

```typescript
const response = await octokit.rest.pulls.get({...});
const pullData = response.data as PullRequest;
const state = pullData.state;
```

### アプローチ 3: @ts-expect-error の使用 (非推奨)

```typescript
// @ts-expect-error - @actions/github@8.0.0 type issue
const response = await octokit.rest.pulls.get({...});
```

### アプローチ 4: ESLint ルールの調整 (非推奨)

```javascript
// eslint.config.mjs
rules: {
  '@typescript-eslint/no-unsafe-assignment': 'warn',
  '@typescript-eslint/no-unsafe-member-access': 'warn',
  '@typescript-eslint/no-unsafe-call': 'warn',
}
```

## テスト環境での検証

### 検証コマンド

```bash
# 各バージョンのテスト
cd .github/actions/lysbot-merge

# @actions/github@7.0.0 (ベースライン)
npm install @actions/github@7.0.0 --save-exact
npm run check:lint  # 177 errors

# @actions/github@8.0.0 (問題発生)
npm install @actions/github@8.0.0 --save-exact
npm run check:lint  # 385 errors (+208)

# @actions/github@9.0.0 (問題継続)
npm install @actions/github@9.0.0 --save-exact
npm run check:lint  # 385 errors (+208)
```

## 関連リソース

- [@actions/github リリースノート](https://github.com/actions/toolkit/blob/main/packages/github/RELEASES.md)
- [TypeScript ESLint ルール: no-unsafe-assignment](https://typescript-eslint.io/rules/no-unsafe-assignment/)
- [TypeScript ESLint ルール: no-unsafe-member-access](https://typescript-eslint.io/rules/no-unsafe-member-access/)
- [TypeScript ESLint ルール: no-unsafe-call](https://typescript-eslint.io/rules/no-unsafe-call/)

## 次のステップ

1. @actions/github の v8.0.0 の CHANGELOG を確認
2. 型定義ファイル (`@types` パッケージ) の変更内容を調査
3. 必要に応じて、GitHub Actions Toolkit チームに問い合わせ
4. 型修正の作業見積もりを作成 (推定: 数時間〜1日)
