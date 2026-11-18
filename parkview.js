// 駐車場を見る画面（版39）：カードの「🅿 駐車場」を押しても、いきなりナビを始めない
// 駐車場と現場の場所を地図に出し、現場までの距離・料金などを見てから「ここにする（ナビ開始）」で道案内を始める
// 駐車場が2つ以上あれば、現場から近い順に①②③と並べ、上の番号ボタンで見比べられる（版40）
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

  // 近い順に並べる（版40。「満車なら」はやめた）。現場の場所が無いときは入れた順
  function sorted(site) {
    const parks = (site && site.parks) || [];
    if (!hasPt(site)) return parks.slice();
    const d = p => hasPt(p) ? meters(site, p) : Infinity;
    return parks.slice().sort((a, b) => d(a) - d(b));
  }
  // 短い距離の字（ボタン用）：「約190m」
  function short(site, p) {
    if (!hasPt(site) || !hasPt(p)) return "";
    const m = meters(site, p);
    return m < 1000 ? `約${Math.round(m / 10) * 10}m` : `約${(m / 1000).toFixed(1)}km`;
  }

  // 最大料金があるか（版41。「最大料金があるかが大事」）：料金と決まりの欄から「最大〇円」を探す
  // 返り値：{ ok:true, text:"最大500円" } ／ 最大の字はあるが金額が読めない { ok:true, text:"最大料金あり" } ／ 分からない { ok:false }
  // 版43：「土日上限なし」「特別日は最大料金なし」のような、日によって最大料金が無い駐車場にも対応
  //  返り値に except（最大料金が無い日：「土日」「特別日」など）と todayNone（今日がその日＝今日は最大料金なし）を足す
  const NONE = /(上限|最大(料金)?|打ち?止め?)\s*(は|が)?\s*(なし|無し|無|ない|休止|適用外|対象外|適用されません|ありません)/; // 版53：「最大料金休止」も
  const DAYS = ["土日祝", "土日", "土曜", "日曜", "祝日", "祝", "休日", "特別日", "特定日", "イベント日", "イベント", "年末年始", "お盆", "GW", "ゴールデンウィーク", "夜間", "平日"];
  function maxFee(p) {
    const mx = String(p.max || "").normalize("NFKC").trim();
    if (/^(なし|無し|無|ない|×)$/.test(mx)) return { ok: false, none: true, text: "最大料金なし" };
    const t = (mx + " " + String((p.price || "") + " " + (p.rule || "") + " " + (p.memo || "")).normalize("NFKC")); // 版66：メモの「土日祝は最大料金なし」も見る
    // 「〇〇は上限なし」の〇〇（日）を集める
    const segs = t.split(/[／\/、,。\n()（）]/);
    const ex = [];
    let noneAll = false;
    for (const sg of segs) {
      if (!NONE.test(sg)) continue;
      const ds = DAYS.filter(d => sg.includes(d));
      if (ds.length) ds.forEach(d => { if (!ex.some(e => e.includes(d) || d.includes(e))) ex.push(d); });
      else noneAll = true;
    }
    // 「土日・祝日は上限なし」の部分だけを除いて、金額（最大〇円）を探す
    const cleaned = t.replace(new RegExp("(?:(?:" + DAYS.join("|") + ")[・と\\s]*)*(?:は|が)?\\s*" + NONE.source, "g"), " ");
    const m = cleaned.match(/最大[^0-9]{0,8}([0-9][0-9,]*)\s*円/) || (mx && !NONE.test(mx) ? mx.match(/([0-9][0-9,]*)\s*円/) : null);
    if (!m) {
      if (noneAll || ex.length) return { ok: false, none: true, text: "最大料金なし" + (ex.length ? `（${ex.join("・")}）` : "") };
      if (/最大|上限|打ち止め|打止/.test(cleaned)) return { ok: true, text: "最大料金あり" };
      return { ok: false };
    }
    const r = { ok: true, text: `最大${m[1]}円` };
    if (ex.length) {
      r.except = ex.join("・");
      const d = new Date().getDay();
      r.todayNone = (d === 0 || d === 6) && ex.some(e => /土|日曜|休日/.test(e)); // 祝日・特別日は見分けられない（看板で確かめる）
    }
    return r;
  }


  let box = null, map = null;
  function close() { if (box) box.remove(); box = null; map = null; }

  function show(siteId, parkId) {
    const site = Store.load().find(s => s.id === siteId);
    const parks = sorted(site);
    let idx = parks.findIndex(q => q.id === parkId);
    if (idx < 0) idx = 0;
    const p = parks[idx];
    if (!p) return;
    close();
    box = document.createElement("div");
    box.className = "pvBack";
    const line = (label, v) => v ? `<tr><th>${label}</th><td>${esc(v)}</td></tr>` : "";
    const tabs = parks.length > 1 ? `<div class="pvTabs">${parks.slice(0, 5).map((q, i) =>
      `<button type="button" data-pv="${esc(q.id)}" class="${i === idx ? "on" : ""}">${NUM[i]} ${short(site, q) || esc((q.name || "").slice(0, 6))}</button>`).join("")}</div>` : "";
    const d = distText(site, p);
    box.innerHTML = `<div class="pvCard">
      ${tabs}
      <div class="pvKind">🅿 駐車場 ${NUM[idx]}${parks.length > 1 && hasPt(site) ? "（現場から近い順）" : ""}</div>
      <div class="pvName">${esc(label(p))}</div>
      ${(() => { const f = maxFee(p); return f.ok
        ? `<div class="pvMax ok">💴 ${esc(f.text)}${p.rule ? `<span>（${esc(p.rule)}）</span>` : ""}</div>`
          + (f.except ? `<div class="pvMax ng">⚠ ${f.todayNone ? `今日は最大料金なし<span>（${esc(f.except)}は上限なし。長く止めると高くなります）</span>` : `${esc(f.except)}は最大料金なし<span>（長く止めると高くなります）</span>`}</div>` : "")
        : f.none ? `<div class="pvMax ng">⚠ 最大料金なし<span>（長く止めると高くなります）</span></div>`
        : `<div class="pvMax ng">⚠ 最大料金が分かりません<span>（看板で確かめてください）</span></div>`; })()}
      ${d ? `<div class="pvDist">🚶 ${d}${site.addrPt ? `<span class="note0">（現場の場所は住所から出した、だいたいの場所）</span>` : ""}</div>`
        : `<div class="note0">現場（${esc(site.name)}）の${site.addr ? "住所の場所が見つからない" : "住所も📍も入っていない"}ので、距離は出せません。</div>
           <button type="button" class="pvSite helperOnly" data-pvsite>📍 現場の場所を入れる（現場を直す）</button>`}
      <div class="pvMap" id="pvMap"></div>
      <div class="pvLegend"><span class="pvDotP">P</span> 駐車場　<span class="pvDotS">現</span> 現場（${esc(site.name)}）</div>
      <table class="pvInfo">${line("料金", p.price)}${line("決まり", p.rule)}${line("車の大きさ", p.size)}${line("形", p.kind)}${line("予約制", p.reserve)}${line("連絡先", p.tel)}${line("メモ", p.memo)}${line("確認日", p.checked)}</table>
      ${Nav.go(p, "🚗 ここにする（ナビ開始）", "pvGo") || `<div class="note0">この駐車場は場所が入っていないので、ナビを出せません。</div>`}
      <button type="button" class="pvEdit helperOnly" data-pvedit="${esc(p.id)}">✏ この駐車場を手直し（料金・メモ）</button>
      <button type="button" class="pvClose" data-pvclose>やめる</button>
    </div>`;
    box.addEventListener("click", e => {
      if (e.target === box || e.target.closest("[data-pvclose]")) return close();
      if (e.target.closest("[data-pvsite]")) { close(); return Editor.start(site); }
      const ed = e.target.closest("[data-pvedit]");
      if (ed) { close(); return Park.edit(siteId, ed.dataset.pvedit, maxFee(p).ok ? "" : "price"); }
      const t = e.target.closest("[data-pv]");
      if (t) show(siteId, t.dataset.pv);
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

  // 版66：名前は書かなくてよくなったので、無ければ料金を名前の代わりに出す
  function label(p) { return p.name || p.price || "名前なし"; }
  return { show, distText, sorted, short, maxFee, label };
})();
