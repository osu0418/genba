// 版58：iPhoneで電話を「キャンセル」したあと、次に電話を押すと
// Safariが「このWebサイトでは通話の自動開始がブロックされています」を出す（iPhoneの決まり。アプリでは止められない）。
// 戸惑って電話をやめないように、そのときだけアプリの上に「『通話を許可』を押せば電話できます」と出す。
// 見分け方：電話を押したあと、電話の画面に切り替わる（アプリが隠れる）ことがなかったら「キャンセルした」と見なす
(() => {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  let last = 0;          // 前に電話を押した時刻
  let wentAway = true;   // 前の電話のあと、アプリが隠れたか（＝電話の画面に行ったか）

  document.addEventListener("visibilitychange", () => { if (document.hidden) wentAway = true; });

  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="tel:"]');
    if (!a) return;
    const now = Date.now();
    if (!wentAway && now - last < 10 * 60 * 1000) show();
    last = now;
    wentAway = false;
  }, true);

  function show() {
    let box = document.getElementById("callTip");
    if (!box) {
      box = document.createElement("div");
      box.id = "callTip";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
      box.addEventListener("click", () => { box.hidden = true; });
    }
    box.innerHTML = "📞 「通話の自動開始がブロック」と出たら<br><b>「通話を許可」</b>を押せば電話できます" +
      "<span class=\"callTipSub\">さっき電話をキャンセルしたので、iPhoneが確かめています（故障ではありません）</span>";
    box.hidden = false;
    clearTimeout(show.t);
    show.t = setTimeout(() => { box.hidden = true; }, 15000);
  }
})();
