# .cursor/rules ルールファイルの分類分析

## 元のプロンプト

.cursor/rules 以下のルールファイルの内容と意図や背景および目的等を解析・読解し、分類分け (ラベル付け) する場合、どのような分類が可能か、分類分けの方法と分類分けの結果について、複数の軸でわける「わけかた」についてどのルールファイルがどの分類に収まるのか、もあわせて、整理してみてください。

---

## 概要

本ドキュメントでは、`.cursor/rules` ディレクトリー配下にある 13 個のルールファイルについて、その内容、意図、背景、目的を分析し、複数の軸で分類を行った結果を記載する。

## 分析対象のルールファイル一覧

1. `artifact-zero-meta-output.mdc`
2. `behavioral-epistemic.mdc`
3. `docs-metrics-policy.mdc`
4. `engineering-abstraction-dry.mdc`
5. `git-pr-conventions.mdc`
6. `japanese-doc-style.mdc`
7. `logic-first.mdc`
8. `meta-rule.rule-for-ai-guidances.mdc`
9. `planning-and-scope.mdc`
10. `rule-application-recheck.mdc`
11. `shell-bash-conventions.mdc`
12. `tmp-inbox-conventions.mdc`
13. `version-external-info-epistemic.mdc`

---

## 分類軸の定義と分類結果

### 軸 1: 適用範囲 (Application Scope)

**定義**: ルールが常に適用されるか、特定の条件下でのみ適用されるか

#### 分類:

**1-A: 常時適用 (alwaysApply: true)**
- `artifact-zero-meta-output.mdc` - 成果物作成時に常に適用
- `behavioral-epistemic.mdc` - AI の振る舞いと認識論的ルール
- `docs-metrics-policy.mdc` - ドキュメント内の定量的指標ポリシー
- `engineering-abstraction-dry.mdc` - 抽象化と DRY 原則
- `git-pr-conventions.mdc` - Git と PR の規約
- `japanese-doc-style.mdc` - 日本語ドキュメントスタイル
- `meta-rule.rule-for-ai-guidances.mdc` - AI ガイダンス規定 (メタルール)
- `planning-and-scope.mdc` - プランニングとスコープ
- `rule-application-recheck.mdc` - ルール適用の再チェック
- `tmp-inbox-conventions.mdc` - 一時ファイル規約
- `version-external-info-epistemic.mdc` - バージョン情報と外部情報の認識論的ルール

**1-B: 条件付き適用 (alwaysApply: false)**
- `logic-first.mdc` - 複雑な変更の際に適用 (小さな変更では省略可)
- `shell-bash-conventions.mdc` - シェルスクリプト作成・編集時に適用

---

### 軸 2: 規定対象 (Target Domain)

**定義**: ルールが何を規定しているか (技術的内容、振る舞い、メタルール等)

#### 分類:

**2-A: AI の振る舞い・姿勢・認識論**
- `behavioral-epistemic.mdc` - AI の役割、中立性、証拠ベース、意思決定権限
- `version-external-info-epistemic.mdc` - バージョン情報の扱いと認識論的謙虚さ

**2-B: コーディング規約・技術的規約**
- `engineering-abstraction-dry.mdc` - 抽象化と DRY 原則 (Rule of Three)
- `shell-bash-conventions.mdc` - シェルスクリプトのコーディング規約 (変数参照、クォート等)

**2-C: ドキュメント記述規約**
- `docs-metrics-policy.mdc` - 定量的指標をドキュメントに含めないポリシー
- `japanese-doc-style.mdc` - 日本語ドキュメントのスタイル (括弧、長音符号等)

**2-D: プロジェクト管理・ワークフロー規約**
- `git-pr-conventions.mdc` - Git コミットメッセージと PR の規約
- `planning-and-scope.mdc` - プランニング専用要求への対応
- `tmp-inbox-conventions.mdc` - 一時ファイルの保管場所と命名規則

**2-E: 成果物出力規約**
- `artifact-zero-meta-output.mdc` - 成果物にメタコメントを含めない

**2-F: 思考・作業プロセス規約**
- `logic-first.mdc` - 複雑な変更時の分析→戦略→確認のプロセス

**2-G: メタルール・システム規約**
- `meta-rule.rule-for-ai-guidances.mdc` - AI ガイダンス全体のルール (言語、規範的用語の解釈)
- `rule-application-recheck.mdc` - ルール適用の再チェック義務

---

### 軸 3: 主要な目的 (Primary Purpose)

**定義**: ルールが達成しようとする主な目的

#### 分類:

**3-A: 品質保証・一貫性確保**
- `docs-metrics-policy.mdc` - ドキュメントのドリフト防止
- `engineering-abstraction-dry.mdc` - 過度な抽象化の防止、実用的なコード品質
- `git-pr-conventions.mdc` - コミットメッセージと PR の一貫性
- `japanese-doc-style.mdc` - 日本語表記の一貫性
- `shell-bash-conventions.mdc` - シェルスクリプトの一貫性と安全性
- `rule-application-recheck.mdc` - ルール適用漏れの防止

**3-B: AI の認識精度向上・誤解防止**
- `behavioral-epistemic.mdc` - 中立性、証拠ベース、不確実性の明示
- `meta-rule.rule-for-ai-guidances.mdc` - 英語記述による AI の認知負荷低減
- `version-external-info-epistemic.mdc` - バージョン情報の過信防止、幻覚の防止

**3-C: 成果物の明瞭性・読みやすさ向上**
- `artifact-zero-meta-output.mdc` - 成果物の独立性、メタコメントの排除
- `japanese-doc-style.mdc` - 読みやすさ向上 (半角括弧、長音符号)

**3-D: 作業プロセスの効率化・品質向上**
- `logic-first.mdc` - 複雑な変更の前に計画を立てる
- `planning-and-scope.mdc` - プランニングと実装の明確な分離
- `tmp-inbox-conventions.mdc` - 一時ファイルの整理

---

### 軸 4: 規範レベル (Normative Level)

**定義**: ルールの強制力・規範性の強さ

#### 分類:

**4-A: 厳格な MUST レベル (強い強制力)**
- `artifact-zero-meta-output.mdc` - MUST が多用され、違反は非準拠出力とされる
- `meta-rule.rule-for-ai-guidances.mdc` - MUST で英語記述、標準前文、RFC 準拠を要求
- `japanese-doc-style.mdc` - 全角括弧の使用を MUST NOT で禁止、編集後の検証を MUST で要求
- `planning-and-scope.mdc` - プランニング専用要求時にファイル変更を MUST NOT で禁止
- `rule-application-recheck.mdc` - 処理終了時の再チェックを MUST で要求

**4-B: SHOULD レベル (推奨、ベストプラクティス)**
- `behavioral-epistemic.mdc` - SHOULD で推奨する振る舞いが多い
- `git-pr-conventions.mdc` - PR 説明は日本語で書く SHOULD
- `version-external-info-epistemic.mdc` - 最新バージョンの確認を SHOULD で推奨

**4-C: プラグマティック (実用的判断を許容)**
- `engineering-abstraction-dry.mdc` - Rule of Three (3 回目に抽象化)、過度な DRY を避ける
- `logic-first.mdc` - 小さなタスクでは省略可 (MAY)

**4-D: 条件付き (特定状況でのみ適用)**
- `shell-bash-conventions.mdc` - シェルスクリプト作成・編集時のみ適用

---

### 軸 5: 技術的 vs 組織的 (Technical vs Organizational)

**定義**: 技術的な実装に関するルールか、組織的・プロセス的なルールか

#### 分類:

**5-A: 技術的ルール (コード、スクリプト、ツール等)**
- `engineering-abstraction-dry.mdc` - コードの抽象化
- `shell-bash-conventions.mdc` - シェルスクリプトの記法
- `docs-metrics-policy.mdc` - ドキュメントの技術的内容

**5-B: 組織的・プロセス的ルール**
- `git-pr-conventions.mdc` - Git/PR のコミュニケーション規約
- `planning-and-scope.mdc` - プランニングと実装の分離
- `tmp-inbox-conventions.mdc` - ファイル管理プロセス

**5-C: AI の振る舞い・認識論 (技術と組織の境界)**
- `behavioral-epistemic.mdc` - AI の役割と姿勢
- `version-external-info-epistemic.mdc` - 情報の扱いと認識論

**5-D: 成果物の形式・表現**
- `artifact-zero-meta-output.mdc` - 成果物の出力形式
- `japanese-doc-style.mdc` - 日本語表記規約

**5-E: 思考プロセス**
- `logic-first.mdc` - 作業前の分析・戦略立案

**5-F: メタレベル (ルールのルール)**
- `meta-rule.rule-for-ai-guidances.mdc` - AI ガイダンス全体の規定
- `rule-application-recheck.mdc` - ルール適用の再チェック

---

### 軸 6: 対象読者 (Intended Reader)

**定義**: ルールの主要な対象読者

#### 分類:

**6-A: 主に AI (AI が守るべきルール)**
- `artifact-zero-meta-output.mdc` - AI の出力形式
- `behavioral-epistemic.mdc` - AI の振る舞い
- `logic-first.mdc` - AI の思考プロセス
- `meta-rule.rule-for-ai-guidances.mdc` - AI ガイダンス全体
- `planning-and-scope.mdc` - AI の作業スコープ
- `rule-application-recheck.mdc` - AI によるルール適用
- `version-external-info-epistemic.mdc` - AI の情報取得と提示

**6-B: AI と人間の両方 (共通理解)**
- `docs-metrics-policy.mdc` - ドキュメント記述方針
- `engineering-abstraction-dry.mdc` - コーディング原則
- `git-pr-conventions.mdc` - Git/PR 規約
- `japanese-doc-style.mdc` - 日本語表記規約
- `shell-bash-conventions.mdc` - シェルスクリプト規約
- `tmp-inbox-conventions.mdc` - ファイル管理規約

---

### 軸 7: エラー防止の焦点 (Error Prevention Focus)

**定義**: どのようなエラーや問題を防止することに焦点を当てているか

#### 分類:

**7-A: 表記の不統一・スタイル違反の防止**
- `japanese-doc-style.mdc` - 全角括弧、長音符号の不統一
- `shell-bash-conventions.mdc` - 変数参照、クォートの不統一

**7-B: 誤解・認識エラーの防止**
- `behavioral-epistemic.mdc` - 過度な肯定、推測の事実化
- `meta-rule.rule-for-ai-guidances.mdc` - 非英語記述による AI の誤解
- `version-external-info-epistemic.mdc` - バージョン情報の過信、幻覚

**7-C: ドキュメントドリフト・陳腐化の防止**
- `docs-metrics-policy.mdc` - 定量的指標の陳腐化

**7-D: 過度な最適化・複雑化の防止**
- `engineering-abstraction-dry.mdc` - 早すぎる抽象化

**7-E: 成果物の汚染・ノイズの防止**
- `artifact-zero-meta-output.mdc` - メタコメント、修正履歴の混入

**7-F: 作業スコープの逸脱防止**
- `planning-and-scope.mdc` - プランニング要求時のファイル変更
- `logic-first.mdc` - 計画なしでの複雑な変更

**7-G: ルール適用漏れの防止**
- `rule-application-recheck.mdc` - ルール適用の確認漏れ

**7-H: ファイル管理の混乱防止**
- `tmp-inbox-conventions.mdc` - 一時ファイルの散乱

---

### 軸 8: 言語・表記に関する規定 (Language and Notation)

**定義**: 言語や表記に関する規定の有無と内容

#### 分類:

**8-A: 特定言語の使用を規定**
- `meta-rule.rule-for-ai-guidances.mdc` - AI ガイダンスは英語で記述 (MUST)
- `git-pr-conventions.mdc` - PR 説明は日本語で記述 (SHOULD)

**8-B: 特定言語内の表記規則を規定**
- `japanese-doc-style.mdc` - 日本語の括弧、長音符号の表記規則

**8-C: 技術記法の規則を規定**
- `shell-bash-conventions.mdc` - シェルスクリプトの記法 (変数、クォート等)

**8-D: 言語・表記について規定なし**
- `artifact-zero-meta-output.mdc`
- `behavioral-epistemic.mdc`
- `docs-metrics-policy.mdc`
- `engineering-abstraction-dry.mdc`
- `logic-first.mdc`
- `planning-and-scope.mdc`
- `rule-application-recheck.mdc`
- `tmp-inbox-conventions.mdc`
- `version-external-info-epistemic.mdc`

---

### 軸 9: 検証・チェック機構の有無 (Verification Mechanism)

**定義**: ルールに検証ステップやチェック機構が組み込まれているか

#### 分類:

**9-A: 明示的な検証ステップあり**
- `japanese-doc-style.mdc` - 編集後の全角括弧検索を MUST で要求
- `rule-application-recheck.mdc` - 処理終了時の全ルール再チェックを MUST で要求

**9-B: 検証ステップなし (ルールの遵守を前提)**
- `artifact-zero-meta-output.mdc`
- `behavioral-epistemic.mdc`
- `docs-metrics-policy.mdc`
- `engineering-abstraction-dry.mdc`
- `git-pr-conventions.mdc`
- `logic-first.mdc`
- `meta-rule.rule-for-ai-guidances.mdc`
- `planning-and-scope.mdc`
- `shell-bash-conventions.mdc`
- `tmp-inbox-conventions.mdc`
- `version-external-info-epistemic.mdc`

---

### 軸 10: 階層性・依存関係 (Hierarchy and Dependencies)

**定義**: ルール間の階層性や依存関係

#### 分類:

**10-A: メタルール (他のルールを規定するルール)**
- `meta-rule.rule-for-ai-guidances.mdc` - 全 AI ガイダンスの基礎ルール
- `rule-application-recheck.mdc` - 全ルールの適用を確認するメタルール

**10-B: 標準ルール (メタルールに依存)**
- すべての `.mdc` ファイル (meta-rule 以外) が `meta-rule.rule-for-ai-guidances.mdc` が定める標準前文を持つ
- 具体的には以下の 11 ファイル:
  - `artifact-zero-meta-output.mdc`
  - `behavioral-epistemic.mdc`
  - `docs-metrics-policy.mdc`
  - `engineering-abstraction-dry.mdc`
  - `git-pr-conventions.mdc`
  - `japanese-doc-style.mdc`
  - `logic-first.mdc`
  - `planning-and-scope.mdc`
  - `rule-application-recheck.mdc`
  - `shell-bash-conventions.mdc`
  - `tmp-inbox-conventions.mdc`
  - `version-external-info-epistemic.mdc`

**10-C: 相互参照・関連性**
- `japanese-doc-style.mdc` と `rule-application-recheck.mdc` は、どちらも検証ステップを要求
- `planning-and-scope.mdc` と `logic-first.mdc` は、どちらも作業プロセスに関する
- `behavioral-epistemic.mdc` と `version-external-info-epistemic.mdc` は、どちらも認識論的な内容

---

## まとめ: 分類の鳥瞰図

以下は、各ルールがどのような性質を持つかを複数の軸で可視化した鳥瞰図である。

| ルールファイル | 適用範囲 | 規定対象 | 主要目的 | 規範レベル | 技術 vs 組織 | 対象読者 | エラー防止の焦点 | 言語・表記規定 | 検証機構 | 階層性 |
|--------------|---------|---------|---------|-----------|------------|---------|----------------|-------------|---------|-------|
| `artifact-zero-meta-output.mdc` | 常時 | 成果物出力規約 | 成果物の明瞭性 | 厳格 MUST | 成果物形式 | 主に AI | 成果物汚染 | なし | なし | 標準 |
| `behavioral-epistemic.mdc` | 常時 | AI 振る舞い | AI 認識精度向上 | SHOULD | AI 振る舞い | 主に AI | 誤解・認識エラー | なし | なし | 標準 |
| `docs-metrics-policy.mdc` | 常時 | ドキュメント規約 | 品質保証 | 推奨 | 技術的 | AI と人間 | ドキュメントドリフト | なし | なし | 標準 |
| `engineering-abstraction-dry.mdc` | 常時 | コーディング規約 | 品質保証 | プラグマティック | 技術的 | AI と人間 | 過度な最適化 | なし | なし | 標準 |
| `git-pr-conventions.mdc` | 常時 | プロジェクト管理 | 品質保証 | SHOULD | 組織的 | AI と人間 | 表記の不統一 | 特定言語 (PR は日本語) | なし | 標準 |
| `japanese-doc-style.mdc` | 常時 | ドキュメント規約 | 成果物の明瞭性・品質保証 | 厳格 MUST | 成果物形式 | AI と人間 | 表記の不統一 | 特定言語表記 (日本語) | あり (編集後検証) | 標準 |
| `logic-first.mdc` | 条件付き | 思考プロセス | 作業プロセス効率化 | プラグマティック | 思考プロセス | 主に AI | スコープ逸脱 | なし | なし | 標準 |
| `meta-rule.rule-for-ai-guidances.mdc` | 常時 | メタルール | AI 認識精度向上 | 厳格 MUST | メタレベル | 主に AI | 誤解・認識エラー | 特定言語 (英語) | なし | メタルール |
| `planning-and-scope.mdc` | 常時 | プロジェクト管理 | 作業プロセス効率化 | 厳格 MUST | 組織的 | 主に AI | スコープ逸脱 | なし | なし | 標準 |
| `rule-application-recheck.mdc` | 常時 | メタルール | 品質保証 | 厳格 MUST | メタレベル | 主に AI | ルール適用漏れ | なし | あり (処理終了時チェック) | メタルール |
| `shell-bash-conventions.mdc` | 条件付き | コーディング規約 | 品質保証 | 条件付き | 技術的 | AI と人間 | 表記の不統一 | 技術記法 | なし | 標準 |
| `tmp-inbox-conventions.mdc` | 常時 | プロジェクト管理 | 作業プロセス効率化 | 規定 | 組織的 | AI と人間 | ファイル管理混乱 | なし | なし | 標準 |
| `version-external-info-epistemic.mdc` | 常時 | AI 振る舞い | AI 認識精度向上 | SHOULD | AI 振る舞い | 主に AI | 誤解・認識エラー | なし | なし | 標準 |

---

## 特記事項: ルール間の相互作用

### 1. メタルールの影響

- `meta-rule.rule-for-ai-guidances.mdc` は、すべての AI ガイダンスファイルに標準前文を要求し、英語記述、RFC 2119/8174 準拠の規範的用語を義務付けている。このため、他のすべてのルールはこのメタルールに依存している。
- `rule-application-recheck.mdc` は、すべてのルールの適用を再チェックするメタルールであり、他のすべてのルールの適用漏れを防ぐための横断的な役割を持つ。

### 2. 検証ステップの重複

- `japanese-doc-style.mdc` は編集後に全角括弧の検証を MUST で要求。
- `rule-application-recheck.mdc` は処理終了時にすべてのルールの再チェックを MUST で要求。
- これらは重複ではなく、意図的に多重の検証を行うことで品質を担保している。

### 3. 認識論的ルールの共通性

- `behavioral-epistemic.mdc` と `version-external-info-epistemic.mdc` は、どちらも AI の認識論的な側面 (不確実性の扱い、証拠ベース、幻覚の防止) を規定している。
- これらは AI の情報処理と提示の信頼性を高めることを共通の目的としている。

### 4. 作業プロセスの連携

- `logic-first.mdc` は複雑な変更の前に分析と戦略を立てることを求める。
- `planning-and-scope.mdc` はプランニング専用要求時にファイル変更を禁止する。
- これらは作業プロセスの段階的な進行を規定し、計画と実装の分離を強化している。

---

## 結論

`.cursor/rules` 配下の 13 個のルールファイルは、以下のような多層的な分類軸で整理できる:

1. **適用範囲**: 常時適用 (11 個) vs 条件付き適用 (2 個)
2. **規定対象**: AI 振る舞い、コーディング規約、ドキュメント規約、プロジェクト管理、成果物出力、思考プロセス、メタルール
3. **主要目的**: 品質保証、AI 認識精度向上、成果物の明瞭性、作業プロセス効率化
4. **規範レベル**: 厳格 MUST (5 個)、SHOULD (3 個)、プラグマティック (2 個)、条件付き (1 個)
5. **技術 vs 組織**: 技術的、組織的、AI 振る舞い、成果物形式、思考プロセス、メタレベル
6. **対象読者**: 主に AI (7 個) vs AI と人間の両方 (6 個)
7. **エラー防止の焦点**: 表記の不統一、誤解、ドキュメントドリフト、過度な最適化、成果物汚染、スコープ逸脱、ルール適用漏れ、ファイル管理混乱
8. **言語・表記規定**: 特定言語使用 (2 個)、言語内表記規則 (1 個)、技術記法 (1 個)、規定なし (9 個)
9. **検証機構**: 明示的検証あり (2 個) vs なし (11 個)
10. **階層性**: メタルール (2 個) vs 標準ルール (11 個)

これらのルールは単独で機能するだけでなく、相互に依存し、補完し合うことで、AI アシスタントによる高品質な成果物の作成と一貫性のあるプロジェクト管理を実現している。
