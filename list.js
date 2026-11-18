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
      <button class="copy helperOnly" data-copy="${esc(num)}">コピー</button>
    </div>`;
  }

  // 住所とナビのボタン（ボタンの作り方は nav.js）
  // 版56：ナビは大きいボタン1つ「🚗 現場へナビ」。迷わないように
  //  進入路がある現場：押すと進入路の地図（赤い線・理由・規制）→「この道でナビ開始」（駐車場と同じ「見てから行く」流れ）
  //  ない現場：押すとすぐナビ（iPhoneはマップ、それ以外はGoogleマップ）。ほかの地図は下に小さく
  function navRow(s) {
    if (!Nav.has(s)) return "";
    const where = s.addr ? `住所：${esc(s.addr)}` : "住所：（なし）";
    const addr = `<div class="addr">${where}${Nav.hasPoint(s) ? (s.addrPt ? "　📍住所から出した場所（だいたい）" : "") : ""}</div>`;
    if (RouteMap.has(s)) {
      return `<button type="button" class="goSite" data-route="${esc(s.id)}">🚗 現場へナビ<span class="sub">🚧 進入路あり：先に通る道を見る</span>${s.routeWhy ? `<span class="why">${esc(s.routeWhy)}</span>` : ""}</button>${addr}`;
    }
    const to = s.inTel || s.outTel ? "現場" : esc(s.name); // 版65：電話の無い物（資材置き場など）は名前で
    return Nav.go(s, `🚗 ${to}へナビ<span class="sub">${Nav.isIOS ? "iPhoneのマップ" : "Googleマップ"}で道案内</span>`, "goSite") + addr + Nav.alt(s);
  }

  // 駐車場（版34・39・40）：携帯が苦手な人は「押すだけ」。登録してある駐車場を、現場から近い順に①②③で出す
  //  押すと駐車場を見る画面（地図・距離・料金）→「ここにする」でナビ（parkview.js）
  //  「🔍 近くを探す」は制作する人（🔧）のときだけ。版67：駐車場の追加・手直し・貼る文は、みんなに出す（「個人個人で直せるように」）
  function parkRow(s) {
    const parks = ParkView.sorted(s);
    const find = Nav.parkSearch(s, parks.length ? "🔍 近くのほかの駐車場を探す" : "🔍 近くの駐車場を探す", "parkFind helperOnly");
    if (!parks.length) {
      return `${find}<button type="button" class="parkBtn small parkAddInline" data-park="${esc(s.id)}">🅿 駐車場を登録（駐車場に着いてから）</button>`;
    }
    const nums = ["①", "②", "③"];
    const gos = parks.slice(0, 3).map((p, i) => {
      const d = ParkView.short(s, p);
      return `<button type="button" class="parkNavi" data-pview="${esc(s.id)}" data-pid="${esc(p.id)}">🅿 駐車場${parks.length > 1 ? " " + nums[i] : ""}`
        + `<span class="sub">${esc(ParkView.label(p))}</span>${d ? `<span class="sub">現場まで${d}</span>` : ""}`
        + (() => { const f = ParkView.maxFee(p); return `<span class="maxTag ${f.ok && !f.todayNone ? "ok" : "ng"}">${f.ok ? esc(f.text) + (f.except ? (f.todayNone ? "（今日はなし）" : `（${esc(f.except)}なし）`) : "") : f.none ? esc(f.text) : "最大料金 ？"}</span>`; })()
        + `</button>`;
    }).join("");
    const line = (label, v) => v ? `<div>${label}：${esc(v)}</div>` : "";
    const items = parks.map((p, i) => `<div class="parkCard">
        <div class="parkName">${i < 3 ? nums[i] : "🅿"} ${esc(ParkView.label(p))}</div>
        ${line("料金", p.price)}${line("決まり", p.rule)}${line("車の大きさ", p.size)}
        ${line("形", p.kind)}${line("予約制", p.reserve)}${line("連絡先", p.tel)}${line("メモ", p.memo)}
        <div class="note0">確認日：${esc(p.checked)}</div>
        ${Nav.links(p)}
      </div>`).join("");
    const btn = `<button type="button" class="parkBtn small" data-park="${esc(s.id)}">🅿 駐車場を足す・直す</button>`;
    // 版66：「近くのほかの駐車場を探す」の代わりに「駐車場を追加」（探すのは追加の画面の中にある）
    //  その現場だけの画面のときは、右下に浮かせた「＋ 駐車場を追加」を使うので、この欄は隠す（parkAddInline）
    const add = `<button type="button" class="parkBtn small parkAddInline" data-park="${esc(s.id)}">🅿 駐車場を追加</button>`;
    return `<div class="parkGo${parks.length > 1 ? " many" : ""}">${gos}</div>${add}
      <details class="parks"><summary>料金・ほかの駐車場（${parks.length}か所${parks[0].price ? "　" + esc(parks[0].price) : ""}）</summary>${items}${btn}</details>`;
  }

  // 版56：カードをたたむ（「10件ぐらい現場が重なる」「これだけ長いと探しにくい」）
  //  たたんだ形：版66から邸名だけ（「どの道開いて、朝の電話とKYを同時にするので、邸名だけで分かった方がいい」）。邸名を押すと開く（開くのは1件ずつ）
  //  版68：邸名の下に住所を小さく1行（「店名が出てこずに住所で覚えている人がいます」）。開いた現場は下に住所があるので出さない
  //  今日入場の電話をした現場は一番上に出す（版66から、開くのは押したときだけ）
  //  版66：開くと、その現場だけの画面にする（倉庫・自宅の帯なども隠す。退場がまだの赤い字だけは残す）。「← ほかの現場も見る」か「とじる」で戻る
  let chosen = null; // 人が開いた・閉じた現場（null：まだ選んでいない → 今日の現場を開く。"" ：全部閉じた）
  let lastCount = -1;
  function render(openNow) {
    if (typeof openNow === "string") chosen = openNow;
    const all = Store.load();
    const q = norm(searchEl.value);
    const seen = window.Status && Status.todayIn ? Status.todayIn() : {};
    // 版65：電話の無い物（資材置き場など）は、現場の下にまとめる（朝の現場の一覧が長くならないように）
    const noTel = s => !s.inTel && !s.outTel;
    const sites = all.filter(s => !q || norm(s.name).includes(q) || norm(s.code).includes(q))
      .sort((a, b) => noTel(a) - noTel(b) || (seen[b.id] || 0) - (seen[a.id] || 0) || a.name.localeCompare(b.name, "ja"));
    // 開く現場：人が選んだもの → 今日の現場 → 1件だけならそれ
    // 版66：今日の現場も自動では開かない（退場がまだなら上の赤い字に電話番号が出るため）
    const openId = chosen !== null ? chosen : (sites.length === 1 ? sites[0].id : "");
    const isOpen = s => s.id === openId || (sites.length === 1 && chosen === null);
    // 現場が入ったら「使い方」を閉じる（入れた現場が下に押しやられないように）
    if (lastCount === 0 && all.length) { const h = document.getElementById("help"); if (h) h.open = false; }
    lastCount = all.length;

    if (!all.length) statusEl.textContent = "まだ現場がありません。下の「現場を追加」から入れてください。";
    else if (!sites.length) statusEl.textContent = `「${searchEl.value}」に合う現場がありません。`;
    else statusEl.textContent = q ? `${sites.length}件見つかりました` : `現場 ${all.length}件`;

    const solo = sites.some(isOpen) && sites.length > 1; // 1件だけのときは、前のまま全部出す
    listEl.classList.toggle("solo", solo);
    document.getElementById("listScreen").classList.toggle("solo", solo);
    // 版66：その現場だけの画面では、右下の「＋ 現場を追加」の代わりに「＋ 駐車場を追加」を浮かせる（登録する人の表示のときだけ）
    const pf = document.getElementById("parkAddFab");
    pf.hidden = !solo;
    pf.dataset.park = solo ? (sites.find(isOpen) || {}).id || "" : "";
    listEl.innerHTML = (solo ? `<button type="button" class="back soloBack" data-toggle="">← ほかの現場も見る（${sites.length - 1}件）</button>` : "") + sites.map(s => `
      <section class="card${isOpen(s) ? " open" : ""}${seen[s.id] ? " today" : ""}">
        <button type="button" class="cardHead" data-toggle="${esc(s.id)}">
          <span class="name">${esc(s.name)}${!isOpen(s) && s.addr ? `<span class="headAddr">${esc(s.addr)}</span>` : ""}</span>${seen[s.id] ? `<span class="todayTag">今日</span>` : ""}
          <span class="arrow">${isOpen(s) ? "▲ とじる" : "▼ 開く"}</span>
        </button>
        ${NoteChips.html(s)}
        ${s.inTel || s.outTel ? `<div class="calls">${s.inTel ? callRow("入場", s.inTel, "in", s.id) : ""}${s.outTel ? callRow("退場", s.outTel, "out", s.id) : ""}</div>` : ""}
        <div class="cardMore">
          ${s.code ? `<div class="code">現場番号：${esc(s.code)}</div>` : ""}
          ${navRow(s)}
          ${/^https:\/\//.test(s.kyUrl) ? `<a class="ky" href="${esc(s.kyUrl)}" target="_blank" rel="noopener">KYを開く</a>` : ""}
          ${parkRow(s)}
          <div class="tools">
            <button data-share="${esc(s.id)}">📋 貼る文をコピー</button>
            <button data-edit="${esc(s.id)}">手直し</button>

            <button class="del" data-del="${esc(s.id)}">削除</button>
          </div>
          <div class="tools helperOnly">
            <button data-edit="${esc(s.id)}" data-focus="notes">⚠ 注意事項</button>
            <button data-edit="${esc(s.id)}" data-focus="route">🚧 進入路を決める</button>
          </div>
        </div>
      </section>`).join("");
    if (window.Status) window.Status.render();
    fillPoints(all);
  }

  // 現場に住所はあるが📍（地図の場所）が無いとき、住所から場所を探して入れる（版44）
  // 「駐車場を登録しても距離が出ない」のは、現場の場所が無いため。押すだけの人が何もしなくても距離が出るように
  // 1つの現場につき、開いている間に1回だけ探す（見つからない住所で何度も調べないため）
  const tried = new Set();
  async function fillPoints(all) {
    if (typeof MapPick === "undefined" || !MapPick.geocode) return; // const で作った部品は window に乗らないため typeof で見る
    let got = false;
    for (const s of all) {
      if (Nav.hasPoint(s) || !s.addr || tried.has(s.id)) continue;
      tried.add(s.id);
      const r = await MapPick.geocode(s.addr);
      if (r === "net") { tried.delete(s.id); break; } // 電波が無いときは、次に開いたときにまた探す
      if (r && Store.setSitePoint(s.id, r.lat, r.lng)) got = true;
    }
    if (got) render();
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

  // 入場の電話：注意事項の時刻より前なら、かける前に一度だけ聞く（「やめる」なら電話も入場の記録もしない）
  // スマホに元からある確認の窓（confirm）を使うと、OKのあとの電話をiPhoneが「サイトが勝手にかけた」と見なして
  // 「通話の自動開始がブロックされています」を出す。なので、アプリの中の枠を出し、その中の電話ボタンを指で押してもらう
  // この見張りは status.js（入場の記録）より先に動く（list.js の方が先に読み込まれるため）
  document.getElementById("parkAddFab").addEventListener("click", e => {
    const id = e.currentTarget.dataset.park;
    if (id && Store.load().some(s => s.id === id)) Park.open(id);
  });

  listEl.addEventListener("click", e => {
    const a = e.target.closest('a[data-kind="in"]');
    if (!a) return;
    const site = Store.load().find(s => s.id === a.dataset.id);
    const t = site && entryTime(site.notes);
    if (!t) return;
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() >= t.h * 60 + t.mi) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    askEarly(site, a.getAttribute("href"), t, now);
  });

  function askEarly(site, href, t, now) {
    const old = document.getElementById("earlyAsk");
    if (old) old.remove();
    const box = document.createElement("div");
    box.id = "earlyAsk";
    box.className = "earlyBack";
    box.innerHTML =
      `<div class="earlyBox" role="dialog" aria-modal="true">` +
        `<p class="earlyText">⚠ <b>${esc(site.name)}</b>は <b>${hm(t.h, t.mi)} 以降</b>の入場です（注意事項）。<br>いまは ${hm(now.getHours(), now.getMinutes())} です。</p>` +
        `<a class="call earlyCall" href="${esc(href)}">📞 それでも入場に電話</a>` +
        `<button type="button" class="earlyNo">やめる</button>` +
      `</div>`;
    const close = () => box.remove();
    box.addEventListener("click", e => {
      if (e.target === box || e.target.closest(".earlyNo")) return close();
      if (e.target.closest(".earlyCall")) {
        // 電話はリンクでそのままかかる（指で押した電話なので止められない）。こちらは入場の記録と、枠を閉じるだけ
        if (window.Status && Status.markIn) Status.markIn(site.id);
        setTimeout(close, 0);
      }
    });
    document.body.appendChild(box);
  }

  listEl.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.toggle !== undefined) { // 版56：邸名を押すと開く・閉じる
      const card = b.closest(".card");
      const closing = !card || card.classList.contains("open");
      render(closing ? "" : b.dataset.toggle);
      // 版66：開くとその現場だけの画面になるので上から見せる。閉じたら、閉じた現場の所へ
      if (!closing) { window.scrollTo(0, 0); return; }
      const c2 = card && [...listEl.querySelectorAll("[data-toggle]")].find(x => x.dataset.toggle === b.dataset.toggle);
      if (c2) c2.scrollIntoView({ block: "center" }); else window.scrollTo(0, 0);
      return;
    }
    if (b.dataset.copy) return copy(b, b.dataset.copy, "コピー");
    if (b.dataset.pview) return ParkView.show(b.dataset.pview, b.dataset.pid);
    if (b.dataset.route) return RouteMap.show(b.dataset.route);
    const site = Store.load().find(s => s.id === (b.dataset.share || b.dataset.del || b.dataset.edit || b.dataset.park));
    if (!site) return;
    if (b.dataset.park) return Park.open(site.id);
    if (b.dataset.edit) return Editor.start(site, b.dataset.focus); // 版67：注意事項・進入路は制作する人だけ（focus でその所を開く）
    if (b.dataset.share) return shareSite(b, site);
    if (b.dataset.del && confirm(`「${site.name}」を削除しますか？\n元に戻せません。`)) {
      Store.remove(site.id);
      render();
    }
  });

  searchEl.addEventListener("input", render);
  render();
  window.addEventListener("load", () => { render(); fillPoints(Store.load()); }); // 版56：status.js が読まれてから並べ直す（今日の現場を上に） // 地図の部品（mappick.js）は list.js より後に読まれるため
  return { render };
})();
