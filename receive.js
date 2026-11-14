// 仲間から届いた現場を入れる（版28）：携帯が苦手な人でも、押すだけで入るように
// ① LINEに貼られた「📲 押すとアプリに入ります」のリンクを押す → アプリが開いて「入れますか？」→「はい」
//    リンクの #in= のうしろに現場の文が入っている（# のうしろは公開の置き場に送られない）
//    iPhoneは「Webアプリとして開く」を切ってホーム画面に置くと、Safariと同じ保存場所になるので、リンクで入れた現場がアイコンからも見える（実機は未確認）
// ② 「📥 仲間から届いた現場を入れる」：LINEで文を長押し→コピーしてから押す → 「入れますか？」→「はい」
const Receive = (() => {
  const enc = t => btoa(String.fromCharCode(...new TextEncoder().encode(t))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const dec = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)));
  // アプリに入れるリンク（共有の文に入れる）
  const link = text => `${location.origin}${location.pathname}#in=${enc(text)}`;

  // 文の中から現場を探す。リンクをコピーしたときは、リンクの中の文を読む
  function sitesFrom(text) {
    const m = String(text || "").match(/#in=([A-Za-z0-9_-]+)/);
    if (m) { try { return Share.parse(dec(m[1])); } catch { return []; } }
    return Share.parse(text);
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
    const m = location.hash.match(/^#in=([A-Za-z0-9_-]+)/);
    if (!m) return;
    const clear = () => history.replaceState(null, "", location.pathname + location.search.replace(/[?&]openExternalBrowser=1/, "").replace(/^&/, "?"));
    let sites = [];
    try { sites = Share.parse(dec(m[1])); } catch {}
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
  return { link };
})();
