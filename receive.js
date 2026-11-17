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
  // 版45：リンクを短くする（#z=）。「LINEに貼ると長くて、ほかの話が流れてしまう」ため
  //  見出しの字（「入場：」など）を外して詰め（Share.pack）、さらに縮めて（deflate）から混ぜる。前の半分くらいの長さになる
  //  縮める仕組み（CompressionStream）が無い古い携帯では、前の形（#i=）で作る。#i= / #in= のリンクも今までどおり読める
  const canZip = typeof CompressionStream === "function" && typeof DecompressionStream === "function";
  async function pipe(u8, stream) {
    return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());
  }
  // アプリに入れるリンク（共有の文に入れる）。site を渡す
  async function link(site) {
    const base = `${location.origin}${location.pathname}`;
    if (canZip) {
      try { return `${base}#z=${b64(mix(await pipe(new TextEncoder().encode(JSON.stringify(Share.pack(site))), new CompressionStream("deflate-raw"))))}`; } catch {}
    }
    return `${base}#i=${enc(Share.toText(site))}`;
  }
  // リンクの #z= / #i= / #in= を探して現場を返す。リンクが無ければ null、読めなければ []
  async function fromLink(text) {
    const m = String(text || "").match(/#(z|in?)=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try {
      if (m[1] !== "z") return Share.parse(dec(m[2], m[1] === "i"));
      const t = new TextDecoder().decode(await pipe(mix(unb64(m[2])), new DecompressionStream("deflate-raw")));
      return Share.unpack(JSON.parse(t));
    } catch { return []; }
  }

  // 文の中から現場を探す。リンクをコピーしたときは、リンクの中を読む
  async function sitesFrom(text) {
    const r = await fromLink(text);
    return r === null ? Share.parse(text) : r;
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
        <div class="note0">${parks ? `駐車場 ${parks}か所もいっしょに入ります。` : ""}同じ現場が入っていれば、注意事項と駐車場を足し合わせます（送った人が消した物は消えます）。</div>
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
  async function fromHash() {
    if (/\bLine\//i.test(navigator.userAgent)) return;
    if (!/^#(z|in?)=/.test(location.hash)) return;
    const clear = () => history.replaceState(null, "", location.pathname + location.search.replace(/[?&]openExternalBrowser=1/, "").replace(/^&/, "?"));
    let sites = [];
    sites = await sitesFrom(location.hash);
    if (!sites.length) { clear(); View.show("list", "リンクから現場を読み取れませんでした（携帯が古いと読めないことがあります）。LINEの文をそのままコピーして「📥 仲間から届いた現場を入れる」を押してください。"); return; }
    ask(sites, clear);
  }

  // ② ボタン：コピーした文を読む（iPhoneは「ペースト」の吹き出しが出るので、それを押す）
  const btn = document.getElementById("receiveBtn");
  btn.addEventListener("click", async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch {}
    const sites = await sitesFrom(text);
    if (!sites.length) {
      View.show("list", "現場の文が見つかりませんでした。LINEで仲間の文を長押しして「コピー」を押してから、もう一度このボタンを押してください。");
      return;
    }
    ask(sites);
  });

  fromHash();
  return { link, sitesFrom };
})();
