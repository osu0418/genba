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
  // 保存した直後の「知らせる文をコピー」：別の駐車場を入れ始めたら・画面を出たら消す（コピーしたあとも、もう一度押せるよう残す）
  const notifyBox = document.getElementById("parkNotify");
  const notifyMsg = document.getElementById("parkNotifyMsg");
  const notifyBtn = document.getElementById("parkNotifyBtn");
  let lastParkId = "";
  const hideNotify = () => { notifyBox.hidden = true; lastParkId = ""; };
  let readNo = 0; // 写真の読み取りの番号。画面を片付けたり次の写真を選んだら増やし、古い結果は使わない

  // 地図でピンを直す：現場の地図と同じ仕組み（mappick.js）を使う。ピンを動かすと場所と住所が変わる
  // 「今いる場所」は上の📍ボタンがあるので、地図の中のボタンは画面に出さない（作るだけ）
  const mapOpen = document.getElementById("parkMapOpen");
  const mapSave = document.getElementById("parkMapSave");
  const picker = MapPick.make({
    box: document.getElementById("parkMapBox"), openBtn: mapOpen,
    hereBtn: document.createElement("button"), clearBtn: document.createElement("button"),
    msg: document.getElementById("parkMapMsg"),
    lat: form.elements.lat, lng: form.elements.lng, addr: form.elements.addr,
    // ピンを人が動かしたら、地図のすぐ下に「✓ この場所で保存」を出す（下の保存ボタンまで探さなくてよいように）
    onChange: manual => { showPlace(); if (manual) mapSave.hidden = false; },
    // 地図の左上の「✕ やめる」：地図を閉じてピンと住所を開く前に戻す。「✓ この場所で保存」も隠す（版22）
    cancel: true,
    onCancel: () => { mapSave.hidden = true; showPlace(); },
    // 住所を書いたら、その住所へピンを動かす（現場と同じ。版22）
    searchAddr: true,
  });
  // 地図を閉じた形に戻す（別の駐車場を入れるとき・直すとき）
  function resetMap() {
    mapSave.hidden = true;
    document.getElementById("parkMapBox").hidden = true;
    mapOpen.hidden = false;
    picker.sync();
  }

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const site = () => Store.load().find(s => s.id === siteId);
  const hasPlace = () => form.elements.lat.value !== "" && form.elements.lng.value !== "";

  function showPlace(extra) {
    placeMsg.textContent = hasPlace()
      ? "✅ 場所は登録ずみ" + (extra || "") + "（ずれていたら「🗺 地図でピンを直す」でピンを動かす）"
      : "まだ場所がありません。駐車場の中で上のボタンを押してください。";
    hereBtn.textContent = hasPlace() ? "📍 今いる場所で登録し直す" : "📍 今いる場所を、この駐車場にする";
  }

  // 保存していない直しがあるか見るため、画面を開いた・保存したときの中身を覚えておく
  let saved = "";
  const snap = () => {
    const o = Object.fromEntries(new FormData(form));
    for (const k of ["lat", "lng"]) o[k] = o[k] === "" ? "" : String(+o[k]); // 「34.7712」と「34.771200」を同じとみなす
    return JSON.stringify(o);
  };

  function clearForm() {
    form.reset();
    for (const k of ["id", "lat", "lng", "checked"]) form.elements[k].value = "";
    pasteBox.value = "";
    saveBtn.textContent = "この駐車場を保存";
    cancelBtn.hidden = true;
    saved = snap();
    readNo++;
    mark("name", false); mark("price", false);
    photoMsg.textContent = "";
    resetMap();
    showPlace();
  }

  function renderList() {
    const s = site();
    if (!s) return;
    title.textContent = `${s.name} の駐車場`;
    // 一番上に「🔍 近くの駐車場を地図で探す」（版23。ピンも住所も無い現場は、入れ方を知らせる）
    document.getElementById("parkFind").innerHTML = Nav.parkSearch(s, "🔍 近くの駐車場を地図で探す")
      || `<p class="note0">🔍 近くの駐車場を地図で探すには、現場の「直す」で住所か地図の場所を入れてください。</p>`;
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
    hideNotify();
    renderList();
    View.show("park");
  }

  // onlyFilled：貼った文にある欄だけ入れる（先に手で打った欄を消さないため）
  // onlyEmpty：空の欄にだけ入れる（写真の読み違いで、手で打った正しい字を消さないため）
  function fill(p, onlyFilled, onlyEmpty) {
    for (const [, k] of ParkText.LABELS) {
      if (onlyFilled && !p[k]) continue;
      if (onlyEmpty && form.elements[k].value.trim()) continue;
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
      hideNotify();
      clearForm();
      fill(p);
      for (const k of ["id", "lat", "lng", "checked"]) form.elements[k].value = p[k] ?? "";
      saveBtn.textContent = "直して保存";
      cancelBtn.hidden = false;
      picker.sync();
      showPlace();
      saved = snap();
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
    const before = form.elements.lat.value + "," + form.elements.lng.value;
    navigator.geolocation.getCurrentPosition(pos => {
      // 調べている間に地図でピンを動かしていたら、手で選んだ場所を残す（遅れた返事で上書きしない）
      if (form.elements.lat.value + "," + form.elements.lng.value !== before) { showPlace(); return; }
      form.elements.lat.value = pos.coords.latitude.toFixed(6);
      form.elements.lng.value = pos.coords.longitude.toFixed(6);
      const m = Math.round(pos.coords.accuracy || 0);
      msg.textContent = msg.textContent.replace(/\n?⚠ 場所がまだ.*$/, ""); // 古い「場所がまだ」を消す
      picker.sync(); // 地図を開いていれば、ピンを今いる場所へ動かす
      // 住所が空なら、今いる場所の住所を入れる（版22。書いてある住所は、番地まであることが多いので上書きしない）
      if (!form.elements.addr.value.trim()) picker.fillAddr(pos.coords.latitude, pos.coords.longitude);
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
    for (const k of ["name", "price"]) if (form.elements[k].value.trim()) mark(k, false);
    // 文の「位置」は、正しい数のときだけ使う（📍がまだのときだけ）
    const la = parseFloat(p.lat), ln = parseFloat(p.lng);
    if (!hasPlace() && isFinite(la) && isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      form.elements.lat.value = p.lat;
      form.elements.lng.value = p.lng;
      picker.sync();
    }
    pasteBox.value = "";
    showPlace();
    msg.textContent = "文から読み取りました。中身を確かめて「保存」を押してください。"
      + (hasPlace() ? "" : "\n⚠ 場所がまだです。駐車場の中で📍を押してください。");
  }
  // 看板の写真で入れる：読めた欄だけ入れ、読めなかった大事な欄（名前・料金）は赤枠で知らせる
  const photoInput = document.getElementById("parkPhoto");
  const photoMsg = document.getElementById("parkPhotoMsg");
  const NAMES = { name: "名前", price: "料金", rule: "最大料金の決まり", size: "車の大きさ", kind: "形", reserve: "予約制", tel: "連絡先" };
  function mark(k, on) {
    const label = form.elements[k].closest("label");
    label.classList.toggle("need", on);
    label.querySelector(".needNote")?.remove();
    if (on) {
      const note = document.createElement("span");
      note.className = "needNote";
      note.textContent = "↓ 読めませんでした。看板を見て手で入れてください";
      label.insertBefore(note, form.elements[k]);
    }
  }
  form.addEventListener("input", e => { if (e.target.value && e.target.closest("label.need")) mark(e.target.name, false); });

  photoInput.addEventListener("change", async () => {
    const files = [...photoInput.files];
    photoInput.value = "";
    if (!files.length) return;
    const my = ++readNo;
    photoMsg.textContent = "読み取り中…（初めては日本語の準備で30秒ほどかかります）";
    const results = [];
    let failed = 0;
    // 1枚ずつ読む（まとめて開くとiPhoneのメモリが足りなくなるため）
    for (const [i, file] of files.entries()) {
      let img;
      try { img = await createImageBitmap(file); }
      catch { failed++; continue; }
      try {
        results.push(await ParkOCR.read(img, (n, all) => {
          if (my === readNo) photoMsg.textContent = `読み取り中…（${i + 1}/${files.length}枚目 ${n}/${all}回目）`;
        }));
      } catch { failed++; }
      finally { img.close && img.close(); } // 写真をメモリから外す（iPhoneが重くならないように）
      if (my !== readNo) return; // 読んでいる間に別の駐車場に移った・次の写真を選んだ
    }
    if (!results.length) {
      photoMsg.textContent = "読み取りができませんでした。電波のある所で試すか、手で入れてください。";
      return;
    }
    const got = ParkOCR.merge(results);
    // 料金：前の写真で「看板で確かめる」つきになっていて、今回は時間つきで読めたら入れ替える
    if (got.price && /確かめる/.test(form.elements.price.value) && !/確かめる/.test(got.price)) form.elements.price.value = "";
    fill(got, true, true);
    const read = Object.keys(NAMES).filter(k => got[k]);
    mark("name", !got.name);
    mark("price", !got.price);
    photoMsg.textContent = (failed ? `${failed}枚は読めませんでした。\n` : "") + (read.length ? "読めた所：" + read.map(k => NAMES[k]).join("・") : "読めた所はありませんでした。")
      + "\n⚠ 読み違いがあります。看板と見比べて、違う所は直してください。"
      + (hasPlace() ? "" : "\n場所がまだです。駐車場の中なら📍を押してください。");
  });

  pasteBox.addEventListener("paste", () => setTimeout(fromPaste, 50));
  pasteBox.addEventListener("blur", fromPaste);

  function save() {
    if (!hasPlace()) { msg.textContent = "場所がまだです。駐車場の中で📍のボタンを押してください。"; return; }
    const f = Object.fromEntries(new FormData(form));
    f.checked = Store.today(); // 保存した日を「確認日」にする（直したときも新しくする）
    const editing = !!f.id;
    const pid = Store.savePark(siteId, f);
    if (!pid) { msg.textContent = "保存できませんでした。"; return; }
    clearForm();
    renderList();
    msg.textContent = "";
    lastParkId = pid;
    notifyMsg.textContent = `✅ 「${f.name || "名前なし"}」を${editing ? "直" : "保存"}しました。仲間に知らせますか？`;
    notifyBtn.textContent = "📋 知らせる文をコピー";
    notifyBox.hidden = false;
    window.scrollTo(0, 0);
  }
  form.addEventListener("submit", e => { e.preventDefault(); save(); });
  notifyBtn.addEventListener("click", async () => {
    const s = site();
    const p = s && (s.parks || []).find(x => x.id === lastParkId);
    if (!p) { hideNotify(); return; }
    notifyBtn.textContent = await Share.copy(Share.notice(s, p))
      ? "✅ コピーしました。邸名のトークに貼ってください" : "コピーできません。もう一度押してください";
  });
  // 次の駐車場を入れ始めたら、前の知らせは消す（どの駐車場の知らせか迷わないように）
  form.addEventListener("input", () => { if (!notifyBox.hidden) hideNotify(); });
  mapSave.addEventListener("click", save);

  cancelBtn.addEventListener("click", () => { clearForm(); msg.textContent = ""; });
  // 「← 一覧に戻る」：保存していない直し（場所を動かした・字を打った）があれば、保存するか聞く
  View.onBack(cur => {
    if (cur !== "park") return;
    if (hasPlace() && snap() !== saved &&
        confirm("保存していない直しがあります。保存しますか？\n（「キャンセル」を押すと、直しは捨てます）")) save();
    clearForm();
  });

  return { open };
})();
