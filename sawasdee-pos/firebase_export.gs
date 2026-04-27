const FIREBASE_URL = 'https://sawatdee-bros-default-rtdb.asia-southeast1.firebasedatabase.app/menu.json';

// 空白以外ならtrue（文字の種類を問わない）
function isOn(val) {
  return val !== null && val !== undefined && val.toString().trim() !== '';
}

function exportToFirebase() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('メニュー');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const COL = {};
  headers.forEach((h, i) => COL[h] = i);
  const menuData = { drink: {}, food: {}, set: {}, subcatOrder: { drink: [], food: [], set: [] } };
  const subcatOrderMap = { drink: [], food: [], set: [] };
  const imgData = getImgData();

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const cat = row[COL['カテゴリ']] ? row[COL['カテゴリ']].toString().trim() : '';
    const subcat = row[COL['サブカテゴリ']] ? row[COL['サブカテゴリ']].toString().trim() : '';
    const activeVal = row[COL['有効']] ? row[COL['有効']].toString().trim() : '';
    if (!cat || !subcat || !activeVal) continue;
    const catKey = cat === 'ドリンク' ? 'drink' : cat === 'セット' ? 'set' : 'food';
    if (!menuData[catKey][subcat]) {
      menuData[catKey][subcat] = [];
      if (!subcatOrderMap[catKey].includes(subcat)) subcatOrderMap[catKey].push(subcat);
    }
    const id = row[COL['ID']] ? row[COL['ID']].toString().trim() : '';
    const name = row[COL['商品名']] ? row[COL['商品名']].toString().trim() : '';
    const kana = row[COL['カタカナ']] ? row[COL['カタカナ']].toString().trim() : '';
    const thai = row[COL['タイ語']] ? row[COL['タイ語']].toString().trim() : '';
    const en = row[COL['英語']] ? row[COL['英語']].toString().trim() : '';

    // 税込価格が入っている場合はそちらを使う（price_type: 'inclusive'）
    const priceEx = Number(row[COL['価格（税抜）']]) || 0;
    const priceIn = Number(row[COL['価格（税込）']]) || 0;
    const price = priceIn > 0 ? priceIn : priceEx;

    const desc = row[COL['説明']] ? row[COL['説明']].toString().trim() : '';
    const pakchi = isOn(row[COL['パクチー']]);
    const spicy = Number(row[COL['辛さ']]) || 0;
    const popularRaw = row[COL['人気']] ? row[COL['人気']].toString().trim() : '';
    const popular = popularRaw;
    const sake = isOn(row[COL['酒に合う']]);
    const warning = row[COL['注意']] ? row[COL['注意']].toString().trim() : '';

    const item = { active: true, id, name, kana, thai, en, price, desc, pakchi, spicy, popular, sake };

    // 税込価格列に値がある場合はprice_type:'inclusive'フラグを付ける
    if (priceIn > 0) item.price_type = 'inclusive';

    if (warning) item.warning = warning;
    if (COL['チャージ免除'] !== undefined && isOn(row[COL['チャージ免除']])) item.charge_exempt = true;
    if (COL['ハンディのみ'] !== undefined && isOn(row[COL['ハンディのみ']])) item.hidden = true;

    // 杯数カウント（未記入=通常1杯、0=カウントしない、2以上=ボトル等）
    if (COL['杯数カウント'] !== undefined) {
      const dcRaw = row[COL['杯数カウント']];
      if (dcRaw !== null && dcRaw !== undefined && dcRaw.toString().trim() !== '') {
        item.drink_count = Number(dcRaw);
      }
    }

    const imgKey = catKey + '/' + subcat + '/' + id;
    if (imgData[imgKey]) item.img = imgData[imgKey];
    menuData[catKey][subcat].push(item);
  }

  menuData.subcatOrder = subcatOrderMap;
  const options = { method: 'put', contentType: 'application/json', payload: JSON.stringify(menuData), muteHttpExceptions: true };
  const res = UrlFetchApp.fetch(FIREBASE_URL, options);
  if (res.getResponseCode() === 200) {
    Logger.log('完了');
  } else {
    Logger.log('エラー: ' + res.getContentText());
  }
}

function getImgData() {
  try {
    const res = UrlFetchApp.fetch('https://sawatdee-bros-default-rtdb.asia-southeast1.firebasedatabase.app/menu.json');
    const data = JSON.parse(res.getContentText());
    const imgMap = {};
    ['drink', 'food', 'set'].forEach(function(cat) {
      if (!data[cat]) return;
      Object.keys(data[cat]).forEach(function(subcat) {
        const items = data[cat][subcat];
        if (!Array.isArray(items)) return;
        items.forEach(function(item) {
          if (item.img && item.id) imgMap[cat + '/' + subcat + '/' + item.id] = item.img;
        });
      });
    });
    return imgMap;
  } catch(e) { return {}; }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Firebase')
    .addItem('Firebaseに反映する', 'exportToFirebase')
    .addToUi();
}
