// 追加：入力欄からの追加と、共有の文の貼り付けからの追加（貼った時点で登録）
(() => {
  const form = document.getElementById("addForm");
  const addMsg = document.getElementById("addMsg");
  const pasteBox = document.getElementById("pasteBox");
  const pasteMsg = document.getElementById("pasteMsg");

  const title = document.getElementById("addTitle");
  const addBtn = document.getElementById("addBtn");
  const cancelBtn = document.getElementById("cancelEdit");
  const notesBox = document.getElementById("notesBox");
  const notesText = document.getElementById("notesText");

  // よく使う言葉のボタン：押すと注意事項の欄の最後に1行足す。〇があれば〇を選んだ形にして、すぐ数字を打てるようにする
  document.getElementById("noteChips").addEventListener("click", e => {
    const b = e.target.closest("button[data-note]");
    if (!b) return;
    const cur = notesText.value.replace(/\s+$/, "");
    const start = cur ? cur.length + 1 : 0;
    notesText.value = (cur ? cur + "\n" : "") + b.dataset.note;
    notesText.focus();
    const j = b.dataset.note.indexOf("〇");
    if (j >= 0) notesText.setSelectionRange(start + j, start + j + 1);
    else notesText.setSelectionRange(notesText.value.length, notesText.value.length);
  });

  // 直す：選んだ現場の内容を入力欄に入れて、「直して保存」にする
  function setMode(editing) {
    title.textContent = editing ? "現場を直す" : "現場を追加";
    addBtn.textContent = editing ? "直して保存" : "追加する";
    cancelBtn.hidden = !editing;
  }
  window.Editor = {
    start(site) {
      for (const k of ["id", "name", "code", "inTel", "outTel", "kyUrl", "addr", "lat", "lng", "notes"]) form.elements[k].value = site[k] ?? "";
      notesBox.open = !!site.notes; // 注意事項があるときだけ開いておく
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
    notesBox.open = false;
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
    if (/〇/.test(f.notes || "")) {
      notesBox.open = true;
      addMsg.textContent = "注意事項に「〇」が残っています。数字に直すか、その行を消してください。"; return;
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
