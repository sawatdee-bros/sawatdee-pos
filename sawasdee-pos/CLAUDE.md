# サワディーブロス POSシステム - プロジェクト概要

## Claudeへの依頼ルール
- **コードを修正する前に、必ず今の構成を維持できるか確認すること**
- 複数ファイルに影響する変更は、影響範囲を事前に説明してから実装する
- 動作中の営業システムなので、破壊的な変更は慎重に行うこと

## システム概要
タイ料理レストラン「サワディーブロス」（25席）向けQRコードベース注文・管理システム。

## 本番環境
- **新URL（本番）**: https://sawatdee-pos.pages.dev/
- **旧URL（移行中）**: https://gentle-voice-165c.mamomo0666.workers.dev/
- **GitHub**: https://github.com/sawatdee-bros/sawatdee-pos
- **Firebase**: sawatdee-bros（asia-southeast1）
  - DB URL: https://sawatdee-bros-default-rtdb.asia-southeast1.firebasedatabase.app
  - apiKey: AIzaSyBVfIZ_pUXqNAUljPBdsNlmVxkPEjvtUZQ
  - appId: 1:1026345346676:web:3fc5dc6cf3f0628a8e1321

## アカウント情報
- **GitHub / Cloudflare / Firebase**: irreciy2000@gmail.com（オーナー）
- **Cloudflare Pages**: sawatdee-pos.pages.dev

## ファイル構成
| ファイル | 説明 |
|---------|------|
| customer.html | お客様注文画面（QRコードで表示） |
| kitchen.html | キッチン受注・伝票・売上・商品管理（統合） |
| handy.html | ホールスタッフ用ハンディ入力 |
| nomi.html | 飲み放題専用注文画面 |
| menu-admin.html | 売り切れトグル管理 |
| sales.html | 売上管理 |
| qr.html | QRコード生成（通常・飲み放題） |

## デプロイ方法
GitHubにファイルをアップロードすると自動でCloudflare Pagesにデプロイされる。

1. https://github.com/sawatdee-bros/sawatdee-pos を開く
2. 「Add file」→「Upload files」
3. HTMLファイルをドラッグ＆ドロップ
4. 「Commit changes」をクリック
5. 約1〜2分でhttps://sawatdee-pos.pages.dev/ に自動反映

## 主要機能

### kitchen.html（キッチン画面）
- タブ：全て / フード / ドリンク / 伝票 / 売上（iframe） / 管理（iframe）
- 同テーブル3分以内のフード注文をグループ表示
- ドリンクは10秒以内でグループ表示
- NEWバッジ：受注から3分間表示
- 伝票タブ：「会計前」（テーブル番号順）「会計済み」（paidAt新しい順）T1〜T10・過去7日
- 会計フロー：「会計する」→モーダル（伝票スタイル）→「会計完了」
- チャージ：¥250×人数、ドリンク人数×2杯以上で免除（お冷はカウント外）
- paxをFirebaseに保存（タブ切り替えでも維持）
- 会計時にpaxをordersに保存（確定申告用）

### customer.html（お客様注文画面）
- 注文履歴ボタン（会計済み除外）
- 店員を呼ぶボタン（呼出中アニメーション付き）
- 会計するボタン（確認モーダル→kitchen.htmlにアラート）
- 注意フラグのある商品は確認ダイアログを表示

### handy.html（ハンディ）
- ドリンク / フード 2行タブ
- お冷ボタン（5行目左端に固定表示）
- お冷は¥0の通常商品としてordersに送信

### nomi.html（飲み放題）
- 飲み放題対象26品を4カテゴリで表示
- 初回ドリンク提供完了でラストオーダー時刻（+1時間半）を表示
- 15分前から赤点滅

## Firebase構造
```
orders/
  {id}/
    table: テーブル番号
    items: [{name, qty, price}]
    total: 税込合計
    status: new|done|paid
    timestamp: 注文時刻
    paidAt: 会計時刻（グループ化キー）
    pax: 人数（会計時に保存）
    source: 'handy'|'nomi'（ハンディ/飲み放題注文）
    itemsDone: {0: true, 1: true, ...}

pax/
  {tableNum}: 人数（アクティブセッション中のみ）

calls/
  {tableNum}: {table, timestamp}（店員呼び出し）

bill_calls/
  {tableNum}: {table, timestamp}（会計依頼）

nomi_lo/
  {tableNum}: timestamp（飲み放題ラストオーダー基準時刻）

soldout/
  {商品名}: true（売り切れ）
```

## 商品マスタ
- Excelファイル（menu_master.xlsx）で管理
- 列：カテゴリ / サブカテゴリ / ID / 商品名 / キッチン名 / 価格 / 説明 / パクチー / 辛さ / 人気 / 有効 / 飲み放題 / 注意
- 「注意」列に文言を入れると注文時に確認ダイアログが表示される
- 「飲み放題」列に○でnomi.htmlの対象品になる
- Excelを更新→Claudeに渡す→コード反映→GitHubにアップ

## テーブル番号対応
| 番号 | 名前 |
|-----|------|
| T1〜T4 | テーブル1〜4 |
| T5 | コーラ卓 |
| T6 | 座敷席 |
| T7 | カウンター1・2 |
| T8 | カウンター3・4 |
| T9 | カウンター5 |
| T10 | 奥席 |

## 今後の課題（将来対応）
- [ ] Googleスプレッドシート連携でメニュー自動更新
- [ ] マルチテナント対応（店舗IDでFirebase設定を動的切り替え）
- [ ] Cloudflare Workersへの移行
- [ ] 売上ExcelエクスポートCI/CD整備
- [ ] Firebase Securityルールの強化

## 開発メモ
- iOSは音声autoplay制限あり→ベルボタンで毎回ONにする必要あり
- Cloudflareデプロイ後1〜2分のラグあり
- module-scoped変数はjavascript_execで検査不可→DOM経由で確認
- DRINKSリストと商品名の全角スペースに注意（マッチング失敗の原因）
- kitchen.htmlのiframeで売上・商品管理を表示（音声維持のため）
