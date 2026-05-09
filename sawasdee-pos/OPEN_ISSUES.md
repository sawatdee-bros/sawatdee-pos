# 未解決・継続確認事項

> bug-fix / saas-planning セッションで継続して扱う事項のメモ。
> 解決したら該当行を削除してください。

---

## 🚧 進行中：スタッフ承認フロー実装（2026-05-08着手）

director裁定により、Phase 1 セキュリティ機能（テーブル占有チェック）をサワディーブロス本店に先行実装中。SaaS化に向けた実証も兼ねる。

### フェーズ進捗
- [x] **フェーズ1**：feature flag `enable_approval_flow` 追加（kitchen/customer/handy/nomi の4画面で読み出し済・全部false固定）。動作変更なし（2026-05-09再投入完了・1ファイルずつ単独で動作確認）
- [x] **フェーズ2**：`tables/{tableNum}/session` 実装（kitchen.html）。changePax で issueTableSession・markPaid で clearTableSession を呼び出し。書き込みはRESTで独立化（2026-05-09 E2E成功確認・iPadのPAX +ボタン押下→Firebase consoleで `tables/{T番号}/session` 出現確認・TTL3時間正常）
- [x] **Phase 5a（部分先行）**：`tables/` ノードへの匿名書き込み許可をFirebase Rulesに1行追加（2026-05-09・director承認下で最小スコープ実施・他ルール非干渉・既存ルールバックアップ取得済）
- [ ] **フェーズ3**：customer.html — 注文送信前にセッション確認、pending_approval分岐、status監視（REST polling 3〜5秒）。**人数入力UI削除＋pax自動参照も同時実施**
- [ ] **フェーズ4**：kitchen.html — 承認待ちエリア、承認/拒否モーダル、一括拒否
- [ ] **Phase 5b**：reservation関連Rule追加（後日まとめて）
- [ ] **Phase 5本体**：HMAC署名QR等の本格Rules大改修（後日まとめて）
- [ ] **フェーズ6**：営業終了後フラグON → 最低3営業日観察

### Phase 5a（2026-05-09実施）の記録
- 追加内容：`"tables": { ".read": true, ".write": true }` 1行のみ
- 既存ルールバックアップ：`rules-backup-20260509.json` （takuyaローカル保存済）
- 投入後の既存機能確認：customer/kitchen/handy 全て動作OK
- E2E確認：iPadでkitchen→伝票タブ→PAX +ボタン押下 → `tables/7/session/` 出現（pax=2, issuedBy=kitchen, expiresAt=startedAt+3時間）
- 想定外の症状：なし

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

### rejected注文の自動削除（後回しOKの小タスク）
rejected注文がFirebase上に積み上がる懸念。`cleanup_orders.html` を拡張して「rejected注文を30日後自動削除」を追加する。

### 2026-05-08 事故の最終究明結果（2026-05-09判明）
昨日の「過去の伝票表示されない・注文も受信しない」症状の真因：
- kitchen.htmlの**既存バグ**で、`?mode=bills` URLパラメータで開いた場合に
  `var _bOrders = {};` 宣言行（1236行目あたり）よりも先にトップレベルから
  `setMode('bills')` → `buildSessions()` → `Object.keys(_bOrders)` が呼ばれて
  `_bOrders` が `var` ホイストで undefined → TypeError → トップレベル中断 →
  後続の `const _newIdTs` などがTDZ → kitchen.html全体が壊れる
- フェーズ1+2投入とは無関係の既存バグ。たまたまPCで `?mode=bills` で開いていたため発覚した
- 修正：`buildSessions` 冒頭に `var bOrders = _bOrders || {};` ガードを追加（コミット d8e1da5）
- 「カスタマから注文できない」の方は再現せず、Cloudflare中間反映やキャッシュ汚染が疑われる（再発時に深掘り）

---

## 動作確認待ち

### 客向け画面のREST化（読み込み 2026-05-08、書き込み 2026-05-09・両方完了）
- **背景**：iPhone Safariで以下2症状が発生：
  - 読み込み詰まり（5-07確認）：customer.htmlの読み込みが約2分間ハング
  - 書き込み詰まり（5-09確認）：注文/呼出/会計が数十分queueに溜まり、後で一気に着信。客側からは「ボタン無反応」に見える
- **真因**：iOS Safari WebSocket「ゾンビ化」。接続は確立するがデータが流れない状態が約2分続き、その間の読み書きはqueueに溜まる
- **修正完了**：
  - customer.html / handy.html / nomi.html の **読み込み・書き込み両方** をREST API（HTTPS）に置換
  - `fbRestGet` / `fbRestPush` / `fbRestSet` / `fbRestRemove` ヘルパー追加
  - `Promise.all`で並列化、`onValue(soldout)`は描画後に張る順に変更
  - `<link rel="preconnect">`を全客向け画面に追加
  - 検証ファイル：customer-debug.html（読み込み診断）/ customer-write-test.html（書き込み診断）
- **継続観察**：
  - kitchen.html / sales.html / menu-admin.html はWebSocket書き込みのまま。iPad常設運用で実害が出たら同パターン適用
  - NEW判定が「キッチン受信時刻」基準なので、もし詰まり症状が再発したらkitchen側で「客クリック時刻基準」への修正を検討
- **詳細**：memory `feedback_firebase_ios_safari.md` 参照



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
