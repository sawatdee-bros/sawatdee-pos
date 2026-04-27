# サワディーブロス POSシステム - プロジェクト概要

## Claudeへの依頼ルール
- **コードを修正する前に、必ず今の構成を維持できるか確認すること**
- 複数ファイルに影響する変更は、影響範囲を事前に説明してから実装する
- 動作中の営業システムなので、破壊的な変更は慎重に行うこと

## システム概要
タイ料理レストラン「サワディーブロス」（25席）向けQRコードベース注文・管理システム。

## 本番環境
- **URL（本番）**: https://sawatdee-pos.pages.dev/
- **GitHub**: https://github.com/sawatdee-bros/sawatdee-pos
- **Firebase**: sawatdee-bros（asia-southeast1）
  - DB URL: https://sawatdee-bros-default-rtdb.asia-southeast1.firebasedatabase.app
  - apiKey: AIzaSyBVfIZ_pUXqNAUljPBdsNlmVxkPEjvtUZQ
  - appId: 1:1026345346676:web:3fc5dc6cf3f0628a8e1321

## アカウント情報
- **GitHub / Cloudflare / Firebase**: irreciy2000@gmail.com（オーナー：takuya）
- **Cloudflare Pages**: sawatdee-pos.pages.dev
- **売上バックアップ用Googleスプレッドシート**: https://docs.google.com/spreadsheets/d/12gudFZYx_6iiYt9Umfctx-OgNGmVvgOpMLfFrjYwZNw

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
| SawatdeeSalesBackup.gs | Googleスプレッドシートへの売上バックアップ用Apps Script |

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
- **会計アラートをクリック→伝票タブに切り替え＋該当テーブルフィルタを自動選択**
- **会計完了時にbill_calls/{tableNum}を自動削除**（アラートが消える）
- チャージ：store_configの`charge_mode`に従って計算（none/conditional/always）
- paxをFirebaseに保存（タブ切り替えでも維持）
- 会計時にpaxをordersに保存（確定申告用）
- **セット商品（source:'set'）はフードタブに「🎁 セット」バッジ付きで表示**
- **ドリンク判定はisDrinkItem()関数で統一**（「梅酒（ロック）」等オプション付きも対応）
- **合計は10円単位切り捨て（Math.floor）で統一**
- **「直前の提供を戻す」機能は削除済み**（フードとドリンクが同じorderIDに混在するため構造的に困難）
- **通知音はWeb Audio API（オシレーター）で統一**
  - フード注文：ポーン↑（820Hz→1000Hz）
  - ドリンク注文：ピピッ（1400Hz 2連打）
  - 店員呼び出し：ピポピポ（1050/800Hz交互×2）
  - 会計：チーン↑（520Hz→700Hz）
  - gain=3.0、DynamicsCompressorなし

### customer.html（お客様注文画面）
- **タブ2段構成**：1段目（右詰め）注文履歴・店員を呼ぶ・会計する / 2段目（左詰め）ドリンク・フード・セット
- 注文履歴モーダル：商品ごとの金額（税抜）・チャージ・消費税・合計を表示。人数入力でチャージ計算
- チャージ文言：「お一人様N杯以上のドリンクで無料」で統一（免除/非免除共通）
- チャージ計算はstore_configの`charge_mode`に従う（none/conditional/always）
- `charge_exempt:true`の商品が含まれる場合はチャージ免除（「コース注文のため免除」と表示）
- `hidden:true`の商品は非表示（ハンディのみ商品）
- セットタブ：`store_config/show_set_on_customer`がONのとき表示
- 店員を呼ぶボタン（呼出中アニメーション付き）
- 会計するボタン（確認モーダル→kitchen.htmlにアラート）
- 注意フラグのある商品は確認ダイアログを表示
- **お冷ボタン**：store_configの`has_ohiya`がONのとき、ソフトドリンクカテゴリの末尾に「お冷 ¥0」を表示
- **唐辛子マーク**：最大10個、font-size 11px
- **popularバッジ**：Firebaseのpopularフィールドの値をそのまま表示
- **多言語表示**：商品名の下にカタカナ / タイ語 / 英語を表示
- **合計は10円単位切り捨て（Math.floor）で統一**
- **ドリンク判定はMENU_DATAのdrinkキーと照合（startsWith対応）**

### handy.html（ハンディ）
- ドリンク / フード / セット 3行タブ（セットはmenu/setにデータがある場合のみ表示）
- セットタブはmenu/setを直接読んでGROUPS_DATA形式に変換（charge_exempt・hiddenも引き継ぐ）
- お冷ボタン（5行目左端に固定表示）、セットタブでは非表示
- お冷は¥0の通常商品としてordersに送信
- **手打ち商品ボタン**：ヘッダー右端「✏️ 手打ち」→商品名・税抜金額を入力してカートに追加
- **色分け**：サブカテゴリ名を初回登場順に番号を振り、黄金角（137.5°）で色相を均等分散
- **Firebaseのhandy_groupsはarray形式**（objectに変換されるので注意）
- セット注文は`source:'set'`で送信
- 注文送信時にitemsに`charge_exempt`フラグを引き継ぐ
- **合計は10円単位切り捨て（Math.floor）で統一**（カート表示・確認モーダル・送信金額すべて）

### nomi.html（飲み放題）
- **飲み放題タブ＋フードタブの2タブ構成**
- 飲み放題タブ：nomi_menuからカテゴリ・商品を表示
- フードタブ：Firebaseのmenu/foodをそのまま表示（写真・説明・売り切れ対応）
- **飲み放題注文はtotal:0で送信**（source:'nomi'）
- フード注文は通常価格で別orderとして送信（source:'nomi'）
- **飲み方選択モーダル**：泡盛・ジャスミン焼酎・梅酒（必須）/ ガパオのライス・目玉焼き（任意・価格加算）
- **catOrderでカテゴリ表示順を管理**
- **FirebaseはJSON配列をobjectに変換する**→Object.values()で配列に戻す処理が必要
- **ラストオーダー機能は削除済み**（アナログ管理に変更）

### sales.html（売上管理）
- タブ：今日 / 今週 / 今月 / 累計 / 日別一覧
- **ドリンク判定はFirebaseのmenu/drinkキーから動的取得**（startsWith対応・ハードコードなし）
- **チャージ計算はstore_configから動的取得**（charge_mode/charge_per_person/charge_free_drink_count/tax_rate）
- **tax_rateの正規化**：Firebaseに0.1で入っている場合は10（%）に自動変換
- **カテゴリ分類はFirebaseメニューデータから算出**（ドリンク/フード/セット/その他）
- **旧商品名マッピング**：`LEGACY_ITEM_CAT`オブジェクトでメニュー改名後も正しく分類
- **未分類バナー**：「その他」に落ちた商品が出たとき画面上部に警告表示→ワンタップでカテゴリ設定→`store_config/item_category_overrides`にFirebase保存
- **pax=0のセッションは客単価・平均人数の計算から除外**（開店当初のデータ対応）
- **前期比（±%）**をサマリーカードに表示
- **今日タブ**：時間帯別棒グラフ
- **今週タブ**：曜日別棒グラフ
- **今月タブ**：月カレンダー形式（月曜始まり）で日別売上を表示。売上あり=緑、今日=緑枠、ゼロ=グレーアウト
- **累計タブ**：曜日別平均売上棒グラフ（営業日数ベース）＋月めくりカレンダー＋月別比較グラフ
- **日別一覧タブ**：週別・日別売上一覧（月曜始まり）＋月別比較グラフ。日付行に「伝票」ボタン→その日のセッション別伝票モーダル
- **メニュー別ランキング**：フード・セット / ドリンク の横並び2列。累計タブのみ全件スクロール表示。数量順/売上順切替
- **テーブル別売上**：回転数表示
- **人数・客単価分析**：平均人数・1人あたり単価・総来客数
- **CSV出力**（ヘッダー右上ボタン）：
  - 伝票別（伝票1枚ずつ）
  - 日別集計
  - 月別集計
  - 商品別集計
  - 全データ（伝票明細・1行=1商品）
  - 全シート一括（Excel・SheetJS使用・5シート）
- **📊 スプレッドシートに保存ボタン**：`store_config/apps_script_url`に設定されたApps ScriptのWeb APIを呼び出し、Googleスプレッドシートに5シートを書き込む

### store-settings.html（店舗設定）
- kitchen.htmlのiframe内で表示
- Firebaseのstore_configに保存
- **←ボタンで未保存変更がある場合は確認モーダルを表示**（保存して戻る / 破棄して戻る / キャンセル）
- **実装済みの設定**：
  - `day_start_hour`：営業日切り替え時刻
  - `has_ohiya`：客席お冷ボタン表示
  - `charge_per_person`：チャージ料単価
  - `charge_mode`：チャージ設定（none/conditional/always）
  - `charge_free_drink_count`：条件付き免除の杯数
  - `show_set_on_customer`：セットメニューを客席に表示
  - `has_nomi_hodai`：飲み放題機能
  - `has_call_button`：呼び出しボタン
  - `apps_script_url`：スプレッドシートバックアップ用Apps Script URL（外部連携セクション）
  - `tax_rate`：消費税率（画面上は%表示・整数。Firebaseには整数10で保存。sales.htmlで0.1→10の正規化対応済み）

### menu-admin.html（商品管理）
- 売り切れトグル管理
- `soldout/{商品名}: true` をFirebaseに保存
- **営業日切り替え時刻に売り切れ自動リセット**（init()内でstore_config先読み後にcheckAutoResetを実行）

### SawatdeeSalesBackup.gs（Apps Script）
- Googleスプレッドシートに紐付けるApps Script
- `doGet()`/`doPost()`でWeb APIとして動作
- Firebaseから全注文データ・メニューデータ・store_configを取得して5シートを生成・書き込み
  - ①伝票別 / ②日別集計 / ③月別集計 / ④商品別集計 / ⑤全データ（伝票明細）
- 実行のたびに既存シートを削除して再生成（常に最新状態）
- タイトル行に最終更新日時を記録

## Firebase構造
```
orders/
  {id}/
    table: テーブル番号
    items: [{name, qty, price, charge_exempt?}]
    total: 税込合計（10円単位切り捨て）
    status: new|done|paid
    timestamp: 注文時刻
    paidAt: 会計時刻（グループ化キー・伝票IDとしても使用）
    pax: 人数（会計時に保存）
    source: 'handy'|'nomi'|'set'
    itemsDone: {0: true, 1: true, ...}

pax/
  {tableNum}: 人数（アクティブセッション中のみ）

calls/
  {tableNum}: {table, timestamp}（店員呼び出し）

bill_calls/
  {tableNum}: {table, timestamp}（会計依頼）

soldout/
  {商品名}: true（売り切れ）
  _reset_at: timestamp（最終リセット時刻）

store_config/
  day_start_hour: 数値（営業日切り替え時刻、デフォルト8）
  has_ohiya: bool（客席お冷ボタン表示）
  charge_per_person: 数値
  charge_mode: 'none'|'conditional'|'always'
  charge_free_drink_count: 数値（conditionalのとき使用）
  show_set_on_customer: bool（セットメニューを客席に表示）
  tax_rate: 数値（整数で保存推奨。0.1で入っている場合はsales.htmlが自動正規化）
  table_count: 数値
  nomi_table_count: 数値
  has_nomi_hodai: bool
  has_call_button: bool
  apps_script_url: string（スプレッドシートバックアップ用Apps Script URL）
  item_category_overrides: {商品名: 'ドリンク'|'フード'|'セット'}（未分類商品の手動分類・sales.htmlから保存）

menu/
  drink/{サブカテゴリ}/[{id, name, kana, thai, en, price, desc, pakchi, spicy, popular, sake, active, img?, charge_exempt?, hidden?}]
  food/{サブカテゴリ}/[{...}]
  set/{サブカテゴリ}/[{..., charge_exempt?, hidden?}]
  subcatOrder/{drink:[...], food:[...], set:[...]}

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
- 列構成：カテゴリ / サブカテゴリ / ID / 商品名 / キッチン名 / カタカナ / タイ語 / 英語 / 価格（税抜） / **価格（税込）** / 説明 / パクチー / 辛さ / 人気 / 酒に合う / 有効 / 注意 / **チャージ免除** / **ハンディのみ** / 飲み放題 / 飲み放題カテゴリ / 飲み放題表示順 / ハンディタブ / ハンディグループ / ハンディ表示順
- カテゴリ列：`ドリンク` / `フード` / `セット`（セットはmenu/setに入る）
- 「有効」列：空白以外でその商品を有効化
- 「チャージ免除」列：空白以外で`charge_exempt:true`（コース等でチャージ免除）
- 「ハンディのみ」列：空白以外で`hidden:true`（客用画面に表示しない）
- **フラグ列は空白以外ならON（〇・○・1・何でも可）**← 文字コード問題を回避
- 「注意」列に文言を入れると注文時に確認ダイアログが表示される

### Firebaseへの反映フロー（自動化済み）
1. Googleスプレッドシートでメニューを編集
2. メニューバー「Firebase」→「Firebaseに反映する」をクリック
3. 数秒で本番に反映される

**Apps Scriptについて（メニュー用）**
- `isOn(val)`関数：空白以外ならtrue（文字の種類を問わない）
- Firebaseに既存の画像パス（imgフィールド）を引き継ぎながらPUT
- menu/drink・menu/food・menu/set・menu/subcatOrderを上書き更新
- nomi_menu・handy_groupsは別途手動でインポートが必要

## マルチテナント展開時の初期設定手順

### 1. Firebase設定
- 新規Firebaseプロジェクトを作成（または既存を流用）
- 各HTMLファイルのFirebase設定を書き換え

### 2. Googleスプレッドシート＋Apps Script設定（売上バックアップ）
1. 店舗のGoogleアカウントで**新規スプレッドシートを作成**
2. メニューバー「拡張機能」→「Apps Script」を開く
3. 既存コードを全削除し、`SawatdeeSalesBackup.gs`の内容を貼り付けて保存
4. スクリプト内の`FIREBASE_URL`を店舗のFirebase URLに書き換え
5. 「デプロイ」→「新しいデプロイ」
   - 種類：**ウェブアプリ**
   - 次のユーザーとして実行：**自分**
   - アクセスできるユーザー：**全員**
6. 権限承認画面で「Advanced」→「Go to ...（unsafe）」→両権限にチェック→「Allow」
   - **Google Sheetsへのアクセス**（スプレッドシート書き込み用）
   - **外部サービスへの接続**（Firebase APIアクセス用）
7. 発行された`https://script.google.com/macros/s/.../exec`形式のURLをコピー
8. store-settings.htmlの「外部連携」セクションに貼り付けて保存
   - またはFirebaseコンソールで`store_config/apps_script_url`に直接PUT

### 3. 再デプロイ時の注意
- Apps ScriptのURLは**変わらない**（「デプロイを管理」→鉛筆→新しいバージョン）
- コードを修正したら「新しいバージョン」で再デプロイが必要（同じURLで更新される）

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
- [ ] ステップ2：time_slotフラグ（ランチ/ディナー）・store_configのランチ時間設定
- [ ] round_mode設定（10円単位切り捨て or 端数そのまま）
- [ ] nomi_menu・handy_groupsもスプレッドシートから自動反映
- [ ] マルチテナント対応（店舗IDでFirebase設定を動的切り替え）
- [ ] Cloudflare Workersへの移行
- [ ] Firebase Securityルールの強化
- [ ] Web Push通知（要Cloud Functions）→Android移行時に検討
- [ ] store-settings.htmlのテーブル名カスタマイズ（現状T1〜T10が固定）

## 開発メモ
- iOSは音声autoplay制限あり→ベルボタンで毎回ONにする必要あり
- Cloudflareデプロイ後1〜2分のラグあり
- module-scoped変数はjavascript_execで検査不可→DOM経由で確認
- **ドリンク判定はisDrinkItem()関数を使うこと**（`DRINKS.indexOf()`は「梅酒（ロック）」等オプション付き商品名で失敗する）
- **スプレッドシートのフラグ列は空白以外ならON**（isOn()関数使用・文字コード問題を回避）
- kitchen.htmlのiframeで売上・商品管理を表示（音声維持のため）
- **サブカテゴリ名は絵文字なし**（Firebaseのキーと一致させること）
- **FirebaseはJSON配列をobjectに変換する**→読み込み時にObject.values()で配列に戻す
- **Firebaseにmenuをインポートするときはmenuノードを選択してからインポート**（誤ってルートにインポートすると全データが消える）
- **お冷はcustomer.htmlがコードで動的追加する**→menu.jsonには含めない
- ブラウザのメディア音量とシステム音量は別（Web Audio APIはメディア音量に依存）
- **Chrome拡張（Claude in Chrome）でブラウザ操作可能**→Claude (MCP)タブを閉じないこと
- **kitchen.htmlのオプション付き商品（extrasStr）の提供ボタンは`item-name`spanの閉じタグに注意**
- handy.htmlのセットタブはhandy_groupsではなくmenu/setを直接読んでいる
- **「直前の提供を戻す」機能は削除済み**（フードとドリンクが同じorderIDに混在するため個別に戻す処理が構造的に困難）
- **menu-admin.htmlの売り切れ自動リセットはinit()内でstore_config先読み後にcheckAutoResetを実行**（非同期タイミング問題を回避）
- 合計計算は全画面で`Math.floor(.../ 10) * 10`で統一（10円単位切り捨て）
- **税込価格で登録したい商品（コース等）はスプレッドシートの「価格（税込）」列に入力する**→Apps ScriptがFirebaseに`price_type:'inclusive'`フラグと税込価格をそのまま保存する。「価格（税抜）」列は空白にする
- `price_type:'inclusive'`の商品は各画面で`taxIn()`をかけず`price`をそのまま税込として使う（customer.html・handy.html・kitchen.html全て対応済み）
- **sales.htmlのtax_rate正規化**：Firebaseに0.1で入っている場合は`Math.round(tax_rate * 100)`で10に変換してから計算。store-settings.htmlは整数（10）で保存する仕様に統一済み
- **sales.htmlの伝票IDはpaidAt（会計完了時のUnixタイムスタンプms）**→ユニークかつ時系列ソート可能
- **sales.htmlの未分類バナーのボタンはonclickではなくdata属性+addEventListener方式**（inline onclickはHTML生成時の引用符混在バグで全画面JSが壊れるため）
- **sales.htmlのCSV全シート一括出力はSheetJS（cdnjs）をブラウザで動かして生成**→サーバー不要
