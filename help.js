// 使い方：現場がまだ1つもない人には開いて見せ、現場がある人には閉じておく。
// ただし初回はお知らせ（oshirase.js）を先に出すので、お知らせを見るまでは自動で開かない。
(() => {
  const help = document.getElementById("help");
  const oshiraseSeen = (() => { try { return !!localStorage.getItem("genba-oshirase-v1"); } catch (e) { return true; } })();
  if (!Store.load().length && oshiraseSeen) help.open = true;
})();
