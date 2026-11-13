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

  // 写真を、横幅 width の白黒にする
  function prepare(img, width) {
    const scale = Math.min(1, width / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high"; // 縮めるときに字がつぶれにくくする
    g.filter = "grayscale(1)";
    g.drawImage(img, 0, 0, c.width, c.height);
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
      !/月極|募集|不正|用地|監視|駐輪|責任|内では|ください|禁止|お願い|注意|^前払|^時間貸|^コイン/.test(l))
      .map(l => l.replace(/^[^一-龠ぁ-んァ-ヶA-Za-z0-9]+/, ""));
    if (names.length) out.name = names.sort((a, b) => b.length - a.length)[0];

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
    const rule = find(/最大|上限|繰り?返|入庫後|夜間|昼間/, /月極|募集/).filter(l => !SENTENCE(l));
    if (/前払/.test(joined)) rule.unshift("前払い式（止めたらすぐチケットを買う）");
    if (/連日|日数分/.test(joined)) rule.push("続けて止めるときは日数分を先に買う");
    if (rule.length) out.rule = rule.slice(0, 3).join("／");

    // 車の大きさ：「全長/5.0m以下」などの所だけ取り出す
    const sizes = [];
    for (const m of joined.matchAll(/(全長|全高|全.|長さ|車幅|幅|高さ|車高|重量|重さ)\/?(\d+(?:\.\d+)?)(m|ｍ|cm|t|トン|kg)(以下|まで)?/g)) {
      // 「全幅」は「全極」「全李」などと読まれやすいので、全長・全高以外の「全〇」は全幅とみなす
      const label = { 全長: "全長", 全高: "高さ", 長さ: "全長", 車幅: "全幅", 幅: "全幅", 車高: "高さ", 高さ: "高さ", 重量: "重量", 重さ: "重量" }[m[1]] || "全幅";
      const t = `${label}${m[2]}${m[3]}${m[4] || ""}`;
      if (!sizes.some(x => x.startsWith(label))) sizes.push(t);
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

    return out;
  }

  // 写真（createImageBitmap の結果）を読む。onStep(何回目, 全部) で進み具合を知らせる
  async function read(img, onStep) {
    if (typeof Tesseract === "undefined") throw new Error("nolib");
    const w = await getWorker();
    await w.setParameters({ tessedit_pageseg_mode: "11", tessedit_char_whitelist: "" });
    onStep && onStep(1, 2);
    const big = lines((await w.recognize(prepare(img, 1200))).data.text);
    onStep && onStep(2, 2);
    const small = lines((await w.recognize(prepare(img, 450))).data.text);
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
