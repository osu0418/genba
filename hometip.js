// 版77：LINEのリンクから開いた人に、下から「ホーム画面に置く」吹き出しを出す（2026-11-28「ア」。ゲームアプリの吹き出しを見て）
// ・iPhone/iPad と Android で手順を変える。パソコンには出さない
// ・ボタン1つで置くことはできない（iPhoneは仕組みで不可。Androidのmanifestは版59で入れないと決めた）ので、手順を見せる
// ・iPhoneは「Webアプリとして開く」を灰色にして置く（入れたまま置くと、LINEで届いた現場がアイコンに出ない。版60）
// ・LINEから来た印（?openExternalBrowser=1）が付いているときだけ出す。出したら印を外す（このまま置いたアイコンからは、次から出ない）
// ・［×］で閉じたら7日休む。［もう置いた］で二度と出さない
// ・はじめての「ご利用について」や、届いた現場の確認が出ているときは出さない
// ・iPhoneのGoogleアプリ（白地にG）で開いた人：ホーム画面に追加が無い（2026-11-28「いくら探してもなかった」）→［Safariで開く］へ誘導（LINEの印が無くても出す）
// ・iPhoneのChromeなど、Safari以外のブラウザには出さない（手順が違い、確かめられていないため）
(() => {
  const KEY = "genba-hometip-v1";
  const ua = navigator.userAgent;
  if (/\bLine\//i.test(ua)) return;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  if (!ios && !android) return;
  const gapp = ios && /\bGSA\//.test(ua); // iPhoneのGoogleアプリ
  if (ios && !gapp && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return;
  if (navigator.standalone === true || matchMedia("(display-mode: standalone)").matches) return;
  if (!gapp && new URLSearchParams(location.search).get("openExternalBrowser") !== "1") return;
  if (/^#(z|in?)=/.test(location.hash)) return; // 届いた現場を入れる確認が出るとき
  try {
    if (!localStorage.getItem("genba-oshirase-v1")) return; // はじめての「ご利用について」が先
    const v = localStorage.getItem(KEY);
    if (v === "done") return;
    if (v && Date.now() - Number(v) < 7 * 864e5) return;
  } catch { return; }

  const steps = ios
    ? `<li><span class="htIcon">⬆︎</span><b>共有ボタン</b>（四角から上に矢印）を押す</li>
       <li><span class="htIcon">＋</span><b>ホーム画面に追加</b>を押す</li>
       <li><b>「Webアプリとして開く」を灰色</b>にして<b>追加</b>
         <img src="guide/5_toggle.jpg?v=2" alt="「Webアプリとして開く」を灰色にして、追加を押す"></li>`
    : `<li><span class="htIcon">⋮</span>右上の<b>点3つ</b>を押す</li>
       <li><span class="htIcon">＋</span><b>ホーム画面に追加</b> →<b>追加</b>を押す</li>`;

  const home = `${location.origin}/`;
  const gappHtml = () => {
    let n = 0; try { n = Store.load().length; } catch {}
    return `
      <div class="htHead"><span>Safariで開いてください</span><button type="button" class="htClose" aria-label="閉じる">×</button></div>
      <p class="htLead">いまは<b>Googleアプリ</b>の中で開いています。ここでは<b>ホーム画面に置けません</b>。</p>
      <a class="htSafari" href="x-safari-${home}?openExternalBrowser=1">Safariで開く</a>
      <button type="button" class="htCopy">開かないとき：アドレスをコピー</button>
      <p class="htSub">Safariで開いたら、もう一度この案内が出ます（ホーム画面に置く手順）。${n ? `<br>※ここで入れた現場はSafariには移りません。<b>📋 貼る文をコピー</b>でLINEに送り、Safariで開いてから押すと入ります。` : ""}</p>
      <button type="button" class="htDone">このままでいい（もう出さない）</button>`;
  };

  function show() {
    const box = document.createElement("div");
    box.id = "homeTip";
    box.innerHTML = gapp ? gappHtml() : `
      <div class="htHead"><span>ホーム画面に置く</span><button type="button" class="htClose" aria-label="閉じる">×</button></div>
      <p class="htLead">置いておくと、明日からは<b>LINEを探さず</b>、アイコン1つで開けます。</p>
      <ol class="htSteps">${steps}</ol>
      <button type="button" class="htDone">もう置いた（もう出さない）</button>`;
    document.body.appendChild(box);
    // LINEから来た印を外す（このあと置いたアイコンを開いても、この吹き出しが出ないように）
    try { history.replaceState(history.state, "", location.pathname + location.search.replace(/[?&]openExternalBrowser=1/, "").replace(/^&/, "?") + location.hash); } catch {}
    const close = val => { try { localStorage.setItem(KEY, val); } catch {} box.remove(); };
    box.querySelector(".htClose").addEventListener("click", () => close(String(Date.now())));
    box.querySelector(".htDone").addEventListener("click", () => close("done"));
    const cp = box.querySelector(".htCopy");
    if (cp) cp.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(home); cp.textContent = "コピーしました。Safariを開き、アドレスの所に貼ってください"; }
      catch { cp.textContent = home; }
    });
  }
  // 開いてすぐ（開いた回数の数え）が済んでから出す
  window.addEventListener("load", () => setTimeout(show, 1500));
})();
