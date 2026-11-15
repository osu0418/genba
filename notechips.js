// 注意事項の札（版56）：「注意事項が多すぎるとそれ自体が邪魔になる。一つ一つが長いとページが長くなる」
// ・1行の注意を5〜8字くらいの短い札にして全部並べる（全部「ある」と一目で分かる）
// ・入場時刻・規制・駐車禁止・許可証は赤い札（見落とすと実害があるもの）
// ・札を押すと、元の長い文が全部出る（もう一度押すと閉じる）
// ・定型文（「現場を追加」のよく使う言葉のボタン）は決まった短い形に、手で打った文は頭の8字で切る
const NoteChips = (() => {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  // 全角の数字・記号をふつうの形に（「８時」「３ｔ」も読めるように）
  const half = s => String(s).normalize("NFKC");
  const T = "(\\d{1,2}(?::\\d{2}|時半?(?:\\d{1,2}分)?))";
  const range = l => { const m = l.match(new RegExp(T + "\\s*[〜~ー-]\\s*" + T)); return m ? `${m[1]}〜${m[2]}` : ""; };
  const SECRET = /近隣|近所|トラブル|苦情|クレーム|揉め|もめ|住人|施主|さん|様|隣|向かい|宅|番地/;

  // [見分け方, 札の字を作る, 赤くするか]。上から順に見て、最初に合ったもの
  const RULES = [
    [/入(退)?場/, l => { const m = l.match(new RegExp(T + "\\s*(以降|から|過ぎ)")); return m ? `⏰入場${m[1]}${m[2] === "から" ? "から" : "以降"}` : ""; }, true],
    [/通学路/, l => `🚸通学路${range(l)}`, true],
    [/(\d+(?:\.\d+)?)\s*(t|ｔ|トン)\s*規制|規制.*?(\d+(?:\.\d+)?)\s*(t|トン)/i, l => { const m = l.match(/(\d+(?:\.\d+)?)\s*(?:t|トン)/i); return `🚛${m ? m[1] + "t" : ""}規制`; }, true],
    [/時間規制|通れない|通行止/, l => `⏰${range(l) || "時間"}通行止`, true],
    [/許可/, () => "📄許可証が要る", true],
    [/進入路.*指定|から入る/, l => { const m = l.match(/[（(](.{1,8}?)から入る/); return `🚧${m && !/〇/.test(m[1]) ? m[1] + "から入る" : "進入路の指定"}`; }, false],
    [/路上駐車|路駐|駐車禁止/, () => "🚫路駐禁止", true],
    [/(\d+)\s*台まで/, l => `🚗${l.match(/(\d+)\s*台まで/)[1]}台まで`, false],
    [/騒音/, l => { const m = l.match(new RegExp(T + "\\s*まで")); return `🔇騒音${m ? m[1] + "まで" : "注意"}`; }, false],
    [SECRET, () => "⚠近隣・要確認", false],
  ];

  // 1行 → { t: 札の字, red: 赤いか }
  function chip(line) {
    const l = half(line).trim();
    for (const [re, make, red] of RULES) {
      if (re.test(l)) { const t = make(l); if (t) return { t, red }; }
    }
    // 手で打った文：かっこの中を外して、頭の8字
    const b = l.replace(/[（(][^）)]*[）)]/g, "").trim() || l;
    return { t: "⚠" + (b.length > 10 ? b.slice(0, 10) + "…" : b), red: false };
  }

  // カードに出す形：札を並べ、押すと全文の箱が開く
  function html(s) {
    const lines = String(s.notes || "").split("\n").map(x => x.trim()).filter(Boolean);
    if (!lines.length) return "";
    const cs = lines.map(chip);
    // 赤い札を先に（見落とすと困るもの）
    const order = cs.map((c, i) => ({ c, i })).sort((a, b) => (b.c.red - a.c.red) || (a.i - b.i));
    return `<div class="nchips" data-nchips="${esc(s.id)}">${order.map(({ c }) => `<button type="button" class="nchip${c.red ? " red" : ""}" data-nfull="${esc(s.id)}">${esc(c.t)}</button>`).join("")}`
      + `<button type="button" class="nchip more" data-nfull="${esc(s.id)}">全文</button></div>`
      + `<div class="notice nfull" id="nfull-${esc(s.id)}" hidden>⚠ ${lines.map(esc).join("<br>⚠ ")}${s.notesChecked ? `<div class="note0">確認日：${esc(s.notesChecked)}</div>` : ""}</div>`;
  }

  // 札を押したら全文を開く・閉じる（カードを開く・閉じるのとは別）
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-nfull]");
    if (!b) return;
    e.stopPropagation();
    const box = document.getElementById("nfull-" + b.dataset.nfull);
    if (box) box.hidden = !box.hidden;
  }, true);

  return { chip, html };
})();
