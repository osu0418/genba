// 表示の切り替え（版28）：ふだんは携帯が苦手な人向けの「かんたん表示」
// 登録や直すのが得意な人は「🔧 登録する人の表示」をオンにすると、直す・貼る文・駐車場の登録などが出る
// 切り替えはこのスマホにだけ覚える
(() => {
  const KEY = "genba-helper";
  const btn = document.getElementById("modeBtn");
  const get = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
  function apply(on) {
    document.body.classList.toggle("helper", on);
    // 版67：一覧の左下に浮かせた「🔧 制作」。オンの人だけ、注意事項・進入路・周りの地図から駐車場を探す、が出る
    btn.textContent = on ? "🔧 制作：オン" : "🔧 制作：オフ";
  }
  btn.addEventListener("click", () => {
    const on = !get();
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
    apply(on);
  });
  apply(get());
})();
