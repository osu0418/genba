// 進入路の地図（版49）：「初めて見る人がすぐわかるように、地図で赤色の線で見えるようにしてほしい」
// ・描く（登録する人）：「現場を追加・直す」の「🚧 進入路を地図に描く」→ 地図で、道の入口から現場まで曲がる所を順に押す → 赤い線になる
//   指でなぞると地図が動いてしまうので、点を押して線にする形にした
// ・見る（みんな）：カードの「🚧 進入路を地図で見る」→ 赤い線・入口の「入」・現場の「現」・駐車場の「P」
// ・線は site.routeLine に「緯度,経度,差,差,…」の短い字で入れる（LINEのリンクが長くならないよう、2点目からは前の点との差を10万倍した整数）
const RouteMap = (() => {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const hasPt = p => p && typeof p.lat === "number" && typeof p.lng === "number";
  const MAX = 40; // 点は40まで（リンクが長くなりすぎないように）
  const TILE = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
  const ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>';

  // 点の並び ⇔ 短い字
  function enc(pts) {
    if (!pts || !pts.length) return "";
    const q = pts.slice(0, MAX).map(([a, b]) => [Math.round(a * 1e5), Math.round(b * 1e5)]);
    const out = [q[0][0], q[0][1]];
    for (let i = 1; i < q.length; i++) out.push(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
    return out.join(",");
  }
  function dec(t) {
    const n = String(t || "").split(",").map(Number);
    if (n.length < 4 || n.length % 2 || n.some(x => !isFinite(x))) return [];
    const pts = [];
    let a = 0, b = 0;
    for (let i = 0; i < n.length; i += 2) {
      a = i ? a + n[i] : n[i]; b = i ? b + n[i + 1] : n[i + 1];
      if (Math.abs(a) > 9e6 || Math.abs(b) > 18e6) return [];
      pts.push([a / 1e5, b / 1e5]);
    }
    return pts;
  }
  const has = s => dec(s && s.routeLine).length >= 2;

  const icon = (cls, t) => L.divIcon({ className: "", html: `<div class="${cls}">${t}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
  function baseMap(el) {
    const map = L.map(el, { zoomControl: true, attributionControl: true, maxZoom: 19 });
    L.tileLayer(TILE, { maxZoom: 19, maxNativeZoom: 18, attribution: ATTR }).addTo(map);
    return map;
  }
  // 線を描く：白いふちの上に赤い太線（地図の色に負けないように）。入口に「入」
  function drawLine(map, pts, group) {
    const g = group || L.layerGroup().addTo(map);
    g.clearLayers();
    if (pts.length >= 2) {
      L.polyline(pts, { color: "#fff", weight: 11, opacity: 0.9 }).addTo(g);
      L.polyline(pts, { color: "#e3001b", weight: 7 }).addTo(g);
    }
    pts.forEach((p, i) => { if (i && i < pts.length - 1) L.circleMarker(p, { radius: 5, color: "#fff", weight: 2, fillColor: "#e3001b", fillOpacity: 1 }).addTo(g); });
    if (pts.length) L.marker(pts[0], { icon: icon("rmIn", "入") }).addTo(g);
    return g;
  }

  let box = null;
  function close() { if (box) box.remove(); box = null; }

  // 見る（カードのボタンから）
  async function show(siteId) {
    const site = Store.load().find(s => s.id === siteId);
    const pts = dec(site && site.routeLine);
    if (pts.length < 2) return;
    close();
    box = document.createElement("div");
    box.className = "pvBack";
    const rules = String(site.notes || "").split("\n").filter(l => /進入路|規制|通学路|通行許可/.test(l));
    box.innerHTML = `<div class="pvCard">
      <div class="pvKind">🚧 進入路</div>
      <div class="pvName">${esc(site.name)}</div>
      ${site.routeWhy ? `<div class="rmWhy">🚧 ${esc(site.routeWhy)}</div>` : ""}
      <div class="rmMap" id="rmMap"></div>
      <div class="pvLegend"><span class="rmLine"></span> 通る道　<span class="rmIn small">入</span> ここから入る　<span class="pvDotS">現</span> 現場${(site.parks || []).length ? `　<span class="pvDotP">P</span> 駐車場` : ""}</div>
      ${rules.length ? `<div class="notice">⚠ ${rules.map(esc).join("<br>⚠ ")}</div>` : ""}
      ${Nav.viaRoute(Object.assign({}, site, { routeWhy: "" }), pts)}
      ${Nav.alt(site, "ふつうのナビ（進入路を通らないことがあります）", true)}
      <button type="button" class="pvClose" data-rmclose>とじる</button>
    </div>`;
    box.addEventListener("click", e => { if (e.target === box || e.target.closest("[data-rmclose]")) close(); });
    document.body.appendChild(box);
    box.querySelector(".pvCard").scrollTop = 0;
    const el = document.getElementById("rmMap");
    try { await MapPick.load(); } catch { el.textContent = "地図を読み込めませんでした（電波を確かめてください）。"; return; }
    if (!box || !document.body.contains(el)) return;
    const map = baseMap(el);
    drawLine(map, pts);
    const all = pts.slice();
    if (hasPt(site)) { L.marker([site.lat, site.lng], { icon: icon("pvDotS big", "現") }).addTo(map); all.push([site.lat, site.lng]); }
    (site.parks || []).forEach(p => { if (hasPt(p)) { L.marker([p.lat, p.lng], { icon: icon("pvDotP", "P") }).addTo(map); all.push([p.lat, p.lng]); } }); // 駐車場も地図に入るように
    map.fitBounds(all, { padding: [30, 30], maxZoom: 18 });
  }

  // 描く（「現場を追加・直す」から）。field：線を入れる隠れた欄、center：始めの場所 {lat,lng} か null、addr：住所
  async function draw(field, center, addr, done) {
    close();
    let pts = dec(field.value);
    const before = field.value;
    box = document.createElement("div");
    box.className = "pvBack rmDraw";
    box.innerHTML = `<div class="pvCard">
      <div class="pvKind">🚧 進入路を地図に描く</div>
      <div class="note0 rmHow">道の入口から現場まで、<b>曲がる所を順に押して</b>ください。押した所が赤い線でつながります。</div>
      <div class="rmMap big" id="rmMap"></div>
      <div class="rmCount" id="rmCount"></div>
      <div class="mapTools"><button type="button" data-rm="undo">↩ 1つ戻す</button><button type="button" class="del" data-rm="clear">全部消す</button></div>
      <button type="button" class="main" data-rm="ok">✓ この線にする</button>
      <button type="button" class="pvClose" data-rm="cancel">✕ やめる</button>
    </div>`;
    document.body.appendChild(box);
    const el = document.getElementById("rmMap");
    const count = document.getElementById("rmCount");
    try { await MapPick.load(); } catch { el.textContent = "地図を読み込めませんでした（電波を確かめてください）。"; }
    let map = null, g = null;
    const redraw = () => {
      if (map) g = drawLine(map, pts, g);
      count.textContent = pts.length ? `点 ${pts.length}こ${pts.length >= MAX ? "（これ以上は足せません）" : ""}` : "まだ点がありません";
    };
    if (window.L && box && document.body.contains(el)) {
      map = baseMap(el);
      if (center) L.marker([center.lat, center.lng], { icon: icon("pvDotS big", "現"), interactive: false }).addTo(map);
      if (pts.length >= 2) map.fitBounds(pts.concat(center ? [[center.lat, center.lng]] : []), { padding: [30, 30], maxZoom: 18 });
      else if (center) map.setView([center.lat, center.lng], 17);
      else {
        map.setView([36.70, 137.21], 12);
        const r = addr ? await MapPick.geocode(addr) : null;
        if (r && r.lat) map.setView([r.lat, r.lng], 17);
      }
      map.on("click", e => { if (pts.length < MAX) { pts.push([+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)]); redraw(); } });
    }
    redraw();
    box.addEventListener("click", e => {
      const b = e.target.closest("[data-rm]");
      if (!b) return;
      const k = b.dataset.rm;
      if (k === "undo") { pts.pop(); redraw(); }
      if (k === "clear") { pts = []; redraw(); }
      if (k === "ok") { field.value = pts.length >= 2 ? enc(pts) : ""; close(); done && done(); }
      if (k === "cancel") { field.value = before; close(); done && done(); }
    });
  }

  return { enc, dec, has, show, draw };
})();
