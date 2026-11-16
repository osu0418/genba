// 記録画面（第1章）：現場・ダンプ・材料・量を選んで「記録する」。日時は押した瞬間のものが自動で入る。
(function () {
  var AMTS = [2, 3, 4, 5, 6, 8, 10];  // よく使う量のボタン
  var sel = Store.selected();         // 前回の選択を引き継ぐ（同じ現場・同じ材料が続くことが多いため）
  var $ = function (id) { return document.getElementById(id); };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(d) { return d.getHours() + ':' + pad(d.getMinutes()); }
  function md(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }

  function showNow() {
    var d = new Date();
    $('now').textContent = '今：' + md(d) + ' ' + hm(d) + '（記録すると、この日時が入ります）';
  }

  function chip(label, on, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (on) b.className = 'on';
    b.onclick = onClick;
    return b;
  }

  function remember() { Store.saveSelected(sel); }

  function drawSites() {
    var box = $('siteChips'); box.innerHTML = '';
    Store.sites().slice(0, 8).forEach(function (s) {
      box.appendChild(chip(s, s === $('site').value, function () {
        $('site').value = s; sel.site = s; remember(); drawSites();
      }));
    });
  }

  function drawDumps() {
    var box = $('dumpChips'); box.innerHTML = '';
    Store.dumps().forEach(function (d) {
      box.appendChild(chip(d, d === sel.dump, function () {
        sel.dump = (sel.dump === d) ? '' : d; remember(); drawDumps();
      }));
    });
  }

  function drawMats() {
    var box = $('matChips'); box.innerHTML = '';
    Store.MATS.forEach(function (m) {
      box.appendChild(chip(m.name, m.name === sel.mat, function () {
        sel.mat = m.name; remember(); drawMats(); drawAmts();
      }));
    });
  }

  function drawAmts() {
    var unit = Store.unitOf(sel.mat);
    $('unit').textContent = unit ? '（' + unit + '）' : '（先に材料を選ぶ）';
    var box = $('amtChips'); box.innerHTML = '';
    AMTS.forEach(function (a) {
      box.appendChild(chip(a + unit, a === sel.amt, function () {
        sel.amt = a; $('amt').value = ''; remember(); drawAmts();
      }));
    });
  }

  function drawToday() {
    var today = new Date().toDateString();
    var list = Store.records().filter(function (r) { return new Date(r.t).toDateString() === today; });
    $('todayCount').textContent = list.length ? '（' + list.length + '台）' : '';
    var box = $('todayList'); box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="empty">まだありません</div>'; }
    list.slice().reverse().forEach(function (r) {
      var div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = '<span class="t"></span><span class="b"></span>';
      div.querySelector('.t').textContent = hm(new Date(r.t));
      div.querySelector('.b').textContent = r.site + '　' + (r.dump || '−') + '　' + r.mat + ' ' + r.amt + Store.unitOf(r.mat);
      box.appendChild(div);
    });
    $('undo').hidden = !list.length;
  }

  function message(text, isErr) {
    var m = $('msg');
    m.textContent = text; m.className = 'msg' + (isErr ? ' err' : ''); m.hidden = false;
    clearTimeout(message.timer);
    message.timer = setTimeout(function () { m.hidden = true; }, 4000);
  }

  // 入力欄
  $('site').value = sel.site || '';
  $('site').oninput = function () { sel.site = this.value.trim(); remember(); drawSites(); };
  $('sameSite').onclick = function () {
    var last = Store.sites()[0];
    if (!last) { message('まだ前の記録がありません', true); return; }
    $('site').value = last; sel.site = last; remember(); drawSites();
  };
  $('addDump').onclick = function () {
    var v = $('newDump').value.trim();
    if (!v) return;
    Store.addDump(v); sel.dump = v; remember();
    $('newDump').value = ''; drawDumps();
  };
  $('amt').oninput = function () {
    var v = parseFloat(this.value);
    sel.amt = isNaN(v) ? null : v; remember(); drawAmts();
  };

  // 記録する
  $('save').onclick = function () {
    var site = $('site').value.trim();
    if (!site) { message('現場を入れてください', true); return; }
    if (!sel.mat) { message('材料を選んでください', true); return; }
    if (!sel.amt) { message('量を選んでください', true); return; }
    var r = Store.addRecord({ t: new Date().toISOString(), site: site, dump: sel.dump || '', mat: sel.mat, amt: sel.amt });
    if (!r) { message('保存できませんでした（携帯の空きを確認してください）', true); return; }
    message('記録しました：' + hm(new Date(r.t)) + ' ' + site + ' ' + (r.dump || '') + ' ' + r.mat + r.amt + Store.unitOf(r.mat));
    drawSites(); drawToday();
  };

  // 取り消し（押し間違い用）
  $('undo').onclick = function () {
    var r = Store.removeLast();
    if (r) message('取り消しました：' + hm(new Date(r.t)) + ' ' + r.site);
    drawSites(); drawToday();
  };

  showNow(); setInterval(showNow, 20000);
  drawSites(); drawDumps(); drawMats(); drawAmts(); drawToday();
})();
