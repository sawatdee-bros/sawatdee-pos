# 未解決・継続確認事項

> bug-fix / saas-planning セッションで継続して扱う事項のメモ。
> 解決したら該当行を削除してください。

---

## 動作確認待ち

### customer.html / handy.html / nomi.html のREST API化（2026-05-08修正）
- **背景**：iPhone Safariでcustomer.htmlの読み込みが約2分間ハングする症状を確認。診断版（customer-debug.html）でFirebase WebSocketが「ゾンビ化」していることを特定（接続は成立するがデータが流れず、約120秒後に再接続で復旧）。
- **修正内容**：
  - 客向け画面（customer.html）の初期データ取得を全てREST API（HTTPS fetch）に置換、`Promise.all`で並列化、`onValue(soldout)`は描画後に張る順に変更（実機確認済・解消）
  - 同症状の予防として handy.html / nomi.html にも同じパターンを適用
  - 全ファイルに`<link rel="preconnect">`を追加
- **要確認（要実機テスト）**：
  - [ ] handy.html：iPad（店内常設）で同じ「アプリ切替→戻る→リロード」シナリオで遅延が起きないか
  - [ ] nomi.html：飲み放題QRから読み込み、同シナリオで動作確認
  - [ ] kitchen.html / sales.html / menu-admin.html はWebSocketのまま。iPad常設運用で実害が出ていないかは継続観察
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
