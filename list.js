// 一覧：現場の表示、邸名で探す、電話・KY・共有・削除のボタン
const List = (() => {
  const listEl = document.getElementById("list");
  const statusEl = document.getElementById("status");
  const searchEl = document.getElementById("search");

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  // 「森田」「もりた邸」などのゆれを吸収するため、空白と「邸」を外して比べる
  const norm = s => String(s || "").replace(/[\s　。、.]/g, "").replace(/邸$/, "");

  function callRow(label, num, kind, id) {
    const mark = `data-kind="${kind}" data-id="${esc(id)}"`;
    return `<div class="row">
      <a class="call" ${mark} href="tel:${esc(num.replace(/-/g, ""))}"><div class="lbl">${label}に電話</div><div class="num">${esc(num)}</div></a>
      <button class="copy" data-copy="${esc(num)}">コピー</button>
    </div>`;
  }

  // 住所とナビのボタン（ボタンの作り方は nav.js）
  function navRow(s) {
    if (!Nav.has(s)) return "";
    const where = s.addr ? `住所：${esc(s.addr)}` : "住所：（なし）";
    return `<div class="addr">${where}${Nav.hasPoint(s) ? "　📍地図の場所あり" : ""}</div>${Nav.links(s)}`;
  }

  // 駐車場：ふだんはたたんでおき（カードを短くするため）、押すと料金・決まり・ナビが出る
  function parkRow(s) {
    const parks = s.parks || [];
    const btn = `<button type="button" class="parkBtn" data-park="${esc(s.id)}">🅿 駐車場を${parks.length ? "足す・直す" : "登録"}</button>`;
    if (!parks.length) return btn;
    const line = (label, v) => v ? `<div>${label}：${esc(v)}</div>` : "";
    const items = parks.map(p => `<div class="parkCard">
        <div class="parkName">🅿 ${esc(p.name || "名前なし")}</div>
        ${line("料金", p.price)}${line("最大料金の決まり", p.rule)}${line("車の大きさ", p.size)}
        ${line("形", p.kind)}${line("予約制", p.reserve)}${line("連絡先", p.tel)}${line("メモ", p.memo)}
        <div class="note0">確認日：${esc(p.checked)}</div>
        ${Nav.links(p)}
      </div>`).join("");
    const first = parks[0];
    return `<details class="parks"><summary>🅿 駐車場 ${parks.length}か所${first.price ? "（" + esc(first.price) + (parks.length > 1 ? " ほか" : "") + "）" : ""}</summary>${items}${btn}</details>`;
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
        ${s.notes ? `<div class="notice">⚠ ${esc(s.notes).replace(/\n/g, "<br>⚠ ")}${s.notesChecked ? `<div class="note0">確認日：${esc(s.notesChecked)}</div>` : ""}</div>` : ""}
        ${callRow("入場", s.inTel, "in", s.id)}
        ${callRow("退場", s.outTel, "out", s.id)}
        ${navRow(s)}
        ${/^https:\/\//.test(s.kyUrl) ? `<a class="ky" href="${esc(s.kyUrl)}" target="_blank" rel="noopener">KYを開く</a>` : ""}
        ${parkRow(s)}
        <div class="tools">
          <button data-share="${esc(s.id)}">📋 貼る文をコピー</button>
          <button data-edit="${esc(s.id)}">直す</button>
          <button class="del" data-del="${esc(s.id)}">削除</button>
        </div>
      </section>`).join("");
    if (window.Status) window.Status.render();
  }

  async function copy(btn, text, label) {
    try { await navigator.clipboard.writeText(text); btn.textContent = "コピーしました"; }
    catch { btn.textContent = "コピーできません"; }
    setTimeout(() => btn.textContent = label, 1500);
  }

  // 貼る文をコピー：邸名ごとのLINEのトークに貼ってもらう
  async function shareSite(btn, site) {
    btn.textContent = await Share.copy(Share.notice(site)) ? "コピーしました。トークに貼ってください" : "コピーできません。もう一度押してください";
    setTimeout(() => btn.textContent = "📋 貼る文をコピー", 2500);
  }

  // 注意事項から入場の時刻を読む：「入場」と書いた行の「8時以降」「7:30以降」「8時半から」など。なければ null
  function entryTime(notes) {
    for (const line of String(notes || "").split("\n")) {
      const l = line.replace(/[０-９：]/g, c => c === "：" ? ":" : String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      const k = l.search(/入(?:退)?場/);
      if (k < 0) continue;
      const rest = l.slice(k).split(/[。．]/)[0]; // 「入場」より後ろの、同じ文の中だけを見る（別の時刻を取り違えないため）
      const m = rest.match(/(午後)?\s*(\d{1,2})\s*(?::\s*(\d{1,2})|時\s*(半|(\d{1,2})\s*分)?)\s*(?:以降|から|過ぎ|より後)/);
      if (!m) continue;
      const h = +m[2] + (m[1] && +m[2] < 12 ? 12 : 0), mi = m[3] ? +m[3] : m[4] === "半" ? 30 : m[5] ? +m[5] : 0;
      if (h <= 23 && mi <= 59) return { h, mi };
    }
    return null;
  }
  const hm = (h, mi) => `${h}:${String(mi).padStart(2, "0")}`;

  // 入場の電話：注意事項の時刻より前なら、かける前に一度だけ聞く（「キャンセル」なら電話も入場の記録もしない）
  // この見張りは status.js（入場の記録）より先に動く（list.js の方が先に読み込まれるため）
  listEl.addEventListener("click", e => {
    const a = e.target.closest('a[data-kind="in"]');
    if (!a) return;
    const site = Store.load().find(s => s.id === a.dataset.id);
    const t = site && entryTime(site.notes);
    if (!t) return;
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() >= t.h * 60 + t.mi) return;
    if (!confirm(`この現場は ${hm(t.h, t.mi)} 以降の入場です（注意事項）。\nいまは ${hm(now.getHours(), now.getMinutes())} です。\n\nそれでも入場の電話をかけますか？`)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });

  listEl.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.copy) return copy(b, b.dataset.copy, "コピー");
    const site = Store.load().find(s => s.id === (b.dataset.share || b.dataset.del || b.dataset.edit || b.dataset.park));
    if (!site) return;
    if (b.dataset.park) return Park.open(site.id);
    if (b.dataset.edit) return Editor.start(site);
    if (b.dataset.share) return shareSite(b, site);
    if (b.dataset.del && confirm(`「${site.name}」を削除しますか？\n元に戻せません。`)) {
      Store.remove(site.id);
      render();
    }
  });

  searchEl.addEventListener("input", render);
  render();
  return { render };
})();
