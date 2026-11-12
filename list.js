// 一覧：現場の表示、邸名で探す、電話・KY・共有・削除のボタン
const List = (() => {
  const listEl = document.getElementById("list");
  const statusEl = document.getElementById("status");
  const searchEl = document.getElementById("search");

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  // 「森田」「もりた邸」などのゆれを吸収するため、空白と「邸」を外して比べる
  const norm = s => String(s || "").replace(/[\s　。、.]/g, "").replace(/邸$/, "");

  // アラームを使うときは、電話ボタンでショートカットを動かす（入場＝アラームをオン、退場＝オフ）
  function callRow(label, num, kind) {
    const tel = "tel:" + esc(num.replace(/-/g, ""));
    const alarm = !!window.Settings && window.Settings.useAlarm();
    const href = alarm ? esc(Settings.shortcutUrl(kind, num)) : tel;
    const note = alarm ? (kind === "in" ? "（アラームをオン）" : "（アラームをオフ）") : "";
    return `<div class="row">
      <a class="call" href="${href}"><div class="lbl">${label}に電話${note}</div><div class="num">${esc(num)}</div></a>
      <button class="copy" data-copy="${esc(num)}">コピー</button>
    </div>${alarm ? `<a class="plain" href="${tel}">アラームなしで${label}に電話</a>` : ""}`;
  }

  function render() {
    const all = Store.load();
    const q = norm(searchEl.value);
    const sites = all.filter(s => !q || norm(s.name).includes(q) || norm(s.code).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));

    if (!all.length) statusEl.textContent = "まだ現場がありません。下の「現場を追加」から入れてください。";
    else if (!sites.length) statusEl.textContent = `「${searchEl.value}」に合う現場がありません。`;
    else statusEl.textContent = q ? `${sites.length}件見つかりました` : `現場 ${all.length}件`;

    listEl.innerHTML = sites.map(s => `
      <section class="card">
        <div class="name">${esc(s.name)}</div>
        ${s.code ? `<div class="code">現場番号：${esc(s.code)}</div>` : ""}
        ${callRow("入場", s.inTel, "in")}
        ${callRow("退場", s.outTel, "out")}
        ${/^https:\/\//.test(s.kyUrl) ? `<a class="ky" href="${esc(s.kyUrl)}" target="_blank" rel="noopener">KYを開く</a>` : ""}
        <div class="tools">
          <button data-share="${esc(s.id)}">共有の文をコピー</button>
          <button data-edit="${esc(s.id)}">直す</button>
          <button class="del" data-del="${esc(s.id)}">削除</button>
        </div>
      </section>`).join("");
  }

  async function copy(btn, text, label) {
    try { await navigator.clipboard.writeText(text); btn.textContent = "コピーしました"; }
    catch { btn.textContent = "コピーできません"; }
    setTimeout(() => btn.textContent = label, 1500);
  }

  listEl.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.copy) return copy(b, b.dataset.copy, "コピー");
    const site = Store.load().find(s => s.id === (b.dataset.share || b.dataset.del || b.dataset.edit));
    if (!site) return;
    if (b.dataset.edit) return Editor.start(site);
    if (b.dataset.share) return copy(b, Share.toText(site), "共有の文をコピー");
    if (b.dataset.del && confirm(`「${site.name}」を削除しますか？\n元に戻せません。`)) {
      Store.remove(site.id);
      render();
    }
  });

  searchEl.addEventListener("input", render);
  render();
  return { render };
})();
