// 画面の切り替え：「一覧」「現場の入力」「倉庫・自宅の入力」のどれか1つだけを出す
// 入力の間は、上の探す欄・赤い字・帰るの帯を出さない（入力しやすくするため）
const View = (() => {
  const screens = {
    list: document.getElementById("listScreen"),
    add: document.getElementById("addScreen"),
    home: document.getElementById("homeScreen"),
    park: document.getElementById("parkScreen"),
  };
  const flash = document.getElementById("flash");
  const backFns = [];
  let cur = "list", timer = 0;

  // msg：一覧に戻ったとき、上に一言出す（「〇〇を追加しました」など）
  function show(name, msg) {
    for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
    cur = name;
    window.scrollTo(0, 0);
    if (name === "list") {
      List.render();
      clearTimeout(timer);
      flash.hidden = !msg;
      flash.textContent = msg || "";
      if (msg) timer = setTimeout(() => { flash.hidden = true; }, 5000);
    }
  }

  // 「← 一覧に戻る」を押したときに、各画面でやること（入力の片付けなど）を足せる
  const onBack = fn => backFns.push(fn);
  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => {
    backFns.forEach(fn => fn(cur));
    show("list");
  }));
  document.getElementById("openAdd").addEventListener("click", () => show("add"));
  document.getElementById("openHome").addEventListener("click", () => show("home"));

  return { show, onBack, current: () => cur };
})();
