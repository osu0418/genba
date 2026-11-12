// 共有の文：現場をLINEなどで送れる文にする／貼り付けた文から現場を読み取る
const Share = (() => {
  function toText(s) {
    return [
      "【現場】" + s.name,
      s.code ? "番号：" + s.code : "",
      "入場：" + s.inTel,
      "退場：" + s.outTel,
      s.kyUrl ? "KY：" + s.kyUrl : "",
      s.addr ? "住所：" + s.addr : "",
      s.lat !== "" && s.lat != null && s.lng !== "" && s.lng != null ? "位置：" + s.lat + "," + s.lng : "",
    ].filter(Boolean).join("\n");
  }

  // 【現場】ごとに区切って読む。複数の現場を一度に貼ってもよい
  function parse(text) {
    const blocks = String(text || "").split(/【現場】/).slice(1);
    const pick = (b, label) => {
      const m = b.match(new RegExp("^\\s*" + label + "\\s*[：:]\\s*(.+)$", "m"));
      return m ? m[1].trim() : "";
    };
    return blocks.map(b => ({
      name: b.split("\n")[0].trim(),
      code: pick(b, "番号"),
      inTel: pick(b, "入場"),
      outTel: pick(b, "退場"),
      kyUrl: (pick(b, "KY").match(/https:\/\/\S+/) || [""])[0],
      addr: pick(b, "住所"),
      lat: (pick(b, "位置").split(/[,，]/)[0] || "").trim(),
      lng: (pick(b, "位置").split(/[,，]/)[1] || "").trim(),
    })).filter(s => s.name && s.inTel && s.outTel);
  }

  return { toText, parse };
})();
