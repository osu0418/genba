// 版67：周りの地図から駐車場を探して登録（制作する人だけ）
//  アプリの中の地図に、現場（「現」の印）と周りの駐車場（「P」の印）を出す。駐車場の印を押すと、その場所で登録を始める
//  駐車場の印の元は OpenStreetMap（誰でも書き込める無料の地図）。載っていない駐車場もあるので「Googleマップでも見る」を並べる
//  入るのは場所・住所（国土地理院で調べる）・会社（書いてあれば）。料金・最大料金は載っていないことがほとんどなので、看板の写真か手で入れる
const ParkMap = (() => {
  const btn = document.getElementById("parkMapFind");
  const box = document.getElementById("parkMapFindBox");
  const mapEl = document.getElementById("parkMapFindMap");
  const msg = document.getElementById("parkMapFindMsg");
  const R = 600; // 現場から何mまで探すか
  let map = null, layer = null, no = 0;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hasPt = p => p && isFinite(parseFloat(p.lat)) && isFinite(parseFloat(p.lng));

  // 会社の名前を、会社のボタンと同じ書き方にそろえる
  function company(t) {
    const s = String(t || "").normalize("NFKC");
    if (/タイムズ|times/i.test(s)) return "タイムズ";
    if (/リパーク|repark|三井不動産リアルティ/i.test(s)) return "三井のリパーク";
    return "";
  }

  async function search(site) {
    const my = ++no;
    const s = { lat: parseFloat(site.lat), lng: parseFloat(site.lng) };
    box.hidden = false;
    msg.textContent = "地図を読み込んでいます…";
    try { await MapPick.load(); } catch { msg.textContent = "地図を読み込めませんでした（電波を確かめてください）。"; return; }
    if (my !== no) return;
    if (!map) {
      map = L.map(mapEl, { maxZoom: 19 });
      L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", { maxZoom: 19, maxNativeZoom: 18,
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>・<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
    }
    if (layer) layer.remove();
    layer = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 50);
    map.setView([s.lat, s.lng], 16);
    const icon = (cls, t) => L.divIcon({ className: "", html: `<div class="${cls}">${t}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    L.marker([s.lat, s.lng], { icon: icon("pvDotS big", "現"), zIndexOffset: 1000 }).addTo(layer);
    msg.textContent = "周りの駐車場を探しています…";
    let list = [];
    try {
      const q = `[out:json][timeout:20];nwr["amenity"="parking"](around:${R},${s.lat},${s.lng});out center tags 80;`;
      const r = await (await fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q))).json();
      list = (r.elements || []).map(e => {
        const t = e.tags || {};
        const lat = e.lat ?? (e.center && e.center.lat), lng = e.lon ?? (e.center && e.center.lon);
        return { lat, lng, t };
      }).filter(p => isFinite(p.lat) && isFinite(p.lng) && !/^(private|customers|no)$/.test(p.t.access || ""));
    } catch {
      if (my === no) msg.textContent = "駐車場を探せませんでした（電波を確かめてください）。下の「Googleマップでも見る」で探せます。";
      return;
    }
    if (my !== no) return;
    for (const p of list) {
      const co = company((p.t.operator || "") + " " + (p.t.name || "") + " " + (p.t.brand || ""));
      const name = p.t.name || p.t.operator || "";
      const label = co || name || (p.t.fee === "yes" ? "有料の駐車場" : "駐車場");
      L.marker([p.lat, p.lng], { icon: icon("pvDotP big", "P") }).addTo(layer)
        .bindPopup(`<b>${esc(label)}</b><br><button type="button" class="main pmPick">ここを登録する</button>`)
        .on("popupopen", ev => {
          const b = ev.popup.getElement().querySelector(".pmPick");
          b.onclick = () => { map.closePopup(); box.hidden = true; Park.fromMap({ lat: p.lat, lng: p.lng, co, name }); };
        });
    }
    msg.textContent = list.length
      ? `周りの駐車場 ${list.length}か所（P）。押して「ここを登録する」。載っていない駐車場は「Googleマップでも見る」で探してください。`
      : "この近くの駐車場は、この地図には載っていませんでした。「Googleマップでも見る」で探してください。";
  }

  btn.addEventListener("click", () => {
    const s = Park.site();
    if (!s) return;
    if (!hasPt(s)) { box.hidden = false; msg.textContent = "現場の場所（住所か📍）が入っていないので探せません。現場の「手直し」で住所を入れてください。"; return; }
    if (!box.hidden && map) { box.hidden = true; return; } // もう一度押すと閉じる
    search(s);
  });
  document.getElementById("parkMapFindClose").addEventListener("click", () => { box.hidden = true; no++; });
  // 別の現場の駐車場の画面を開いたら閉じておく
  return { close: () => { box.hidden = true; no++; } };
})();
