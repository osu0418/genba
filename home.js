// 帰る：「倉庫へ」「自宅へ」のナビ。住所はこの携帯の中にだけ保存する（共有の文には入れない）
// iPhoneは押すと「マップ」「Googleマップ」の2つが出る。Androidなどは押すとすぐGoogleマップが開く
const Home = (() => {
  const KEY = "genba-home-v1";
  const KINDS = [["souko", "倉庫"], ["jitaku", "自宅"]];
  const bar = document.getElementById("homeBar");
  const navEl = document.getElementById("homeNav");
  const forms = document.getElementById("homeForms");
  let open = "";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch { return false; }
  }
  const num = (v, max) => { const n = parseFloat(v); return isFinite(n) && Math.abs(n) <= max ? n : ""; };

  // 住所を入れる欄を、倉庫と自宅の2つ作る（地図で選ぶ部分は mappick.js）
  forms.innerHTML = KINDS.map(([k, label]) => `
    <div class="homeForm" data-kind="${k}">
      <h3>${label}</h3>
      <label>住所（地図で選ぶと自動で入ります）<input data-f="addr" autocomplete="off" placeholder="例：富山県〇〇市〇〇町1-2"></label>
      <input type="hidden" data-f="lat"><input type="hidden" data-f="lng">
      <div class="mapTools">
        <button type="button" data-m="open">🗺 地図で場所を選ぶ</button>
        <button type="button" data-m="here" hidden>📍 今いる場所</button>
        <button type="button" data-m="clear" class="del" hidden>場所を消す</button>
      </div>
      <div class="mapBox" hidden></div>
      <div class="msg" data-m="msg"></div>
      <button type="button" class="main" data-save>${label}の住所を保存</button>
      <div class="msg" data-m="saved"></div>
    </div>`).join("");

  const pickers = {};
  const data0 = load();
  for (const [k] of KINDS) {
    const box = forms.querySelector(`[data-kind="${k}"]`);
    const q = s => box.querySelector(s);
    const h = data0[k] || {};
    q('[data-f="addr"]').value = h.addr || "";
    q('[data-f="lat"]').value = h.lat ?? "";
    q('[data-f="lng"]').value = h.lng ?? "";
    pickers[k] = MapPick.make({
      box: q(".mapBox"), openBtn: q('[data-m="open"]'), hereBtn: q('[data-m="here"]'),
      clearBtn: q('[data-m="clear"]'), msg: q('[data-m="msg"]'), cancel: true,
      lat: q('[data-f="lat"]'), lng: q('[data-f="lng"]'), addr: q('[data-f="addr"]'),
    });
    pickers[k].sync();
  }

  forms.addEventListener("click", e => {
    const b = e.target.closest("[data-save]");
    if (!b) return;
    const box = b.closest(".homeForm"), k = box.dataset.kind;
    const label = KINDS.find(x => x[0] === k)[1];
    const v = f => box.querySelector(`[data-f="${f}"]`).value;
    const data = load();
    data[k] = { addr: v("addr").trim(), lat: num(v("lat"), 90), lng: num(v("lng"), 180) };
    const ok = save(data);
    // 保存できなかったときだけ、この画面に残って知らせる
    if (!ok) { box.querySelector('[data-m="saved"]').textContent = "保存できませんでした。"; return; }
    // 保存できたら一覧に戻り、上に一言出す（押しても何も起きないように見えて心配にならないように）
    forms.querySelectorAll('[data-m="saved"]').forEach(m => { m.textContent = ""; });
    open = "";
    render();
    View.show("list", Nav.has(data[k]) ? `${label}の住所を保存しました。「${label}へ」でナビが出ます。` : `${label}の住所を空にしました。`);
  });

  // 住所・地図で入れる画面を開く（前からある入れ方）
  function openForm(k) {
    const label = KINDS.find(x => x[0] === k)[1];
    open = "";
    render();
    View.show("home");
    forms.querySelector(`[data-kind="${k}"] [data-m="saved"]`).textContent = `${label}の住所か地図の場所を入れて「保存」を押してください。`;
  }
  // 版35：まだ入れていないときは「今、〇〇にいますか？」→「はい」で今いる場所を入れる（その場所で押すだけ）
  // 住所や地図で入れたい人は「住所・地図で入れる」で、前からの入力の画面へ
  function askHere(k) {
    const label = KINDS.find(x => x[0] === k)[1];
    open = "";
    navEl.innerHTML = `<div class="askBox homeAsk">📍 <b>${label}</b>の場所がまだ入っていません。<br>今、${label}にいますか？
      <button type="button" class="main" data-here="${k}">はい、ここを${label}にする</button>
      <div class="mapTools"><button type="button" data-manual="${k}">住所・地図で入れる</button><button type="button" data-hcancel>やめる</button></div>
      <div class="msg" data-hmsg></div></div>`;
  }
  function saveHere(k) {
    const label = KINDS.find(x => x[0] === k)[1];
    const m = navEl.querySelector("[data-hmsg]");
    if (!navigator.geolocation) { m.textContent = "この携帯では今いる場所を使えません。「住所・地図で入れる」で入れてください。"; return; }
    m.textContent = "今いる場所を調べています…";
    navigator.geolocation.getCurrentPosition(pos => {
      const data = load();
      data[k] = { addr: (data[k] && data[k].addr) || "", lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) };
      if (!save(data)) { m.textContent = "保存できませんでした。"; return; }
      // 入力の画面の欄と地図も合わせる（あとで「直す」とき、今の場所から始まるように）
      const box = forms.querySelector(`[data-kind="${k}"]`);
      box.querySelector('[data-f="lat"]').value = data[k].lat;
      box.querySelector('[data-f="lng"]').value = data[k].lng;
      pickers[k].sync();
      open = "";
      render();
      const acc = Math.round(pos.coords.accuracy || 0);
      View.show("list", `${label}の場所を入れました。これからは「${label}へ」でナビが出ます。` + (acc > 100 ? `（ずれ 約${acc}m。ずれていたら「倉庫・自宅の住所を入れる・直す」で直せます）` : ""));
    }, () => {
      m.textContent = "今いる場所を使えませんでした。位置情報の許可を確かめるか、「住所・地図で入れる」で入れてください。";
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  bar.addEventListener("click", e => {
    if (e.target.closest("[data-here]")) return saveHere(e.target.closest("[data-here]").dataset.here);
    if (e.target.closest("[data-manual]")) return openForm(e.target.closest("[data-manual]").dataset.manual);
    if (e.target.closest("[data-hcancel]")) { open = ""; return render(); }
    const b = e.target.closest("[data-go]");
    if (!b) return;
    const k = b.dataset.go;
    const h = load()[k];
    if (!Nav.has(h)) return askHere(k); // まだ場所がない：その場所で押すだけで入れられるように聞く
    if (!Nav.isIOS) { // Androidなど：ボタンが1つなので、すぐGoogleマップを開く
      const a = document.createElement("div");
      a.innerHTML = Nav.links(h);
      location.href = a.querySelector("a").href;
      return;
    }
    open = open === k ? "" : k; // もう一度押すと閉じる
    render();
  });

  function render() {
    const h = open && load()[open];
    navEl.innerHTML = h && Nav.has(h) ? `<div class="addr">${KINDS.find(x => x[0] === open)[1]}へ</div>${Nav.links(h)}` : "";
  }

  return { render };
})();
