// QR読み取り：看板の写真からKYのページのアドレスを読む
const QR = (() => {
  function tryDecode(img, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
    return r ? r.data : "";
  }

  // 大きさを変えて3回まで試す。https で始まるものだけ返す
  function read(img) {
    if (typeof jsQR !== "function") return "";
    for (const size of [1200, 2000, 800]) {
      const text = tryDecode(img, size);
      if (text) return /^https:\/\//.test(text) ? text : "";
    }
    return "";
  }

  return { read };
})();
