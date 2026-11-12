// 文字読み取り：看板の写真から、現場番号と入場・退場の電話番号を読む
const OCR = (() => {
  let workerPromise = null;

  function getWorker() {
    if (!workerPromise) {
      workerPromise = (async () => {
        const w = await Tesseract.createWorker("eng");
        await w.setParameters({
          tessedit_char_whitelist: "0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          tessedit_pageseg_mode: "11",
        });
        return w;
      })();
      workerPromise.catch(() => { workerPromise = null; });
    }
    return workerPromise;
  }

  // 青い帯の白い文字も読めるよう、赤の色だけを取り出して濃淡をはっきりさせる
  function prepare(img) {
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h);
    const px = d.data;
    let min = 255, max = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i] < min) min = px[i]; if (px[i] > max) max = px[i]; }
    const k = 255 / Math.max(1, max - min);
    for (let i = 0; i < px.length; i += 4) {
      const v = (px[i] - min) * k;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  }

  // 読んだ文字から番号を拾う。電話番号は上から順に1つ目＝入場、2つ目＝退場
  function pick(text) {
    const code = (text.match(/[A-Z]{2}\d{5}/) || [""])[0];
    const tels = [...new Set(text.match(/0\d{1,4}-\d{1,4}-\d{3,4}/g) || [])];
    return { code, inTel: tels[0] || "", outTel: tels[1] || "" };
  }

  async function read(img) {
    if (typeof Tesseract === "undefined") throw new Error("nolib");
    const w = await getWorker();
    const { data } = await w.recognize(prepare(img));
    return pick(data.text);
  }

  return { read, pick };
})();
