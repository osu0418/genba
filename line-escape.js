// LINEの中で開かれたとき：LINEの中は保存が消えることがあるので、外のブラウザ（Safariなど）で開き直す
// 1回目：URLに openExternalBrowser=1 を付けて開き直す（LINEがこれを見て外のブラウザで開く）
// 2回目（付いているのにまだLINEの中）：同じ所を回らないよう開き直さず、赤い字で知らせる
(() => {
  if (!/\bLine\//i.test(navigator.userAgent)) return;

  const url = new URL(location.href);
  if (url.searchParams.get("openExternalBrowser") !== "1") {
    url.searchParams.set("openExternalBrowser", "1");
    location.replace(url.toString());
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const box = document.createElement("div");
    box.className = "banner";
    box.innerHTML =
      "⚠ <b>LINEの中で開いています。</b>ここで登録した現場は消えることがあります。<br>" +
      "画面の「…」などのメニューから「ブラウザで開く」（iPhoneは「Safariで開く」）を押してください。";
    const header = document.querySelector("header");
    if (header) header.appendChild(box);
    else document.body.prepend(box);
  });
})();
