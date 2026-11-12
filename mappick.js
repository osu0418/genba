// 地図で場所を選ぶ：住所の下の「地図で場所を選ぶ」から、アプリの中に地図を出してピンを立てる
// ピンは指で動かして直せる。「今いる場所」で携帯の位置を使える。選んだ点は lat / lng（緯度・経度）に入る
// 点を選ぶと、住所の欄をその点の住所（国土地理院で調べる。町名・丁目まで）に合わせる
// 地図の部品（Leaflet）と地図の絵（国土地理院）は、ボタンを押したときだけ読む
const MapPick = (() => {
  const form = document.getElementById("addForm");
  const box = document.getElementById("mapBox");
  const openBtn = document.getElementById("mapOpen");
  const hereBtn = document.getElementById("mapHere");
  const clearBtn = document.getElementById("mapClear");
  const msg = document.getElementById("mapMsg");
  const START = [36.70, 137.21]; // 何も選んでいないときの真ん中（富山のあたり）
  let map = null, pin = null, loading = null, muni = null, asked = 0;

  const lat = () => parseFloat(form.elements.lat.value);
  const lng = () => parseFloat(form.elements.lng.value);
  const has = () => isFinite(lat()) && isFinite(lng());

  function showMsg() {
    msg.textContent = has() ? "📍 場所を選んであります（ピンを指で動かすと直せます）" : (box.hidden ? "" : "地図を押すと、その場所にピンが立ちます。");
    clearBtn.hidden = !has();
  }

  // 市町村の番号 → 「富山県射水市」の変換表（国土地理院の muni.js）。1回読んだら覚えておく
  async function loadMuni() {
    if (muni) return muni;
    const t = await (await fetch("https://maps.gsi.go.jp/js/muni.js")).text();
    const m = {};
    for (const r of t.matchAll(/'(\d+),([^,']+),(\d+),([^']+)'/g)) {
      m[r[3].padStart(5, "0")] = r[2] + r[4].replace(/[\s　]/g, "");
    }
    if (!Object.keys(m).length) throw new Error("muni");
    return (muni = m);
  }

  // 点から住所を調べて、住所の欄に入れる（押し直したら、後のほうだけ使う）
  async function fillAddr(la, ln) {
    const my = ++asked;
    msg.textContent = "📍 場所を選びました。住所を調べています…";
    try {
      const [res, m] = await Promise.all([
        fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${la}&lon=${ln}`).then(r => r.json()),
        loadMuni(),
      ]);
      if (my !== asked) return;
      const r = res && res.results;
      const city = r && m[String(r.muniCd).padStart(5, "0")];
      if (!city) throw new Error("none");
      form.elements.addr.value = city + (r.lv01Nm && r.lv01Nm !== "－" ? r.lv01Nm : "");
      msg.textContent = "📍 住所を地図の点に合わせました（番地までは出ません）。ピンを動かすと住所も変わります。";
    } catch {
      if (my !== asked) return;
      msg.textContent = "📍 場所は選べましたが、住所を調べられませんでした。ナビはピンの場所へ向かいます。";
    }
  }

  function setPoint(la, ln, move, fill) {
    form.elements.lat.value = la.toFixed(6);
    form.elements.lng.value = ln.toFixed(6);
    if (map) {
      if (!pin) {
        pin = L.marker([la, ln], { draggable: true }).addTo(map);
        pin.on("dragend", () => { const p = pin.getLatLng(); setPoint(p.lat, p.lng, false, true); });
      } else pin.setLatLng([la, ln]);
      if (move) map.setView([la, ln], Math.max(map.getZoom(), 17));
    }
    showMsg();
    if (fill) fillAddr(la, ln);
  }

  function load() {
    if (window.L) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((ok, ng) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
      s.onload = ok;
      s.onerror = () => { loading = null; ng(); };
      document.head.appendChild(s);
    });
    return loading;
  }

  async function open() {
    box.hidden = false;
    openBtn.hidden = true;
    hereBtn.hidden = false;
    msg.textContent = "地図を読み込んでいます…";
    try { await load(); }
    catch { msg.textContent = "地図を読み込めませんでした（電波を確かめてください）。住所は手で入れられます。"; return; }
    if (!map) {
      map = L.map(box, { tap: true }).setView(START, 11);
      L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
      }).addTo(map);
      map.on("click", e => setPoint(e.latlng.lat, e.latlng.lng, false, true));
    }
    setTimeout(() => {
      map.invalidateSize();
      if (has()) setPoint(lat(), lng(), true);
    }, 50);
    showMsg();
  }

  function here() {
    if (!navigator.geolocation) { msg.textContent = "この携帯では今いる場所を使えません。"; return; }
    msg.textContent = "今いる場所を調べています…";
    navigator.geolocation.getCurrentPosition(
      p => setPoint(p.coords.latitude, p.coords.longitude, true, true),
      () => { msg.textContent = "今いる場所を使えませんでした（位置情報の許可を確かめてください）。地図を押して選べます。"; },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function clear() {
    asked++;
    form.elements.lat.value = "";
    form.elements.lng.value = "";
    if (pin) { pin.remove(); pin = null; }
    showMsg();
  }

  // 入力欄を空にしたとき・「直す」で現場を開いたときに、地図を入力欄に合わせる
  function sync() {
    asked++;
    if (pin) { pin.remove(); pin = null; }
    if (has()) {
      if (map && !box.hidden) setPoint(lat(), lng(), true);
    } else if (box.hidden === false && map) map.setView(START, 11);
    showMsg();
  }

  openBtn.addEventListener("click", open);
  hereBtn.addEventListener("click", here);
  clearBtn.addEventListener("click", clear);
  return { sync };
})();
