// 帰る・よく行く場所：名前を自分で決めた場所を何か所でも入れ、押すとナビ（版65。前は「倉庫」「自宅」の2つだけ）
// 住所はこの携帯の中にだけ保存する（共有の文には入れない）
// iPhoneは押すと「マップ」「Googleマップ」の2つが出る。Androidなどは押すとすぐGoogleマップが開く
const Home = (() => {
  const KEY = "genba-home-v1";
  const bar = document.getElementById("homeBar");
  const row = document.getElementById("homeRow");
  const navEl = document.getElementById("homeNav");
  const forms = document.getElementById("homeForms");
  let open = "";

  const num = (v, max) => { const n = parseFloat(v); return isFinite(n) && Math.abs(n) <= max ? n : ""; };
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const newId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // 形：{ list: [{ id, name, addr, lat, lng }] }。前の形（{ souko:{…}, jitaku:{…} }）は、倉庫・自宅の2つに直して読む
  function load() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch {}
    if (Array.isArray(d.list)) return d.list;
    return [["souko", "倉庫"], ["jitaku", "自宅"]].map(([id, name]) => Object.assign({ id, name, addr: "", lat: "", lng: "" }, d[id] || {}, { id, name }));
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify({ list })); return true; }
    catch { return false; }
  }
  const find = id => load().find(p => p.id === id);
  const label = p => p.name || "名前なし";

  // 一覧の帯：場所ごとに「〇〇へ」のボタン
  function renderRow() {
    const list = load();
    row.innerHTML = list.map(p => `<button type="button" data-go="${esc(p.id)}">${esc(label(p))}へ</button>`).join("");
  }

  // 入力の画面：場所ごとに名前・住所・地図・保存・削除。いちばん下に「＋ 場所を足す」
  const pickers = {};
  function formHtml(p, fresh) {
    return `
    <div class="homeForm" data-kind="${esc(p.id)}">
      <label>名前（ボタンに出ます。例：倉庫・自宅・資材屋）<input data-f="name" maxlength="12" autocomplete="off" value="${esc(p.name)}"></label>
      <label>住所（地図で選ぶと自動で入ります）<input data-f="addr" autocomplete="off" placeholder="例：大阪府〇〇市〇〇町1-2" value="${esc(p.addr)}"></label>
      <input type="hidden" data-f="lat" value="${esc(p.lat)}"><input type="hidden" data-f="lng" value="${esc(p.lng)}">
      <div class="mapTools">
        <button type="button" data-m="open">🗺 地図で場所を選ぶ</button>
        <button type="button" data-m="here" hidden>📍 今いる場所</button>
        <button type="button" data-m="clear" class="del" hidden>場所を消す</button>
      </div>
      <div class="mapBox" hidden></div>
      <div class="msg" data-m="msg"></div>
      <button type="button" class="main" data-save>保存</button>
      <button type="button" class="del homeDel" data-hdel>${fresh ? "やめる" : "この場所を削除"}</button>
      <div class="msg" data-m="saved"></div>
    </div>`;
  }
  function attach(box) {
    const q = s => box.querySelector(s);
    const pk = MapPick.make({
      box: q(".mapBox"), openBtn: q('[data-m="open"]'), hereBtn: q('[data-m="here"]'),
      clearBtn: q('[data-m="clear"]'), msg: q('[data-m="msg"]'), cancel: true,
      lat: q('[data-f="lat"]'), lng: q('[data-f="lng"]'), addr: q('[data-f="addr"]'),
    });
    pk.sync();
    pickers[box.dataset.kind] = pk;
  }
  // 版66：入れ済みの場所は「名前　［直す］」の1行だけ並べ、押した1つだけ入力欄を開く（全部開くと入れ直すように見えて長いため）
  // 足すのは、一覧のすぐ下・右寄せのオレンジの「＋ 場所を足す」（現場の追加と同じ色。下の隅だと遠かった）
  let editing = "";
  function rowHtml(p) {
    return `<div class="homeLine" data-kind="${esc(p.id)}"><span class="homeName">${esc(label(p))}</span><button type="button" data-hedit="${esc(p.id)}">手直し</button></div>`;
  }
  function renderForms() {
    const list = load();
    const isNew = editing && !list.some(p => p.id === editing);
    forms.innerHTML = (list.length || isNew ? "" : `<p class="note0">まだ入っていません。下の「＋ 場所を足す」で入れてください。</p>`) +
      list.map(p => p.id === editing ? formHtml(p) : rowHtml(p)).join("") +
      (isNew ? formHtml({ id: editing, name: "", addr: "", lat: "", lng: "" }, true) : "");
    forms.querySelectorAll(".homeForm").forEach(attach);
    document.getElementById("homeAddFab").hidden = !!editing; // 入力中は出さない（保存かやめるで戻る）
  }
  function edit(id) {
    editing = id;
    renderForms();
    const box = forms.querySelector(`.homeForm[data-kind="${id}"]`);
    if (box) box.scrollIntoView({ block: "start" });
    return box;
  }
  document.getElementById("homeAddFab").addEventListener("click", () => {
    const box = edit(newId()); // 保存を押すまでは入らない
    if (box) box.querySelector('[data-f="name"]').focus();
  });

  forms.addEventListener("click", e => {
    const ed = e.target.closest("[data-hedit]");
    if (ed) { edit(ed.dataset.hedit); return; }
    const box = e.target.closest(".homeForm");
    if (!box) return;
    const id = box.dataset.kind;
    const v = f => box.querySelector(`[data-f="${f}"]`).value;
    const say = t => { box.querySelector('[data-m="saved"]').textContent = t; };
    if (e.target.closest("[data-hdel]")) {
      if (!find(id)) { editing = ""; renderForms(); return; } // まだ保存していない新しい欄は、閉じるだけ
      const name = v("name").trim() || "この場所";
      if (!confirm(`「${name}」を削除しますか？`)) return;
      save(load().filter(p => p.id !== id));
      open = ""; editing = "";
      renderRow(); render();
      View.show("list", `「${name}」を削除しました。`);
      return;
    }
    if (!e.target.closest("[data-save]")) return;
    const name = v("name").trim();
    if (!name) { say("名前を入れてください（ボタンに出ます）。"); return; }
    const list = load();
    if (list.some(p => p.id !== id && p.name === name)) { say(`「${name}」はもうあります。別の名前にしてください。`); return; }
    const p = { id, name, addr: v("addr").trim(), lat: num(v("lat"), 90), lng: num(v("lng"), 180) };
    const i = list.findIndex(x => x.id === id);
    if (i >= 0) list[i] = p; else list.push(p);
    // 保存できなかったときだけ、この画面に残って知らせる
    if (!save(list)) { say("保存できませんでした。"); return; }
    open = ""; editing = "";
    renderRow(); render();
    View.show("list", Nav.has(p) ? `「${name}」を保存しました。「${name}へ」でナビが出ます。` : `「${name}」を保存しました。住所か場所を入れるとナビが出ます。`);
  });

  // 住所・地図で入れる画面を開く（前からある入れ方）
  function openForm(id) {
    open = "";
    render();
    View.show("home");
    const box = edit(id);
    if (box) {
      box.querySelector('[data-m="saved"]').textContent = `${label(find(id) || {})}の住所か地図の場所を入れて「保存」を押してください。`;
      box.scrollIntoView({ block: "start" });
    }
  }
  // 版35：まだ入れていないときは「今、〇〇にいますか？」→「はい」で今いる場所を入れる（その場所で押すだけ）
  // 住所や地図で入れたい人は「住所・地図で入れる」で、前からの入力の画面へ
  function askHere(id) {
    const name = esc(label(find(id) || {}));
    open = "";
    navEl.innerHTML = `<div class="askBox homeAsk">📍 <b>${name}</b>の場所がまだ入っていません。<br>今、${name}にいますか？
      <button type="button" class="main" data-here="${esc(id)}">はい、ここを${name}にする</button>
      <div class="mapTools"><button type="button" data-manual="${esc(id)}">住所・地図で入れる</button><button type="button" data-hcancel>やめる</button></div>
      <div class="msg" data-hmsg></div></div>`;
    mark(id);
  }
  function saveHere(id) {
    const m = navEl.querySelector("[data-hmsg]");
    if (!navigator.geolocation) { m.textContent = "この携帯では今いる場所を使えません。「住所・地図で入れる」で入れてください。"; return; }
    m.textContent = "今いる場所を調べています…";
    navigator.geolocation.getCurrentPosition(pos => {
      const list = load(), p = list.find(x => x.id === id);
      if (!p) return;
      p.lat = +pos.coords.latitude.toFixed(6); p.lng = +pos.coords.longitude.toFixed(6);
      if (!save(list)) { m.textContent = "保存できませんでした。"; return; }
      open = "";
      render();
      const acc = Math.round(pos.coords.accuracy || 0);
      View.show("list", `${label(p)}の場所を入れました。これからは「${label(p)}へ」でナビが出ます。` + (acc > 100 ? `（ずれ 約${acc}m。ずれていたら「場所を足す・直す」で直せます）` : ""));
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
    const id = b.dataset.go;
    const h = find(id);
    if (!h) return;
    if (!Nav.has(h)) return askHere(id); // まだ場所がない：その場所で押すだけで入れられるように聞く
    if (!Nav.isIOS) { // Androidなど：ボタンが1つなので、すぐGoogleマップを開く
      const a = document.createElement("div");
      a.innerHTML = Nav.links(h);
      location.href = a.querySelector("a").href;
      return;
    }
    open = open === id ? "" : id; // もう一度押すと閉じる
    render();
  });

  // 「場所を足す・直す」を押したら、入力の画面を今の中身で作り直す
  document.getElementById("openHome").addEventListener("click", () => { open = ""; editing = ""; render(); renderForms(); });

  // 押したボタンに色を付ける（版38。下に出た字だけでは、年配の人にはどれを押したか見にくいため）
  function mark(id) {
    bar.querySelectorAll("[data-go]").forEach(b => b.classList.toggle("on", b.dataset.go === id));
  }
  function render() {
    const h = open && find(open);
    navEl.innerHTML = h && Nav.has(h) ? `<div class="homeTo">${esc(label(h))}へのナビ</div>${Nav.links(h)}` : "";
    mark(h && Nav.has(h) ? open : "");
  }

  renderRow();
  renderForms();
  return { render };
})();
