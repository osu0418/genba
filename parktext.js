// 駐車場の文：駐車場を【駐車場】から始まる文にする／貼り付けた文から駐車場を読み取る
// Claudeが看板の写真から出す文も、仲間に送る共有の文も、この形にそろえる
const ParkText = (() => {
  // 文の見出しと、保存するときの名前の組
  const LABELS = [
    ["名前", "name"], ["住所", "addr"], ["料金", "price"], ["最大料金の決まり", "rule"],
    ["車の大きさ", "size"], ["形", "kind"], ["予約制", "reserve"], ["連絡先", "tel"], ["メモ", "memo"],
  ];

  function toText(p) {
    return ["【駐車場】"]
      .concat(LABELS.filter(([, k]) => p[k]).map(([l, k]) => `${l}：${p[k]}`))
      .concat(p.lat !== "" && p.lat != null && p.lng !== "" && p.lng != null ? [`位置：${p.lat},${p.lng}`] : [])
      .concat(p.checked ? [`確認日：${p.checked}`] : [])
      .join("\n");
  }

  // 【駐車場】ごとに区切って読む。【現場】が出てきたらそこで止める（共有の文に混ざっているとき用）
  function parse(text) {
    return String(text || "").split(/【駐車場】/).slice(1).map(raw => {
      const b = raw.split(/【現場】/)[0];
      const pick = label => {
        const m = b.match(new RegExp("^\\s*" + label + "\\s*[：:]\\s*(.+)$", "m"));
        return m ? m[1].trim() : "";
      };
      const p = {};
      for (const [l, k] of LABELS) p[k] = pick(l);
      // 「【駐車場】稲葉町…」のように、見出しのすぐ後ろに名前が書いてあるとき
      const first = b.split("\n")[0].trim();
      if (!p.name && first && !/[：:]/.test(first)) p.name = first;
      const pos = pick("位置").split(/[,，]/);
      p.lat = (pos[0] || "").trim();
      p.lng = (pos[1] || "").trim();
      p.checked = pick("確認日");
      return p;
    }).filter(p => LABELS.some(([, k]) => p[k]) || (p.lat && p.lng)); // 場所だけの駐車場も残す
  }

  return { LABELS, toText, parse };
})();
