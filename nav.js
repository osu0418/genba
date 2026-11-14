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
  function parkSearch(p, label) {
    if (!has(p)) return "";
    const word = "駐車場";
    const href = hasPoint(p)
      ? `https://www.google.com/maps/search/${encodeURIComponent(word)}/@${p.lat},${p.lng},16z`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.addr + " " + word)}`;
    return `<a class="parkFind" href="${href.replace(/&/g, "&amp;")}" target="_blank" rel="noopener">${label || "🔍 近くの駐車場を探す"}</a>`;
  }

  // 1回で道案内を始めるボタン（版27。現場のカードの「🅿 ナビ」）：iPhoneは「マップ」、それ以外は「Googleマップ」
  function go(p, label, cls) {
    if (!has(p)) return "";
    const q = encodeURIComponent(hasPoint(p) ? `${p.lat},${p.lng}` : p.addr);
    const href = isIOS ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&amp;destination=${q}`;
    return `<a class="${cls || "goBtn"}" href="${href}">${label}</a>`;
  }

  return { isIOS, has, hasPoint, links, parkSearch, go };
})();
