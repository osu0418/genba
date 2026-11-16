// 版60：iPhoneで「Webアプリとして開く」を入れたままホーム画面に置いたアイコンから開いたときだけ、上に黄色の注意を出す。
// 理由：そのアイコンはSafariと保存場所が別になり、LINEのリンク（Safariで開く）で入れた現場がアイコンからは見えない＝「消えた」に見える。
// 見分け方：iPhone・iPadは、そのアイコンから開くと navigator.standalone が true になる（正しく置いたアイコン・Safari・Androidでは true にならない）。実機は未確認。
(() => {
  if (navigator.standalone !== true) return;
  document.addEventListener("DOMContentLoaded", () => {
    const box = document.createElement("div");
    box.id = "webAppTip";
    box.setAttribute("role", "alert");
    box.innerHTML =
      "⚠ このアイコンは<b>「Webアプリとして開く」が入っています。</b>LINEで届いた現場がここに出ません。" +
      "<div class=\"webAppTipHow\">直し方（1回だけ）</div>" +
      "<ol class=\"webAppTipSteps\">" +
      "<li>このアイコンを<b>長押し</b> →「削除」</li>" +
      "<li><b>Safari</b>で <b>nyujo.genba-benri.com</b> を開く</li>" +
      "<li>共有ボタン（四角から上に矢印）→「ホーム画面に追加」</li>" +
      "<li><b>「Webアプリとして開く」を灰色にする</b>（①）→「追加」（②）" +
      "<img src=\"guide/5_toggle.jpg\" alt=\"「Webアプリとして開く」のスイッチを灰色にして、追加を押す\"></li>" +
      "</ol>" +
      "<span class=\"webAppTipSub\">※このアイコンの中で入れた現場は、置き直すと消えます。</span>";
    const header = document.querySelector("header");
    if (header) header.appendChild(box); else document.body.prepend(box);
  });
})();
