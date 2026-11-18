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
  // 比べるときだけ使う形：現場番号は空白を外して大文字に、邸名は空白と最後の「邸」を外す
  const normCode = v => String(v ?? "").replace(/[\s　]/g, "").toUpperCase();
  const normName = v => String(v ?? "").replace(/[\s　。、.]/g, "").replace(/邸$/, "");
  // 注意事項：【】は〔〕に変える（共有の文の区切りの【現場】【駐車場】と取り違えないため）。空の行は詰める
  const cleanNotes = v => String(v ?? "").replace(/【/g, "〔").replace(/】/g, "〕")
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean).join("\n");

  // 駐車場1か所の形をそろえる。場所（緯度・経度）がなければ null（保存しない）
  const PARK_KEYS = ["name", "addr", "price", "max", "rule", "size", "kind", "reserve", "tel", "memo"];
  function cleanPark(p) {
    const lat = num(p && p.lat, 90), lng = num(p && p.lng, 180);
    if (lat === "" || lng === "") return null;
    const out = { id: str(p.id) || newId(), lat, lng, checked: str(p.checked) || today() };
    for (const k of PARK_KEYS) out[k] = str(p[k]);
    return out;
  }
  const cleanParks = list => (Array.isArray(list) ? list : []).map(cleanPark).filter(Boolean);

  // 駐車場の足し合わせ：前からある駐車場は残し、入ってきた駐車場を足す
  // 同じ駐車場か：版62から共有のidが付いてくるので、まずidで見る。idが合わなければ、同じ名前でほぼ同じ場所（約50m以内）
  // 同じなら、確認日が同じか新しいときだけ入れ替える（idは送ってきた人の物にそろえる。次の訂正がidで届くように）
  // gone（版62）：消した駐車場の印。入ってきた駐車場のうち、自分が消した物（同じid）は足さない（古いリンクで戻らないように）
  const nearSame = (o, p) => o.name === p.name && Math.abs(o.lat - p.lat) < 0.0005 && Math.abs(o.lng - p.lng) < 0.0005;
  function mergeParks(oldList, newList, gone) {
    const out = cleanParks(oldList);
    const g = cleanGone({ p: gone }).p;
    for (const raw of Array.isArray(newList) ? newList : []) {
      const p = cleanPark(raw);
      if (!p) continue;
      // idの無い駐車場（版61までのリンク）は、名前と場所で消した印と比べる
      if (g.some(a => a[0] === p.id || (!str(raw.id) && nearSame(p, { name: a[1], lat: a[2], lng: a[3] })))) continue;
      let j = out.findIndex(o => o.id === p.id);
      if (j < 0) j = out.findIndex(o => nearSame(o, p));
      if (j < 0) out.push(p);
      else if (p.checked >= out[j].checked) out[j] = p;
    }
    return out;
  }

  // 版62：消した印（gone）。{ n: [消した注意事項の行], p: [[駐車場のid, 名前, 緯度, 経度]] }
  // 足し合わせると、消した物が仲間の携帯に残るので、消した印もリンクに入れて送り、受け取った人の携帯でも消す
  // 印は新しい方から30ずつまで（リンクが長くなりすぎないように）
  const GONE_MAX = 30;
  function cleanGone(g) {
    const n = Array.isArray(g && g.n) ? g.n.map(str).filter(Boolean) : [];
    const pk = Array.isArray(g && g.p) ? g.p.filter(a => Array.isArray(a) && a[0]).map(a => [str(a[0]), str(a[1]), num(a[2], 90), num(a[3], 180)]) : [];
    return { n: [...new Set(n)].slice(-GONE_MAX), p: pk.filter((a, i) => pk.findIndex(b => b[0] === a[0]) === i).slice(-GONE_MAX) };
  }
  function joinGone(a, b) {
    const x = cleanGone(a), y = cleanGone(b);
    return cleanGone({ n: x.n.concat(y.n), p: x.p.concat(y.p) });
  }
  // 入ってきた「消した印」で、自分の携帯の駐車場を消す（idが合う物。前の版で受け取ってidが違う物は、名前と場所で見る）
  function dropGoneParks(list, gone, keepIds) {
    const g = cleanGone(gone).p;
    return cleanParks(list).filter(o => !g.some(a => a[0] === o.id ||
      (!keepIds.has(o.id) && nearSame(o, { name: a[1], lat: a[2], lng: a[3] }))));
  }
  const lines = v => cleanNotes(v).split("\n").filter(Boolean);

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
    // どの現場と同じかを決める：①「直す」から来たら同じid ②現場番号（契約番号）が同じ
    // ③入場の番号が同じ（ただし、両方に現場番号があって違うときは別の現場。番号は使い回されることがあるため）
    let i = site.id ? sites.findIndex(x => x.id === site.id) : -1;
    if (i < 0 && s.code) i = sites.findIndex(x => normCode(x.code) === normCode(s.code));
    if (i < 0 && s.inTel) i = sites.findIndex(x => x.inTel === s.inTel && !(s.code && x.code && normCode(x.code) !== normCode(s.code)));
    // 版65：入場の電話が無い物（資材置き場など）は、同じ名前で電話の無い物を同じとみなす
    if (i < 0 && !s.inTel) i = sites.findIndex(x => !x.inTel && normName(x.name) === normName(s.name));
    // 同じ現場か：id・現場番号・邸名（空白や「邸」の有る無しは見ない）のどれかが合う
    // 合わなければ、入場の番号だけが同じ別の現場（使い回し）。前の駐車場・注意事項は引き継がない
    const same = i >= 0 && (!!site.id || (s.code && normCode(sites[i].code) === normCode(s.code)) || normName(sites[i].name) === normName(s.name));
    const replaced = i >= 0 && !same ? sites[i].name : "";
    // 現場の場所（📍）：入ってきた方に場所がなければ、前の場所を残す（版44。場所の無いリンクで消えないように。「直す」から来たときは、人が消したのかもしれないので残さない）
    if (!site.id && same && s.lat === "" && s.lng === "" && sites[i].lat !== "" && sites[i].lat != null) { s.lat = sites[i].lat; s.lng = sites[i].lng; if (!s.addrPt && sites[i].addrPt) s.addrPt = 1; }
    // 版62：消した印。「直す」から来たときは前の印のまま（注意事項の差は下で印にする）、受け取ったときは足し合わせる
    const inGone = cleanGone(site.gone);
    s.gone = same ? joinGone(sites[i].gone, site.id ? {} : inGone) : inGone;
    const inIds = new Set((Array.isArray(site.parks) ? site.parks : []).map(p => str(p && p.id)).filter(Boolean));
    const kept = same ? dropGoneParks(sites[i].parks, site.id ? {} : inGone, inIds) : [];
    s.parks = mergeParks(kept, site.parks, same ? s.gone.p : []);
    // 注意事項：入ってきた方に注意事項の欄がなければ（古い共有の文など）、前の注意事項を残す
    // 中身が変わったら確認日を今日にする（貼った文に確認日があればそれを使う）
    const old = same ? sites[i] : {};
    // 進入路の線（版49）：入ってきた方に欄がなければ前の線を残す。字の形が正しいときだけ入れる
    s.routeLine = site.routeLine === undefined ? (old.routeLine || "") : (/^-?\d+(,-?\d+){3,}$/.test(str(site.routeLine)) ? str(site.routeLine) : "");
    // 版55：この道を使う理由。入ってきた方に欄がなければ前の理由を残す。線が無ければ理由も持たない
    s.routeWhy = !s.routeLine ? "" : site.routeWhy === undefined ? (old.routeWhy || "") : str(site.routeWhy).slice(0, 60);
    if (site.notes === undefined) { s.notes = old.notes || ""; s.notesChecked = old.notesChecked || ""; }
    else if (site.id) {
      // 「直す」：書いたとおりにする。消した行は印に入れ、書き直した（また入れた）行は印から外す
      s.notes = cleanNotes(site.notes);
      const now = lines(s.notes), was = lines(old.notes);
      s.gone.n = s.gone.n.filter(l => !now.includes(l)).concat(was.filter(l => !now.includes(l)));
      s.gone = cleanGone(s.gone);
      s.notesChecked = !s.notes ? "" : str(site.notesChecked) || (s.notes === old.notes && old.notesChecked) || today();
    } else {
      // 版62：受け取ったとき：前の注意事項に、届いた行を足す（同じ行は1つ）。消した印の行は、どちらからも外す
      const goneN = new Set(s.gone.n);
      const merged = [...new Set(lines(old.notes).concat(lines(site.notes)))].filter(l => !goneN.has(l));
      s.notes = merged.join("\n");
      s.notesChecked = !s.notes ? "" : (s.notes === (old.notes || "") ? old.notesChecked || "" : "") || str(site.notesChecked) || today();
    }
    if (!s.gone.n.length && !s.gone.p.length) delete s.gone;
    if (i >= 0) { s.id = sites[i].id; sites[i] = s; } else { sites.push(s); }
    save(sites);
    if (replaced) return `上書き（入場の番号が同じ「${replaced}」と入れ替え）`;
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
    const p = cleanParks(site.parks).find(x => x.id === parkId);
    site.parks = cleanParks(site.parks).filter(x => x.id !== parkId);
    // 版62：消した印を付ける（共有したとき、受け取った人の携帯からも消えるように）
    if (p) site.gone = joinGone(site.gone, { p: [[p.id, p.name, p.lat, p.lng]] });
    save(sites);
  }

  // 現場の場所だけを入れる（版44：住所から探した場所。addrPt＝住所から出した、だいたいの場所）
  function setSitePoint(id, lat, lng) {
    const sites = load();
    const site = sites.find(s => s.id === id);
    if (!site) return false;
    site.lat = num(lat, 90); site.lng = num(lng, 180); site.addrPt = 1;
    return save(sites);
  }

  return { load, upsert, remove, cleanTel, savePark, removePark, today, setSitePoint };
})();
