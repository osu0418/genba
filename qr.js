// QR読み取り：看板の写真からKYのページのアドレスを読む
(() => {
  const input = document.getElementById("qrFile");
  const msg = document.getElementById("qrMsg");
  const kyField = document.querySelector('#addForm [name="kyUrl"]');

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

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    msg.textContent = "読み取り中…";
    try {
      if (typeof jsQR !== "function") throw new Error("nolib");
      const img = await createImageBitmap(file);
      let text = "";
      for (const size of [1200, 2000, 800]) { text = tryDecode(img, size); if (text) break; }
      if (/^https:\/\//.test(text)) {
        kyField.value = text;
        msg.textContent = "QRを読み取りました。";
      } else {
        msg.textContent = text ? "QRは読めましたが、KYのページではないようです。" : "QRが読めませんでした。QRに近づいて撮り直してください。";
      }
    } catch (e) {
      msg.textContent = e.message === "nolib" ? "読み取りの準備ができていません。電波のある所で開き直してください。" : "写真を開けませんでした。";
    }
    input.value = "";
  });
})();
