// 保存：このiPhoneの中（ブラウザの保存場所）にだけ現場を保存する
const Store = (() => {
  const KEY = "genba-sites-v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }

  function save(sites) {
    try { localStorage.setItem(KEY, JSON.stringify(sites)); return true; }
    catch { return false; }
  }

  // 全角数字やハイフンのゆれを直す
  function cleanTel(s) {
    return String(s || "")
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[－ー―‐]/g, "-")
      .replace(/[^0-9-]/g, "");
  }

  // 同じ入場番号の現場があれば上書き、なければ追加
  function upsert(site) {
    const sites = load();
    const s = {
      id: site.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: String(site.name || "").trim(),
      code: String(site.code || "").trim(),
      inTel: cleanTel(site.inTel),
      outTel: cleanTel(site.outTel),
      kyUrl: String(site.kyUrl || "").trim(),
    };
    const i = sites.findIndex(x => x.inTel === s.inTel);
    if (i >= 0) { s.id = sites[i].id; sites[i] = s; } else { sites.push(s); }
    save(sites);
    return i >= 0 ? "上書き" : "追加";
  }

  function remove(id) {
    save(load().filter(s => s.id !== id));
  }

  return { load, upsert, remove, cleanTel };
})();
