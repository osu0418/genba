// 追加：入力欄からの追加と、共有の文の貼り付けからの追加（貼った時点で登録）
(() => {
  const form = document.getElementById("addForm");
  const addMsg = document.getElementById("addMsg");
  const pasteBox = document.getElementById("pasteBox");
  const pasteMsg = document.getElementById("pasteMsg");

  const title = document.getElementById("addTitle");
  const addBtn = document.getElementById("addBtn");
  const cancelBtn = document.getElementById("cancelEdit");

  // 直す：選んだ現場の内容を入力欄に入れて、「直して保存」にする
  function setMode(editing) {
    title.textContent = editing ? "現場を直す" : "現場を追加";
    addBtn.textContent = editing ? "直して保存" : "追加する";
    cancelBtn.hidden = !editing;
  }
  window.Editor = {
    start(site) {
      for (const k of ["id", "name", "code", "inTel", "outTel", "kyUrl", "addr", "lat", "lng"]) form.elements[k].value = site[k] ?? "";
      if (typeof MapPick !== "undefined") MapPick.sync();
      setMode(true);
      addMsg.textContent = `「${site.name}」を直しています。`;
      View.show("add");
    },
  };
  // 隠れた欄（id）は reset で消えないので、手で消す
  function clearForm() {
    form.reset();
    for (const k of ["id", "lat", "lng"]) form.elements[k].value = "";
    setMode(false);
    if (typeof MapPick !== "undefined") MapPick.sync();
  }
  cancelBtn.addEventListener("click", () => { clearForm(); addMsg.textContent = ""; View.show("list"); });
  // 「← 一覧に戻る」：直している途中なら、直すのをやめる（新しく入れている途中の字は残す）
  View.onBack(cur => { if (cur === "add" && form.elements.id.value) { clearForm(); addMsg.textContent = ""; } });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    f.name = (f.name || "").trim() || (f.code || "").trim();
    if (!f.name) { addMsg.textContent = "邸名か現場番号を入れてください。"; return; }
    if (!Store.cleanTel(f.inTel) || !Store.cleanTel(f.outTel)) {
      addMsg.textContent = "入場と退場の電話番号を入れてください。"; return;
    }
    if (f.kyUrl && !/^https:\/\//.test(f.kyUrl.trim())) {
      addMsg.textContent = "KYのページは https:// から始まるものだけ入れられます。"; return;
    }
    const r = f.id ? "直" : Store.upsert(f);
    if (f.id) Store.upsert(f);
    clearForm();
    document.getElementById("photoMsg").textContent = "";
    addMsg.textContent = "";
    View.show("list", `「${f.name}」を${r}しました。`);
  });

  function addFromPaste() {
    const sites = Share.parse(pasteBox.value);
    if (!sites.length) {
      if (pasteBox.value.trim()) pasteMsg.textContent = "現場を読み取れませんでした。【現場】から始まる文か確かめてください。";
      return;
    }
    const done = sites.map(s => `「${s.name}」を${Store.upsert(s)}`);
    pasteMsg.textContent = "";
    pasteBox.value = "";
    View.show("list", done.join("\n") + "しました。");
  }

  // 貼り付けたら、少し待ってから自動で登録する（手で打った途中では登録しない）
  pasteBox.addEventListener("paste", () => setTimeout(addFromPaste, 50));
  pasteBox.addEventListener("blur", addFromPaste);
})();
