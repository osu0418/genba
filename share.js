// 共有の文：現場をLINEなどで送れる文にする／貼り付けた文から現場を読み取る
const Share = (() => {
  const noteLines = s => String(s.notes || "").split("\n").filter(Boolean);
  function toText(s) {
    return [
      "【現場】" + s.name,
      s.code ? "番号：" + s.code : "",
      "入場：" + s.inTel,
      "退場：" + s.outTel,
      s.kyUrl ? "KY：" + s.kyUrl : "",
      s.addr ? "住所：" + s.addr : "",
      s.lat !== "" && s.lat != null && s.lng !== "" && s.lng != null ? "位置：" + s.lat + "," + s.lng : "",
      s.routeLine ? "進入路の線：" + s.routeLine : "", // 版49
    ].concat(noteLines(s).length ? noteLines(s).map(l => "注意：" + l) : ["注意：なし"]) // 「なし」：消したことも仲間に伝わるように
      .concat(s.notes && s.notesChecked ? ["注意の確認日：" + s.notesChecked] : [])
      .filter(Boolean)
      .concat((s.parks || []).map(p => ParkText.toText(p))) // 駐車場は【駐車場】ごとに後ろへ付ける
      .join("\n");
  }

  // 【現場】ごとに区切って読む。複数の現場を一度に貼ってもよい
  function parse(text) {
    const blocks = String(text || "").split(/【現場】/).slice(1);
    const pick = (b, label) => {
      const m = b.match(new RegExp("^\\s*" + label + "\\s*[：:]\\s*(.+)$", "m"));
      return m ? m[1].trim() : "";
    };
    // 現場の欄は【駐車場】より前だけから読む（駐車場の住所・位置と取り違えないため）
    return blocks.map(all => ({ b: all.split(/【駐車場】/)[0], all })).map(({ b, all }) => ({
      parks: ParkText.parse(all),
      name: b.split("\n")[0].trim(),
      code: pick(b, "番号"),
      inTel: pick(b, "入場"),
      outTel: pick(b, "退場"),
      kyUrl: (pick(b, "KY").match(/https:\/\/\S+/) || [""])[0],
      addr: pick(b, "住所"),
      lat: (pick(b, "位置").split(/[,，]/)[0] || "").trim(),
      lng: (pick(b, "位置").split(/[,，]/)[1] || "").trim(),
      // 「注意：」の行は何行でも。1行もなければ undefined（前からある注意事項を消さないため）
      // 「注意：なし」だけなら空にする（注意事項を消した）。「注意：」の行がない古い文は undefined
      notes: (() => {
        const ls = b.match(/^\s*注意\s*[：:].*$/gm);
        if (!ls) return undefined;
        return ls.map(l => l.replace(/^\s*注意\s*[：:]\s*/, "").trim()).filter(l => l && l !== "なし").join("\n");
      })(),
      notesChecked: pick(b, "注意の確認日"),
      routeLine: /^\s*進入路の線\s*[：:]/m.test(b) ? pick(b, "進入路の線") : undefined, // 版49。無い古い文は undefined（前の線を消さない）
    })).filter(s => s.name && s.inTel && s.outTel);
  }

  // LINEに送る文（版30）：見える字は邸名だけ。電話番号・KY・住所・駐車場・注意事項は、すべてリンクの中に入れる（情報がもれないように）
  // park を渡したとき：その駐車場を足した知らせ。渡さないとき：現場の情報の知らせ
  // 注意事項をLINEの字でどう見せるか（版36）：注意事項は全部、あることが分かるようにする
  // ただし、近隣トラブル・人の名前・どの家か分かりそうな行は、中身を書かずに「要確認」とだけ出す（くわしくはリンクからアプリで）
  const SECRET = /近隣|近所|トラブル|苦情|クレーム|揉め|もめ|怒|住人|施主|さん|様|氏|ちゃん|君|隣|向かい|裏の|前の家|宅|号室|番地/;
  const openNotes = s => noteLines(s).filter(l => !SECRET.test(l));
  const hiddenCount = s => noteLines(s).filter(l => SECRET.test(l)).length;
  // 版45：短くする（見出しは1行、リンクは半分くらい、注意事項は1行ずつ「・」で続ける）
  async function notice(s, park) {
    const head = park ? `📲 ${s.name}に駐車場を足しました` : `📲 ${s.name}`;
    const n = hiddenCount(s);
    const ns = openNotes(s).concat(n ? [`要確認の注意${n > 1 ? n + "つ" : ""}（アプリで）`] : []);
    const notes = (typeof RouteMap !== "undefined" && RouteMap.has(s) ? ["🚧 進入路の地図あり（アプリで）"] : []).concat(ns.length ? ["⚠ " + ns.join("／")] : []);
    if (typeof Receive === "undefined") return [head].concat(notes, [toText(s)]).join("\n");
    return [head + "（押すとアプリに入ります）", await Receive.link(s)].concat(notes).join("\n");
  }

  // 版45：リンクに入れる短い形。見出しの字を外し、決まった順に並べる（うしろの空は落とす）
  const SK = ["name", "code", "inTel", "outTel", "kyUrl", "addr", "lat", "lng", "notes", "notesChecked", "routeLine"]; // routeLine：版49で後ろに足した
  const PK = ["name", "addr", "price", "max", "rule", "size", "kind", "reserve", "tel", "memo", "lat", "lng", "checked"];
  const trim = a => { while (a.length && (a[a.length - 1] === "" || a[a.length - 1] == null)) a.pop(); return a; };
  const row = (o, keys) => trim(keys.map(k => o[k] == null ? "" : o[k]));
  function pack(s) {
    const r = row(s, SK);
    while (r.length < SK.length) r.push(""); // 進入路の線の場所まで必ず入れる（消したことも伝わるように。版49）
    return [1, r, (s.parks || []).map(p => row(p, PK))]; // 1：形の番号（あとで形を変えたときに見分ける）
  }
  function unpack(a) {
    if (!Array.isArray(a) || a[0] !== 1) return [];
    const obj = (r, keys) => Object.fromEntries(keys.map((k, i) => [k, r && r[i] != null ? r[i] : ""]));
    const s = obj(a[1], SK);
    if (!(a[1] && a[1].length > SK.indexOf("routeLine"))) s.routeLine = undefined; // 線の欄が無い前のリンクでは、前の線を消さない
    s.parks = (a[2] || []).map(r => obj(r, PK));
    return s.name && s.inTel && s.outTel ? [s] : [];
  }

  // 文をコピーする（それぞれが邸名ごとのLINEのトークに貼る）。うまくいけば true
  // 版45：文はリンクを縮めてから出来るので、出来上がりを待ってから写すと、iPhoneが「押してすぐ」と見なさず写せないことがある
  //  なので「これから出来る文」をそのまま渡して写す（ClipboardItem）。使えない携帯では、待ってから写す
  async function copy(text) {
    try {
      if (text && typeof text.then === "function" && typeof ClipboardItem === "function" && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then(t => new Blob([t], { type: "text/plain" })) })]);
        return true;
      }
    } catch {}
    try { await navigator.clipboard.writeText(await text); return true; }
    catch { return false; }
  }

  return { toText, parse, notice, copy, openNotes, pack, unpack };
})();
