// 写真で登録：写真1枚からQRと番号を読み、入力欄に入れる
(() => {
  const input = document.getElementById("photoFile");
  const msg = document.getElementById("photoMsg");
  const form = document.getElementById("addForm");
  const field = n => form.querySelector(`[name="${n}"]`);

  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    msg.textContent = "読み取り中…（初めては10秒ほどかかります）";
    let img;
    try { img = await createImageBitmap(file); }
    catch { msg.textContent = "写真を開けませんでした。"; return; }

    const ky = QR.read(img);
    let nums = { code: "", inTel: "", outTel: "" };
    let ocrFailed = false;
    try { nums = await OCR.read(img, (n, all) => { msg.textContent = `読み取り中…（${n}/${all}回目。読みにくい写真ほど回数が増えます）`; }); }
    catch { ocrFailed = true; }

    // 前の写真の結果が残らないよう、読めなかった欄は空にする
    field("kyUrl").value = ky;
    field("code").value = nums.code;
    field("inTel").value = nums.inTel;
    field("outTel").value = nums.outTel;

    const lines = [
      `現場番号：${nums.code || "読めず"}`,
      `入場：${nums.inTel || "読めず"}`,
      `退場：${nums.outTel || "読めず"}`,
      `KY：${ky ? "読めた" : "読めず"}`,
    ];
    const ok = nums.inTel && nums.outTel;
    const areaDiff = ok && nums.inTel.slice(0, 4) !== nums.outTel.slice(0, 4);
    msg.textContent = (ocrFailed ? "番号の読み取りができませんでした。電波のある所で試すか、手で入れてください。\n" : "")
      + lines.join("\n")
      + (areaDiff ? "\n⚠ 入場と退場で頭の4けたが違います。読み間違いかもしれません。看板と1けたずつ見比べてください。" : "")
      + (ok ? "\n看板と番号が合っているか見て、邸名を入れて「追加する」を押してください。"
            : nums.inTel
              ? "\n退場が読めませんでした。入場の番号も看板と同じか必ず見てください。看板の正面から撮り直すのがおすすめです。"
              : "\n読めなかった所は手で入れるか、看板の正面から近づいて撮り直してください。");
    field("name").focus();
  });
})();
