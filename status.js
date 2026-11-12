// 退場まだ：入場の電話ボタンを押した日は、退場の電話ボタンを押すまで、上に赤い文字で知らせる
// （ボタンを押したかどうかで判断する。本当に電話がつながったかまでは分からない）
window.Status = (() => {
  const KEY = "genba-today-v1";
  const banner = document.getElementById("exitBanner");
  const today = () => new Date().toLocaleDateString("ja-JP");

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      return s.date === today() ? s : { date: today(), open: {} };
    } catch { return { date: today(), open: {} }; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function render() {
    const s = load();
    const sites = Store.load();
    const items = Object.entries(s.open)
      .map(([id, time]) => ({ site: sites.find(x => x.id === id), time }))
      .filter(x => x.site);
    banner.hidden = !items.length;
    banner.innerHTML = items.map(({ site, time }) =>
      `<div>⚠ <b>${esc(site.name)}</b>の退場の電話がまだです（${esc(time)} 入場）</div>`).join("");
  }

  document.getElementById("list").addEventListener("click", e => {
    const a = e.target.closest("a[data-kind]");
    if (!a) return;
    const s = load();
    if (a.dataset.kind === "in") {
      s.open[a.dataset.id] = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    } else {
      delete s.open[a.dataset.id];
    }
    save(s);
    render();
  });

  // 日付が変わったときや、ほかの画面から戻ったときにも表示を合わせる
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
  render();
  return { render };
})();
