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

  // 近くの駐車場を探す（版23・版24で直した）：地図アプリで、現場のまわりの「駐車場」を検索して開く
  // 場所：ピンがあればピン、なければ住所。iPhoneは「マップ」、それ以外は「Googleマップ」
  function parkSearch(p, label) {
    if (!has(p)) return "";
    const word = "駐車場";
    let href;
    if (isIOS) {
      // 版24：古い書き方（?q=…&sll=…）だと「駐車場」という名前のピンが1つ立つだけだったので、
      // Appleの新しい検索の書き方（/search?query=…&center=…）にする。まわり約1kmの駐車場が一覧で出る
      href = hasPoint(p)
        ? `https://maps.apple.com/search?query=${encodeURIComponent(word)}&center=${p.lat},${p.lng}&span=0.01,0.01`
        : `https://maps.apple.com/search?query=${encodeURIComponent(p.addr + " 周辺 " + word)}`;
    } else {
      href = hasPoint(p)
        ? `https://www.google.com/maps/search/${encodeURIComponent(word)}/@${p.lat},${p.lng},17z`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.addr + " " + word)}`;
    }
    return `<a class="parkFind" href="${href.replace(/&/g, "&amp;")}" target="_blank" rel="noopener">${label || "🔍 近くの駐車場を探す"}</a>`;
  }

  return { isIOS, has, hasPoint, links, parkSearch };
})();
