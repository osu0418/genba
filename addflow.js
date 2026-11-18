// 版67：現場を追加を、1つずつ出して確定する形に（駐車場の登録と同じ考え方）
//  ① 看板の写真で読む → 電話番号とKYのQRを確かめて「確定」 → ② 邸名 → ③ 住所（📍現在地・ピンの確認） → 完了
//  手直し（Editor.start）は、前からの全部の欄が1画面に出る形のまま
//  最後は、前からの入力欄（addForm）に入れて「追加する」と同じ保存をする（確かめ・保存の決まりを1か所にするため）
(() => {
  const screen = document.getElementById("addScreen");
  const steps = [...document.querySelectorAll("#wizard .wzStep")];
  const $ = id => document.getElementById(id);
  let st = {};   // 入れている途中の中身（保存は最後だけ）
  let readNo = 0; // 写真の読み取りの番号。撮り直したら古い結果は使わない

  function show(n) {
    steps.forEach(s => { s.hidden = s.dataset.step !== String(n); });
    window.scrollTo(0, 0);
  }
  function start() {
    st = { inTel: "", outTel: "", code: "", kyUrl: "", name: "", addr: "", lat: "", lng: "" };
    readNo++;
    screen.classList.add("wiz");
    screen.classList.remove("showPaste");
    show(1);
  }
  // 「＋ 現場を追加」から開いたときだけ、この形にする（手直しは前の形）
  $("openAdd").addEventListener("click", start);
  const editStart = Editor.start;
  Editor.start = (site, focus) => { screen.classList.remove("wiz", "showPaste"); editStart(site, focus); };
  // 途中で「← 一覧に戻る」：何も保存しない
  View.onBack(cur => { if (cur === "add") readNo++; });

  // 写真なし（資材置き場など）：確認の画面を、手で入れる形で出す
  $("wzNoPhoto").addEventListener("click", () => { readNo++; st.noPhoto = true; showCheck(true); });
  // LINEで届いた文を貼る：前からの「共有の文を貼り付けて追加」を出す
  $("wzPaste").addEventListener("click", () => {
    screen.classList.add("showPaste");
    $("pasteBox").focus();
    $("pastePanel").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ① 写真を読む
  $("wzPhoto").addEventListener("change", e => readPhoto(e.target));
  $("wzPhoto2").addEventListener("change", e => readPhoto(e.target));
  async function readPhoto(input) {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    const my = ++readNo;
    st.noPhoto = false;
    show(2);
    $("wzCheck").hidden = true;
    const say = t => { if (my === readNo) $("wzReading").textContent = t; };
    say("読み取り中…（初めては10秒ほどかかります）");
    let img;
    try { img = await createImageBitmap(file); }
    catch { say("写真を開けませんでした。"); showCheck(true); return; }
    const ky = QR.read(img);
    let nums = { code: "", inTel: "", outTel: "" }, ocrNg = false;
    try { nums = await OCR.read(img, (n, all) => say(`読み取り中…（${n}/${all}回目。読みにくい写真ほど回数が増えます）`)); }
    catch { ocrNg = true; }
    if (my !== readNo) return; // 読んでいる間に撮り直した・戻った
    st.kyUrl = ky; st.inTel = nums.inTel; st.outTel = nums.outTel; st.code = nums.code;
    say(ocrNg ? "番号の読み取りができませんでした（電波を確かめてください）。手で入れるか、撮り直してください。" : "");
    showCheck(!(st.inTel && st.outTel));
  }

  // 確認の画面：電話番号は大きく出して見比べてもらう。KYのQRは、読めたかをアプリが言う
  function showCheck(fix) {
    show(2);
    $("wzCheck").hidden = false;
    if (!fix) $("wzReading").textContent = "";
    $("wzIn").textContent = st.inTel || "読めませんでした";
    $("wzOut").textContent = st.outTel || "読めませんでした";
    $("wzIn").classList.toggle("ng", !st.inTel);
    $("wzOut").classList.toggle("ng", !st.outTel);
    $("wzCode").textContent = st.code;
    $("wzCodeRow").hidden = !st.code;
    $("wzKy").className = "wzKy " + (st.kyUrl ? "ok" : "ng");
    $("wzKy").hidden = !!st.noPhoto; // 写真なしのときは、QRの知らせは出さない
    $("wzKy").textContent = st.kyUrl ? "✅ KYのQR：読めました" : "❌ KYのQR：読めませんでした（撮り直すか、QRなしで進めます）";
    $("wzHead2").textContent = st.noPhoto ? "① 電話番号を入れてください（なくてもよい）" : "① 読めた物を確かめてください";
    $("wzOk2").textContent = st.noPhoto ? "確定" : "合っている・確定";
    const diff = st.inTel && st.outTel && st.inTel.slice(0, 4) !== st.outTel.slice(0, 4);
    $("wzWarn").textContent = diff ? "⚠ 入場と退場で頭の4けたが違います。読み間違いかもしれません。" : "";
    $("wzInIn").value = st.inTel; $("wzOutIn").value = st.outTel; $("wzCodeIn").value = st.code;
    setFix(fix);
  }
  function setFix(on) {
    $("wzFix").hidden = !on;
    $("wzFixBtn").hidden = on;
    // 手で直すときは、大きな青い番号は隠して、打つ欄だけにする（同じ番号が2つ並んで迷わないように）
    document.querySelectorAll("#wizard .wzTel").forEach(el => { el.hidden = on; });
    if (on) $("wzCodeRow").hidden = true;
  }
  $("wzFixBtn").addEventListener("click", () => { setFix(true); $("wzInIn").focus(); });
  // 手で打つ欄も、現場の欄と同じくハイフンを入れる
  const fmt = v => {
    const d = String(v || "").normalize("NFKC").replace(/[^0-9]/g, "");
    return d && typeof libphonenumber !== "undefined" ? new libphonenumber.AsYouType("JP").input(d) : v;
  };
  ["wzInIn", "wzOutIn"].forEach(id => $(id).addEventListener("input", e => { e.target.value = fmt(e.target.value); }));

  $("wzOk2").addEventListener("click", () => {
    if (!$("wzFix").hidden) {
      st.inTel = $("wzInIn").value.trim(); st.outTel = $("wzOutIn").value.trim(); st.code = $("wzCodeIn").value.trim();
    }
    // ② 邸名へ
    show(3);
    $("wzName").value = st.name;
    $("wzNameHint").textContent = st.code ? `入れなければ、現場番号（${st.code}）を名前にします。` : "";
    $("wzNameMsg").textContent = "";
    $("wzName").focus();
  });

  // ② 邸名 → 確定
  $("wzName").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); $("wzOk3").click(); } });
  $("wzOk3").addEventListener("click", () => {
    const n = $("wzName").value.trim() || st.code;
    if (!n) { $("wzNameMsg").textContent = "邸名を入れてください（ボタンに出ます）。"; return; }
    st.name = n;
    startAddr();
  });

  // ③ 住所：手で打つ欄の右に「📍 現在地」。地図にピンが出たら「合っていますか？」→「はい・確定」で登録
  const lat = $("wzLat"), lng = $("wzLng"), addr = $("wzAddr");
  const hasPlace = () => lat.value !== "" && lng.value !== "";
  const pk = MapPick.make({
    box: $("wzMapBox"), openBtn: $("wzMapOpen"), hereBtn: document.createElement("button"), clearBtn: $("wzMapClear"),
    msg: $("wzMapMsg"), lat, lng, addr, searchAddr: true, cancel: true,
    onCancel: () => { $("wzConfirm").hidden = true; },
  });
  function startAddr() {
    show(4);
    addr.value = st.addr; lat.value = st.lat; lng.value = st.lng;
    $("wzConfirm").hidden = true;
    $("wzMapBox").hidden = true;
    $("wzMapOpen").hidden = false;
    $("wzAddrMsg").textContent = "";
    pk.sync();
  }
  function ask() { $("wzConfirm").hidden = false; setTimeout(() => $("wzConfirm").scrollIntoView({ behavior: "smooth", block: "end" }), 50); }
  $("wzHere").addEventListener("click", async () => { addr.value = ""; await pk.openHere(); ask(); });
  addr.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); addr.blur(); } });
  addr.addEventListener("change", () => { if (!addr.value.trim()) return; if ($("wzMapBox").hidden) $("wzMapOpen").click(); ask(); });
  $("wzMapOpen").addEventListener("click", ask);
  $("wzOk4").addEventListener("click", () => {
    if (!hasPlace()) { $("wzAddrMsg").textContent = "まだピンがありません。地図を押してピンを置いてください。"; return; }
    st.addr = addr.value.trim(); st.lat = lat.value; st.lng = lng.value;
    finish();
  });
  $("wzSkip4").addEventListener("click", () => {
    if (!Store.cleanTel(st.inTel) && !Store.cleanTel(st.outTel)) {
      $("wzAddrMsg").textContent = "電話番号が無いときは、住所か場所が要ります（ナビで行けるように）。";
      return;
    }
    st.addr = addr.value.trim(); st.lat = hasPlace() ? lat.value : ""; st.lng = hasPlace() ? lng.value : "";
    finish();
  });

  // 完了：前からの入力欄（addForm）に入れて、「追加する」と同じ確かめ・保存をする
  function finish() {
    const f = document.getElementById("addForm");
    f.reset();
    for (const k of ["id", "lat", "lng", "routeLine", "routeWhy", "notes"]) f.elements[k].value = "";
    for (const k of ["name", "code", "inTel", "outTel", "kyUrl", "addr", "lat", "lng"]) f.elements[k].value = st[k] || "";
    readNo++;
    f.requestSubmit();
    // 保存できなかったとき（決まりに合わない）は、その知らせを住所の画面に出す
    const m = document.getElementById("addMsg").textContent;
    if (View.current() === "add" && m) $("wzAddrMsg").textContent = m;
  }

  window.Flow = { start, state: () => st, show };
})();
