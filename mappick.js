// 地図で場所を選ぶ：「地図で場所を選ぶ」から、アプリの中に地図を出してピンを立てる
// ピンは指で動かして直せる。「今いる場所」で携帯の位置を使える。選んだ点は lat / lng（緯度・経度）に入る
// 点を選ぶと、住所の欄をその点の住所（国土地理院で調べる。町名・丁目まで）に合わせる
// 地図の部品（Leaflet）と地図の絵（国土地理院の淡色地図・航空写真）は、ボタンを押したときだけ読む
// 地図を開くと、今いる場所のあたりを出す（まだ場所を選んでいないとき）
// 地図の右上の「⛶ 大きく」で画面いっぱいに広げられる。下の「✓ この場所にする」で元の画面に戻る
// 「現場を追加」の欄・「帰る」の欄（home.js）・駐車場の画面（park.js）で使う：MapPick.make({ 欄の部品 }) で1つ作る
const MapPick = (() => {
  const START = [36.70, 137.21]; // 何も選んでいないときの真ん中（富山のあたり）
  let loading = null, muni = null;

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

  function make(el) {
    const { box, openBtn, hereBtn, clearBtn, msg } = el;
    let map = null, pin = null, asked = 0, full = false, dot = null;
    // 手でピンを立てた・消した回数。「今いる場所」の返事が遅れて届いたとき、
    // その間に手で選んでいたら、遅れた返事は使わない（手で選んだ場所を上書きしないため）
    let manual = 0;

    // 画面いっぱいのときに下に出す帯（今いる場所・この場所にする・お知らせの文）
    const bar = document.createElement("div");
    bar.className = "mapFullBar";
    bar.hidden = true;
    bar.innerHTML = `<div class="msg"></div><div class="mapTools"><button type="button" data-f="here">📍 今いる場所</button><button type="button" data-f="done" class="main">✓ この場所にする</button></div>`;
    document.body.appendChild(bar);
    const barMsg = bar.querySelector(".msg");

    // お知らせの文は、入力画面の欄と画面いっぱいの帯の両方に出す
    function say(t) { msg.textContent = t; barMsg.textContent = t; }

    function setFull(on) {
      if (full === on) return;
      full = on;
      box.classList.toggle("mapFull", on);
      bar.hidden = !on;
      document.body.classList.toggle("noScroll", on);
      if (map) setTimeout(() => map.invalidateSize(), 50);
      if (!on) box.scrollIntoView({ block: "center" });
    }

    const lat = () => parseFloat(el.lat.value);
    const lng = () => parseFloat(el.lng.value);
    const has = () => isFinite(lat()) && isFinite(lng());

    function showMsg() {
      say(has() ? "📍 場所を選んであります（ピンを指で動かすと直せます）" : (box.hidden ? "" : "地図を押すと、その場所にピンが立ちます。"));
      clearBtn.hidden = !has();
    }

    // 点から住所を調べて、住所の欄に入れる（押し直したら、後のほうだけ使う）
    async function fillAddr(la, ln) {
      const my = ++asked;
      say("📍 場所を選びました。住所を調べています…");
      try {
        const [res, m] = await Promise.all([
          fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${la}&lon=${ln}`).then(r => r.json()),
          loadMuni(),
        ]);
        if (my !== asked) return;
        const r = res && res.results;
        const city = r && m[String(r.muniCd).padStart(5, "0")];
        if (!city) throw new Error("none");
        el.addr.value = city + (r.lv01Nm && r.lv01Nm !== "－" ? r.lv01Nm : "");
        say("📍 住所を地図の点に合わせました（番地までは出ません）。ピンを動かすと住所も変わります。");
      } catch {
        if (my !== asked) return;
        say("📍 場所は選べましたが、住所を調べられませんでした。ナビはピンの場所へ向かいます。");
      }
    }

    function setPoint(la, ln, move, fill) {
      el.lat.value = la.toFixed(6);
      el.lng.value = ln.toFixed(6);
      if (map) {
        if (!pin) {
          pin = L.marker([la, ln], { draggable: true }).addTo(map);
          pin.on("dragend", () => { manual++; const p = pin.getLatLng(); setPoint(p.lat, p.lng, false, true); });
        } else pin.setLatLng([la, ln]);
        if (move) map.setView([la, ln], Math.max(map.getZoom(), 17));
      }
      showMsg();
      if (el.onChange) el.onChange(); // 使う側（駐車場の画面など）に「場所が変わった」と知らせる
      if (fill) fillAddr(la, ln);
    }

    async function open() {
      box.hidden = false;
      openBtn.hidden = true;
      hereBtn.hidden = false;
      say("地図を読み込んでいます…");
      try { await load(); }
      catch { say("地図を読み込めませんでした（電波を確かめてください）。住所は手で入れられます。"); return; }
      if (!map) {
        // 段階19・20は、段階18の絵を引き伸ばして出す（少しぼやけるが、もっと近づける）
        map = L.map(box, { tap: true, maxZoom: 20 }).setView(START, 11);
        // 地図の絵は国土地理院の「淡色地図」（色が薄く道が見やすい）。右上のボタンで「写真」（航空写真）に切り替えられる
        const tile = (name, ext) => L.tileLayer(`https://cyberjapandata.gsi.go.jp/xyz/${name}/{z}/{x}/{y}.${ext}`, {
          maxZoom: 20, maxNativeZoom: 18,
          attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
        });
        const pale = tile("pale", "png").addTo(map), photo = tile("seamlessphoto", "jpg");
        map.on("click", e => { manual++; setPoint(e.latlng.lat, e.latlng.lng, false, true); });
        // 右上の「⛶ 大きく」ボタン
        const Big = L.Control.extend({
          options: { position: "topright" },
          onAdd() {
            const b = L.DomUtil.create("button", "mapBigBtn");
            b.type = "button";
            b.textContent = "⛶ 大きく";
            L.DomEvent.disableClickPropagation(b);
            L.DomEvent.on(b, "click", () => setFull(true));
            return b;
          },
        });
        map.addControl(new Big());
        // 右上の「🛰 写真」「🗺 地図」の切り替えボタン
        const Kind = L.Control.extend({
          options: { position: "topright" },
          onAdd() {
            const b = L.DomUtil.create("button", "mapBigBtn");
            b.type = "button";
            b.textContent = "🛰 写真";
            L.DomEvent.disableClickPropagation(b);
            L.DomEvent.on(b, "click", () => {
              const toPhoto = map.hasLayer(pale);
              map.removeLayer(toPhoto ? pale : photo);
              map.addLayer(toPhoto ? photo : pale);
              b.textContent = toPhoto ? "🗺 地図" : "🛰 写真";
            });
            return b;
          },
        });
        map.addControl(new Kind());
      }
      setTimeout(() => {
        map.invalidateSize();
        if (has()) setPoint(lat(), lng(), true);
        else showHere();
      }, 50);
      showMsg();
    }

    // 地図を開いたとき、まだ場所を選んでいなければ、今いる場所のあたりを出す（ピンは立てない。青い点で今いる場所を出す）
    function showHere() {
      if (!navigator.geolocation) return;
      const my = manual;
      navigator.geolocation.getCurrentPosition(p => {
        if (!map || my !== manual || has()) return;
        const ll = [p.coords.latitude, p.coords.longitude];
        map.setView(ll, 16);
        if (!dot) dot = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1, interactive: false }).addTo(map);
        else dot.setLatLng(ll);
      }, () => {}, { timeout: 10000, maximumAge: 60000 });
    }

    function here() {
      if (!navigator.geolocation) { say("この携帯では今いる場所を使えません。"); return; }
      say("今いる場所を調べています…");
      const my = ++manual;
      navigator.geolocation.getCurrentPosition(
        p => { if (my === manual) setPoint(p.coords.latitude, p.coords.longitude, true, true); },
        () => { if (my === manual) say("今いる場所を使えませんでした（位置情報の許可を確かめてください）。地図を押して選べます。"); },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }

    bar.querySelector('[data-f="here"]').addEventListener("click", here);
    bar.querySelector('[data-f="done"]').addEventListener("click", () => setFull(false));

    function clear() {
      asked++;
      manual++;
      el.lat.value = "";
      el.lng.value = "";
      if (pin) { pin.remove(); pin = null; }
      showMsg();
      if (el.onChange) el.onChange();
    }

    // 入力欄を空にしたとき・「直す」で現場を開いたときに、地図を入力欄に合わせる
    function sync() {
      asked++;
      manual++;
      setFull(false);
      if (pin) { pin.remove(); pin = null; }
      if (has()) {
        if (map && !box.hidden) setPoint(lat(), lng(), true);
      } else if (box.hidden === false && map) map.setView(START, 11);
      showMsg();
    }

    // 地図を開いて（開いていなければ）、今いる場所にピンを立てる。写真で登録したときの「はい」から使う
    async function openHere() {
      if (box.hidden) await open();
      if (window.L) here();
    }

    openBtn.addEventListener("click", open);
    hereBtn.addEventListener("click", here);
    clearBtn.addEventListener("click", clear);
    return { sync, openHere };
  }

  // 「現場を追加」の欄の地図（add.js から MapPick.sync()、photo.js から MapPick.openHere() で使う）
  const f = document.getElementById("addForm").elements;
  const add = make({
    box: document.getElementById("mapBox"), openBtn: document.getElementById("mapOpen"),
    hereBtn: document.getElementById("mapHere"), clearBtn: document.getElementById("mapClear"),
    msg: document.getElementById("mapMsg"), lat: f.lat, lng: f.lng, addr: f.addr,
  });
  return { sync: add.sync, openHere: add.openHere, make };
})();
