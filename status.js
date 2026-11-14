// 退場まだ：入場の電話ボタンを押した日は、退場の電話ボタンを押すまで、上に赤い文字で知らせる
// （ボタンを押したかどうかで判断する。本当に電話がつながったかまでは分からない）
// 赤い字の行を押すと、その現場の退場の番号に電話をかけ、退場ボタンを押したのと同じ扱いにする
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
      `<a class="exitCall" data-exit="${esc(site.id)}" href="tel:${esc(String(site.outTel).replace(/-/g, ""))}">` +
      `⚠ <b>${esc(site.name)}</b>の退場の電話がまだです（${esc(time)} 入場）` +
      `<span class="exitGo">📞 ここを押すと退場に電話</span></a>`).join("");
  }

  document.getElementById("list").addEventListener("click", e => {
    const a = e.target.closest("a[data-kind]");
    if (!a) return;
    if (a.dataset.kind === "in") return markIn(a.dataset.id);
    const s = load();
    delete s.open[a.dataset.id];
    save(s);
    render();
  });

  // 入場の記録（時刻前の確認の枠から電話したときも、ここを呼ぶ）
  function markIn(id) {
    const s = load();
    s.open[id] = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    save(s);
    render();
  }

  // 赤い字の行を押した：電話はリンクでかかる。こちらは退場済みにするだけ
  banner.addEventListener("click", e => {
    const a = e.target.closest("a[data-exit]");
    if (!a) return;
    const s = load();
    delete s.open[a.dataset.exit];
    save(s);
    setTimeout(render, 0);
  });

  // 日付が変わったときや、ほかの画面から戻ったときにも表示を合わせる
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
  render();
  return { render, markIn };
})();
