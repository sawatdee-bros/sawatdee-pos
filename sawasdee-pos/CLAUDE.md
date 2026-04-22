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
| nomi.html | 飲み放題注文画面（飲み放題タブ＋フードタブ） |
| menu-admin.html | 売り切れトグル管理 |
| sales.html | 売上管理 |
| qr.html | QRコード生成（通常・飲み放題） |
| store-settings.html | 店舗設定（kitchen.htmlのiframe内） |

## ローカル管理ファイル（GitHubには上げない）
| ファイル | 説明 |
|---------|------|
| menu_master_v2（Googleスプレッドシート） | 商品マスタ（全管理の起点）※後述 |
| menu_with_img.json | Firebaseのmenuノード用（画像パス含む最新版） |
| nomi_menu.json | FirebaseのnoMi_menuノード用インポートファイル |
| handy_groups.json | Firebaseのhandy_groupsノード用インポートファイル |

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
- **会計アラートをクリック→伝票タブに切り替え＋該当テーブルへ自動スクロール**
- **会計完了時にbill_calls/{tableNum}を自動削除**（アラートが消える）
- チャージ：¥250×人数、ドリンク人数×2杯以上で免除（お冷はカウント外）
- paxをFirebaseに保存（タブ切り替えでも維持）
- 会計時にpaxをordersに保存（確定申告用）
- **通知音はWeb Audio API（オシレーター）で統一**
  - フード注文：ポーン↑（820Hz→1000Hz）
  - ドリンク注文：ピピッ（1400Hz 2連打）
  - 店員呼び出し：ピポピポ（1050/800Hz交互×2）
  - 会計：チーン↑（520Hz→700Hz）
  - gain=3.0、DynamicsCompressorなし

### customer.html（お客様注文画面）
- 注文履歴ボタン（会計済み除外）
- 店員を呼ぶボタン（呼出中アニメーション付き）
- 会計するボタン（確認モーダル→kitchen.htmlにアラート）
- 注意フラグのある商品は確認ダイアログを表示
- **お冷ボタン**：store_configの`has_ohiya`がONのとき、ソフトドリンクカテゴリの末尾に「お冷 ¥0」を表示（has_ohiyaはロード時に1回取得）
- **唐辛子マーク**：最大10個、font-size 11px
- **popularバッジ**：Firebaseのpopularフィールドの値をそのまま表示（「人気」「当店名物」「おススメ」等）
- **多言語表示**：商品名の下にカタカナ / タイ語 / 英語を表示（`kana`・`thai`・`en`フィールド、空のものは除外）

### handy.html（ハンディ）
- ドリンク / フード 2行タブ
- お冷ボタン（5行目左端に固定表示）
- お冷は¥0の通常商品としてordersに送信
- **手打ち商品ボタン**：ヘッダー右端「✏️ 手打ち」→商品名（初期値：手打ち商品）・税抜金額を入力してカートに追加
- **色分け**：サブカテゴリ名を初回登場順に番号を振り、黄金角（137.5°）で色相を均等分散（衝突なし・マルチテナント対応）
- **Firebaseのhandy_groupsはarray形式**（objectに変換されるので注意）

### nomi.html（飲み放題）
- **飲み放題タブ＋フードタブの2タブ構成**
- 飲み放題タブ：nomi_menuからカテゴリ・商品を表示
- フードタブ：Firebaseのmenu/foodをそのまま表示（写真・説明・売り切れ対応）
- **飲み放題注文はtotal:0で送信**（source:'nomi'）
- フード注文は通常価格で別orderとして送信（source:'nomi'）
- **飲み方選択モーダル**：泡盛・ジャスミン焼酎・梅酒（必須）/ ガパオのライス・目玉焼き（任意・価格加算）
- **catOrderでカテゴリ表示順を管理**（FirebaseのJSONキーはアルファベット順になるためcatOrderで上書き）
- **FirebaseはJSON配列をobjectに変換する**→Object.values()で配列に戻す処理が必要
- ラストオーダー表示：nomi_lo/{tableNum}を監視、15分前から赤点滅

### store-settings.html（店舗設定）
- kitchen.htmlのiframe内で表示
- Firebaseのstore_configに保存
- **現在実際に機能している設定**：
  - `day_start_hour`：kitchen.htmlとsales.htmlが読む（営業日切り替え時刻）
  - `has_ohiya`：customer.htmlが読む（お冷ボタンの表示制御）
- その他の設定（charge_per_person等）は保存されるが未実装

## Firebase構造
```
orders/
  {id}/
    table: テーブル番号
    items: [{name, qty, price}]
    total: 税込合計（飲み放題ドリンクは0）
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

store_config/
  day_start_hour: 数値（営業日切り替え時刻、デフォルト8）
  has_ohiya: bool（客席お冷ボタン表示）
  charge_per_person: 数値
  charge_free_drink_count: 数値
  tax_rate: 数値
  table_count: 数値
  nomi_table_count: 数値
  has_nomi_hodai: bool
  has_call_button: bool

menu/
  drink/{サブカテゴリ}/[{id, name, kana, thai, en, price, desc, pakchi, spicy, popular, sake, active, img?}]
  food/{サブカテゴリ}/[{...}]
  subcatOrder/{drink:[...], food:[...]}

nomi_menu/
  catOrder: [カテゴリ名, ...]（表示順）
  {カテゴリ名}: [{name, price}]

handy_groups/
  drink: [{name:グループ名, items:[{name, price, subcat}]}]
  food:  [{name:グループ名, items:[{name, price, subcat}]}]
```

## 商品マスタ（Googleスプレッドシート：menu_master_v2）
- **元はxlsxだったが「Googleスプレッドシートとして保存」で変換済み**
- `.xlsx`バッジなしの`menu_master_v2`を使うこと（Apps Scriptが紐付いている）
- **1ファイルで3つのFirebaseノードを管理**
- 列構成：カテゴリ / サブカテゴリ / ID / 商品名 / キッチン名 / カタカナ / タイ語 / 英語 / 価格（税抜） / 説明 / パクチー / 辛さ / 人気 / 酒に合う / 有効 / 注意 / **飲み放題** / **飲み放題カテゴリ** / **飲み放題表示順** / **ハンディタブ** / **ハンディグループ** / **ハンディ表示順**
- 「注意」列に文言を入れると注文時に確認ダイアログが表示される
- 「飲み放題」列に〇でnomi.htmlの飲み放題タブ対象
- 飲み放題カテゴリ：nomi_menuのカテゴリ名（絵文字なし）
- 飲み放題表示順：カテゴリの左からの並び順（同じ数字が同カテゴリ）
- ハンディタブ：`drink` または `food`
- ハンディグループ：ハンディのサブカテゴリ名
- ハンディ表示順：グループの左からの並び順

### Firebaseへの反映フロー（自動化済み）
1. Googleスプレッドシートでメニューを編集
2. メニューバー「🔥 Firebase」→「Firebaseに反映する」をクリック
3. 数秒で本番に反映される

**Apps Scriptについて**
- スプレッドシートに紐付いたApps Scriptが`exportToFirebase`関数を実行
- Firebaseに既存の画像パス（imgフィールド）を引き継ぎながらPUT
- menu/drink・menu/food・menu/subcatOrderを上書き更新
- nomi_menu・handy_groupsは別途手動でインポートが必要

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
- [ ] nomi_menu・handy_groupsもスプレッドシートから自動反映
- [ ] マルチテナント対応（店舗IDでFirebase設定を動的切り替え）
- [ ] Cloudflare Workersへの移行
- [ ] 売上ExcelエクスポートCI/CD整備
- [ ] Firebase Securityルールの強化
- [ ] Web Push通知（要Cloud Functions）→Android移行時に検討

## 開発メモ
- iOSは音声autoplay制限あり→ベルボタンで毎回ONにする必要あり
- Cloudflareデプロイ後1〜2分のラグあり
- module-scoped変数はjavascript_execで検査不可→DOM経由で確認
- DRINKSリストと商品名の全角スペースに注意（マッチング失敗の原因）
- kitchen.htmlのiframeで売上・商品管理を表示（音声維持のため）
- **サブカテゴリ名は絵文字なし**（Firebaseのキーと一致させること）
- **FirebaseはJSON配列をobjectに変換する**→読み込み時にObject.values()で配列に戻す
- **Firebaseにmenuをインポートするときはmenuノードを選択してからインポート**（誤ってルートにインポートすると全データが消える）
- **お冷はcustomer.htmlがコードで動的追加する**→menu.jsonには含めない
- ブラウザのメディア音量とシステム音量は別（Web Audio APIはメディア音量に依存）
- **Chrome拡張（Claude in Chrome）でブラウザ操作可能**→Claude (MCP)タブを閉じないこと
- **kitchen.htmlのオプション付き商品（extrasStr）の提供ボタンは`item-name`spanの閉じタグに注意**（閉じ忘れるとボタンが左詰めになる）
