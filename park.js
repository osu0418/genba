// 駐車場の画面：現場ごとに駐車場を登録する・直す・消す
// 場所（今いる位置）は必須。ほかの欄は、Claudeの【駐車場】の文を貼るか、手で入れる（空でもよい）
const Park = (() => {
  const title = document.getElementById("parkTitle");
  const listEl = document.getElementById("parkList");
  const form = document.getElementById("parkForm");
  const placeMsg = document.getElementById("parkPlaceMsg");
  const pasteBox = document.getElementById("parkPaste");
  const msg = document.getElementById("parkMsg");
  const saveBtn = document.getElementById("parkSave");
  const cancelBtn = document.getElementById("parkCancel");
  const hereBtn = document.getElementById("parkHere");
  let siteId = "";

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const site = () => Store.load().find(s => s.id === siteId);
  const hasPlace = () => form.elements.lat.value !== "" && form.elements.lng.value !== "";

  function showPlace(extra) {
    placeMsg.textContent = hasPlace()
      ? "✅ 場所は登録ずみ" + (extra || "") + "（ずれていたら、駐車場の中でもう一度押す）"
      : "まだ場所がありません。駐車場の中で上のボタンを押してください。";
    hereBtn.textContent = hasPlace() ? "📍 今いる場所で登録し直す" : "📍 今いる場所を、この駐車場にする";
  }

  function clearForm() {
    form.reset();
    for (const k of ["id", "lat", "lng", "checked"]) form.elements[k].value = "";
    pasteBox.value = "";
    saveBtn.textContent = "この駐車場を保存";
    cancelBtn.hidden = true;
    showPlace();
  }

  function renderList() {
    const s = site();
    if (!s) return;
    title.textContent = `${s.name} の駐車場`;
    const parks = s.parks || [];
    listEl.innerHTML = parks.length
      ? parks.map(p => `<div class="parkItem">
          <div><b>${esc(p.name || "名前なし")}</b>${p.price ? "　" + esc(p.price) : ""}</div>
          <div class="note0">確認日：${esc(p.checked)}</div>
          <div class="tools"><button type="button" data-pedit="${esc(p.id)}">直す</button>
          <button type="button" class="del" data-pdel="${esc(p.id)}">削除</button></div>
        </div>`).join("")
      : `<p class="note0">まだ駐車場はありません。</p>`;
  }

  function open(id) {
    siteId = id;
    if (!site()) return;
    clearForm();
    msg.textContent = "";
    renderList();
    View.show("park");
  }

  // onlyFilled：貼った文にある欄だけ入れる（先に手で打った欄を消さないため）
  function fill(p, onlyFilled) {
    for (const [, k] of ParkText.LABELS) {
      if (onlyFilled && !p[k]) continue;
      form.elements[k].value = p[k] ?? "";
    }
  }

  listEl.addEventListener("click", e => {
    const b = e.target.closest("button");
    const s = site();
    if (!b || !s) return;
    const p = (s.parks || []).find(x => x.id === (b.dataset.pedit || b.dataset.pdel));
    if (!p) return;
    if (b.dataset.pedit) {
      clearForm();
      fill(p);
      for (const k of ["id", "lat", "lng", "checked"]) form.elements[k].value = p[k] ?? "";
      saveBtn.textContent = "直して保存";
      cancelBtn.hidden = false;
      showPlace();
      msg.textContent = `「${p.name || "名前なし"}」を直しています。`;
      form.scrollIntoView({ behavior: "smooth" });
    } else if (confirm(`「${p.name || "名前なし"}」を削除しますか？\n元に戻せません。`)) {
      Store.removePark(siteId, p.id);
      if (form.elements.id.value === p.id) clearForm();
      renderList();
    }
  });

  hereBtn.addEventListener("click", () => {
    if (!navigator.geolocation) { placeMsg.textContent = "この携帯では今いる場所を使えません。"; return; }
    placeMsg.textContent = "今いる場所を調べています…";
    navigator.geolocation.getCurrentPosition(pos => {
      form.elements.lat.value = pos.coords.latitude.toFixed(6);
      form.elements.lng.value = pos.coords.longitude.toFixed(6);
      const m = Math.round(pos.coords.accuracy || 0);
      msg.textContent = msg.textContent.replace(/\n?⚠ 場所がまだ.*$/, ""); // 古い「場所がまだ」を消す
      showPlace(m ?`（ずれ 約${m}m${m > 100 ? "。大きいので外の開けた所で押し直すのがおすすめ" : ""}）` : "");
    }, () => {
      placeMsg.textContent = "今いる場所を使えませんでした。位置情報の許可を確かめて、もう一度押してください。";
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });

  // 【駐車場】の文を貼ったら、欄に入れる（保存はしない。場所を確かめてから保存する）
  function fromPaste() {
    const p = ParkText.parse(pasteBox.value)[0];
    if (!p) {
      if (pasteBox.value.trim()) msg.textContent = "読み取れませんでした。【駐車場】から始まる文か確かめてください。";
      return;
    }
    fill(p, true);
    // 文の「位置」は、正しい数のときだけ使う（📍がまだのときだけ）
    const la = parseFloat(p.lat), ln = parseFloat(p.lng);
    if (!hasPlace() && isFinite(la) && isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      form.elements.lat.value = p.lat;
      form.elements.lng.value = p.lng;
    }
    pasteBox.value = "";
    showPlace();
    msg.textContent = "文から読み取りました。中身を確かめて「保存」を押してください。"
      + (hasPlace() ? "" : "\n⚠ 場所がまだです。駐車場の中で📍を押してください。");
  }
  pasteBox.addEventListener("paste", () => setTimeout(fromPaste, 50));
  pasteBox.addEventListener("blur", fromPaste);

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!hasPlace()) { msg.textContent = "場所がまだです。駐車場の中で📍のボタンを押してください。"; return; }
    const f = Object.fromEntries(new FormData(form));
    f.checked = Store.today(); // 保存した日を「確認日」にする（直したときも新しくする）
    const editing = !!f.id;
    if (!Store.savePark(siteId, f)) { msg.textContent = "保存できませんでした。"; return; }
    clearForm();
    renderList();
    msg.textContent = `「${f.name || "名前なし"}」を${editing ? "直" : "保存"}しました。`;
    window.scrollTo(0, 0);
  });

  cancelBtn.addEventListener("click", () => { clearForm(); msg.textContent = ""; });
  View.onBack(cur => { if (cur === "park") clearForm(); });

  return { open };
})();
