// QR読み取り：看板の写真からKYのページのアドレスを読む
// 版63：そのままで読めないときは「くっきりさせて」読む（ぼやけた写真・小さく写ったQRでも入りやすく）
//  ①白黒にして輪郭を強める（シャープ）②まわりの明るさに合わせて白と黒に分ける ③写真を9つに分けて、それぞれ大きくして読む
const QR = (() => {
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  // 写真の一部（sx,sy,sw,sh）を、長い辺が side になる大きさで描いて、画素を返す
  function pixels(img, side, sx = 0, sy = 0, sw = img.width, sh = img.height) {
    const scale = side / Math.max(sw, sh);
    const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
    const ctx = canvas(w, h).getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  const decode = d => { const r = jsQR(d.data, d.width, d.height); return r ? r.data : ""; };

  // まわり（半径 r）の平均。積分画像（足し算の表）で速く出す
  function boxMean(g, w, h, r) {
    const W = w + 1, S = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) { row += g[y * w + x]; S[(y + 1) * W + x + 1] = S[y * W + x + 1] + row; }
    }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        out[y * w + x] = (S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0]) / ((y1 - y0) * (x1 - x0));
      }
    }
    return out;
  }

  // くっきりさせる：白黒 → 輪郭を強める（amount 倍）→ まわりより暗ければ黒、明るければ白
  function sharpen(d, amount, binarize) {
    const { width: w, height: h, data } = d, n = w * h;
    const g = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11;
    const blur = boxMean(g, w, h, Math.max(2, Math.round(Math.max(w, h) / 300)));
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = g[i] + amount * (g[i] - blur[i]);
    const local = binarize ? boxMean(s, w, h, Math.max(8, Math.round(Math.max(w, h) / 40))) : null;
    const out = new ImageData(w, h);
    for (let i = 0; i < n; i++) {
      const v = binarize ? (s[i] < local[i] - 4 ? 0 : 255) : Math.max(0, Math.min(255, s[i]));
      out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255;
    }
    return out;
  }

  // QRがありそうな所（元の写真での [左, 上, 一辺]）を、ありそうな順に返す
  function spots(img) {
    const d = pixels(img, 400), w = d.width, h = d.height, n = w * h, g = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = d.data[i * 4] * 0.3 + d.data[i * 4 + 1] * 0.59 + d.data[i * 4 + 2] * 0.11;
    const e = new Float32Array(n); // 境目の強さ
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      e[i] = Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + w] - g[i - w]);
    }
    const k = Math.max(img.width, img.height) / Math.max(w, h), list = [];
    for (const f of [0.12, 0.2, 0.32]) {
      const r = Math.max(4, Math.round(Math.min(w, h) * f / 2));
      const m = boxMean(e, w, h, r);
      for (let pick = 0; pick < 2; pick++) {
        let best = -1, bi = 0;
        for (let i = 0; i < n; i++) if (m[i] > best) { best = m[i]; bi = i; }
        if (best <= 0) break;
        const cx = bi % w, cy = (bi / w) | 0, half = r * 2.2;
        const side = Math.round(half * 2 * k);
        list.push([best, Math.max(0, Math.round((cx - half) * k)), Math.max(0, Math.round((cy - half) * k)), Math.min(side, img.width, img.height)]);
        for (let y = Math.max(0, cy - 2 * r); y < Math.min(h, cy + 2 * r); y++) for (let x = Math.max(0, cx - 2 * r); x < Math.min(w, cx + 2 * r); x++) m[y * w + x] = 0;
      }
    }
    return list.sort((a, b) => b[0] - a[0]).map(([, x, y, sd]) => [Math.min(x, img.width - sd), Math.min(y, img.height - sd), sd]);
  }

  // https で始まるものだけ返す。読めなければ ""
  function read(img) {
    if (typeof jsQR !== "function") return "";
    const ok = t => /^https:\/\//.test(t) ? t : "";
    // 1. そのまま（大きさを変えて3回）
    for (const size of [1200, 2000, 800]) {
      const t = decode(pixels(img, Math.min(size, Math.max(img.width, img.height))));
      if (t) return ok(t);
    }
    // 2. QRがありそうな所を探す：小さくした写真で「白黒の境目が一番つまっている四角」を数か所選ぶ
    //    その所を切り出して大きくし、そのまま → くっきりさせて、の順に読む（ぼやけた・小さく写ったQR）
    for (const [sx, sy, sw] of spots(img)) {
      const d = pixels(img, 1000, sx, sy, sw, sw);
      for (const amount of [0, 2, 4]) {
        const t = decode(amount ? sharpen(d, amount, false) : d);
        if (t) return ok(t);
      }
    }
    return "";
  }

  return { read };
})();
