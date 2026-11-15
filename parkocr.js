// 駐車場の看板の文字読み取り：写真から、名前・料金・決まり・車の大きさ・連絡先などを拾う
// 読み取りは無料の Tesseract（日本語）。AIではないので、読めない所・読み違いがある前提で使う
//
// 読み方
// 1. 写真を2つの大きさで読む：大きいまま（小さい字用）と、小さく縮めて（「500円」のような大きい字用）
// 2. 行ごとに、言葉の決まりで欄に振り分ける（例：「円」があれば料金、「高さ」があれば車の大きさ）
// 3. 月極・罰金・募集などの行は、料金や連絡先に入れない
const ParkOCR = (() => {
  let workerPromise = null;
  function getWorker() {
    if (!workerPromise) workerPromise = Tesseract.createWorker("jpn").catch(e => { workerPromise = null; throw e; });
    return workerPromise;
  }

  // 版53：白黒にするとき、ふつうの明るさではなく「緑の濃さ」を使う：黄色い看板の赤い字・黒い字が、地の黄色とはっきり分かれる
  //  （黄色は緑が多く明るい、赤と黒は緑が少なく暗い。白い看板・青い看板でも字は読める）
  //  bw：true なら、さらに白と黒の2色にする（暗い所＝字だけを黒に残す）。黄色い看板の太い数字はこの方が読めた
  //  境目の85は、タイムズの白い看板と黄色い看板の2枚で試して両方読めた値
  function green(c, bw) {
    const g = c.getContext("2d");
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    let lo = 255, hi = 0;
    for (let k = 1; k < a.length; k += 4 * 7) { if (a[k] < lo) lo = a[k]; if (a[k] > hi) hi = a[k]; }
    const span = Math.max(40, hi - lo);
    for (let k = 0; k < a.length; k += 4) {
      let v = Math.max(0, Math.min(255, (a[k + 1] - lo) * 255 / span));
      if (bw) v = v < 85 ? 0 : 255;
      a[k] = a[k + 1] = a[k + 2] = v;
    }
    g.putImageData(d, 0, 0);
  }

  // 写真を、横幅 width の白黒にする
  function prepare(img, width, bw) {
    const scale = Math.min(1, width / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high"; // 縮めるときに字がつぶれにくくする
    g.drawImage(img, 0, 0, c.width, c.height);
    green(c, bw);
    return c;
  }

  // 全角数字や空白のゆれを直す（日本語の読み取りは字の間に空白が入るため、空白は全部取る）
  const clean = t => String(t || "")
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[ 　]/g, "")
    .replace(/(\d[.．])[OoDＯ]/g, "$10") // 「5.Om」のように 0 が O と読まれたのを直す
    .replace(/[－ー―‐](?=\d)/g, "-");
  const lines = t => clean(t).split("\n").map(s => s.trim()).filter(Boolean);

  const NOT_PRICE = /月額|月極|万円|保証|手数料|税込|罰|請求|違約|募集/;
  const NOT_TEL = /月極|募集|用地/;
  // 注意書きや説明の長い文（名前・決まりには入れない）
  const SENTENCE = l => l.length > 28 || /。|下さい|ください|ません|ます|場合|規約|方法|お客様|ご利用/.test(l);
  const TEL = /0\d{1,4}[-.(（]\d{1,4}[-.)）]\d{3,4}|0(?:120|570|800)\d{6}/;

  // 読んだ行から、欄ごとに拾う（pick は Node での試しにも使えるよう、画面と分けておく）
  function pick(big, small) {
    const out = {};
    const all = big.concat(small);
    const find = (re, not) => big.filter(l => re.test(l) && !(not && not.test(l)));

    // 名前：「駐車場」「パーキング」などの行。案内や注意の行は外し、いちばん長い行を使う
    const names = all.filter(l => /駐車場|パーキング|パーク|タイムズ|リパーク/.test(l) && !SENTENCE(l) &&
      !(/チケ|チ$/.test(l) && !/駐車場/.test(l)) && // 「パーキングチケットのご利用方法」の切れ端は外す
      !/月極|募集|不正|用地|監視|駐輪|責任|内では|ください|禁止|お願い|注意|^前払|^時間貸|^コイン|危険|車両|支障|管理|積載|故障/.test(l)) // 版53：規約の切れ端も外す
      .map(l => l.replace(/^[^一-龠ぁ-んァ-ヶA-Za-z]+/, "")); // 頭の記号・番号（看板の駐車場番号など）を外す
    // 版53：「〇〇駐車場」「タイムズ〇〇」の形を先に、その中で長い方
    const nameScore = l => (/(駐車場|パーキング|第\d+)$|^タイムズ/.test(l) ? 100 : 0) + l.length;
    if (names.length) out.name = names.sort((a, b) => nameScore(b) - nameScore(a))[0];

    // 料金：「円」がある行（月極や罰金は外す）
    // 「24時間500円」「24時間500n」のように、時間と数が並んでいる所（「円」が読めなくても拾う）
    const timed = big.concat(small).map(l => l.match(/(\d{1,3})(時間|分)(\d{3,5})(?!\d)/)).find(Boolean);
    const prices = find(/\d.*円|円.*\d/, NOT_PRICE).filter(l => !SENTENCE(l)).map(l => l.replace(/^[^\d一-龠]+/, ""));
    if (timed) out.price = `${timed[1]}${timed[2]} ${timed[3]}円`;
    else if (prices.length) out.price = prices.slice(0, 3).join("／");
    else {
      // 大きい字：縮めた方で、電話番号でない3〜4けたの数を料金とみなす（時間は看板で確かめてもらう）
      const n = small.filter(l => !TEL.test(l) && !NOT_PRICE.test(l) && !/年|月|日|改定|台/.test(l)).map(l => (l.match(/(?:^|[^\d.-])(\d{3,4})(?![\d.-])/) || [])[1]).find(Boolean);
      // 料金はふつう0で終わる。「500円」の「円」が数字に読まれて「5007」になったときは、最後の1けたを外す
      const yen = n && (/0$/.test(n) ? n : /0$/.test(n.slice(0, -1)) ? n.slice(0, -1) : "");
      if (yen) out.price = `${yen}円（何時間でいくらかは看板で確かめる）`;
    }

    const joined = all.join("");
    const rule = find(/最大|上限|繰り?返|入庫後|夜間|昼間/, /月極|募集|休止/).filter(l => !SENTENCE(l));
    if (/最大料.?休止|最大料金.?なし/.test(joined)) rule.push((/特定日/.test(joined) ? "特定日は" : "") + "最大料金休止（日付は看板で確かめる）"); // 版53
    if (/前払/.test(joined)) rule.unshift("前払い式（止めたらすぐチケットを買う）");
    if (/連日|日数分/.test(joined)) rule.push("続けて止めるときは日数分を先に買う");
    if (rule.length) out.rule = rule.slice(0, 3).join("／");

    // 車の大きさ：「全長/5.0m以下」などの所だけ取り出す
    const sizes = [];
    for (const m of joined.matchAll(/(全長|全高|全.|長さ|車幅|幅|高さ|車高|重量|重さ)\/?(\d+(?:\.\d+)?)(m|ｍ|cm|t|トン|kg)(以下|まで)?/g)) {
      // 「全幅」は「全極」「全李」などと読まれやすいので、全長・全高以外の「全〇」は全幅とみなす
      const label = { 全長: "全長", 全高: "高さ", 長さ: "全長", 車幅: "全幅", 幅: "全幅", 車高: "高さ", 高さ: "高さ", 重量: "重量", 重さ: "重量" }[m[1]] || "全幅";
      const t = `${label}${m[2]}${m[3]}${m[4] || ""}`;
      const sc = v => (/\.\d/.test(v) ? 2 : 0) + (/以下|まで/.test(v) ? 1 : 0);
      const j = sizes.findIndex(x => x.startsWith(label));
      if (j < 0) sizes.push(t); else if (sc(t) > sc(sizes[j])) sizes[j] = t; // 版53：何度も読むので、くわしく読めた方
    }
    if (sizes.length) out.size = sizes.join("・");

    if (/機械式|立体|タワー/.test(joined)) out.kind = "機械式";
    else if (/平置/.test(joined)) out.kind = "平置き";
    const rsv = joined.match(/akippa|アキッパ|特P|予約制/i);
    if (rsv) out.reserve = rsv[0];

    // 連絡先：「緊急」「連絡」「管理」などの行の番号を先に。月極や募集の問い合わせ番号は外す
    const tels = all.map((l, i) => ({ l, prev: all[i - 1] || "", m: l.match(TEL) }))
      .filter(x => x.m && !NOT_TEL.test(x.l) && !NOT_TEL.test(x.prev));
    const tel = tels.find(x => /緊急|連絡|管理|ロック|お客様/.test(x.l)) || tels.find(x => /^0120/.test(x.m[0])) || tels[0];
    if (tel) out.tel = tel.m[0].replace(/[.(（)）]/g, "-").replace(/^(0120|0570|0800)(\d{3})(\d{3})$/, "$1-$2-$3");

    // ---- 版53：タイムズなどの看板の書き方（「駐車後24時間 500円」「60分200円」「最初の60分無料」）----
    // 字はばらばらに読まれる（「24時間」「500」が別の行、「60分200円」が「60,200」）ので、行をつないだ字から探す
    const flat = all.join(" ");
    const f2 = flat.replace(/\s/g, "");
    // 料金：「60分200円」「60,200」「60.200」「30ヵ100」など（分のあとに3〜4けたの値段）
    if (!out.price || /確かめる/.test(out.price)) {
      const ps = [];
      for (const m of flat.matchAll(/(?:^|[^\d:：.-])(5|10|12|15|20|25|30|40|45|60|90|120)\s?[分ヵカ,，.．・、]\s?(\d{3,4})(?!\d)/g)) {
        const t = `${m[1]}分${m[2]}円`;
        if (+m[2] % 10 === 0 && +m[2] <= 3000 && !ps.includes(t)) ps.push(t);
      }
      // 「8:00〜22:00」のような時間帯があれば、時間帯で値段が違う看板（どれがいつかは看板で確かめてもらう）
      if (ps.length) out.price = ps.slice(0, 3).join("／") + (ps.length > 1 && /\d{1,2}[:：.]?\d{2}\s?[~〜～-]/.test(flat) ? "（時間帯で違う。看板で確かめる）" : "");
    }
    // 最大料金：「駐車後24時間 500円」「24時間最大500円」「最大料金…500円」
    const num = t => +String(t).replace(/[,，.]/g, "");
    const mx = flat.match(/(駐車後|入庫後)?\s?(\d{1,2})\s?時間[^\d]{0,8}?(\d[,，.]\d{3}|\d{3,4})(?![\d~〜～:：-])/); // 「8:00〜」の「800」のような時刻は外す
    if (mx && num(mx[3]) % 10 === 0 && num(mx[3]) <= 5000) out.max = `${mx[1] || ""}${mx[2]}時間 最大${num(mx[3]).toLocaleString("ja-JP")}円`;
    else {
      const m2 = flat.match(/最大(?!料.?休止)[^\d]{0,8}(\d[,，]\d{3}|\d{3,4})(?![\d~〜～:：-])/);
      if (m2 && num(m2[1]) % 10 === 0) out.max = `最大${num(m2[1]).toLocaleString("ja-JP")}円`;
    }
    if (out.max && /最大料.?休止/.test(f2) && /特定日/.test(f2)) out.max += "（特定日は最大料金休止）";
    // 無料の時間
    const free = flat.replace(/\s/g, "").match(/最初の?(\d{1,3})分(?:間)?無料/);
    if (free && out.price) out.price += `（最初の${free[1]}分無料）`;
    else if (free) out.price = `最初の${free[1]}分無料`;
    const memo = [];
    if (/無料追加|無料延長|サービス券|お買[い上]?/.test(flat.replace(/\s/g, ""))) memo.push("買い物などで無料の時間が延びる（看板で確かめる）");
    const rule2 = [];
    if (/帰り.{0,4}前に?必ず.{0,3}精算/.test(f2)) rule2.push("帰る前に必ず精算");
    if (/(入場|入庫)から(課金|料金)?/.test(f2)) rule2.push("入った時から料金がかかる");
    if (rule2.length) out.rule = [out.rule].concat(rule2).filter(Boolean).join("／");
    if (/ナンバー.{0,3}(精算|認識|管理)|駐車券なし/.test(f2)) memo.push("ナンバーで精算（駐車券なし）");
    if (/車止め.{0,3}(ありま|なし|無し)/.test(f2)) memo.push("車止めなし");
    if (/満車の場合|満車時/.test(f2)) memo.push("満車のときは場内で待たずに出る");
    if (memo.length) out.memo = memo.join("／");
    if (!out.name && /Times|TIMES|タイムズ/i.test(flat)) out.name = "タイムズ";

    return out;
  }

  // 版53：写真を上・中・下の3つの帯に分け、2倍に大きくして濃くしてから読む（看板の小さい字・色のついた看板用）
  //  「最初の60分無料」「駐車後24時間」などは、写真をそのまま読むと字が小さすぎて読めなかった
  function band(img, i, n) {
    const h = img.height / n, y = Math.max(0, i * h - h * 0.15), bh = Math.min(img.height - y, h * 1.3);
    const scale = Math.min(2, 2400 / img.width); // 大きくしすぎるとiPhoneのメモリが足りなくなる
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(bh * scale);
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, y, img.width, bh, 0, 0, c.width, c.height);
    green(c);
    return c;
  }

  // 写真（createImageBitmap の結果）を読む。onStep(何回目, 全部) で進み具合を知らせる
  async function read(img, onStep) {
    if (typeof Tesseract === "undefined") throw new Error("nolib");
    const w = await getWorker();
    await w.setParameters({ tessedit_pageseg_mode: "11", tessedit_char_whitelist: "" });
    const N = 6;
    onStep && onStep(1, N);
    const big = lines((await w.recognize(prepare(img, 1200))).data.text);
    onStep && onStep(2, N);
    const small = lines((await w.recognize(prepare(img, 450))).data.text);
    onStep && onStep(3, N);
    big.push(...lines((await w.recognize(prepare(img, 1200, true))).data.text)); // 白と黒の2色で（太い数字用）
    for (let i = 0; i < 3; i++) {
      onStep && onStep(4 + i, N);
      big.push(...lines((await w.recognize(band(img, i, 3))).data.text));
    }
    return pick(big, small);
  }

  // 何枚かの結果を合わせる：先に読めた方を使う。料金は「時間つき」を、「看板で確かめる」つきより先にする
  function merge(list) {
    const out = {};
    for (const r of list) for (const [k, v] of Object.entries(r)) {
      if (!v) continue;
      if (!out[k] || (k === "price" && /確かめる/.test(out[k]) && !/確かめる/.test(v))) out[k] = v;
    }
    return out;
  }

  return { read, pick, merge };
})();
