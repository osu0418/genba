// 追加：入力欄からの追加と、共有の文の貼り付けからの追加
(() => {
  const form = document.getElementById("addForm");
  const pasteBox = document.getElementById("pasteBox");
  const pasteMsg = document.getElementById("pasteMsg");

  form.addEventListener("submit", e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if (f.kyUrl && !/^https:\/\//.test(f.kyUrl.trim())) {
      document.getElementById("qrMsg").textContent = "KYのページは https:// から始まるものだけ入れられます。";
      return;
    }
    const r = Store.upsert(f);
    form.reset();
    document.getElementById("qrMsg").textContent = `「${f.name}」を${r}しました。`;
    List.render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("pasteBtn").addEventListener("click", () => {
    const sites = Share.parse(pasteBox.value);
    if (!sites.length) {
      pasteMsg.textContent = "現場を読み取れませんでした。【現場】から始まる文か確かめてください。";
      return;
    }
    const done = sites.map(s => `「${s.name}」を${Store.upsert(s)}`);
    pasteMsg.textContent = done.join("\n") + "しました。";
    pasteBox.value = "";
    List.render();
  });
})();
