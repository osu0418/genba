// 仲間から届いた現場を入れる（版28）：携帯が苦手な人でも、押すだけで入るように
// ① LINEに貼られた「📲 押すとアプリに入ります」のリンクを押す → アプリが開いて「入れますか？」→「はい」
//    リンクの #i= のうしろに現場の文が入っている（# のうしろは公開の置き場に送られない）
//    iPhoneは「Webアプリとして開く」を切ってホーム画面に置くと、Safariと同じ保存場所になるので、リンクで入れた現場がアイコンからも見える（実機は未確認）
// ② 「📥 仲間から届いた現場を入れる」：LINEで文を長押し→コピーしてから押す → 「入れますか？」→「はい」
const Receive = (() => {
  // 版30：リンクの中身は、ぱっと見て読めないよう混ぜてから入れる（#i=）。鍵はアプリの中にあるので、
  // アプリを持っていない人がLINEで見ても電話番号などは分からない（ただし、詳しい人が調べれば読める。鍵のかかった金庫ほど強くはない）
  // 版28・29のリンク（#in=。混ぜていない）も読める
  const KEY = new TextEncoder().encode("genba-nyujo-2026");
  const mix = u8 => u8.map((v, i) => v ^ KEY[i % KEY.length] ^ (i * 31 & 255));
  const b64 = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64 = b => Uint8Array.from(atob(b.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const enc = t => b64(mix(new TextEncoder().encode(t)));
  const dec = (b, mixed) => new TextDecoder().decode(mixed ? mix(unb64(b)) : unb64(b));
  // アプリに入れるリンク（共有の文に入れる）
  const link = text => `${location.origin}${location.pathname}#i=${enc(text)}`;
  // リンクの #i= / #in= を探して中の文を返す。無ければ null
  function fromLink(text) {
    const m = String(text || "").match(/#(in?)=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try { return dec(m[2], m[1] === "i"); } catch { return ""; }
  }

  // 文の中から現場を探す。リンクをコピーしたときは、リンクの中の文を読む
  function sitesFrom(text) {
    const t = fromLink(text);
    return Share.parse(t === null ? text : t);
  }

  // 「入れますか？」の枠（スマホに元からある確認の窓より文字を大きく、押しやすく）
  function ask(sites, done) {
    document.getElementById("receiveAsk")?.remove();
    const box = document.createElement("div");
    box.id = "receiveAsk";
    box.className = "receiveAsk";
    const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const names = sites.map(s => `「${esc(s.name)}」`).join("<br>");
    const parks = sites.reduce((n, s) => n + (s.parks || []).length, 0);
    box.innerHTML = `<div class="receiveCard">
        <div class="receiveTitle">📥 仲間から届いた現場</div>
        <div class="receiveNames">${names}</div>
        <div class="note0">${parks ? `駐車場 ${parks}か所もいっしょに入ります。` : ""}同じ現場が入っていれば、新しい方に直します。</div>
        <button type="button" class="main" data-r="yes">はい、アプリに入れる</button>
        <button type="button" class="receiveNo" data-r="no">いいえ</button>
      </div>`;
    box.addEventListener("click", e => {
      const b = e.target.closest("button[data-r]");
      if (!b) return;
      box.remove();
      if (b.dataset.r === "yes") {
        const msg = sites.map(s => `「${s.name}」を${Store.upsert(s)}`).join("\n") + "しました。";
        View.show("list", msg);
      }
      if (done) done();
    });
    document.body.appendChild(box);
  }

  // ① リンクで開いたとき（LINEの中では開き直しが先なので、何もしない）
  function fromHash() {
    if (/\bLine\//i.test(navigator.userAgent)) return;
    if (!/^#in?=/.test(location.hash)) return;
    const clear = () => history.replaceState(null, "", location.pathname + location.search.replace(/[?&]openExternalBrowser=1/, "").replace(/^&/, "?"));
    let sites = [];
    sites = sitesFrom(location.hash);
    if (!sites.length) { clear(); View.show("list", "リンクから現場を読み取れませんでした。LINEの文をそのままコピーして「📥 仲間から届いた現場を入れる」を押してください。"); return; }
    ask(sites, clear);
  }

  // ② ボタン：コピーした文を読む（iPhoneは「ペースト」の吹き出しが出るので、それを押す）
  const btn = document.getElementById("receiveBtn");
  btn.addEventListener("click", async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch {}
    const sites = sitesFrom(text);
    if (!sites.length) {
      View.show("list", "現場の文が見つかりませんでした。LINEで仲間の文を長押しして「コピー」を押してから、もう一度このボタンを押してください。");
      return;
    }
    ask(sites);
  });

  fromHash();
  return { link, sitesFrom };
})();
