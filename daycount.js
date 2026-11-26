// 版76：何台で使われているかを知るため、1台につき1日1回だけ「今日開いた」をGoatCounterに送る（2026-11-26「ア」）
// 送るのは「開いた」ことだけ。名前・電話番号・現場のデータは送らない。人を見分ける番号も付けない
// LINEの中で開いたときは送らない（すぐ外のブラウザで開き直すので、2回数えないため）
(() => {
  if (/\bLine\//i.test(navigator.userAgent)) return;
  const KEY = "genba-daycount-v1";
  const d = new Date();
  const today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  try { if (localStorage.getItem(KEY) === today) return; } catch { return; }
  let tries = 0;
  const send = () => {
    const gc = window.goatcounter;
    if (gc && typeof gc.count === "function") {
      gc.count({ path: "今日使った台数", title: "1台につき1日1回", event: true });
      try { localStorage.setItem(KEY, today); } catch {}
      return;
    }
    if (++tries < 20) setTimeout(send, 1000); // count.js の読み込みを最大20秒待つ。届かなければ今日は数えない
  };
  window.addEventListener("load", send);
})();
