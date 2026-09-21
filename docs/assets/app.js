// web/app.js — お得(/deals)・カードページの共有クライアントロジック。
// mode(document.body.dataset.mode)は "public"(公開サイト、fetch無し・データは埋め込み済み)と
// "local"(手元の非公開モード。web/personal.js が追加の個人機能を足す)の両方で同じこの
// ファイルを読む。
// このファイルには個人データへの参照(fetch /api/... 等)を一切書かない。個人データは
// window.personalApi(既定はlocalStorageだけの実装。mode=local では personal.js が上書きする)
// を通してだけ触る。これが「一つの層」(personalApi)を守るための境界線。
(function () {
  'use strict';

  // ---------------- personalApi: 既定は localStorage(公開版のデフォルト実装) ----------------
  window.personalApi = window.personalApi || {
    savedGet: function () {
      try {
        var raw = localStorage.getItem('pb_deals_saved_v1');
        var arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    },
    savedSet: function (ids) {
      try { localStorage.setItem('pb_deals_saved_v1', JSON.stringify(ids)); } catch (e) { /* ignore */ }
    },
    // 単品特価を既定で畳まず常に表示するか(v2, 2026-09-19)。公開サイトは端末のlocalStorageだけ。
    singlesAlwaysGet: function () {
      try { return localStorage.getItem('pb_deals_singles_always_v1') === '1'; } catch (e) { return false; }
    },
    singlesAlwaysSet: function (on) {
      try { localStorage.setItem('pb_deals_singles_always_v1', on ? '1' : '0'); } catch (e) { /* ignore */ }
    },
  };

  var TABS = [
    { key: 'all', label: 'すべて', scene: null },
    { key: 'food', label: '外食', scene: '外食テイクアウト' },
    { key: 'grocery', label: '食料品・日用品', scene: '食料品日用品' },
    { key: 'kids', label: '子ども', scene: '子どもファミリー' },
    { key: 'free', label: '無料', scene: '無料でもらえる' },
    { key: 'clothes', label: '服・くつ', scene: '服くつ' },
  ];

  function initDealsPage() {
    // /cards や記事のページには一覧が無いので何もしない。場面別ページ(/scene/*.html)は
    // タブも日付帯も無いが、カードはあるので郵便番号の絞り込みとハートだけ動かす。
    var tabsWrap = document.getElementById('tabs-wrap');
    if (!tabsWrap && !document.querySelector('.card[data-id], .bundle-item[data-id]')) return;

    var calendarIndexEl = document.getElementById('deals-calendar-index');
    var calendarIndex = {};
    try { calendarIndex = JSON.parse(calendarIndexEl.textContent) || {}; } catch (e) { calendarIndex = {}; }

    var state = { activeTab: 'all', activeDate: null, region: null, saved: personalApi.savedGet() };

    function readJSON(id) {
      var el = document.getElementById(id);
      if (!el) return null;
      try { return JSON.parse(el.textContent); } catch (e) { return null; }
    }

    function tabByKey(key) {
      for (var i = 0; i < TABS.length; i++) { if (TABS[i].key === key) return TABS[i]; }
      return TABS[0];
    }

    // v2(2026-09-19): セクションは時間軸(今日やること/今週/先の予定)なので、絞り込みは
    // カード単位(.card[data-scene]・.bundle-item[data-scene])で行う。バンドルは中の1件でも
    // 見えていれば表示し、全部隠れたら畳む。セクションはカードが1件も残らなければ丸ごと隠す
    // (ただし「今日やることはありません」等の空文言だけの節=.cards が無い節はそのまま触らない)。
    // ---------- 郵便番号での絞り込み(公開サイト、2026-09-20) ----------
    // 台帳の地域は州までしか無いので、郵便番号は州を特定する入口として使う。
    // 表(郵便番号の帯 → 州)は us_zip.py が唯一の置き場で、ページに埋め込まれたものを読む。
    var ZIP_KEY = 'pb_deals_zip_v1';
    var zipTable = readJSON('zip-states') || { ranges: [], labels: {} };

    function stateOfZip(raw) {
      var m = String(raw || '').match(/^\s*(\d{5})(?:-\d{4})?\s*$/);
      if (!m) return null;
      var n = parseInt(m[1], 10);
      for (var i = 0; i < zipTable.ranges.length; i++) {
        var r = zipTable.ranges[i];
        if (n >= r[0] && n <= r[1]) return r[2];
      }
      return null;
    }

    function zipLoad() {
      try { return JSON.parse(localStorage.getItem(ZIP_KEY) || 'null') || null; } catch (e) { return null; }
    }
    function zipSave(v) {
      try {
        if (v) localStorage.setItem(ZIP_KEY, JSON.stringify(v));
        else localStorage.removeItem(ZIP_KEY);
      } catch (e) { /* プライベートウィンドウ等。絞り込み自体はこのまま動く */ }
    }

    function regionOk(el) {
      if (!state.region) return true;
      var attr = el.getAttribute('data-region') || 'unknown';
      if (attr === 'all' || attr === 'online' || attr === 'unknown') return true;
      return attr.split(',').indexOf(state.region) !== -1;
    }

    function renderZipNote() {
      var note = document.getElementById('zip-note');
      var clear = document.getElementById('zip-clear');
      if (!note) return;
      // 「どこにも送信しない」は絞り込みの前後どちらでも出しておく(読者が一番気にする点なので、
      // 絞り込んだ瞬間に消えないようにする)
      var privacy = ' 入力はこの端末のブラウザにだけ残り、どこにも送信しません。';
      if (state.region) {
        var label = zipTable.labels[state.region] || state.region;
        note.textContent = label + 'のお得に絞り込んでいます。全米・オンラインのお得は常に出ます。' + privacy;
        note.classList.add('on');
      } else {
        note.textContent = '州限定のお得だけを絞り込みます。全米・オンラインのお得は常に出ます。' + privacy;
        note.classList.remove('on');
      }
      if (clear) clear.hidden = !state.region;
    }

    function setZip(raw, persist) {
      var st = stateOfZip(raw);
      var input = document.getElementById('zip-input');
      // 5桁そろっていないうちは何も変えない(打っている途中で一覧が消えないように)
      if (!/^\s*\d{5}/.test(String(raw || '')) && String(raw || '').trim() !== '') {
        return;
      }
      state.region = st;
      if (persist) zipSave(st ? { zip: String(raw).trim(), state: st } : null);
      if (input && st === null && String(raw || '').trim() !== '') {
        document.getElementById('zip-note').textContent =
          'その郵便番号から州を判定できませんでした。5桁で入れてみてください。';
        return;
      }
      renderZipNote();
      applyFilters();
    }

    function initZip() {
      var input = document.getElementById('zip-input');
      if (!input) return;
      var saved = zipLoad();
      if (saved && saved.state) {
        input.value = saved.zip || '';
        state.region = saved.state;
      }
      renderZipNote();
      input.addEventListener('input', function () { setZip(input.value, true); });
      var clear = document.getElementById('zip-clear');
      if (clear) {
        clear.addEventListener('click', function () {
          input.value = '';
          state.region = null;
          zipSave(null);
          renderZipNote();
          applyFilters();
        });
      }
    }

    function applyFilters() {
      var tab = tabByKey(state.activeTab);
      var dateIds = state.activeDate ? (calendarIndex[state.activeDate] || []) : null;
      var dateSet = null;
      if (dateIds) { dateSet = {}; dateIds.forEach(function (id) { dateSet[id] = true; }); }
      document.querySelectorAll('.card[data-id], .bundle-item[data-id]').forEach(function (el) {
        var id = el.getAttribute('data-id');
        var scene = el.getAttribute('data-scene') || '';
        var sceneOk = !tab.scene || scene.indexOf(tab.scene) !== -1;
        var dateOk = !dateSet || !!dateSet[id];
        el.hidden = !(sceneOk && dateOk && regionOk(el));
      });
      document.querySelectorAll('.store-bundle').forEach(function (bundle) {
        var anyVisible = false;
        bundle.querySelectorAll('.bundle-item').forEach(function (bi) { if (!bi.hidden) anyVisible = true; });
        bundle.hidden = !anyVisible;
      });
      ['section-today', 'section-week', 'section-later'].forEach(function (id) {
        var sec = document.getElementById(id);
        if (!sec) return;
        var cardsWrap = sec.querySelector('.cards');
        if (!cardsWrap) return;   // 元々0件で空文言だけの節はそのまま(絞り込みでは触らない)
        var anyVisible = false;
        cardsWrap.querySelectorAll(':scope > .card, :scope > .store-bundle').forEach(function (c) {
          if (!c.hidden) anyVisible = true;
        });
        sec.hidden = !anyVisible;
      });
    }

    function renderTabs() {
      document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === state.activeTab);
      });
    }

    function renderDateStrip() {
      document.querySelectorAll('.date-chip').forEach(function (chip) {
        chip.classList.toggle('selected', chip.getAttribute('data-date') === state.activeDate);
      });
      var chipWrap = document.getElementById('filter-chip-wrap');
      var chip = document.getElementById('filter-chip');
      if (!chipWrap || !chip) return;                       // 場面別ページには日付帯が無い
      if (!state.activeDate) { chipWrap.hidden = true; return; }
      var btn = document.querySelector('.date-chip[data-date="' + state.activeDate + '"]');
      var md = btn ? btn.querySelector('.md').textContent : state.activeDate;
      chip.textContent = md + 'で絞り込み中 ✕';
      chipWrap.hidden = false;
    }

    function setHeart(id, on) {
      document.querySelectorAll('.heart-btn[data-id="' + id + '"]').forEach(function (btn) {
        btn.classList.toggle('on', on);
        btn.textContent = on ? '♥' : '♡';
      });
    }

    function renderSaved() {
      var wrap = document.getElementById('saved-cards');
      var empty = document.getElementById('saved-empty');
      if (!wrap) return;
      wrap.innerHTML = '';
      var any = false;
      state.saved.forEach(function (id) {
        var master = document.querySelector('#section-today .card[data-id="' + id + '"], ' +
          '#section-week .card[data-id="' + id + '"], #section-week .bundle-item[data-id="' + id + '"], ' +
          '#section-later .card[data-id="' + id + '"], #section-singles .card[data-id="' + id + '"]');
        if (!master) return;
        var clone = master.cloneNode(true);
        clone.hidden = false;
        clone.classList.remove('bundle-item');
        clone.classList.add('card');
        wrap.appendChild(clone);
        any = true;
      });
      if (empty) empty.hidden = any;
    }

    function toggleSaved(id) {
      var on = state.saved.indexOf(id) === -1;
      if (on) { state.saved.push(id); } else { state.saved = state.saved.filter(function (x) { return x !== id; }); }
      personalApi.savedSet(state.saved);
      setHeart(id, on);
      renderSaved();
    }

    function toggleDetail(id) {
      document.querySelectorAll('[data-detail-for="' + id + '"]').forEach(function (el) { el.hidden = !el.hidden; });
      var openEl = document.querySelector('[data-detail-for="' + id + '"]');
      var open = openEl ? !openEl.hidden : false;
      document.querySelectorAll('.detail-link[data-id="' + id + '"]').forEach(function (btn) {
        btn.innerHTML = (open ? '閉じる' : 'くわしく') + '<span class="chev">' + (open ? '‹' : '›') + '</span>';
      });
    }

    // ---------------- 単品特価「次回から常に表示する」設定(v2, 2026-09-19) ----------------
    function applySinglesPref() {
      var det = document.getElementById('section-singles');
      if (!det) return;
      var show = personalApi.singlesAlwaysGet ? personalApi.singlesAlwaysGet() : false;
      det.open = show;
      var cb = document.getElementById('singles-always-show');
      if (cb) cb.checked = show;
    }

    function selectTab(key) { state.activeTab = key; renderTabs(); applyFilters(); }
    function selectDate(dateStr) {
      state.activeDate = (state.activeDate === dateStr) ? null : dateStr;
      renderDateStrip(); applyFilters();
    }

    // 公式ページを見る、のクリックを「仮想ページビュー」として記録する(実際のリンク遷移は
    // ブラウザ標準の挙動に任せ、preventDefault はしない)
    function trackOutbound(slug) {
      try { history.pushState({}, '', (location.pathname.indexOf('/deals') === 0 ? '/deals' : '') + '/out/' + slug + '/'); } catch (e) { /* ignore */ }
    }

    document.addEventListener('click', function (e) {
      var tabBtn = e.target.closest('.tab-btn');
      if (tabBtn) { selectTab(tabBtn.getAttribute('data-tab')); return; }
      var chip = e.target.closest('.date-chip');
      if (chip) { selectDate(chip.getAttribute('data-date')); return; }
      var clearChip = e.target.closest('#filter-chip');
      if (clearChip) { selectDate(state.activeDate); return; }
      var heart = e.target.closest('[data-action="heart"]');
      if (heart) { toggleSaved(heart.getAttribute('data-id')); return; }
      var detail = e.target.closest('[data-action="detail"]');
      if (detail) { toggleDetail(detail.getAttribute('data-id')); return; }
      var moreBtn = e.target.closest('#more-btn');
      if (moreBtn) { loadMore(moreBtn); return; }
      var official = e.target.closest('.official');
      if (official) { trackOutbound(official.getAttribute('data-out-slug') || 'unknown'); return; }
    });
    document.addEventListener('change', function (e) {
      var cb = e.target.closest('#singles-always-show');
      if (!cb) return;
      if (personalApi.singlesAlwaysSet) personalApi.singlesAlwaysSet(cb.checked);
      var det = document.getElementById('section-singles');
      if (det) det.open = cb.checked;
    });

    // ---------------- 「もっと見る」(公開サイトのみ、2026-09-20) ----------------
    // index を軽くするため、上位40件より後と単品は同一オリジンの静的 JSON から足す。
    // 読むのは書き出し時に作った /deals/more.json だけ(API は無い。外部にも出ない)。
    function loadMore(btn) {
      var sec = document.getElementById('more-section');
      var slot = document.getElementById('more-slot');
      if (!sec || !slot || sec.dataset.loaded === '1') return;
      var src = sec.getAttribute('data-src');
      if (!src) return;
      btn.disabled = true;
      btn.textContent = '読み込み中…';
      fetch(src, { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
          sec.dataset.loaded = '1';
          slot.innerHTML = (data.rest_html || '') + (data.singles_html || '');
          btn.remove();
          state.saved.forEach(function (id) { setHeart(id, true); });
          applyFilters();
          applySinglesPref();
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = '読み込めませんでした。もう一度試す';
        });
    }

    state.saved.forEach(function (id) { setHeart(id, true); });
    renderSaved();
    initZip();
    applyFilters();
    applySinglesPref();

    // mode=local: personal.js がサーバーから saved を取り直したら呼ぶ再同期フック
    window.tpApp = window.tpApp || {};
    window.tpApp.refreshSaved = function () {
      state.saved = personalApi.savedGet();
      state.saved.forEach(function (id) { setHeart(id, true); });
      renderSaved();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDealsPage);
  } else {
    initDealsPage();
  }
})();

// ================= v3 シェル(2026-09-20, 仕様 §9-1・§2・§9-3) =================
// ヘッダーのあいさつ/地名/ベル、地域と「期限が近い」の2枚のボトムシート、Deals の
// タイル8個と検索の絞り込み。公開サイトでも手元モードでも同じこの1つが動く
// (どちらも実行時に外部へは一切 fetch しない。データはページに焼いてある)。
(function () {
  'use strict';
  var ZIP_KEY = 'pb_deals_zip_v1';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }
  function zipLoad() {
    try { return JSON.parse(localStorage.getItem(ZIP_KEY) || 'null') || null; } catch (e) { return null; }
  }
  function zipSave(v) {
    try {
      if (v) localStorage.setItem(ZIP_KEY, JSON.stringify(v));
      else localStorage.removeItem(ZIP_KEY);
    } catch (e) { /* プライベートウィンドウ等。絞り込み自体はこのまま動く */ }
  }

  function initV3() {
    var head = document.querySelector('.dk-head');
    if (!head) return;
    var zipTable = readJSON('zip-states') || { ranges: [], labels: {} };
    var due = readJSON('dk-due-data') || [];

    // ---- あいさつ(§9-1): 05-10 おはようございます / 10-17 こんにちは / それ以外 こんばんは。
    // 公開サイトは1日1回しか作られないので、焼いた時刻ではなく読む人の時計で決める。
    var greetEl = document.getElementById('dk-greet'), sunEl = document.getElementById('dk-sun');
    if (greetEl) {
      var h = new Date().getHours();
      var night = (h < 5 || h >= 17);
      greetEl.textContent = (h >= 5 && h < 10) ? 'おはようございます' : (night ? 'こんばんは' : 'こんにちは');
      if (sunEl && night) {
        sunEl.classList.add('night');
        sunEl.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
          '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';
      }
    }

    // ---- 地名(§9-1)と州の絞り込み(§2) ----
    var locName = document.getElementById('dk-loc-name');
    var state = null;
    var saved = zipLoad();
    if (saved && saved.state) state = saved.state;

    function stateOfZip(raw) {
      var m = String(raw || '').match(/^\s*(\d{5})(?:-\d{4})?\s*$/);
      if (!m) return null;
      var n = parseInt(m[1], 10);
      for (var i = 0; i < zipTable.ranges.length; i++) {
        var r = zipTable.ranges[i];
        if (n >= r[0] && n <= r[1]) return r[2];
      }
      return null;
    }
    function stateLabel(code) { return (zipTable.labels || {})[code] || code; }
    function renderLoc() {
      if (locName) locName.textContent = state ? stateLabel(state) : '全米・オンライン';
      var clear = document.getElementById('zip-clear');
      if (clear) clear.hidden = !state;
    }

    // 州限定の行だけを隠す(全米・オンライン・不明は常に出す)
    function regionOk(el) {
      if (!state) return true;
      var attr = el.getAttribute('data-region') || 'unknown';
      if (attr === 'all' || attr === 'online' || attr === 'unknown') return true;
      return attr.split(',').indexOf(state) !== -1;
    }

    // ---- ボトムシート ----
    var backdrop = document.getElementById('dk-sheet-backdrop');
    function openSheet(id) {
      var sheet = document.getElementById(id);
      if (!sheet || !backdrop) return;
      backdrop.hidden = false;
      sheet.hidden = false;
    }
    function closeSheets() {
      if (backdrop) backdrop.hidden = true;
      ['dk-loc-sheet', 'dk-due-sheet'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = true;
      });
      // ディールのシート(§10)は履歴を1つ積んでいるので、専用の閉じ方を呼ぶ
      if (typeof window.dkCloseDeal === 'function') window.dkCloseDeal();
    }
    if (backdrop) backdrop.addEventListener('click', closeSheets);
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-dk-close]')) { closeSheets(); return; }
      if (e.target.closest('#dk-loc')) { openSheet('dk-loc-sheet'); return; }
      if (e.target.closest('#dk-bell')) { openSheet('dk-due-sheet'); return; }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheets(); });

    // ---- ベルの一覧(§9-1): 期限3日以内。ページに焼いた一覧をそのまま出す ----
    var dueList = document.getElementById('dk-due-list');
    if (dueList) {
      dueList.innerHTML = due.length ? due.map(function (d) {
        return '<a class="dk-row" href="' + esc(d.slug ? (dueList.getAttribute('data-base') || '') + d.slug + '/' : '#') + '">' +
          '<span class="dk-row-body"><span class="dk-row-store">' + esc(d.store) + '</span>' +
          '<span class="dk-row-deal">' + esc(d.headline) + '</span></span>' +
          (d.pill ? '<span class="dk-pill soon">' + esc(d.pill) + '</span>' : '') + '</a>';
      }).join('') : '<p class="dk-empty">期限が近いお得はありません</p>';
    }

    // ---- 郵便番号の入力(§2) ----
    var zipInput = document.getElementById('zip-input'), zipNote = document.getElementById('zip-note');
    if (zipInput) {
      if (saved && saved.zip) zipInput.value = saved.zip;
      zipInput.addEventListener('input', function () {
        var raw = zipInput.value;
        if (String(raw || '').trim() === '') { state = null; zipSave(null); renderLoc(); applyFilters(); return; }
        if (!/^\s*\d{5}/.test(String(raw))) return;   // 打っている途中は変えない
        var st = stateOfZip(raw);
        if (st === null) {
          if (zipNote) zipNote.textContent = 'その郵便番号から州を判定できませんでした。5桁で入れてみてください。';
          return;
        }
        if (zipNote) zipNote.textContent = '州限定のお得だけを絞ります。全米・オンラインは常に出ます。';
        state = st;
        zipSave({ zip: String(raw).trim(), state: st });
        renderLoc(); applyFilters();
      });
    }
    var zipClear = document.getElementById('zip-clear');
    if (zipClear) {
      zipClear.addEventListener('click', function () {
        if (zipInput) zipInput.value = '';
        state = null; zipSave(null); renderLoc(); applyFilters();
      });
    }

    // ---- Deals(§9-3): タイル8個 + 検索で店の一覧を絞る ----
    var tilesWrap = document.getElementById('dk-tiles');
    var storeList = document.getElementById('dk-store-list');
    var storeEmpty = document.getElementById('dk-store-empty');
    var searchEl = document.getElementById('dk-search');
    var activeTile = null;

    function applyFilters() {
      var q = (searchEl && searchEl.value || '').trim().toLowerCase();
      var any = false;
      if (storeList) {
        storeList.querySelectorAll('.dk-row').forEach(function (row) {
          var tiles = (row.getAttribute('data-tiles') || '').split(' ');
          var okTile = !activeTile || tiles.indexOf(activeTile) !== -1;
          var okQ = !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
          var show = okTile && okQ && regionOk(row);
          row.hidden = !show;
          if (show) any = true;
        });
        if (storeEmpty) storeEmpty.hidden = any;
      }
      // Home の一覧も州で絞る。日付の帯(§12)が8件の頭打ちを数えるので、ここでは
      // hidden を直接いじらず印だけ付け、数え直しは日付側に任せる。
      document.querySelectorAll('.dk-list .dk-row[data-region]').forEach(function (row) {
        if (storeList && storeList.contains(row)) return;
        row.classList.toggle('is-region-out', !regionOk(row));
      });
      if (typeof window.dkReselectDay === 'function') window.dkReselectDay();
    }

    if (tilesWrap) {
      tilesWrap.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-tile]');
        if (!btn || btn.disabled) return;
        var key = btn.getAttribute('data-tile');
        activeTile = (activeTile === key) ? null : key;
        tilesWrap.querySelectorAll('[data-tile]').forEach(function (b) {
          b.classList.toggle('is-on', b.getAttribute('data-tile') === activeTile);
        });
        applyFilters();
      });
    }
    if (searchEl) searchEl.addEventListener('input', applyFilters);

    renderLoc();
    applyFilters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initV3);
  else initV3();
})();

// ---- Me タブ(§9-5): お住まいの地域の入口と、気になるリスト(端末内) ----
(function () {
  'use strict';
  function initMe() {
    var locBtn = document.getElementById('dk-me-loc');
    var listEl = document.getElementById('dk-saved-list');
    if (!locBtn && !listEl) return;

    // 地域: ヘッダーの地名と同じボトムシートを開く(§2 入口は2つ、シートは1枚)
    if (locBtn) {
      locBtn.addEventListener('click', function () {
        var head = document.getElementById('dk-loc');
        if (head) head.click();
      });
      var nameEl = document.getElementById('dk-me-loc-name');
      var headName = document.getElementById('dk-loc-name');
      if (nameEl && headName) {
        nameEl.textContent = headName.textContent;
        new MutationObserver(function () { nameEl.textContent = headName.textContent; })
          .observe(headName, { childList: true, characterData: true, subtree: true });
      }
    }

    // 気になるリスト: localStorage の id と、ページに焼いた一覧を突き合わせるだけ
    if (!listEl) return;
    var catalog = {};
    try { catalog = JSON.parse(document.getElementById('dk-saved-catalog').textContent) || {}; } catch (e) { catalog = {}; }
    var ids = [];
    try { ids = JSON.parse(localStorage.getItem('pb_deals_saved_v1') || '[]') || []; } catch (e) { ids = []; }
    var base = (document.body.dataset.mode === 'public') ? '/s/' : '/s/';
    var rows = ids.map(function (id) { return catalog[id]; }).filter(Boolean);
    var empty = document.getElementById('dk-saved-empty');
    if (!rows.length) { if (empty) empty.hidden = false; return; }
    if (empty) empty.hidden = true;
    listEl.innerHTML = '<div class="dk-list">' + rows.map(function (d) {
      return '<a class="dk-row" href="' + base + d.slug + '/">' +
        '<span class="dk-row-body"><span class="dk-row-store">' + d.store + '</span>' +
        '<span class="dk-row-deal">' + d.headline + '</span></span>' +
        (d.pill ? '<span class="dk-pill">' + d.pill + '</span>' : '') + '</a>';
    }).join('') + '</div>';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMe);
  else initMe();
})();

// ---- §12 日付の帯(2026-09-21): 選んだ日でヒーローと一覧の両方を絞る ----
// 日ごとのヒーローはサーバーが全部選んで焼いてあるので、ここは見せ替えるだけ。
// 行は「その日に使えるか」(start ≤ その日 ≤ end、不明の側は縛らない)で絞り、8件で頭打ちにする。
(function () {
  'use strict';
  var ROWS_MAX = 8;
  function initStrip() {
    var days = document.getElementById('dk-days');
    var list = document.getElementById('dk-home-list');
    if (!days || !list) return;
    var slots = document.getElementById('dk-hero-slots');
    var titleEl = document.getElementById('dk-rows-title');
    var emptyEl = document.getElementById('dk-home-empty');
    var rows = Array.prototype.slice.call(list.querySelectorAll('.dk-row'));

    function availableOn(row, day) {
      var s = row.getAttribute('data-start') || '';
      var e = row.getAttribute('data-end') || '';
      if (s && s !== '不明' && s > day) return false;
      if (e && e !== '不明' && e < day) return false;
      return true;
    }
    function heroIdFor(day) {
      var slot = slots && slots.querySelector('.dk-hero-slot[data-day="' + day + '"]');
      var a = slot && slot.querySelector('.dk-hero');
      return a ? (a.getAttribute('data-deal') || '') : '';
    }
    function select(day, label) {
      days.querySelectorAll('.dk-day').forEach(function (b) {
        b.classList.toggle('is-on', b.getAttribute('data-day') === day);
      });
      if (slots) {
        slots.querySelectorAll('.dk-hero-slot').forEach(function (el) {
          el.hidden = el.getAttribute('data-day') !== day;
        });
      }
      if (titleEl && label) titleEl.textContent = label + 'に使えるお得';
      var heroId = heroIdFor(day), shown = 0;
      rows.forEach(function (row) {
        var ok = availableOn(row, day) && row.getAttribute('data-deal') !== heroId
          && shown < ROWS_MAX && !row.classList.contains('is-region-out');
        row.hidden = !ok;
        if (ok) shown++;
      });
      list.hidden = shown === 0;
      if (emptyEl) emptyEl.hidden = shown !== 0;
    }
    days.addEventListener('click', function (e) {
      var b = e.target.closest('.dk-day');
      if (!b) return;
      select(b.getAttribute('data-day'), b.getAttribute('data-label'));
    });
    var todayBtn = document.getElementById('dk-today');
    if (todayBtn) {
      todayBtn.addEventListener('click', function () {
        var first = days.querySelector('.dk-day');
        if (first) select(first.getAttribute('data-day'), first.getAttribute('data-label'));
      });
    }
    // 州の絞り込み(ヘッダーの地名)が行を隠したあとも、8件の頭打ちを数え直す
    window.dkReselectDay = function () {
      var on = days.querySelector('.dk-day.is-on') || days.querySelector('.dk-day');
      if (on) select(on.getAttribute('data-day'), on.getAttribute('data-label'));
    };
    var on = days.querySelector('.dk-day.is-on') || days.querySelector('.dk-day');
    if (on) select(on.getAttribute('data-day'), on.getAttribute('data-label'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStrip);
  else initStrip();
})();

// ---- §10 ディールの詳細(ボトムシート、2026-09-21) ----
// 行・ヒーローをタップしてもページを移らない。history.pushState で #d-<id> を積み、
// 端末の戻る操作(popstate)で閉じる。#d-<id> 付きで直接開かれたら、その状態で開く。
// 要約(§11)だけは別ファイルから1回だけ読む(無くてもシートは成立する)。
(function () {
  'use strict';
  var SAVED_KEY = 'pb_deals_saved_v1';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function savedGet() {
    try { var a = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function savedSet(a) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(a)); } catch (e) { /* ignore */ } }

  function initDealSheet() {
    var dataEl = document.getElementById('dk-deal-data');
    var sheet = document.getElementById('dk-deal-sheet');
    if (!dataEl || !sheet) return;
    var deals = {};
    try { deals = JSON.parse(dataEl.textContent) || {}; } catch (e) { deals = {}; }
    var summarySrc = dataEl.getAttribute('data-summary-src') || '';
    var summaries = null, summaryTried = false;
    var backdrop = document.getElementById('dk-sheet-backdrop');
    var current = null;

    var el = {
      logo: document.getElementById('dk-sheet-logo'),
      store: document.getElementById('dk-sheet-storename'),
      headline: document.getElementById('dk-sheet-headline'),
      summary: document.getElementById('dk-sheet-summary'),
      quote: document.getElementById('dk-sheet-quote'),
      facts: document.getElementById('dk-sheet-facts'),
      src: document.getElementById('dk-sheet-src'),
      open: document.getElementById('dk-sheet-open'),
      save: document.getElementById('dk-sheet-save'),
      storelink: document.getElementById('dk-sheet-storelink')
    };

    function row(label, value) {
      if (!value) return '';
      return '<div class="row"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
    }
    function renderSummary(id) {
      var s = summaries && summaries[id];
      if (el.summary) {
        el.summary.textContent = (s && s.summary) || '';
        el.summary.hidden = !(s && s.summary);
      }
      if (el.quote) {
        el.quote.textContent = (s && s.source_quote) || '';
        el.quote.hidden = !(s && s.source_quote);
      }
    }
    function loadSummaries(id) {
      if (summaries || summaryTried || !summarySrc) { renderSummary(id); return; }
      summaryTried = true;
      fetch(summarySrc, { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (j) { summaries = j || {}; renderSummary(id); })
        .catch(function () { summaries = {}; renderSummary(id); });   // 読めなくてもシートは成立する
    }
    function renderSaveBtn(id) {
      if (!el.save) return;
      var on = savedGet().indexOf(id) !== -1;
      el.save.classList.toggle('is-on', on);
      el.save.textContent = on ? '気になるに入れた' : '気になる';
    }
    function fill(d) {
      if (el.logo) el.logo.innerHTML = d.logo || '';
      if (el.store) el.store.textContent = d.store || '';
      if (el.headline) el.headline.textContent = d.headline || '';
      if (el.facts) {
        el.facts.innerHTML = row('条件', d.cond || d.cond_full) + row('対象者', d.who)
          + row('期間', d.period) + row('地域', d.region);
      }
      if (el.src) {
        var bits = [];
        if (d.sources && d.sources.length) bits.push('出どころ: ' + d.sources.join('・'));
        if (d.updated) bits.push('確認日: ' + d.updated);
        el.src.innerHTML = esc(bits.join(' ・ '));
      }
      if (el.open) {
        el.open.href = d.url || '#';
        el.open.hidden = !d.url;
      }
      if (el.storelink) el.storelink.href = d.href || '#';
      renderSaveBtn(d.id);
      renderSummary(d.id);
      loadSummaries(d.id);
    }
    function openDeal(id, push) {
      var d = deals[id];
      if (!d) return false;
      current = id;
      fill(d);
      if (backdrop) backdrop.hidden = false;
      sheet.hidden = false;
      if (push && location.hash !== '#d-' + id) {
        try { history.pushState({ deal: id }, '', '#d-' + id); } catch (e) { /* ignore */ }
      }
      return true;
    }
    function closeDeal(pop) {
      if (sheet.hidden) return;
      sheet.hidden = true;
      if (backdrop) backdrop.hidden = true;
      current = null;
      if (!pop && location.hash.indexOf('#d-') === 0) {
        try { history.back(); } catch (e) { /* ignore */ }
      }
    }

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-deal]');
      if (trigger) {
        var id = trigger.getAttribute('data-deal');
        if (deals[id]) { e.preventDefault(); openDeal(id, true); return; }
      }
      if (e.target.closest('#dk-sheet-save')) {
        if (!current) return;
        var ids = savedGet(), i = ids.indexOf(current);
        if (i === -1) ids.push(current); else ids.splice(i, 1);
        savedSet(ids); renderSaveBtn(current);
        return;
      }
      if (!sheet.hidden && e.target.closest('[data-dk-close]')) { closeDeal(false); return; }
    }, true);
    window.addEventListener('popstate', function () {
      var m = location.hash.match(/^#d-(.+)$/);
      if (m && deals[m[1]]) openDeal(m[1], false);
      else closeDeal(true);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDeal(false); });

    window.dkCloseDeal = function () { closeDeal(false); };

    // #d-<id> 付きで直接開かれたとき
    var m0 = location.hash.match(/^#d-(.+)$/);
    if (m0) openDeal(m0[1], false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDealSheet);
  else initDealSheet();
})();
