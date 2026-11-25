// 版74：はじめて開いた人に、本物の画面で見本を見せる（「開いた時に、このアプリの良さが一目で分かるように」）
// 説明の枠や切り抜き写真は使わない（字が多いと伝わらない。アプリそのものを見せる）
// ・現場が1件も無いときに1回だけ、見本の現場を3件入れる（並ぶ様子が見える）。消したら二度と出さない
// ・LINEのリンクで開いたとき（#z= など）は入れない（届いた現場だけにするため）
// ・「練習邸」は説明書の「練習してみる」と同じ中身（場所と駐車場は本物、電話と注意事項は架空）。写真用にKYのボタンも付ける
// ・見本の現場には、毎日押す所に番号の札（①朝 ②KY ③帰り 🅿）を付ける
// ・見本の電話・KYは押してもかけない・開かない（「見本です」と出す）。入場を押すと、本物と同じく退場まだの赤い字が出る
// ・上の帯：「これ1つで、現場の朝と帰りが完了」＋「見本です。使うには現場の登録が必要」と［見本を消して始める］（見本を全部消す）
// ・版75：招待（LINEのリンク）で来た人・今使っている人には何も出さない。届いた現場が入るだけ（2026-11-26「情報がごちゃごちゃになって使いにくい。招待した人が使い方を教えてくれるはず」）
(() => {
  const KEY = "genba-sample-v1";
  const isSample = s => /^RS0000\d$/.test(String(s.code || ""));
  const site = (name, code, inTel, outTel, kyUrl, addr, lat, lng, notes, checked, routeLine, parks) =>
    [1, [name, code, inTel, outTel, kyUrl, addr, lat, lng, notes, checked, routeLine], parks || []];
  const DATA = [
    site("練習邸（れんしゅう・架空）", "RS00001", "0000-00-0000", "0000-00-0001", "https://nyujo.genba-benri.com/mihon-ky", "大阪府東大阪市高井田中4丁目3-3", 34.67573, 135.56882,
      "練習用の架空の現場（電話はつながりません。終わったら削除）\n入場は8時以降\n路上駐車禁止\n進入路 3t規制（それより重い車は入れない）\n進入路 時間規制（7時〜9時は車が通れない）\n近隣とトラブル中（あいさつ・駐車に注意）",
      "2026-11-15", "3467812,13556989,-267,-14,3,-119,25,2",
      [["タイムズ", "〒577-0066 大阪府東大阪市高井田本通２−５−２", "60分200円", "24時間最大500円", "", "", "", "", "", "", 34.670776, 135.566727, "2026-11-15"],
       ["オートバックス", "〒577-0066 大阪府東大阪市高井田本通４丁目２−４−２", "60分200円", "24時間最大500円", "", "", "", "", "", "", 34.67321, 135.566849, "2026-11-15"]]),
    site("青空邸（見本）", "RS00002", "0000-00-0010", "0000-00-0011", "", "", "", "", "", "", ""),
    site("若葉ビル（見本）", "RS00003", "0000-00-0020", "0000-00-0021", "", "", "", "", "", "", ""),
  ];

  let seen = false;
  try { seen = !!localStorage.getItem(KEY); } catch { return; }
  const fromLink = /^#(z|in?)=/.test(location.hash);
  // 版74で招待の人・今の人に出していた案内の残りを片付ける（版75でやめた）
  try { localStorage.removeItem("genba-tour-v1"); } catch {}
  if (!seen) {
    try { localStorage.setItem(KEY, "1"); } catch {}
    if (!fromLink && !Store.load().length) { DATA.forEach(d => { const s = Share.unpack(d)[0]; if (s) Store.upsert(s); }); List.render(); }
  }

  const list = document.getElementById("list");
  const samples = () => Store.load().filter(isSample);

  // 上の帯（見本があるときだけ）
  const HEAD = `<div class="sampleHead">これ<b>1つ</b>で、<br>現場の朝と帰りが<b>完了</b></div>`;
  const band = document.createElement("div");
  band.className = "sampleBand";
  list.parentNode.insertBefore(band, list);
  band.innerHTML = `${HEAD}👀 <b>見本です</b>（電話はつながりません）。押して試せます。<br>使うには<b>現場の登録</b>が必要（自分で入れる／仲間からLINEで届く）<button type="button" data-b="clear">見本を消して始める</button>`;
  band.addEventListener("click", e => {
    if (!e.target.closest("button[data-b=clear]")) return;
    samples().forEach(s => Store.remove(s.id));
    list.querySelectorAll(".mihonTag").forEach(x => x.remove());
    List.render("");
    update();
  });

  // 番号の札
  const tag = (el, text) => {
    if (!el || el.querySelector(":scope > .mihonTag")) return;
    el.classList.add("mihonRel");
    el.insertAdjacentHTML("afterbegin", `<span class="mihonTag">${text}</span>`);
  };
  function update() {
    const ss = samples();
    const mode = ss.length > 0;
    band.hidden = !mode;
    // 最初の案内の間は、上の見出し「現場入場アプリ」と「帰る・よく行く場所」の帯を隠し、その分を上に詰める（「最初の時は消えてもいい」）
    document.getElementById("listScreen").classList.toggle("firstTour", mode);
    ss.forEach(s => {
      const id = CSS.escape(s.id);
      const head = list.querySelector(`.cardHead[data-toggle="${id}"]`);
      if (!head) return;
      const card = head.closest(".card");
      if (!card.classList.contains("open")) { if (s.code === "RS00001") tag(head.querySelector(".arrow"), "👆 ここ"); return; }
      tag(card.querySelector(`a.call[data-kind="in"]`), "① 朝");
      tag(card.querySelector("a.ky"), "② 入場のあと");
      tag(card.querySelector(`a.call[data-kind="out"]`), "③ 帰り");
      tag(card.querySelector(".parkNavi"), "🅿 着く前に");
    });
  }
  new MutationObserver(update).observe(list, { childList: true });
  update();

  // 見本の電話・KYは、かけない・開かない（入場の記録はふつうどおり付くので、赤い字の知らせも見られる）
  let toastT;
  const toast = msg => {
    let t = document.querySelector(".mihonToast");
    if (!t) { t = document.createElement("div"); t.className = "mihonToast"; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500);
  };
  const sampleIds = () => new Set(samples().map(s => s.id));
  document.addEventListener("click", e => {
    const a = e.target.closest("a.call, a.ky, a.exitCall");
    if (!a) return;
    const id = a.dataset.id || a.dataset.exit || (a.closest(".card")?.querySelector(".cardHead")?.dataset.toggle);
    const fakeTel = /^tel:0000/.test(a.getAttribute("href") || ""); // 念のため：見本の番号には、どこから押してもかけない
    if (!(id && sampleIds().has(id)) && !fakeTel) return;
    e.preventDefault();
    if (a.classList.contains("ky")) return toast("見本のKYです。本物は、看板のQRのKYの画面が開きます。");
    if (a.dataset.kind === "in") {
      // 入場は、時刻の確認の枠を出さずに、入場の記録だけ付ける（赤い字を見せるため）
      e.stopImmediatePropagation();
      if (window.Status && Status.markIn) Status.markIn(id);
      return toast("見本の入場の電話です（本物はここで電話がかかります）。上に赤い字が出ます。");
    }
    toast("見本の退場の電話です（本物はここで電話がかかります）。赤い字が消えます。");
  }, true);
})();
