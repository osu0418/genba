// 保存係：記録・ダンプの一覧・今の選択を、この携帯の中（localStorage＝ブラウザの保存場所）にしまう。
// 現場入場アプリと同じ住所（nyujo.genba-benri.com）なので、名前の頭に「dump_」を付けて混ざらないようにしている。
var Store = (function () {
  var K_REC = 'dump_records';   // 記録：[{id, t(日時), site(現場), dump(ダンプ), mat(材料), amt(量)}]
  var K_DUMP = 'dump_dumps';    // ダンプのボタン一覧
  var K_SEL = 'dump_selected';  // 最後に選んでいたもの（次の1台をすぐ記録できるように）

  function read(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  return {
    // 材料と単位（紙の表と同じ）
    MATS: [
      { name: '残土', unit: 't' },
      { name: '砕石', unit: '㎥' },
      { name: '改良土', unit: 't' }
    ],
    unitOf: function (mat) {
      for (var i = 0; i < this.MATS.length; i++) if (this.MATS[i].name === mat) return this.MATS[i].unit;
      return '';
    },
    records: function () { return read(K_REC, []); },
    addRecord: function (r) {
      var list = read(K_REC, []);
      r.id = Date.now() + '-' + Math.floor(Math.random() * 1000);
      list.push(r);
      return write(K_REC, list) ? r : null;
    },
    removeLast: function () {
      var list = read(K_REC, []);
      var r = list.pop();
      write(K_REC, list);
      return r;
    },
    dumps: function () { return read(K_DUMP, ['黒', '白']); },
    addDump: function (name) {
      var list = this.dumps();
      if (list.indexOf(name) < 0) list.push(name);
      write(K_DUMP, list);
      return list;
    },
    // 一度打った現場（新しい順・重なりなし）
    sites: function () {
      var list = read(K_REC, []), out = [];
      for (var i = list.length - 1; i >= 0; i--) {
        var s = list[i].site;
        if (s && out.indexOf(s) < 0) out.push(s);
      }
      return out;
    },
    selected: function () { return read(K_SEL, {}); },
    saveSelected: function (sel) { write(K_SEL, sel); }
  };
})();
