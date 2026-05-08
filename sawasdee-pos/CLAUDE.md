# サワディーブロス POSシステム - プロジェクト概要

## Claudeへの依頼ルール
- **コードを修正する前に、必ず今の構成を維持できるか確認すること**
- 複数ファイルに影響する変更は、影響範囲を事前に説明してから実装する
- 動作中の営業システムなので、破壊的な変更は慎重に行うこと

## システム概要
タイ料理レストラン「サワディーブロス」（25席）向けQRコードベース注文・管理システム。

## 関連プロジェクト
- **sawatdee-fun**（別フォルダ・別Cloudflare Pages）：お客様向けお楽しみページ（クイズ・タイのトリビア・おすすめスポット）
  - **Firebaseは同じ`sawatdee-bros`プロジェクトを共有**
  - データパス：`surveys` / `spot_suggestions` / `quiz_scores`
  - 完成後はcustomer.htmlからリンクで遷移する想定
  - フォルダは別だがFirebaseセキュリティルールは共通なので、ルール変更時はfun側の影響も確認すること

## 本番環境
- **URL（本番）**: https://sawatdee-pos.pages.dev/
- **GitHub**: https://github.com/sawatdee-bros/sawatdee-pos
- **Firebase**: sawatdee-bros（asia-southeast1）
  - DB URL: https://sawatdee-bros-default-rtdb.asia-southeast1.firebasedatabase.app
  - apiKey: AIzaSyBVfIZ_pUXqNAUljPBdsNlmVxkPEjvtUZQ
  - appId: 1:1026345346676:web:3fc5dc6cf3f0628a8e1321
  - **GAS書き込み認証**: スクリプトプロパティ`FIREBASE_SECRET`にデータベースシークレットを保存し、`buildFirebaseUrl()`で`?auth=`付きURLを生成して使用
  - **セキュリティルール**: `menu`はGASのみシークレット書き込み（`auth != null`）。それ以外の`store_config` / `soldout` / `menu_overrides` / `orders` / `calls` / `bill_calls` / `pax` / `ohiya` / `handy_groups` / `nomi_menu` 等は匿名書き込み許可（HTMLからの直接書き込み用）。中期的にFirebase Auth導入で全パスを認証必須にする予定

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
| menu-admin.html | 商品管理・売り切れ管理・オプション設定 |
| sales.html | 売上管理 |
| qr.html | QRコード生成（通常・飲み放題） |
| store-settings.html | 店舗設定（kitchen.htmlのiframe内） |
| firebase_export.gs | GASスクリプト（メニュー管理・双方向同期） |
| cleanup_orders.html | 注文データ削除ツール |
| cleanup_overrides.html | menu_overridesクリーンアップツール |
| rounding_check.html | 丸め差異チェックツール |

## デプロイ方法
GitHubにファイルをアップロードすると自動でCloudflare Pagesにデプロイされる。

1. https://github.com/sawatdee-bros/sawatdee-pos を開く
2. 「Add file」→「Upload files」
3. HTMLファイルをドラッグ＆ドロップ
4. 「Commit changes」をクリック
5. 約1〜2分でhttps://sawatdee-pos.pages.dev/ に自動反映

---

## 主要機能

### kitchen.html（キッチン画面）
- タブ：全て / フード / ドリンク / 伝票 / 売上（iframe） / 管理（iframe）
- 同テーブル3分以内のフード注文をグループ表示
- ドリンクは10秒以内でグループ表示
- NEWバッジ：受注から3分間表示
- 伝票タブ：「会計前」（テーブル番号順）「会計済み」（paidAt新しい順）T1〜T10・過去7日
- 伝票フィルターボタン：`store_config/table_count`から動的生成
- 会計フロー：「会計する」→モーダル（伝票スタイル）→「会計完了」
- **会計アラートをクリック→伝票タブに切り替え＋該当テーブルフィルターを自動選択**
- **会計完了時にbill_calls/{tableNum}を自動削除**（アラートが消える）
- チャージ：store_configの`charge_mode`に従って計算（none/conditional/always）
- paxをFirebaseに保存（タブ切り替えでも維持）
- 会計時にpaxをordersに保存（確定申告用）
- **セット商品（source:'set'）はフードタブに「🎁 セット」バッジ付きで表示**
- **ドリンク判定はisDrinkItem()関数で統一**（`item.category`があれば優先、なければDRINKSリストでフォールバック）
- **KITCHEN_NAMES動的化**：menuノードのkitchen_nameフィールドから生成
  - 検索順：フルネームマッチ→括弧除去ベース名マッチ→商品名そのまま
  - フルネームマッチ時はoptを付けない（「ソムタム ラオ（激辛バージョン）」問題対策）
  - KITCHEN_NAMES生成完了後にrenderOrders()で再描画
- **通知音はWeb Audio API（オシレーター）で統一**
  - フード注文：ポーン↑（820Hz→1000Hz）
  - ドリンク注文：ピピッ（1400Hz 2連打）
  - 店員呼び出し：ピポピポ（1050/800Hz交互×2）
  - 会計：チーン↑（520Hz→700Hz）
  - gain=3.0、DynamicsCompressorなし
- **extrasの集計**：本体価格=`item.price - extrasTotal`として計算、extrasを個別商品として別行に表示

### customer.html（お客様注文画面）
- **タブ2段構成**：1段目（右詰め）注文履歴・店員を呼ぶ・会計する / 2段目（左詰め）ドリンク・フード・セット
- 注文履歴モーダル：商品ごとの金額（税抜）・チャージ・消費税・合計を表示。人数入力でチャージ計算
- チャージ文言：「お一人様N杯以上のドリンクで無料」で統一
- チャージ計算はstore_configの`charge_mode`に従う（none/conditional/always）
- `charge_exempt:true`の商品が含まれる場合はチャージ免除
- `hidden:true`の商品は非表示（ハンディのみ商品）
- セットタブ：`store_config/show_set_on_customer`がONのとき表示
- 店員を呼ぶボタン（呼出中アニメーション付き）→ **確認モーダル経由**で誤タップ防止（呼出中の取消はモーダルなしで即実行）
- 会計するボタン（確認モーダル→kitchen.htmlにアラート）
- **注文するボタン → 確認モーダル**：商品リスト＋税込合計を表示。「注文する」押下で送信→モーダル内で完了表示（緑チェック＋お坊さんマスコット）→2.5秒で自動クローズ
- 注意フラグのある商品はカート追加時に確認ダイアログ（注文確認モーダルとは別・カート追加時の1回だけ）
- **お楽しみページ連携**：完了モーダル＋画面右上にお坊さんマスコット（ヘッダー右端、テーブル番号の右）。マスコットタップで`https://sawatdee-fun.pages.dev/funpage.html`を別タブで開く
  - フローティングマスコットは初回注文完了後に出現（localStorage `sawatdee_first_order_done`で永続化）
  - 画像はwixstaticのGIFを左右反転で使用（funpageと共通）
- **お冷ボタン**：`has_ohiya`がONのとき、ソフトドリンクカテゴリの末尾に「お冷 ¥0」を表示
- **唐辛子マーク**：最大10個、font-size 11px
- **popularバッジ**：FirebaseのpopularフィールドのL値をそのまま表示
- **多言語表示**：商品名の下にカタカナ / タイ語 / 英語を表示
- **注文時にitemsにcategory（'drink'|'food'|'set'）を保存**（ドリンク判定の新形式）
- **注文時にextras配列をFirebaseに保存**（集計用）
- **ITEM_OPTIONS動的化**：menu_overridesのitem_optionsをマージしてITEM_OPTIONSに反映
- 複数オプショングループ対応（「次へ」ボタンで順番に表示）

### handy.html（ハンディ）
- ドリンク / フード / セット 3行タブ（セットはmenu/setにデータがある場合のみ表示）
- セットタブはmenu/setを直接読んでGROUPS_DATA形式に変換
- お冷ボタン（5行目左端に固定表示）、セットタブでは非表示
- **手打ち商品ボタン**：ヘッダー右端「✏️ 手打ち」→商品名・税抜金額を入力してカートに追加
- **色分け**：サブカテゴリ名を初回登場順に番号を振り、黄金角（137.5°）で色相を均等分散
- セット注文は`source:'set'`で送信
- **TABLE_NAMES動的化**：`store_config/table_names_short`から取得（フォールバック：`'T' + n`）
- **注文時にcategoryを保存**（'drink'|'food'|'set'）

### nomi.html（飲み放題）
- **飲み放題タブ＋フードタブの2タブ構成**
- 飲み放題タブ：nomi_menuからカテゴリ・商品を表示
- フードタブ：Firebaseのmenu/foodをそのまま表示（写真・説明・売り切れ対応）
- **飲み放題注文はtotal:0で送信**（source:'nomi'）
- フード注文は通常価格で別orderとして送信（source:'nomi'）
- **catOrderでカテゴリ表示順を管理**
- **ラストオーダー機能は削除済み**（アナログ管理に変更）

### sales.html（売上管理）
- タブ：今日 / 今週 / 今月 / 累計 / 日別一覧
- **ドリンク判定はFirebaseのmenu/drinkキーから動的取得**（startsWith対応・ハードコードなし）
- **チャージ計算はstore_configから動的取得**
- **カテゴリ分類はFirebaseメニューデータから算出**
- **旧商品名マッピング**：`LEGACY_ITEM_CAT`オブジェクトでメニュー改名後も正しく分類
- **未分類バナー**：「その他」に落ちた商品が出たとき画面上部に警告表示
- **前期比（±%）**をサマリーカードに表示
- 今日タブ：時間帯別棒グラフ
- 今週タブ：曜日別棒グラフ
- 今月タブ：月カレンダー形式で日別売上を表示
- 累計タブ：曜日別平均売上棒グラフ＋月めくりカレンダー＋月別比較グラフ
- 日別一覧タブ：週別・日別売上一覧＋月別比較グラフ
- **メニュー別ランキング**：フード・セット / ドリンク の横並び2列
- **CSV出力**：伝票別・日別・月別・商品別・全データ・全シート一括（SheetJS）
- **📊 スプレッドシートに保存ボタン**：Apps Script経由でGoogleスプレッドシートに5シート書き込み
- **extrasの集計**：本体価格=`item.price - extrasTotal`として計算、extrasを個別商品として別集計（商品マスタにある商品は同名で合算）

### store-settings.html（店舗設定）
- kitchen.htmlのiframe内で表示
- FirebaseのSTORE_configに保存
- **←ボタンで未保存変更がある場合は確認モーダルを表示**
- **アコーディオン式UI**：全8セクションをタップで折りたたみ/展開。デフォルト全閉じ
- **実装済みの設定**：
  - `store_name`：店舗名
  - `tax_rate`：消費税率
  - `rounding_mode` / `rounding_unit`：端数処理
  - `table_count` / `nomi_table_count`：テーブル数
  - `table_names` / `table_names_short`：テーブル名・略称
  - `charge_per_person` / `charge_mode` / `charge_free_drink_count`：チャージ設定
  - `day_start_hour`：営業日切り替え時刻
  - `has_ohiya` / `has_nomi_hodai` / `has_call_button` / `show_set_on_customer`：機能ON/OFF
  - `discount_presets`：割引プリセット
  - `base_url` / `qr_note1` / `qr_note2`：QRコード設定
  - `apps_script_url`：外部連携

### menu-admin.html（商品管理）
- 売り切れトグル管理（`soldout/{商品名}: true`をFirebaseに保存）
- **営業日切り替え時刻に売り切れ自動リセット**
  - リセット判定はFirebaseの`soldout/_reset_at`値で行う（`_resetChecked`フラグは廃止済み・Firebase値だけで無限ループ防止）
  - **1分ごとにFirebaseから明示取得して同期**（onValueリスナーが切れた場合の保険・iframe長期生存・iPadスリープ復帰のケースをカバー）
  - 仕組み：menu-admin読み込み時、`_reset_at`が今日のday_start_hourより古ければ→`set(soldout, {_reset_at: now})`で全クリア
  - 注意：誰もmenu-adminを開かない日はリセットされない（リアクティブ実装）
- **商品カードの展開UI**：kitchen_name・price・pakchi等の編集
- **注文オプション（item_options）のGUI編集**：行ベースUI（名前+価格フィールド）
  - 複数オプショングループ対応
  - 既存ラベル・選択肢の候補表示
  - オプション行クリックで編集モーダル、×ボタンで削除
- **スプレッドシートへの双方向同期**：保存ボタンでGAS doGet() 経由でスプレッドシート更新→GASがFirebaseのmenuノードも更新
- **スプレッドシート管理フィールドはmenu_overridesからnullで削除**（menuノードの値を使う）
- init()でmenu_overridesもマージしてALL_ITEMSを構築

### firebase_export.gs（Apps Script）
- `exportToFirebase()`：スプレッドシート→Firebaseのmenuノードを更新
- `doGet(e)`：GETパラメータでid・fields受け取り→`updateItem()`→`exportToFirebase()`
- `doPost(e)`：POSTボディでid・fields受け取り→`updateItem()`（現在はdoGetを使用）
- `updateItem(id, fields)`：IDでスプレッドシートの行を検索し更新
- **再デプロイ時**：「デプロイを管理」→鉛筆→新しいバージョン（URLは変わらない）

### 売上バックアップ用Apps Script（別プロジェクト）
- スプレッドシート: https://docs.google.com/spreadsheets/d/12gudFZYx_6iiYt9Umfctx-OgNGmVvgOpMLfFrjYwZNw に紐づく独立プロジェクト（プロジェクト名「無題のプロジェクト」、コード名「サワディーブロス 売上バックアップ」）
- `doGet(e)` → `doPost(e)` → `runBackup()`：Firebaseの`orders`/`store_config`/`pax`/`menu`を読み取り、スプレッドシートに5シート（伝票別／日別／月別／商品別／全データ）を再生成
- sales.htmlの「📊 スプレッドシートに保存」ボタンが`store_config/apps_script_url`のURLにGETで叩く
- menu-admin.htmlの保存ボタンも同じ`apps_script_url`を使う（パラメータ付きGETでメニュー同期）
- **このスクリプトはfirebase_export.gsとは別の独立プロジェクト**（名前が「無題のプロジェクト」なので混同注意）

### Apps Scriptの再デプロイ手順（重要・URL固定の鉄則）
- ✅ **正しい**：「デプロイを管理」→既存デプロイの**鉛筆アイコン**→「新しいバージョン」を選択→「デプロイ」 → URLは変わらない
- ❌ **間違い**：「新しいデプロイ」を選ぶ → 新しいURLが発行され、古いURL（store_configに登録済み）は古いコードのまま放置される
- 過去事例（2026-04-23）：セキュリティ対応で「新しいデプロイ」を選んでしまい、店舗側のstore_configのURLが古いコードを指したまま「保存しても何も起きない」状態になり、4/23以降の売上データが記録されていなかった（5/3に発覚・URL更新で復旧）
- GAS関連の作業では、貼り替え前に既存コードをコピー退避→貼り替え→保存→**「デプロイを管理」で既存デプロイを編集**して新バージョン反映、の手順を守る

---

## Firebase構造
```
orders/
  {id}/
    table, items[{name, qty, price, charge_exempt?, category?, extras?}]
    total, status(new|done|paid), timestamp, paidAt, pax
    source('handy'|'nomi'|'set'), itemsDone

pax/         {tableNum}: 人数
calls/       {tableNum}: {table, timestamp}（店員呼び出し）
bill_calls/  {tableNum}: {table, timestamp}（会計依頼）

soldout/
  {商品名}: true
  _reset_at: timestamp

store_config/
  store_name, tax_rate, rounding_mode, rounding_unit
  table_count, nomi_table_count, table_names, table_names_short
  has_ohiya, has_nomi_hodai, has_call_button, show_set_on_customer
  charge_per_person, charge_mode, charge_free_drink_count
  day_start_hour, apps_script_url, item_category_overrides
  discount_presets, base_url, qr_note1, qr_note2
  enable_approval_flow  # スタッフ承認フロー有効化フラグ（デフォルトfalse・フェーズ展開中）

# === スタッフ承認フロー（実装中・フェーズ1〜6で段階導入中・2026-05-08着手） ===
tables/                # テーブル占有セッション管理（フェーズ2で実装）
  {tableNum}/
    session/
      startedAt: ms       # セッション開始時刻
      expiresAt: ms       # 失効時刻（startedAt + TTL、デフォルト3時間）
      pax: number         # 着席人数（PAX）
      issuedBy: 'handy'|'kitchen'  # 発行元（運用ログ用）
  # 会計完了時に削除、TTL満了時はクライアント/ルールで判定

# orders.status の値（フェーズ3〜4で追加）
# 既存：'new' | 'done' | 'paid'
# 追加：'pending_approval' | 'rejected'
#   - pending_approval: テーブル占有未確認の注文（スタッフ承認待ち）
#   - rejected: スタッフが拒否した注文（履歴保持・売上集計対象外）

menu/
  drink/{サブカテゴリ}/[{id, name, kitchen_name?, kana, thai, en,
                         price, price_type?, desc, pakchi, spicy,
                         popular, sake, active, img?,
                         charge_exempt?, hidden?, drink_count?}]
  food/{サブカテゴリ}/[{...}]
  set/{サブカテゴリ}/[{...}]
  subcatOrder/{drink:[...], food:[...], set:[...]}

menu_overrides/
  {商品ID}/
    item_options: [{type, label, choices}]
    drink_count: 数値
    ※スプレッドシート管理フィールド（name/price等）はnullで削除

nomi_menu/
  catOrder: [カテゴリ名, ...]
  {カテゴリ名}: [{name, price}]

handy_groups/
  drink: [{name, items:[{name, price, subcat}]}]
  food:  [{name, items:[{name, price, subcat}]}]
```

---

## 商品マスタ（Googleスプレッドシート：menu_master_v2）
- **元はxlsxだったが「Googleスプレッドシートとして保存」で変換済み**
- `.xlsx`バッジなしの`menu_master_v2`を使うこと（Apps Scriptが紐付いている）
- 列構成：カテゴリ / サブカテゴリ / ID / 商品名 / **キッチン名** / カタカナ / タイ語 / 英語 / 価格（税抜） / **価格（税込）** / 説明 / パクチー / 辛さ / 人気 / 酒に合う / 有効 / 注意 / **飲み放題** / **飲み放題カテゴリ** / **飲み放題表示順** / **ハンディタブ** / **ハンディグループ** / **ハンディ表示順** / **チャージ免除** / **ハンディのみ** / 杯数カウント
- カテゴリ列：`ドリンク` / `フード` / `セット`
- **フラグ列は空白以外ならON（◯・●・1・何でも可）**← 文字コード問題を回避
- 「注意」列に文言を入れると注文時に確認ダイアログが表示される

### Firebaseへの反映フロー
1. Googleスプレッドシートでメニューを編集
2. メニューバー「Firebase」→「Firebaseに反映する」をクリック
3. 数秒で本番に反映される

---

## 分担設計（確定）
| 管理場所 | 対象 |
|---------|------|
| スプレッドシート→GAS | カテゴリ・分類・有効無効・商品追加削除・価格・説明・フラグ類・キッチン名 |
| menu_overrides | item_options・drink_count（スプレッドシートにない項目）|
| soldout ノード | 売り切れ（当日リセット） |

**重要：** menu-adminで保存するとき、スプレッドシート管理フィールド（name/kitchen_name/price等）はmenu_overridesからnullで削除してmenuノードの値を使う。menu_overridesにはitem_options等のみ残す。

---

## マルチテナント展開時の初期設定手順

### 1. Firebase設定
- 新規Firebaseプロジェクトを作成（または既存を流用）
- 各HTMLファイルのFirebase設定を書き換え

### 2. GoogleスプレッドシートとApps Script設定
1. 店舗のGoogleアカウントで新規スプレッドシートを作成
2. 拡張機能→Apps Script
3. 既存コードを全削除し、`firebase_export.gs`の内容を貼り付けて保存
4. `FIREBASE_URL`を店舗のFirebase URLに書き換え
5. 「デプロイ」→「新しいデプロイ」
   - 種類：ウェブアプリ / 実行：自分 / アクセス：全員
6. 権限承認→Google Sheetsへのアクセス＋外部サービスへの接続を許可
7. 発行されたURLをstore-settings.htmlの「外部連携」に設定

### 3. 再デプロイ時の注意
- Apps ScriptのURLは変わらない
- コードを修正したら「新しいバージョン」で再デプロイが必要

---

## テーブル番号対応（現在）
※ store_config/table_namesで動的設定可能

| 番号 | 名前 |
|-----|------|
| T1〜T4 | テーブル1〜4 |
| T5 | コーラ卓 |
| T6 | 座敷席 |
| T7 | カウンター1・2 |
| T8 | カウンター3・4 |
| T9 | カウンター5 |
| T10 | 奥席 |

---

## 丸め処理（全ファイル統一）
- `applyRounding(val)` 関数を全ファイルに実装
- `store_config/rounding_mode`（floor/round/ceil）と `store_config/rounding_unit`（1/10/100）で動的設定
- デフォルト：切り捨て（floor）・10円単位
- 対象ファイル：kitchen/bills/sales/customer/handy

---

## 進行中タスク
- **スタッフ承認フロー + テーブルセッション**（2026-05-08着手・フェーズ1完了）
  - SaaS化の実証も兼ねて本店先行実装。完了後に saas-planning に引き継ぎ
  - 進捗・チェックリストは `OPEN_ISSUES.md` 参照
  - 関連memory：`feedback_firebase_ios_safari.md`（クライアント→Firebase直接構成のためREST polling併用）

---

## 今後の課題（将来対応）
- [ ] **バッジのフレキシブル化**：`pakchi`・`spicy`・`sake`・`popular`を`store_config/badges`で動的定義（影響範囲大・設計から丁寧に進める）
- [ ] nomi_menu・handy_groupsもスプレッドシートから自動反映
- [ ] **スプレッドシートのシート分割**：現在1シートに詰め込んでいる飲み放題・ハンディ関連列を専用シートに分離（メニューシート／飲み放題シート／ハンディシート）。GASのexportToFirebaseも合わせて書き直しが必要
- [ ] マルチテナント対応（店舗IDでFirebase設定を動的切り替え）
- [ ] Cloudflare Workersへの移行
- [ ] Firebase Securityルールの強化
- [ ] Web Push通知（要Cloud Functions）→Android移行時に検討
- [ ] time_slotフラグ（ランチ/ディナー）

---

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
- **Chrome拡張（Claude in Chrome）でブラウザ操作可能**→Claude (MCP)タブを閉じないこと
- **kitchen.htmlのオプション付き商品（extrasStr）の提供ボタンは`item-name`spanの閉じタグに注意**
- handy.htmlのセットタブはhandy_groupsではなくmenu/setを直接読んでいる
- **「直前の提供を戻す」機能は削除済み**（フードとドリンクが同じorderIDに混在するため構造的に困難）
- **menu-admin.htmlの売り切れ自動リセットはinit()内でstore_config先読み後にcheckAutoResetを実行**（非同期タイミング問題を回避）
- **税込価格で登録したい商品（コース等）はスプレッドシートの「価格（税込）」列に入力する**→`price_type:'inclusive'`フラグで保存
- `price_type:'inclusive'`の商品は各画面で`taxIn()`をかけずに`price`をそのまま税込として使う
- **sales.htmlのtax_rate正規化**：Firebaseに0.1で入っている場合は`Math.round(tax_rate * 100)`で10に変換
- **sales.htmlの伝票IDはpaidAt（会計完了時のUnixタイムスタンプms）**
- **sales.htmlの未分類バナーのボタンはdata属性+addEventListener方式**（inline onclickはHTML生成時の引用符混在バグで全画面JSが壊れるため）
- **extrasはitem.priceに合算済み**→集計時はitem.price - extrasTotal を本体価格として使う（二重計上防止）
- **GASのdoGetはCORSフリーなのでブラウザから直接呼べる**（doPostはno-corsでも届かないため使用しない）
- **menu_overridesのスプレッドシート管理フィールドが残っているとスプレッドシートの変更が反映されない**→cleanup_overrides.htmlで一括削除できる
