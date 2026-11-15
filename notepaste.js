// まとめた注意事項を貼る（版57）：「現場監督用に現場の注意事項をまとめて書いた分を、アプリに貼り付けるだけで注意事項に記入できる仕組み」
// 現場監督の書き方はまだ分からないので、よくある書き方を全部受ける：
//  ・1行に1つ ・頭に「・」「-」「1.」「①」「■」などの印 ・「。」で続けた1段落 ・空の行や「注意事項」などの見出しは外す
// 入れる前に「この〇つを入れます」と並べて見せ、「入れる」を押したときだけ注意事項の欄に足す（崩れていたらやめられる）
const NotePaste = (() => {
  const MARK = /^\s*(?:[・･\-－‐ー―*＊•●○◯■□◆◇▲△▼▽★☆※→⇒>＞]+|\(?[0-9０-９]{1,2}[.．、)）:]|[①-⑳]|[（(][0-9０-９]{1,2}[)）]|[一二三四五六七八九十]{1,2}[、.．])\s*/;
  const HEAD = /^(?:注意事項|注意点|注意|お願い|連絡事項|連絡|現場の?注意事項?|【.*】|〈.*〉|<.*>|以上.*|お疲れ様です|おつかれさまです|お世話になっております|お世話になります|注意事項(です|になります|を送ります)|.*よろしくお願い(します|いたします|致します).*)[:：]?$/;

  function split(text) {
    // 1行の途中にある「②」「③」の前で行を分ける（「①入場は8時以降②駐車禁止」）
    const lines = String(text || "").replace(/\r/g, "").replace(/(.)([②-⑳])/g, "$1\n$2").split("\n");
    const out = [];
    for (let raw of lines) {
      let l = raw.trim();
      if (!l) continue;
      const marked = MARK.test(l);
      l = l.replace(MARK, "").trim();
      if (!l || HEAD.test(l)) continue;
      // 印の無い行が、前の行の続き（前が「。」で終わらず、この行が短い・ひらがなで始まる）なら、つなげる
      if (!marked && out.length && !/[。．！!？?]$/.test(out[out.length - 1]) && /^[、）)をにはがでとのもへやより]/.test(l)) {
        out[out.length - 1] += l; continue;
      }
      // 印のついた行は、「。」があっても1つの注意として残す（「3トン規制あり。北側から入る」）
      if (marked) { const t = l.replace(/[。．]$/, "").trim(); if (t && !HEAD.test(t)) out.push(t); continue; }
      // 印の無い行で「。」でいくつも続いていたら、「。」で分ける（かっこの中の「。」では分けない）
      const parts = [];
      let buf = "", depth = 0;
      for (const ch of l) {
        buf += ch;
        if (/[（(「『]/.test(ch)) depth++;
        if (/[）)」』]/.test(ch)) depth = Math.max(0, depth - 1);
        if (/[。．]/.test(ch) && depth === 0) { parts.push(buf); buf = ""; }
      }
      if (buf.trim()) parts.push(buf);
      for (const p of parts) {
        const t = p.trim().replace(/[。．]$/, "").trim();
        if (t && !HEAD.test(t)) out.push(t);
      }
    }
    // 同じ文は1つに
    return [...new Set(out)].slice(0, 20);
  }

  // 「直す」の注意事項の欄に、貼る箱を付ける
  function setup() {
    const notes = document.getElementById("notesText");
    const btn = document.getElementById("notePasteBtn");
    const box = document.getElementById("notePasteBox");
    if (!notes || !btn || !box) return;
    const area = box.querySelector("textarea");
    const prev = box.querySelector(".npPrev");
    const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    let items = [];
    const show = () => {
      items = split(area.value);
      prev.innerHTML = !items.length ? "" :
        `<div class="npHead">この${items.length}つを注意事項に入れます</div>`
        + `<ol>${items.map(t => `<li><span class="nchip${NoteChips.chip(t).red ? " red" : ""}">${esc(NoteChips.chip(t).t)}</span> ${esc(t)}</li>`).join("")}</ol>`
        + `<button type="button" class="main npGo">入れる</button>`;
    };
    btn.addEventListener("click", () => { box.hidden = !box.hidden; if (!box.hidden) area.focus(); });
    area.addEventListener("input", show);
    box.addEventListener("click", e => {
      if (e.target.closest(".npCancel")) { area.value = ""; show(); box.hidden = true; return; }
      if (!e.target.closest(".npGo")) return;
      const have = notes.value.split("\n").map(x => x.trim()).filter(Boolean);
      notes.value = [...new Set(have.concat(items))].join("\n"); // 前からある注意は残し、同じ文は足さない
      area.value = ""; show(); box.hidden = true;
      btn.textContent = `✅ ${items.length}つ入れました（保存を押すと決まります）`;
      setTimeout(() => btn.textContent = "📋 まとめた文を貼る（現場監督の注意事項など）", 3500);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup); else setup();

  return { split };
})();
