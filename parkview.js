// 駐車場を見る画面（版39）：カードの「🅿 駐車場」を押しても、いきなりナビを始めない
// 駐車場と現場の場所を地図に出し、現場までの距離・料金などを見てから「ここにする（ナビ開始）」で道案内を始める
// 満車のとき用の②③も、上の番号ボタンで見比べられる
const ParkView = (() => {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const hasPt = p => p && typeof p.lat === "number" && typeof p.lng === "number";
  const NUM = ["①", "②", "③", "④", "⑤"];
  // 2点の間のまっすぐの距離（m）
  function meters(a, b) {
    const R = 6371000, r = x => x * Math.PI / 180;
    const dLa = r(b.lat - a.lat), dLn = r(b.lng - a.lng);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function distText(site, p) {
    if (!hasPt(site) || !hasPt(p)) return "";
    const m = meters(site, p);
    const walk = Math.max(1, Math.round(m * 1.3 / 80)); // 道は遠回りになるので1.3倍、歩くのは1分80m
    return m < 1000 ? `現場まで 約${Math.round(m / 10) * 10}m（歩いて約${walk}分）` : `現場まで 約${(m / 1000).toFixed(1)}km（歩いて約${walk}分）`;
  }

  let box = null, map = null;
  function close() { if (box) box.remove(); box = null; map = null; }

  function show(siteId, idx) {
    const site = Store.load().find(s => s.id === siteId);
    const parks = (site && site.parks) || [];
    const p = parks[idx];
    if (!p) return;
    close();
    box = document.createElement("div");
    box.className = "pvBack";
    const line = (label, v) => v ? `<tr><th>${label}</th><td>${esc(v)}</td></tr>` : "";
    const tabs = parks.length > 1 ? `<div class="pvTabs">${parks.slice(0, 5).map((q, i) =>
      `<button type="button" data-pv="${i}" class="${i === idx ? "on" : ""}">${NUM[i]} ${i === 0 ? "いつもの" : "満車なら"}</button>`).join("")}</div>` : "";
    const d = distText(site, p);
    box.innerHTML = `<div class="pvCard">
      ${tabs}
      <div class="pvKind">🅿 ${NUM[idx]} ${idx === 0 ? "いつもの駐車場" : "満車のときの駐車場"}</div>
      <div class="pvName">${esc(p.name || "名前なし")}</div>
      ${d ? `<div class="pvDist">🚶 ${d}</div>` : `<div class="note0">現場の場所が入っていないので、距離は出せません。</div>`}
      <div class="pvMap" id="pvMap"></div>
      <div class="pvLegend"><span class="pvDotP">P</span> 駐車場　<span class="pvDotS">現</span> 現場（${esc(site.name)}）</div>
      <table class="pvInfo">${line("料金", p.price)}${line("最大料金の決まり", p.rule)}${line("車の大きさ", p.size)}${line("形", p.kind)}${line("予約制", p.reserve)}${line("連絡先", p.tel)}${line("メモ", p.memo)}${line("確認日", p.checked)}</table>
      ${Nav.go(p, "🚗 ここにする（ナビ開始）", "pvGo") || `<div class="note0">この駐車場は場所が入っていないので、ナビを出せません。</div>`}
      <button type="button" class="pvClose" data-pvclose>やめる</button>
    </div>`;
    box.addEventListener("click", e => {
      if (e.target === box || e.target.closest("[data-pvclose]")) return close();
      const t = e.target.closest("[data-pv]");
      if (t) show(siteId, +t.dataset.pv);
      if (e.target.closest(".pvGo")) setTimeout(close, 300); // ナビを開いたら、この画面は閉じる
    });
    document.body.appendChild(box);
    drawMap(site, p);
  }

  // 地図：駐車場（P）と現場（現）の2つの印。両方が入るように広さを合わせる
  async function drawMap(site, p) {
    const el = document.getElementById("pvMap");
    if (!hasPt(p)) { el.hidden = true; return; }
    try { await MapPick.load(); } catch { el.textContent = "地図を読み込めませんでした（電波を確かめてください）。"; return; }
    if (!box || !document.body.contains(el)) return;
    map = L.map(el, { zoomControl: true, attributionControl: true, maxZoom: 19 });
    L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", { maxZoom: 19, maxNativeZoom: 18,
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>' }).addTo(map);
    const icon = (cls, t) => L.divIcon({ className: "", html: `<div class="${cls}">${t}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    const pts = [[p.lat, p.lng]];
    L.marker([p.lat, p.lng], { icon: icon("pvDotP big", "P") }).addTo(map);
    if (hasPt(site)) {
      L.marker([site.lat, site.lng], { icon: icon("pvDotS big", "現") }).addTo(map);
      L.polyline([[site.lat, site.lng], [p.lat, p.lng]], { color: "#e3001b", weight: 3, dashArray: "6 6" }).addTo(map);
      pts.push([site.lat, site.lng]);
    }
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 18 }); else map.setView(pts[0], 17);
  }

  return { show, distText };
})();
