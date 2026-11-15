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
    return `<a class="viaRoute" href="${href.replace(/&/g, "&amp;")}">🚧 進入路から入るナビ<span class="sub">Googleマップだけ（入口を通ってから現場へ）</span></a>`;
  }

  return { isIOS, has, hasPoint, links, parkSearch, go, viaRoute };
})();
