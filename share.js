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
    })).filter(s => s.name && s.inTel && s.outTel);
  }

  // LINEに送る文：上は人が読む案内（地図のリンクつき）、下はアプリに貼る用の今の共有の文
  // 上の段には【】を使わない（アプリが貼った文を読むとき、上の段を現場や駐車場と取り違えないため）
  const hasPos = p => p.lat !== "" && p.lat != null && p.lng !== "" && p.lng != null;
  const mapUrl = p => "https://www.google.com/maps/search/?api=1&query=" + p.lat + "," + p.lng;
  function parkLines(p) {
    return [
      "🅿 " + (p.name || "名前なし"),
      p.price ? "料金：" + p.price : "",
      p.rule ? "最大料金の決まり：" + p.rule : "",
      p.size ? "車の大きさ：" + p.size : "",
      hasPos(p) ? "地図：" + mapUrl(p) : "",
    ].filter(Boolean);
  }
  // park を渡したとき：その駐車場を足した知らせ。渡さないとき：現場の情報の知らせ
  function notice(s, park) {
    const notes = noteLines(s).map(l => "⚠ " + l);
    const head = park
      ? [s.name + "に駐車場を足しました"].concat(parkLines(park))
      : [s.name + "の現場の情報です"].concat(...(s.parks || []).map(p => [""].concat(parkLines(p))));
    // 一番上に「押すとアプリに入る」リンク（版28。携帯が苦手な人は押して「はい」だけ）
    const top = typeof Receive !== "undefined" ? ["📲 押すとアプリに入ります（現場・駐車場・注意）", Receive.link(toText(s)), ""] : [];
    return top.concat(head).concat(notes.length ? ["", "⚠ この現場の注意"].concat(notes) : [])
      .concat(["", "―― アプリに貼る用（そのまま貼ってOK）――", toText(s)]).join("\n");
  }

  // 文をコピーする（それぞれが邸名ごとのLINEのトークに貼る）。うまくいけば true
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { return false; }
  }

  return { toText, parse, notice, copy };
})();
