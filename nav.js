// ナビ：地図アプリで道案内を始めるボタンを作る（現場の一覧と「帰る」の両方で使う）
// iPhoneは「マップ」と「Googleマップ」の2つ、それ以外（Androidなど）は「Googleマップ」だけ
// 行き先：地図のピン（緯度・経度）があればそれを、なければ住所の文字を使う
const Nav = (() => {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

  const hasPoint = p => typeof p.lat === "number" && typeof p.lng === "number";
  const has = p => !!p && (hasPoint(p) || !!p.addr);

  function links(p) {
    if (!has(p)) return "";
    const q = encodeURIComponent(hasPoint(p) ? `${p.lat},${p.lng}` : p.addr);
    const google = `<a class="nav google" href="https://www.google.com/maps/dir/?api=1&amp;destination=${q}"><div class="lbl">ナビ</div>Googleマップ</a>`;
    const apple = `<a class="nav apple" href="https://maps.apple.com/?daddr=${q}"><div class="lbl">ナビ</div>マップ</a>`;
    return `<div class="navs">${isIOS ? apple + google : google}</div>`;
  }

  // 近くの駐車場を探す（版23。版25でiPhoneもGoogleマップに）
  // iPhoneの「マップ」は、場所を決めて駐車場を探す書き方が実機で効かなかった（ナビが開くだけ・今いる場所から始まる）ので、
  // iPhoneもAndroidもGoogleマップの検索で開く（Googleマップのアプリが無いiPhoneはSafariで開く）
  function parkSearch(p, label, cls) {
    if (!has(p)) return "";
    const word = "駐車場";
    const href = hasPoint(p)
      ? `https://www.google.com/maps/search/${encodeURIComponent(word)}/@${p.lat},${p.lng},16z`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.addr + " " + word)}`;
    return `<a class="${cls || "parkFind"}" href="${href.replace(/&/g, "&amp;")}" target="_blank" rel="noopener">${label || "🔍 近くの駐車場を探す"}</a>`;
  }

  // 1回で道案内を始めるボタン（版27。現場のカードの「🅿 ナビ」）：iPhoneは「マップ」、それ以外は「Googleマップ」
  function go(p, label, cls) {
    if (!has(p)) return "";
    const q = encodeURIComponent(hasPoint(p) ? `${p.lat},${p.lng}` : p.addr);
    const href = isIOS ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&amp;destination=${q}`;
    return `<a class="${cls || "goBtn"}" href="${href}">${label}</a>`;
  }

  // 進入路を通るナビ（版54）：「進入路が決まっているところは、ナビを設定したときに進入路から入るように」
  // ・Googleマップの「経由地」で、進入路の入口（＋途中の曲がり角）を通ってから現場へ行く道にする
  // ・iPhoneの「マップ」はアドレスで経由地を渡せないので、iPhoneもGoogleマップで開く（ボタンに「Googleマップだけ」と書く）
  // ・スマホのブラウザから開くと経由地は3つまで → 入口＋途中2つまで（線の最後の点は現場なので行き先にする）
  function viaRoute(s, pts) {
    if (!pts || pts.length < 2) return "";
    const ll = p => `${p[0]},${p[1]}`;
    const dest = hasPoint(s) ? `${s.lat},${s.lng}` : ll(pts[pts.length - 1]);
    const mid = pts.slice(1, -1);
    const pick = mid.length <= 2 ? mid : [mid[Math.floor(mid.length / 3)], mid[Math.floor(mid.length * 2 / 3)]];
    const ways = [pts[0], ...pick].map(ll).join("|");
    const href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&waypoints=${encodeURIComponent(ways)}&travelmode=driving`;
    const why = s.routeWhy ? `<span class="why">${String(s.routeWhy).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";")}</span>` : "";
    return `<a class="viaRoute" data-via="1" href="${href.replace(/&/g, "&amp;")}">🚗 この道でナビ開始${why}<span class="sub">Googleマップだけ（入口を通ってから現場へ）</span></a>`;
  }

  // 版56：ほかの地図で開く（小さい字のリンク）。iPhoneはGoogleマップ、ほかは無し（Googleマップが大きいボタン）
  function alt(p, label, both) {
    if (!has(p)) return "";
    const q = encodeURIComponent(hasPoint(p) ? `${p.lat},${p.lng}` : p.addr);
    const g = `<a href="https://www.google.com/maps/dir/?api=1&amp;destination=${q}">Googleマップ</a>`;
    const a = `<a href="https://maps.apple.com/?daddr=${q}">iPhoneのマップ</a>`;
    // カードでは大きいボタンがiPhoneのマップなので、iPhoneはGoogleマップだけ。進入路の画面（both）は両方
    if (!both && !isIOS) return "";
    return `<div class="navAlt">${label || "ほかの地図で開く"}：${isIOS && both ? a + "／" + g : both ? a + "／" + g : g}</div>`;
  }

  // 版55：はじめて「進入路から入るナビ」を押したときだけ、アプリの中に案内の枠を出す
  // （iPhoneの確認の窓は前に戸惑う人が出たので使わない。2回目からはすぐGoogleマップが開く）
  const SEEN = "genbaViaSeen";
  const seen = () => { try { return localStorage.getItem(SEEN) === "1"; } catch { return true; } };
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-via]");
    if (!a || seen()) return;
    e.preventDefault();
    const box = document.createElement("div");
    box.className = "pvBack";
    box.innerHTML = `<div class="pvCard">
      <div class="pvKind">🚧 進入路から入るナビ（はじめての1回だけ出ます）</div>
      <div class="viaHelp">
        <p>① <b>Googleマップ</b>で開きます（iPhoneの「マップ」は、通る道を決められないため）。</p>
        <p>② 途中の<b>入口</b>で「到着」と出たら、そのまま<b>「次へ」「続行」</b>を押すと現場へ進みます。</p>
        <p>③ Googleマップのアプリを入れていないiPhoneは、Safariで開きます。アプリを入れておくと楽です。</p>
      </div>
      <a class="pvGo" data-viago href="${a.getAttribute("href").replace(/&/g, "&amp;")}">わかった・開く</a>
      <button type="button" class="pvClose" data-viaclose>やめる</button>
    </div>`;
    const close = () => box.remove();
    box.addEventListener("click", ev => {
      if (ev.target === box || ev.target.closest("[data-viaclose]")) close();
      if (ev.target.closest("[data-viago]")) { try { localStorage.setItem(SEEN, "1"); } catch {} setTimeout(close, 300); }
    });
    document.body.appendChild(box);
  });

  return { isIOS, has, hasPoint, links, parkSearch, go, viaRoute, alt };
})();
