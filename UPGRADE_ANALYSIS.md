# npm run all:full-upgrade 問題分析レポート

## 概要

`(cd .github/actions/lysbot-merge && npm run all:full-upgrade)` を実行すると、TypeScript ESLint エラーが大量に発生し、ビルドプロセスが失敗する問題を調査しました。

## 実行環境

- Node.js: v20.20.0
- npm: 10.8.2
- 調査日: 2026-01-29

## 検出されたアップグレード

`npm-check-updates` により以下のライブラリアップデートが検出されました:

1. @actions/core: ^2.0.2 → ^3.0.0
2. @actions/github: ^7.0.0 → ^9.0.0
3. @stylistic/eslint-plugin: ^5.7.0 → ^5.7.1
4. @typescript-eslint/parser: ^8.53.1 → ^8.54.0
5. rollup: ^4.56.0 → ^4.57.0
6. typescript-eslint: ^8.53.1 → ^8.54.0

## 調査方法

各ライブラリを個別にアップグレードし、`npm run check:lint` を実行してエラー数を比較しました。

## 調査結果

### ベースライン (アップグレード前)

- **ESLint エラー数**: 177 errors
- 影響範囲: テストファイルのみ (`__tests__/action.test.ts`, `__tests__/github-api.test.ts`)

### 個別アップグレードテスト結果

| ライブラリ | バージョン変更 | ESLint エラー数 | 結果 |
|-----------|---------------|----------------|------|
| @stylistic/eslint-plugin | 5.7.0 → 5.7.1 | 177 errors | ✓ 問題なし |
| rollup | 4.56.0 → 4.57.0 | 177 errors | ✓ 問題なし |
| @typescript-eslint/parser | 8.53.1 → 8.54.0 | 177 errors | ✓ 問題なし |
| typescript-eslint | 8.53.1 → 8.54.0 | 177 errors | ✓ 問題なし |
| @actions/core | 2.0.2 → 3.0.0 | 177 errors | ✓ 問題なし |
| **@actions/github** | **7.0.0 → 9.0.0** | **385 errors** | **✗ 208個のエラー増加** |
| **@actions/github** | **7.0.0 → 8.0.0** | **385 errors** | **✗ 208個のエラー増加** |

## 問題の原因

**@actions/github@8.0.0 以降のバージョンアップが問題の根本原因**

### エラー増加の詳細

- **ベースライン**: 177 errors
- **@actions/github@8.0.0+**: 385 errors
- **増加分**: +208 errors

### エラータイプ別の増加

| エラータイプ | ベースライン | @actions/github@9.0.0 | 増加 |
|-------------|-------------|----------------------|------|
| @typescript-eslint/no-unsafe-member-access | 71 | 174 | +103 |
| @typescript-eslint/no-unsafe-assignment | 50 | 114 | +64 |
| @typescript-eslint/no-unsafe-call | 47 | 82 | +35 |
| @typescript-eslint/no-unsafe-return | 8 | 14 | +6 |

### 新たに影響を受けるファイル

@actions/github@8.0.0+ へのアップグレードにより、以下のソースファイルでもエラーが発生するようになりました:

- `src/github-api.ts`: 大量の型安全性エラー (REST API、GraphQL API、Pagination 関連)
- `src/main.ts`: 型安全性エラー
- `__tests__/action.test.ts`: 追加のエラー
- `__tests__/github-api.test.ts`: 追加のエラー
- `__tests__/main.test.ts`: 追加のエラー

### 具体的なエラーの内容

@actions/github@8.0.0+ では、以下のAPIアクセスで型情報が失われています:

1. `octokit.rest.*` メソッドの呼び出し
2. `octokit.paginate()` の使用
3. `octokit.graphql()` の使用
4. レスポンスオブジェクトのプロパティアクセス (`.data`, `.state`, `.head`, `.base` など)

## 推奨事項

### 短期的な対応

1. **@actions/github@7.0.0 を維持する**: 現状では @actions/github@8.0.0 以降へのアップグレードは推奨されません
2. **他のライブラリは安全にアップグレード可能**: 以下のアップグレードは問題ありません
   - @actions/core: ^2.0.2 → ^3.0.0
   - @stylistic/eslint-plugin: ^5.7.0 → ^5.7.1
   - @typescript-eslint/parser: ^8.53.1 → ^8.54.0
   - rollup: ^4.56.0 → ^4.57.0
   - typescript-eslint: ^8.53.1 → ^8.54.0

### 長期的な対応

@actions/github@8.0.0+ へのアップグレードを実現するには、以下の対応が必要です:

1. **型アノテーションの追加**: `src/github-api.ts` および関連ファイルに明示的な型アノテーションを追加
2. **@actions/github の型定義の調査**: v8.0.0 での型定義の変更内容を確認
3. **段階的な修正**:
   - まず `src/github-api.ts` の型安全性を確保
   - 次にテストファイルの型エラーを修正
   - 全ての型エラーを解決後、アップグレードを完了

## 結論

`npm run all:full-upgrade` の失敗は **@actions/github のバージョン 7.0.0 から 8.0.0 への変更により発生する 208 個の TypeScript ESLint エラー**が原因です。

他のライブラリのアップグレードは問題なく適用可能ですが、@actions/github については v7.0.0 を維持するか、大規模な型修正作業を実施する必要があります。
