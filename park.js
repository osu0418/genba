// 駐車場の画面：現場ごとに駐車場を登録する・直す・消す
// 場所（今いる位置）は必須。料金と、書きたい人だけメモ・名前（版66）。看板の写真・Claudeの【駐車場】の文でも入る
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
  const more = document.getElementById("parkMore"); // 版66：メモ（書きたい人だけ）の欄
  // 登録のしかた3つ（版24）：選ぶまで入れる欄はたたんでおく（画面を短くし、何をすればいいか迷わないように）
  const chooseBox = document.getElementById("parkChoose");
  // 版66：「駐車場を追加」で、すぐ住所と「📍 現在地」の欄を出す（選ぶ段をやめた）
  function openForm() { chooseBox.hidden = true; form.hidden = false; }
  function closeForm() { openForm(); }
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
  const confirmBox = document.getElementById("parkConfirm");
  const picker = MapPick.make({
    box: document.getElementById("parkMapBox"), openBtn: mapOpen,
    hereBtn: document.createElement("button"), clearBtn: document.createElement("button"),
    msg: document.getElementById("parkMapMsg"),
    lat: form.elements.lat, lng: form.elements.lng, addr: form.elements.addr,
    // ピンを人が動かしたら、地図のすぐ下に「✓ この場所で保存」を出す（下の保存ボタンまで探さなくてよいように）
    onChange: () => showPlace(), // 版66：ピンを動かしたあとは「はい」で決める（「✓ この場所で保存」は出さない）
    // 地図の左上の「✕ やめる」：地図を閉じてピンと住所を開く前に戻す。「✓ この場所で保存」も隠す（版22）
    cancel: true,
    onCancel: () => { confirmBox.hidden = true; showPlace(); },
    // 住所を書いたら、その住所へピンを動かす（現場と同じ。版22）
    searchAddr: true,
  });
  // 地図を閉じた形に戻す（別の駐車場を入れるとき・直すとき）
  function resetMap() {
    mapSave.hidden = true;
    confirmBox.hidden = true;
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
      ? "✅ 場所は入っています" + (extra || "") + (confirmBox.hidden ? "（ずれていたら「🗺 地図でピンを直す」）" : "")
      : "まだ場所がありません。住所を打つか、右の「📍 現在地」を押してください。";
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
    more.open = false;
    coChips.querySelectorAll("button").forEach(b => b.classList.remove("on"));
    for (const k of ["id", "lat", "lng", "checked"]) form.elements[k].value = "";
    pasteBox.value = "";
    saveBtn.textContent = "この駐車場を保存";
    cancelBtn.textContent = "登録をやめる";
    closeForm();
    saved = snap();
    readNo++;
    mark("price", false);
    photoMsg.textContent = "";
    resetMap();
    showPlace();
  }

  function renderList() {
    const s = site();
    if (!s) return;
    title.textContent = `${s.name} の駐車場`;
    // 登録した駐車場の下に、控えの「🔍 いっぱいのとき：近くの駐車場を地図で探す」（版26。ふだんは登録した駐車場を使い、登録は駐車場に行って📍でする）
    document.getElementById("parkFind").innerHTML = Nav.parkSearch(s, (s.parks || []).length ? "🔍 近くのほかの駐車場を探す" : "🔍 近くの駐車場を探す")
      || `<p class="note0">🔍 近くの駐車場を地図で探すには、現場の「直す」で住所か地図の場所を入れてください。</p>`;
    const parks = s.parks || [];
    listEl.innerHTML = parks.length
      // 版40：カードには現場から近い順に①②③で出る（「いつもの」「満車なら」はやめた）
      ? `<p class="note0">カードには、現場から<b>近い順</b>に3つまで出ます。近くの駐車場をいくつか入れておくと、みんなが押すだけで選べます。</p>`
        + ParkView.sorted(s).map((p, i) => `<div class="parkItem">
          <div><b>${["①", "②", "③"][i] || "🅿"} ${esc(ParkView.label(p))}</b>${p.price ? "　" + esc(p.price) : ""}</div>
          <div class="note0">${ParkView.short(s, p) ? "現場まで" + ParkView.short(s, p) + "／" : ""}確認日：${esc(p.checked)}</div>
          <div class="tools"><button type="button" data-pedit="${esc(p.id)}">✏ 手直し（料金・メモ）</button>
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
  // 版66：書く欄は「料金」とメモ・名前だけにした。前の欄（最大料金・決まり・車の大きさ・形・予約制・連絡先）に入っていた物は、
  //  消さずに「料金」（最大料金）と「メモ」（そのほか）に足して見せる。保存すると、その形で残る（前の欄は空になる）
  const FOLD = [["rule", "決まり"], ["size", "車の大きさ"], ["kind", "形"], ["reserve", "予約制"], ["tel", "連絡先"]];
  const norm = t => String(t || "").normalize("NFKC").replace(/\s/g, "");
  function addTo(k, t) {
    const el = form.elements[k];
    t = String(t || "").trim();
    if (!t || norm(el.value).includes(norm(t))) return; // もう書いてあれば足さない
    el.value = el.value.trim() ? el.value.trim() + (k === "memo" ? "\n" : "・") + t : t;
  }
  function fill(p, onlyFilled, onlyEmpty) {
    for (const [, k] of ParkText.LABELS) {
      const el = form.elements[k];
      if (!el) continue;
      if (onlyFilled && !p[k]) continue;
      if (onlyEmpty && el.value.trim()) continue;
      el.value = p[k] ?? "";
    }
    if (p.max) addTo("price", /^(なし|無し|無|ない|×)$/.test(String(p.max).trim()) ? "最大料金なし" : p.max);
    for (const [k, l] of FOLD) if (p[k]) addTo("memo", `${l}：${p[k]}`);
    more.open = !!(form.elements.memo.value.trim() || (form.elements.name.value.trim() && !COS.includes(form.elements.name.value.trim())));
    markCo();
  }

  // 版66：会社のボタン。押すとその会社名を名前に入れる（その他は、名前の欄を開いて手で書く）
  const coChips = document.getElementById("coChips");
  const COS = [...coChips.querySelectorAll("button:not([data-other])")].map(b => b.textContent);
  function markCo() {
    const n = form.elements.name.value.trim();
    coChips.querySelectorAll("button").forEach(b =>
      b.classList.toggle("on", b.dataset.other !== undefined ? !!n && !COS.some(c => n.includes(c)) : n.includes(b.textContent)));
  }
  coChips.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.other !== undefined) {
      if (COS.some(c => form.elements.name.value.includes(c))) form.elements.name.value = "";
      more.open = true;
      form.elements.name.focus();
      form.elements.name.scrollIntoView({ behavior: "smooth", block: "center" });
    } else form.elements.name.value = b.textContent;
    markCo();
    if (!notifyBox.hidden) hideNotify();
  });
  form.elements.name.addEventListener("input", markCo);

  // メモの言葉：押すとメモに足す。「〇台とめられる」は台数を聞く
  document.getElementById("memoChips").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    let t = b.textContent.trim();
    if (b.dataset.ask) {
      const n = prompt("何台とめられますか？（数字）", "");
      if (n === null) return;
      const d = String(n).normalize("NFKC").replace(/[^0-9]/g, "");
      if (!d) return;
      t = d + b.dataset.ask;
    }
    addTo("memo", t);
    if (!notifyBox.hidden) hideNotify();
  });

  listEl.addEventListener("click", e => {
    const b = e.target.closest("button");
    const s = site();
    if (!b || !s) return;
    const p = (s.parks || []).find(x => x.id === (b.dataset.pedit || b.dataset.pdel));
    if (!p) return;
    if (b.dataset.pedit) startEdit(p);
    else if (confirm(`「${ParkView.label(p)}」を削除しますか？\n元に戻せません。`)) {
      Store.removePark(siteId, p.id);
      if (form.elements.id.value === p.id) clearForm();
      renderList();
    }
  });
  // 駐車場を直す（版42で外からも呼べるようにした：駐車場を見る画面の「✏ 直す」から）
  function startEdit(p, focus) {
    {
      hideNotify();
      clearForm();
      fill(p);
      for (const k of ["id", "lat", "lng", "checked"]) form.elements[k].value = p[k] ?? "";
      saveBtn.textContent = "直して保存";
      cancelBtn.textContent = "直すのをやめる";
      openForm();
      picker.sync();
      showPlace();
      saved = snap();
      msg.textContent = `「${ParkView.label(p)}」を直しています。`;
      const f = focus && form.elements[focus];
      if (f) { f.scrollIntoView({ behavior: "smooth", block: "center" }); f.focus(); }
      else form.scrollIntoView({ behavior: "smooth" });
    }
  }
  // 駐車場を見る画面から：その現場の駐車場の画面を開き、その駐車場を直す形にする（focus：最初に打つ欄）
  function edit(siteIdArg, parkId, focus) {
    open(siteIdArg);
    const p = (site() && site().parks || []).find(x => x.id === parkId);
    if (p) startEdit(p, focus);
  }

  // 版66：地図が開いたら「この位置で合っていますか？」を出す。「はい」で地図を閉じ、料金へ
  function askPlace() {
    confirmBox.hidden = false;
    showPlace();
    confirmBox.scrollIntoView({ behavior: "smooth", block: "end" });
  }
  // 「📍 現在地」：地図を開いて、今いる場所にピンを立て、その住所を住所の欄に書く
  hereBtn.addEventListener("click", async () => {
    msg.textContent = msg.textContent.replace(/\n?⚠ 場所がまだ.*$/, ""); // 古い「場所がまだ」を消す
    await picker.openHere();
    askPlace();
  });
  // 住所を打ったら（「完了」）：地図を開いてピンを出す（ピンを住所へ動かすのは mappick.js）
  form.elements.addr.addEventListener("change", () => {
    if (!form.elements.addr.value.trim()) return;
    if (document.getElementById("parkMapBox").hidden) mapOpen.click();
    askPlace();
  });
  // 住所の欄で改行（キーボードの「開く」「完了」など）を押しても、保存はしない。地図とピンの確認へ進む（料金を入れる前に保存されないように）
  form.elements.addr.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault();
    form.elements.addr.blur();
  });
  mapOpen.addEventListener("click", askPlace);
  document.getElementById("parkOk").addEventListener("click", () => {
    if (!hasPlace()) { placeMsg.textContent = "まだピンがありません。地図を押してピンを置いてください。"; return; }
    resetMap();
    showPlace();
    const pr = form.elements.price;
    pr.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // 【駐車場】の文を貼ったら、欄に入れる（保存はしない。場所を確かめてから保存する）
  function fromPaste() {
    const p = ParkText.parse(pasteBox.value)[0];
    if (!p) {
      if (pasteBox.value.trim()) msg.textContent = "読み取れませんでした。【駐車場】から始まる文か確かめてください。";
      return;
    }
    fill(p, true);
    if (form.elements.price.value.trim()) mark("price", false);
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
  const NAMES = { name: "名前", price: "料金", max: "最大料金", rule: "決まり", size: "車の大きさ", kind: "形", reserve: "予約制", tel: "連絡先", memo: "メモ" }; // 版53：最大料金・メモも
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

  photoInput.addEventListener("change", () => readPhotos(photoInput));
  // 「📷 看板の写真で登録」（版24）：入れる欄を開いてから読む
  const photoInput2 = document.getElementById("parkPhoto2");
  photoInput2.addEventListener("change", () => {
    if (!photoInput2.files.length) return;
    openForm();
    readPhotos(photoInput2);
    photoMsg.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  async function readPhotos(input) {
    const files = [...input.files];
    input.value = "";
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
    // 最大料金が読めなければ、読めた料金・決まりの中の「最大〇円」を料金に足す（版42。版66から料金の欄に）
    if (!got.max) { const mf = ParkView.maxFee(got); if (mf.ok && /\d/.test(mf.text)) addTo("price", mf.text); }
    const read = Object.keys(NAMES).filter(k => got[k]);
    mark("price", !form.elements.price.value.trim());
    photoMsg.textContent = (failed ? `${failed}枚は読めませんでした。\n` : "") + (read.length ? "読めた所：" + read.map(k => NAMES[k]).join("・") : "読めた所はありませんでした。")
      + "\n⚠ 読み違いがあります。看板と見比べて、違う所は直してください。"
      + (hasPlace() ? "" : "\n場所がまだです。駐車場の中なら📍を押す、離れていたら住所を打ってください。");
  }

  // 「📍 今いる場所で登録」：欄を開いて、すぐ今いる場所を調べる
  document.getElementById("parkByHere").addEventListener("click", () => {
    openForm();
    hereBtn.click();
  });
  // 「🏠 住所で登録」：欄を開いて、住所の欄に字を打てるようにする（打ち終わるとピンが動く）
  document.getElementById("parkByAddr").addEventListener("click", () => {
    openForm();
    const a = form.elements.addr;
    a.focus();
    a.scrollIntoView({ behavior: "smooth", block: "center" });
    placeMsg.textContent = "住所を打って「完了」を押すと、その場所にピンを置きます。";
  });

  pasteBox.addEventListener("paste", () => setTimeout(fromPaste, 50));
  pasteBox.addEventListener("blur", fromPaste);

  async function save() {
    // 場所がまだで住所が書いてあれば、住所から場所を探してから保存する（版25。「完了」を押さずに保存を押したとき）
    if (!hasPlace() && form.elements.addr.value.trim()) {
      msg.textContent = "住所から場所を探しています…";
      await picker.fromAddr();
      if (hasPlace()) msg.textContent = "";
    }
    if (!hasPlace()) { msg.textContent = "場所がまだです。駐車場の中で📍のボタンを押すか、住所を打ってください。（住所が見つからないときは「🗺 地図でピンを直す」で地図を押してください）"; return; }
    const f = Object.fromEntries(new FormData(form));
    f.checked = Store.today(); // 保存した日を「確認日」にする（直したときも新しくする）
    const editing = !!f.id;
    const pid = Store.savePark(siteId, f);
    if (!pid) { msg.textContent = "保存できませんでした。"; return; }
    clearForm();
    renderList();
    msg.textContent = "";
    lastParkId = pid;
    notifyMsg.textContent = `✅ 「${ParkView.label(f)}」を${editing ? "直" : "保存"}しました。仲間に知らせますか？`;
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

  return { open, edit };
})();
