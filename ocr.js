// 文字読み取り：看板の写真から、現場番号と入場・退場の電話番号を読む
//
// 読み方（退場がずれないための工夫）
// 1. 文字の大きさで選ぶ：入場・退場の番号は看板でいちばん大きい。小さい問い合わせ番号は使わない
// 2. 上下の位置で分ける：上が入場、すぐ下が退場
// 3. 退場が読めないときは、入場のすぐ下だけを切り出して、大きくしてもう一度読む
// 4. 番号1つずつを切り出して、大きくして読み直す（ぼけた写真に強くする）
// 5. 入場・退場が2つそろわないときは、写真を少し回したり大きくしたりして読み直す
//    （斜めの写真・遠くから撮った写真に強くする）。そろわなければ、いちばん良かった結果を使う
const OCR = (() => {
  const TEL = /0\d{1,4}-\d{1,4}-\d{3,4}/;
  const TRIES = [
    { angle: 0, size: 1600 }, { angle: 6, size: 1600 }, { angle: -6, size: 1600 },
    { angle: 11, size: 1600 }, { angle: -11, size: 1600 }, { angle: 0, size: 2600, up: true },
  ];

  // 電話番号の形を整える。頭の0が2つになったものは1つにする
  function fixTel(s) {
    if (!s) return "";
    let t = s.replace(/^00/, "0");
    const digits = t.replace(/-/g, "");
    return digits.length === 10 || digits.length === 11 ? t : "";
  }

  // 線（1行）ごとに、電話番号と、その位置・高さを集める
  function collect(data) {
    const out = [];
    for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
      const m = (l.text || "").match(TEL);
      const tel = m && fixTel(m[0]);
      if (tel) out.push({ tel, bb: l.bbox, h: l.bbox.y1 - l.bbox.y0 });
    }
    return out;
  }

  // engine は「写真を回して整える」「全体を読む」「一部を切り出して1行として読む」の3つの道具
  async function readWith(engine, onTry) {
    const codes = [];
    let best = null;
    for (let i = 0; i < TRIES.length; i++) {
      if (onTry) onTry(i + 1, TRIES.length);
      const page = await engine.prepare(TRIES[i]);
      const data = await engine.readAll(page);
      codes.push(...((data.text || "").match(/[A-Z]{2}\d{5}/g) || []));

      const cands = collect(data);
      if (!cands.length) continue;
      const maxH = Math.max(...cands.map(c => c.h)) / TRIES[i].size;
      const r = await decide(engine, page, cands);
      const score = (r.inTel ? 1 : 0) + (r.outTel ? 1 : 0) + (r.pair ? 1 : 0) + maxH;
      if (!best || score > best.score) best = { ...r, score };
      if (r.pair && r.inTel && r.outTel) break;
    }
    // 現場番号は、何回も読めたものを選ぶ（1回だけ出た読み間違いを避ける）
    const count = {};
    codes.forEach(c => count[c] = (count[c] || 0) + 1);
    const code = codes.sort((a, b) => count[b] - count[a])[0] || "";
    return { code, inTel: best ? best.inTel : "", outTel: best ? best.outTel : "" };
  }

  // 1回分の読み取り結果から、入場と退場を決める。pair は「大きい番号が上下に2つそろった」
  async function decide(engine, page, cands) {
    {
      const maxH = Math.max(...cands.map(c => c.h));
      const big = cands.filter(c => c.h >= maxH * 0.6).sort((a, b) => a.bb.y0 - b.bb.y0);

      const lineRead = async box => fixTel(((await engine.readLine(page, box)) || "").match(TEL)?.[0]);
      const below = c => ({ x0: c.bb.x0, x1: c.bb.x1, y0: c.bb.y1 + c.h * 0.15, y1: c.bb.y1 + c.h * 1.9 });
      const above = c => ({ x0: c.bb.x0, x1: c.bb.x1, y0: c.bb.y0 - c.h * 1.9, y1: c.bb.y0 - c.h * 0.15 });

      let inC = big[0], outC = big[1] && big[1].bb.y0 - big[0].bb.y0 < big[0].h * 3.5 ? big[1] : null;
      let inTel = "", outTel = "";

      if (!outC) {
        // 1つしか読めなかった：それが入場か退場かを、上を読んで決める
        const up = await lineRead(above(inC));
        if (up) { inTel = up; outTel = (await lineRead(inC.bb)) || inC.tel; }
        else { outTel = await lineRead(below(inC)); }
      }
      if (!inTel) inTel = (await lineRead(inC.bb)) || inC.tel;
      if (!outTel && outC) outTel = (await lineRead(outC.bb)) || outC.tel;
      if (inTel === outTel) outTel = "";

      return { inTel, outTel, pair: !!outC };
    }
  }

  // ---- ここからiPhoneのブラウザ用の道具 ----
  let workerPromise = null;
  const WL = "0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function getWorker() {
    if (!workerPromise) {
      workerPromise = Tesseract.createWorker("eng");
      workerPromise.catch(() => { workerPromise = null; });
    }
    return workerPromise;
  }

  // 赤の色だけを取り出して濃淡をはっきりさせ、指定の角度だけ回す
  function prepareCanvas(img, { angle, size, up }) {
    const scale = up ? size / Math.max(img.width, img.height) : Math.min(1, size / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const d = ctx.getImageData(0, 0, w, h);
    const px = d.data;
    let min = 255, max = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i] < min) min = px[i]; if (px[i] > max) max = px[i]; }
    const k = 255 / Math.max(1, max - min);
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = (px[i] - min) * k;
    ctx.putImageData(d, 0, 0);
    return c;
  }

  function cropCanvas(src, box) {
    const pad = 15;
    const x0 = Math.max(0, Math.floor(box.x0 - pad)), y0 = Math.max(0, Math.floor(box.y0 - pad));
    const x1 = Math.min(src.width, Math.ceil(box.x1 + pad)), y1 = Math.min(src.height, Math.ceil(box.y1 + pad));
    if (x1 - x0 < 10 || y1 - y0 < 10) return null;
    const k = 120 / (y1 - y0);
    const c = document.createElement("canvas");
    c.width = Math.round((x1 - x0) * k); c.height = 120;
    c.getContext("2d").drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    return c;
  }

  async function read(img, onTry) {
    if (typeof Tesseract === "undefined") throw new Error("nolib");
    const w = await getWorker();
    return readWith({
      prepare: async t => prepareCanvas(img, t),
      readAll: async page => {
        await w.setParameters({ tessedit_char_whitelist: WL, tessedit_pageseg_mode: "11" });
        return (await w.recognize(page, {}, { blocks: true, text: true })).data;
      },
      readLine: async (page, box) => {
        const c = cropCanvas(page, box);
        if (!c) return "";
        await w.setParameters({ tessedit_char_whitelist: WL, tessedit_pageseg_mode: "7" });
        return (await w.recognize(c)).data.text;
      },
    }, onTry);
  }

  return { read, readWith, fixTel };
})();
