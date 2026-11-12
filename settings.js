// 設定：アラーム（ショートカット）を使うかどうか。このiPhoneの中にだけ保存する
window.Settings = (() => {
  const KEY = "genba-settings-v1";
  const IN_NAME = "現場入場";
  const OUT_NAME = "現場退場";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }

  // ショートカットを動かすアドレス。電話番号（数字だけ）を渡す
  function shortcutUrl(kind, tel) {
    const name = kind === "in" ? IN_NAME : OUT_NAME;
    return "shortcuts://run-shortcut?name=" + encodeURIComponent(name)
      + "&input=text&text=" + encodeURIComponent(String(tel).replace(/[^0-9]/g, ""));
  }

  const box = document.getElementById("useAlarm");
  box.checked = !!load().useAlarm;
  box.addEventListener("change", () => {
    save({ ...load(), useAlarm: box.checked });
    List.render();
  });

  const api = {
    useAlarm: () => !!load().useAlarm,
    shortcutUrl,
  };
  return api;
})();
// 一覧は設定より先に表示されるので、設定を読んだあとで表示し直す
List.render();
