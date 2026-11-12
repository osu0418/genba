// 使い方：現場がまだ1つもない人には開いて見せ、現場がある人には閉じておく
(() => {
  const help = document.getElementById("help");
  if (!Store.load().length) help.open = true;
})();
