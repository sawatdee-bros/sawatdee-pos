# 未解決・継続確認事項

> bug-fix / saas-planning セッションで継続して扱う事項のメモ。
> 解決したら該当行を削除してください。

---

## 🚧 進行中：スタッフ承認フロー実装（2026-05-08着手）

director裁定により、Phase 1 セキュリティ機能（テーブル占有チェック）をサワディーブロス本店に先行実装中。SaaS化に向けた実証も兼ねる。

### フェーズ進捗
- [x] **フェーズ1**：feature flag `enable_approval_flow` 追加（kitchen/customer/handy/nomi の4画面で読み出し済・全部false固定）。動作変更なし
- [ ] **フェーズ2**：`tables/{tableNum}/session` 実装。handy.html / kitchen.html のPAX入力で発行
- [ ] **フェーズ3**：customer.html — 注文送信前にセッション確認、pending_approval分岐、status監視（REST polling 3〜5秒）。**人数入力UI削除＋pax自動参照も同時実施**
- [ ] **フェーズ4**：kitchen.html — 承認待ちエリア、承認/拒否モーダル、一括拒否
- [ ] **フェーズ5**：Firebase Rules更新（**directorに事前確認必須・テストノードで検証必須・既存ルールバックアップ必須**）
- [ ] **フェーズ6**：営業終了後フラグON → 最低3営業日観察

### フェーズ4で必ず修正する箇所（status分岐ロジック）
新status（`pending_approval` / `rejected`）が混入したときに既存コードが想定外動作するため、以下の箇所を精密修正：

**kitchen.html（要：rejectedを未会計から除外）**
- 861行：`if (o.status !== 'paid') unpaidTables.add(...)` → rejectedも除外
- 1158行：`data[id].status !== 'done' && data[id].status !== 'paid'` → 取込はOK・ただし rejected/pending_approval は別エリア表示分岐を追加
- 1188行：同上
- 1194行：`orders[oid].status !== 'done'` → rejected除外
- 1249行：`var isUnpaid = o.status !== 'paid'` → rejected除外
- 1766/1774/1808/1854行：伝票/セッション集計の各分岐に rejected 除外を追加

**bills.html（要：rejectedを未会計から除外）**
- 483行：`if (o.status!=='done' && o.status!=='paid') activeCount++` → rejected除外
- 686行：`all[id].status !== 'done' && all[id].status !== 'paid'` → rejected除外

**sales.html（修正不要・現状で正解）**
- `'paid' || 'done'` でフィルタしているのでpending_approval/rejectedは自動的に売上集計対象外

### HMAC署名QRは別タスク
director裁定により、テーブル占有チェック完了後、別bug-fixサイクルで対応。
- URL構造変更を含むため影響範囲が広い
- テーブル占有チェックだけでG脅威（元客遠隔注文）はカバー可能

### rejected注文の自動削除（後回しOKの小タスク）
rejected注文がFirebase上に積み上がる懸念。`cleanup_orders.html` を拡張して「rejected注文を30日後自動削除」を追加する。

---

## 動作確認待ち

### customer.html / handy.html / nomi.html のREST API化（2026-05-08修正）
- **背景**：iPhone Safariでcustomer.htmlの読み込みが約2分間ハングする症状を確認。診断版（customer-debug.html）でFirebase WebSocketが「ゾンビ化」していることを特定（接続は成立するがデータが流れず、約120秒後に再接続で復旧）。
- **修正内容**：
  - 客向け画面（customer.html）の初期データ取得を全てREST API（HTTPS fetch）に置換、`Promise.all`で並列化、`onValue(soldout)`は描画後に張る順に変更（実機確認済・解消）
  - 同症状の予防として handy.html / nomi.html にも同じパターンを適用（**実機動作確認済・2026-05-08 takuya確認**）
  - 全ファイルに`<link rel="preconnect">`を追加
- **詳細**：memory `feedback_firebase_ios_safari.md` 参照

### kitchen.html / sales.html / menu-admin.html のWebSocket監視
- 上記3画面はiPad常設運用が前提でWebSocketのまま。
- 同じiOS Safari WSゾンビ問題が起きる可能性あり。常設iPadで実害が出たら同パターンでREST化する。

### 売り切れ自動リセット機能の安定性検証
- **背景**：2026-05-05 に menu-admin.html の売り切れリセット処理を改修
  - `_resetChecked` フラグ廃止（無限ループ防止はFirebase値だけで担保）
  - 1分ごとの明示同期を追加（リスナー切断時の保険）
- **要確認**：
  - [ ] 翌朝 8時以降に menu-admin を開いて、前日の売り切れが自動クリアされるか
  - [ ] iPad（kitchen.html iframe）を一晩放置して、翌朝の状態確認
  - [ ] customer.html と menu-admin.html の売り切れ表示が常に一致するか

---

## 後で整理したい設定・データ

### Firebaseセキュリティルール内の未使用ノード
- `nomi_lo`：ラストオーダー機能は削除済みのため未使用。ルールから削除候補
- `surveys` / `spot_suggestions` / `quiz_scores`：sawatdee-fun（お楽しみページ）用。fun側設計が固まったらルールを精査

### 売上Apps Script（売上バックアップ用GAS）の二重管理
- 現状：firebase_export.gs（メニュー同期）と「無題のプロジェクト」（売上バックアップ）の2つの独立Apps Scriptが存在
- 同じスプレッドシートに紐付けて1プロジェクト化することで保守性UPする可能性
- 優先度：低（動いていれば触らない方針）

---

## 観察待ち項目（経過観察）

### 注文確認モーダル導入（2026-05-05）の効果測定
- いたずら注文・誤タップ注文の発生頻度が変わるか観察
- 客のコンバージョン率（カート→注文確定）が落ちていないか

### お楽しみページマスコット連携（2026-05-05）の利用率
- 初回注文後、フローティングマスコットがどれくらいタップされるか
- funpage側でアクセス解析を入れると効果測定可能

---

## 中期的な機能要望（バグではないが残しておく）

### バッジのフレキシブル化（CLAUDE.md「今後の課題」より）
- `pakchi`・`spicy`・`sake`・`popular`を`store_config/badges`で動的定義
- 影響範囲が広く、設計から丁寧に進める必要あり
- saas-planning側の議論にも関係（マルチテナントで店舗ごとにバッジ違うため）
