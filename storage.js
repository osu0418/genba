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

  // 緯度・経度：数字で、ありえる範囲のときだけ残す（なければ空）
  function num(v, max) {
    const n = parseFloat(v);
    return isFinite(n) && Math.abs(n) <= max ? n : "";
  }

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const str = v => String(v ?? "").trim();

  // 駐車場1か所の形をそろえる。場所（緯度・経度）がなければ null（保存しない）
  const PARK_KEYS = ["name", "addr", "price", "rule", "size", "kind", "reserve", "tel", "memo"];
  function cleanPark(p) {
    const lat = num(p && p.lat, 90), lng = num(p && p.lng, 180);
    if (lat === "" || lng === "") return null;
    const out = { id: str(p.id) || newId(), lat, lng, checked: str(p.checked) || today() };
    for (const k of PARK_KEYS) out[k] = str(p[k]);
    return out;
  }
  const cleanParks = list => (Array.isArray(list) ? list : []).map(cleanPark).filter(Boolean);

  // 駐車場の足し合わせ：前からある駐車場は残し、入ってきた駐車場を足す
  // 同じ名前で、ほぼ同じ場所（約50m以内）なら同じ駐車場とみなし、確認日が同じか新しいときだけ入れ替える
  function mergeParks(oldList, newList) {
    const out = cleanParks(oldList);
    for (const p of cleanParks(newList)) {
      const j = out.findIndex(o => o.name === p.name &&
        Math.abs(o.lat - p.lat) < 0.0005 && Math.abs(o.lng - p.lng) < 0.0005);
      if (j < 0) out.push(p);
      else if (p.checked >= out[j].checked) { p.id = out[j].id; out[j] = p; }
    }
    return out;
  }

  // 「直す」から来たら同じ現場を上書き。そうでなければ、同じ入場番号の現場があれば上書き、なければ追加
  // 駐車場：入ってきた方に駐車場があればそれを使い、なければ前の駐車場を残す（直しても消えないように）
  function upsert(site) {
    const sites = load();
    const s = {
      id: site.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: String(site.name || "").trim(),
      code: String(site.code || "").trim(),
      inTel: cleanTel(site.inTel),
      outTel: cleanTel(site.outTel),
      kyUrl: String(site.kyUrl || "").trim(),
      addr: String(site.addr || "").trim(),
      lat: num(site.lat, 90),
      lng: num(site.lng, 180),
    };
    let i = site.id ? sites.findIndex(x => x.id === site.id) : -1;
    if (i < 0) i = sites.findIndex(x => x.inTel === s.inTel);
    s.parks = mergeParks(i >= 0 ? sites[i].parks : [], site.parks);
    if (i >= 0) { s.id = sites[i].id; sites[i] = s; } else { sites.push(s); }
    save(sites);
    return i >= 0 ? "上書き" : "追加";
  }

  function remove(id) {
    save(load().filter(s => s.id !== id));
  }

  // 駐車場を足す・直す（同じidなら上書き）。うまくいけば駐車場のid、だめなら ""
  function savePark(siteId, park) {
    const sites = load();
    const site = sites.find(s => s.id === siteId);
    const p = cleanPark(park);
    if (!site || !p) return "";
    site.parks = cleanParks(site.parks);
    const j = site.parks.findIndex(x => x.id === p.id);
    if (j >= 0) site.parks[j] = p; else site.parks.push(p);
    return save(sites) ? p.id : "";
  }

  function removePark(siteId, parkId) {
    const sites = load();
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    site.parks = cleanParks(site.parks).filter(p => p.id !== parkId);
    save(sites);
  }

  return { load, upsert, remove, cleanTel, savePark, removePark, today };
})();
