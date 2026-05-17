# Firebase Realtime Database Rules - IaC 運用ガイド

2026-05-18 から Rules は Firebase Console 直接管理ではなく、本リポの
`database.rules.json` を **真実のソース** として Firebase CLI 経由で deploy する運用に移行。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `database.rules.json` | Rules 本体（真実のソース） |
| `firebase.json` | Firebase CLI に Rules ファイルパスを伝える設定 |
| `.firebaserc` | プロジェクト ID（sawatdee-bros）紐付け |

## 通常運用フロー（変更時）

1. `database.rules.json` を git で編集
2. 構文チェック: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8'))"`
3. git commit（変更理由を message に明記）
4. **deploy 前に既存と diff 取って想定通りか確認**
5. deploy:
   ```powershell
   firebase deploy --only database --project sawatdee-bros
   ```
6. Firebase Console で実際の Rules が反映されたか目視確認
7. git push

### 注意

- **Console 直接編集は原則禁止**（git と乖離する）
- 緊急時に Console 直接編集する場合は、必ず後で git に反映させて同期し直す
- 同内容 deploy は無害（変更なしと判定される）

## Rollback 手順

### 方法1: git revert で前バージョンに戻す（推奨）

```powershell
# 直前の Rules 変更コミットを取り消す（変更コミットだけ revert）
git revert <commit-hash>
firebase deploy --only database --project sawatdee-bros
```

### 方法2: Firebase Console の履歴から復元

1. https://console.firebase.google.com/project/sawatdee-bros/database/sawatdee-bros-default-rtdb/rules
2. 右上の「履歴」アイコン → 復元したいバージョンを選択 → 「ロールバック」
3. **その後必ず** `database.rules.json` も同じ内容に戻して git commit（git と Console の整合性維持）

### Console 履歴から取得して git に反映

Console から復元した場合、リポ側も追随する：

1. Console の Rules テキストをコピー
2. `database.rules.json` に貼り付け
3. `git add database.rules.json && git commit -m "sync: console revert を反映"`

## セットアップ（新規端末で IaC 環境を整える場合）

```powershell
# 1. Node.js インストール（未導入なら）
winget install OpenJS.NodeJS

# 2. Firebase CLI
npm install -g firebase-tools
firebase --version  # 確認

# 3. 認証
firebase login
# - Gemini in Firebase: N
# - 利用統計送信: N
# - Google アカウントで認証

# 4. プロジェクト確認
cd C:\dev\sawatdee-bros
firebase projects:list  # sawatdee-bros (current) が見えればOK
```

## SaaS化フェーズへの含意

- マルチテナント化（`tenants/{tenantId}/...`）時には Rules も書き換え必要
- saas-refresh Stage 5 で Rules 二重ガード（session 検査 + テナント境界）を追加予定
- その際もこの IaC フローで管理（git で差分・rollback 容易）

## 関連

- 配置経緯: `memory/project_saas_refresh_scope.md` Stage 5 関連サブタスク
- 既存 Rules 構造: `memory/project_attendance_repo.md` / `project_session_issuance.md`
