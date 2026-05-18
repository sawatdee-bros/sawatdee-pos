// ============================================================
//  サワディーブロス 売上バックアップ Apps Script
//  スプレッドシート: https://docs.google.com/spreadsheets/d/12gudFZYx_6iiYt9Umfctx-OgNGmVvgOpMLfFrjYwZNw
// ============================================================

var FIREBASE_URL = "https://sawatdee-bros-default-rtdb.asia-southeast1.firebasedatabase.app";

// 支払方法ラベルマスタ（POS側 PAYMENT_METHOD_DEFS と同期）
var PAYMENT_METHOD_LABELS = {
  "cash":    "現金",
  "card":    "カード",
  "qr":      "QR決済",
  "paypay":  "PayPay",
  "rakuten": "楽天Pay",
  "dpay":    "d払い",
  "suica":   "交通系IC",
  "other":   "その他"
};

// ── Web API エントリーポイント ──────────────────────────────
function doGet(e) { return doPost(e); }
function doPost(e) {
  try {
    var result = runBackup();
    return ContentService.createTextOutput(JSON.stringify({ status:"ok", message:result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status:"error", message:err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── メイン処理 ───────────────────────────────────────────────
function runBackup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var orders        = fetchJson("/orders.json");
  var config        = fetchJson("/store_config.json");
  var paxData       = fetchJson("/pax.json") || {};
  var menuData      = fetchJson("/menu.json");
  var menuOverrides = fetchJson("/menu_overrides.json") || {};

  var DAY_START     = config.day_start_hour || 8;
  var TAX_RATE      = config.tax_rate || 10;
  if (TAX_RATE < 1) TAX_RATE = Math.round(TAX_RATE * 100);
  var CHARGE        = config.charge_per_person || 250;
  var MODE          = config.charge_mode || "conditional";
  var FREE_COUNT    = config.charge_free_drink_count || 2;
  var ROUNDING_MODE = config.rounding_mode || "floor";
  var ROUNDING_UNIT = config.rounding_unit || 10;
  var overrides     = config.item_category_overrides || {};

  function applyRounding(val) {
    if (ROUNDING_MODE === "round") return Math.round(val / ROUNDING_UNIT) * ROUNDING_UNIT;
    if (ROUNDING_MODE === "ceil")  return Math.ceil(val / ROUNDING_UNIT) * ROUNDING_UNIT;
    return Math.floor(val / ROUNDING_UNIT) * ROUNDING_UNIT;
  }

  // カスタム支払方法マージ
  var customPm = config.custom_payment_methods || {};
  var pmLabels = Object.assign({}, PAYMENT_METHOD_LABELS);
  Object.keys(customPm).forEach(function(id) {
    if (customPm[id] && customPm[id].label) pmLabels[id] = customPm[id].label;
  });
  function pmLabel(key) {
    if (!key) return "現金";
    return pmLabels[key] || key;
  }

  // ── メニューを menu_overrides でマージしながら走査して
  //    drinkSet / foodSet / setSet / drinkCountMap を構築
  var drinkSet = {}, foodSet = {}, setSet = {};
  var drinkCountMap = {}; // 商品名 → drink_count
  ["drink","food","set"].forEach(function(cat) {
    var node = menuData[cat] || {};
    var target = cat === "drink" ? drinkSet : cat === "food" ? foodSet : setSet;
    Object.keys(node).forEach(function(sub) {
      var items = Array.isArray(node[sub]) ? node[sub] : Object.values(node[sub]);
      items.forEach(function(it) {
        if (!it || !it.name) return;
        // menu_overrides をマージ
        var ov = (it.id && menuOverrides[it.id]) ? menuOverrides[it.id] : {};
        var merged = Object.assign({}, it, ov);
        target[merged.name] = true;
        if (merged.drink_count !== undefined && merged.drink_count !== null) {
          drinkCountMap[merged.name] = merged.drink_count;
        }
      });
    });
  });

  var LEGACY = {
    "生ビール ジョッキ(アサヒ\u3000スーパードライ)": "ドリンク",
    "メガハイボール": "ドリンク",
    "コークハイボール": "ドリンク",
    "ジンジャーハイボール": "ドリンク"
  };

  // sales.html と完全一致の isDrinkItem（4段階チェック）
  function isDrinkItem(name, item) {
    // 1) 新形式 item.category
    if (item && item.category !== undefined) return item.category === "drink";
    // 2) Firebase保存済み分類
    if (overrides[name] === "ドリンク") return true;
    // 3) 旧名マッピング
    if (LEGACY[name] === "ドリンク") return true;
    // 4) menu/drink キー（startsWith含む）
    if (drinkSet[name]) return true;
    var keys = Object.keys(drinkSet);
    for (var i = 0; i < keys.length; i++) {
      if (name.indexOf(keys[i]) === 0) return true;
    }
    return false;
  }

  function getCat(name) {
    if (overrides[name]) return overrides[name];
    if (LEGACY[name]) return LEGACY[name];
    if (name === "お冷") return "ドリンク";
    if (isDrinkItem(name)) return "ドリンク";
    if (foodSet[name]) return "フード";
    if (setSet[name]) return "セット";
    return "その他";
  }

  var DOW = ["日","月","火","水","木","金","土"];
  var TABLE_NAMES = config.table_names || {
    "1":"テーブル1","2":"テーブル2","3":"テーブル3","4":"テーブル4",
    "5":"コーラ卓","6":"座敷席","7":"カウンター1・2",
    "8":"カウンター3・4","9":"カウンター5","10":"奥席"
  };
  function pad(n) { return ("0"+n).slice(-2); }
  function toDayStr(ts) {
    var d = new Date(ts - DAY_START * 3600000);
    return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  }

  // paid/doneのみ対象
  var paid = [];
  Object.keys(orders || {}).forEach(function(k) {
    var o = orders[k];
    if (o.status === "paid" || o.status === "done") paid.push(o);
  });
  paid.sort(function(a,b){ return a.timestamp - b.timestamp; });

  // セッション構築（sales.html の buildSessionMap と完全同等）
  var sessMap = {};
  paid.forEach(function(o) {
    var sk = (o.table||"?") + "__" + (o.paidAt||"unpaid");
    if (!sessMap[sk]) sessMap[sk] = {
      table: o.table, ex: 0, inclusiveTotal: 0, ts: o.timestamp,
      drinkQty: 0, pax: 0, hasExempt: false,
      paymentMethod: null, items: {}, orders: []
    };
    var s = sessMap[sk];
    if (o.timestamp < s.ts) s.ts = o.timestamp;
    if (o.pax) s.pax = o.pax;
    if (o.paymentMethod && !s.paymentMethod) s.paymentMethod = o.paymentMethod;
    s.orders.push(o);
    (o.items||[]).forEach(function(it) {
      if (it.price_type === "inclusive") {
        s.inclusiveTotal += it.price * it.qty;
      } else {
        s.ex += it.price * it.qty;
      }
      // drink_count: orders に保存済みなら優先、なければ menu_overrides マージ後の値、なければ 1
      if (isDrinkItem(it.name, it) && it.name !== "お冷") {
        var dc = (it.drink_count !== undefined && it.drink_count !== null)
          ? it.drink_count
          : (drinkCountMap[it.name] !== undefined ? drinkCountMap[it.name] : 1);
        s.drinkQty += it.qty * dc;
      }
      if (it.charge_exempt) s.hasExempt = true;
      if (!s.items[it.name]) s.items[it.name] = { name: it.name, price: it.price, qty: 0 };
      s.items[it.name].qty += it.qty;
    });
  });

  Object.keys(sessMap).forEach(function(k) {
    var s = sessMap[k];
    var pax = s.pax || paxData[String(s.table)] || 0;
    s.pax = pax;
    // calcCharge (sales.html と完全一致)
    var charge = 0;
    if (!s.hasExempt) {
      if (MODE === "none") charge = 0;
      else if (MODE === "always") charge = CHARGE * pax;
      else { // conditional
        var hasFreeCharge = pax > 0 && s.drinkQty >= pax * FREE_COUNT;
        charge = hasFreeCharge ? 0 : CHARGE * pax;
      }
    }
    s.charge = charge;
    var finalEx = s.ex + charge;
    // 税込売上 = applyRounding((税抜+チャージ)×(1+税率)) + inclusiveTotal
    s.sales = applyRounding(finalEx * (1 + TAX_RATE/100)) + s.inclusiveTotal;
    s.tax = s.sales - Math.round(finalEx) - s.inclusiveTotal;
    var dt = new Date(s.ts);
    s.ds = toDayStr(s.ts);
    s.timeStr = pad(dt.getHours()) + ":" + pad(dt.getMinutes());
    s.dow = DOW[dt.getDay()];
    s.tableName = TABLE_NAMES[String(s.table)] || "T"+s.table;
    s.billId = String(s.orders[0].paidAt || s.ts);
    s.pmLabel = pmLabel(s.paymentMethod);
    var d2 = new Date(s.ts - DAY_START*3600000);
    s.ym = d2.getFullYear()+"-"+pad(d2.getMonth()+1);
    s.exDisplay = s.ex; // 表示用税抜（inclusive 含めない）
  });

  var sessions = Object.values(sessMap).sort(function(a,b){ return a.ts - b.ts; });

  // ① 伝票別
  var rows1 = [["日付","時刻","曜日","テーブル","人数","支払方法","税抜小計","チャージ","消費税","税込合計"]];
  sessions.forEach(function(s) {
    rows1.push([s.ds, s.timeStr, s.dow, s.tableName,
      s.pax > 0 ? s.pax : "", s.pmLabel,
      s.exDisplay, s.charge, s.tax, s.sales]);
  });
  var t1 = sessions.reduce(function(a,s){ return {ex:a.ex+s.exDisplay, ch:a.ch+s.charge, tax:a.tax+s.tax, tot:a.tot+s.sales}; }, {ex:0,ch:0,tax:0,tot:0});
  rows1.push(["合計","","","","","", t1.ex, t1.ch, t1.tax, t1.tot]);

  // ② 日別
  var dayMap = {};
  sessions.forEach(function(s) {
    if (!dayMap[s.ds]) dayMap[s.ds] = { ds:s.ds, dow:s.dow, cnt:0, sales:0 };
    dayMap[s.ds].cnt++; dayMap[s.ds].sales += s.sales;
  });
  var rows2 = [["日付","曜日","会計件数","税込売上"]];
  Object.values(dayMap).sort(function(a,b){ return a.ds.localeCompare(b.ds); }).forEach(function(d) {
    rows2.push([d.ds, d.dow, d.cnt, d.sales]);
  });
  var t2 = Object.values(dayMap).reduce(function(a,d){ return {cnt:a.cnt+d.cnt, s:a.s+d.sales}; }, {cnt:0,s:0});
  rows2.push(["合計","", t2.cnt, t2.s]);

  // ③ 月別
  var monthMap = {};
  sessions.forEach(function(s) {
    if (!monthMap[s.ym]) monthMap[s.ym] = { ym:s.ym, cnt:0, sales:0 };
    monthMap[s.ym].cnt++; monthMap[s.ym].sales += s.sales;
  });
  var rows3 = [["年月","会計件数","税込売上"]];
  Object.values(monthMap).sort(function(a,b){ return a.ym.localeCompare(b.ym); }).forEach(function(m) {
    rows3.push([m.ym, m.cnt, m.sales]);
  });
  var t3 = Object.values(monthMap).reduce(function(a,m){ return {cnt:a.cnt+m.cnt, s:a.s+m.sales}; }, {cnt:0,s:0});
  rows3.push(["合計", t3.cnt, t3.s]);

  // ④ 商品別（extras を別計上）
  var itemMap = {};
  paid.forEach(function(o) {
    (o.items||[]).forEach(function(it) {
      var extrasTotal = (it.extras||[]).reduce(function(s,ex){ return s+(ex.price||0); }, 0);
      var basePrice = it.price - extrasTotal;
      if (!itemMap[it.name]) itemMap[it.name] = { name:it.name, cat:getCat(it.name), qty:0, sales:0 };
      itemMap[it.name].qty += it.qty;
      itemMap[it.name].sales += basePrice * it.qty;
      (it.extras||[]).forEach(function(ex){
        if (!ex.price) return;
        if (!itemMap[ex.label]) itemMap[ex.label] = { name:ex.label, cat:getCat(ex.label), qty:0, sales:0 };
        itemMap[ex.label].qty += it.qty;
        itemMap[ex.label].sales += ex.price * it.qty;
      });
    });
  });
  var sorted4 = Object.values(itemMap).sort(function(a,b){ return b.sales - a.sales; });
  var totalS4 = sorted4.reduce(function(a,i){ return a+i.sales; }, 0);
  var rows4 = [["順位","商品名","カテゴリ","数量","税抜売上","構成比"]];
  sorted4.forEach(function(it, i) {
    rows4.push([i+1, it.name, it.cat, it.qty, it.sales,
      totalS4 > 0 ? (Math.round(it.sales/totalS4*1000)/10)+"%": "0%"]);
  });
  var t4 = sorted4.reduce(function(a,i){ return {qty:a.qty+i.qty, s:a.s+i.sales}; }, {qty:0,s:0});
  rows4.push(["","合計","", t4.qty, t4.s, "100.0%"]);

  // ⑤ 全データ（伝票明細）
  var rows5 = [["日付","時刻","曜日","テーブル","伝票ID","人数","支払方法","商品名","カテゴリ","数量","単価(税抜)","小計(税抜)","チャージ","消費税","税込合計"]];
  sessions.forEach(function(s) {
    var sortedItems = Object.values(s.items).sort(function(a,b) {
      var aD=isDrinkItem(a.name), bD=isDrinkItem(b.name);
      return aD===bD ? 0 : aD ? -1 : 1;
    });
    sortedItems.forEach(function(it, idx) {
      rows5.push([
        idx===0 ? s.ds : "",
        idx===0 ? s.timeStr : "",
        idx===0 ? s.dow : "",
        idx===0 ? s.tableName : "",
        idx===0 ? s.billId : "",
        idx===0 && s.pax>0 ? s.pax : "",
        idx===0 ? s.pmLabel : "",
        it.name, getCat(it.name), it.qty, it.price, it.price*it.qty,
        idx===0 ? s.charge : "",
        idx===0 ? s.tax : "",
        idx===0 ? s.sales : ""
      ]);
    });
  });
  var t5 = sessions.reduce(function(a,s){ return {sub:a.sub+s.exDisplay, ch:a.ch+s.charge, tax:a.tax+s.tax, tot:a.tot+s.sales}; }, {sub:0,ch:0,tax:0,tot:0});
  rows5.push(["","","","","","","","合計","","","", t5.sub, t5.ch, t5.tax, t5.tot]);

  // ⑥ 支払方法別集計
  var pmMonthMap = {};
  var pmIdsUsed = {};
  sessions.forEach(function(s) {
    var pmId = s.paymentMethod || "cash";
    pmIdsUsed[pmId] = true;
    if (!pmMonthMap[s.ym]) pmMonthMap[s.ym] = {};
    if (!pmMonthMap[s.ym][pmId]) pmMonthMap[s.ym][pmId] = { cnt:0, sales:0 };
    pmMonthMap[s.ym][pmId].cnt++;
    pmMonthMap[s.ym][pmId].sales += s.sales;
  });
  var pmIdList = Object.keys(pmIdsUsed);
  var pmOrder = ["cash","card","qr","paypay","rakuten","dpay","suica","other"];
  pmIdList.sort(function(a,b) {
    var ai = pmOrder.indexOf(a), bi = pmOrder.indexOf(b);
    if (ai < 0) ai = 100; if (bi < 0) bi = 100;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });

  var rows6Header = ["年月"];
  pmIdList.forEach(function(id) { rows6Header.push(pmLabel(id)+" 件数"); rows6Header.push(pmLabel(id)+" 売上"); });
  rows6Header.push("合計 件数"); rows6Header.push("合計 売上");
  var rows6 = [rows6Header];
  Object.keys(pmMonthMap).sort().forEach(function(ym) {
    var row = [ym];
    var totCnt = 0, totSales = 0;
    pmIdList.forEach(function(id) {
      var v = pmMonthMap[ym][id] || { cnt:0, sales:0 };
      row.push(v.cnt > 0 ? v.cnt : "");
      row.push(v.sales > 0 ? v.sales : "");
      totCnt += v.cnt; totSales += v.sales;
    });
    row.push(totCnt); row.push(totSales);
    rows6.push(row);
  });
  var totalRow6 = ["合計"];
  var grandCnt = 0, grandSales = 0;
  pmIdList.forEach(function(id) {
    var sumCnt = 0, sumSales = 0;
    Object.keys(pmMonthMap).forEach(function(ym) {
      var v = pmMonthMap[ym][id]; if (v) { sumCnt += v.cnt; sumSales += v.sales; }
    });
    totalRow6.push(sumCnt > 0 ? sumCnt : "");
    totalRow6.push(sumSales > 0 ? sumSales : "");
    grandCnt += sumCnt; grandSales += sumSales;
  });
  totalRow6.push(grandCnt); totalRow6.push(grandSales);
  rows6.push(totalRow6);

  var widths6 = [90];
  pmIdList.forEach(function() { widths6.push(55); widths6.push(90); });
  widths6.push(65); widths6.push(100);

  // ── シートに書き込み ─────────────────────────────────
  var now = new Date();
  var stamp = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HH:mm");

  var sheetDefs = [
    { name:"①伝票別",              rows: rows1, widths:[90,50,35,110,50,70,85,80,80,90] },
    { name:"②日別集計",            rows: rows2, widths:[90,35,75,100] },
    { name:"③月別集計",            rows: rows3, widths:[90,75,100] },
    { name:"④商品別集計",          rows: rows4, widths:[40,200,65,55,100,55] },
    { name:"⑤全データ(伝票明細)",  rows: rows5, widths:[90,48,35,110,130,40,70,200,65,45,85,85,75,75,90] },
    { name:"⑥支払方法別集計",      rows: rows6, widths: widths6 },
  ];

  sheetDefs.forEach(function(def) {
    var sh = ss.getSheetByName(def.name);
    if (sh) ss.deleteSheet(sh);
    sh = ss.insertSheet(def.name);

    sh.getRange(1,1,1,def.rows[0].length).merge()
      .setValue("サワディーブロス 売上データ｜最終更新: " + stamp)
      .setBackground("#1E3A8A").setFontColor("#FFFFFF")
      .setFontWeight("bold").setFontSize(11)
      .setHorizontalAlignment("center");
    sh.setRowHeight(1, 28);

    sh.getRange(2,1,1,def.rows[0].length)
      .setValues([def.rows[0]])
      .setBackground("#2563EB").setFontColor("#FFFFFF")
      .setFontWeight("bold").setFontSize(10)
      .setHorizontalAlignment("center");
    sh.setRowHeight(2, 20);

    if (def.rows.length > 1) {
      var dataRows = def.rows.slice(1, def.rows.length - 1);
      if (dataRows.length > 0) {
        sh.getRange(3,1,dataRows.length,def.rows[0].length).setValues(dataRows);
        dataRows.forEach(function(_, i) {
          var bg = i%2===0 ? "#FFFFFF" : "#F8FAFC";
          sh.getRange(i+3,1,1,def.rows[0].length).setBackground(bg);
        });
        sh.getRange(3,1,dataRows.length,def.rows[0].length).setFontSize(10).setFontColor("#1E293B");
        for (var ri = 0; ri < dataRows.length; ri++) sh.setRowHeight(ri+3, 18);
      }
      var lastRow = def.rows.length + 1;
      sh.getRange(lastRow,1,1,def.rows[0].length)
        .setValues([def.rows[def.rows.length-1]])
        .setBackground("#DBEAFE").setFontColor("#1E3A8A")
        .setFontWeight("bold").setFontSize(10);
      sh.setRowHeight(lastRow, 20);
    }
    def.widths.forEach(function(w, i) { sh.setColumnWidth(i+1, w); });
    if (def.rows.length > 1) {
      sh.getRange(1,1,def.rows.length+1,def.rows[0].length)
        .setBorder(true,true,true,true,true,true,"#CBD5E1",SpreadsheetApp.BorderStyle.SOLID);
    }
    sh.setFrozenRows(2);
  });

  var oldFifth = ss.getSheetByName("⑤全データ（伝票明細）");
  if (oldFifth) ss.deleteSheet(oldFifth);
  var defaultSheet = ss.getSheetByName("シート1");
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
  ss.setActiveSheet(ss.getSheets()[0]);

  return "✅ " + sessions.length + "件のセッション / " + paid.length + "件の注文を書き込みました（" + stamp + "）";
}

function fetchJson(path) {
  var res = UrlFetchApp.fetch(FIREBASE_URL + path, { muteHttpExceptions: true });
  return JSON.parse(res.getContentText());
}