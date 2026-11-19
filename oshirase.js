// 版64：初回に「ご利用について（お試し期間・免責・データ）」のお知らせを出す（A）。
// 使い方より先に出て、「分かりました」で消すと使い方（#help）が開く。
// メニューの「ご利用について」リンク（#oshLink）からはいつでも開ける（B）。
// 見たことは端末に記録し、お知らせは初回1回だけ。普段の動きは一切変えない。
(() => {
  const KEY = "genba-oshirase-v1";

  function injectCss() {
    if (document.getElementById("oshCss")) return;
    const s = document.createElement("style");
    s.id = "oshCss";
    s.textContent =
      "#oshBack{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}" +
      ".oshBox{background:#fff;color:#222;max-width:420px;width:100%;max-height:88vh;overflow:auto;border-radius:14px;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,.35);}" +
      ".oshBox h2{font-size:18px;margin:0 0 10px;}" +
      ".oshBox section{margin:0 0 12px;}" +
      ".oshBox section h3{font-size:14px;margin:0 0 4px;color:#b5742a;}" +
      ".oshBox section p{font-size:14px;line-height:1.7;margin:0;}" +
      ".oshBox .oshOk{display:block;width:100%;margin-top:6px;padding:12px;font-size:16px;font-weight:700;border:0;border-radius:10px;background:#1d9e75;color:#fff;}";
    document.head.appendChild(s);
  }

  function html(firstTime) {
    return '<div class="oshBox" role="dialog" aria-modal="true" aria-label="ご利用について">' +
      '<h2>ご利用について</h2>' +
      '<section><h3>お試し期間</h3><p>このアプリは、お試し期間中のため、今は無料でお使いいただけます。本格リリース（2026年12月〜2027年1月ごろを予定）から、正式版として有料になります。</p></section>' +
      '<section><h3>免責事項</h3><p>本アプリは現状のまま提供されます。通信やサーバーの状況により、一時的につながらない・正しく表示されないことがあります。これにより生じた損害について、提供者は責任を負いません。ご利用はお客様ご自身の判断でお願いします。</p></section>' +
      '<section><h3>データについて</h3><p>入力したデータは、お使いの端末（ブラウザ）の中に保存されます。端末やブラウザを変えると引き継がれません。大切な現場は「📋 貼る文をコピー」でLINEなどに送っておくと、控えになります（端末を変えても、そのリンクから入れ直せます）。</p></section>' +
      '<button type="button" class="oshOk">' + (firstTime ? "分かりました" : "閉じる") + '</button>' +
      '</div>';
  }

  function open(firstTime) {
    if (document.getElementById("oshBack")) return;
    injectCss();
    const back = document.createElement("div");
    back.id = "oshBack";
    back.innerHTML = html(firstTime);
    document.body.appendChild(back);
    back.querySelector(".oshOk").addEventListener("click", () => {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      back.remove();
      if (firstTime) {
        const help = document.getElementById("help");
        let empty = true;
        try { empty = !(window.Store && Store.load().length); } catch (e) {}
        if (help && empty) help.open = true;
      }
    });
  }

  // B：メニューの「ご利用について」からいつでも開ける
  window.showOshirase = () => open(false);

  document.addEventListener("DOMContentLoaded", () => {
    const link = document.getElementById("oshLink");
    if (link) link.addEventListener("click", (e) => { e.preventDefault(); open(false); });
    let seen = false;
    try { seen = !!localStorage.getItem(KEY); } catch (e) {}
    if (!seen) open(true); // A：初回だけ、使い方より先に出す
  });
})();
