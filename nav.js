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

  return { isIOS, has, hasPoint, links };
})();
