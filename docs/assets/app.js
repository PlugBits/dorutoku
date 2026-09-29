var DK_ICON_CHECK = '<svg class="dk-vicon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
var DK_ICON_HELP = '<svg class="dk-vicon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';

(function () {
  'use strict';

  window.personalApi = window.personalApi || {
    savedGet: function () {
      try {
        var raw = localStorage.getItem('pb_deals_saved_v1');
        var arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    },
    savedSet: function (ids) {
      try { localStorage.setItem('pb_deals_saved_v1', JSON.stringify(ids)); } catch (e) {  }
    },

    singlesAlwaysGet: function () {
      try { return localStorage.getItem('pb_deals_singles_always_v1') === '1'; } catch (e) { return false; }
    },
    singlesAlwaysSet: function (on) {
      try { localStorage.setItem('pb_deals_singles_always_v1', on ? '1' : '0'); } catch (e) {  }
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
      } catch (e) {  }
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
        if (!cardsWrap) return;
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
      if (!chipWrap || !chip) return;
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

    function trackOutbound(slug) {
      try { history.pushState({}, '', (location.pathname.indexOf('/deals') === 0 ? '/deals' : '') + '/out/' + slug + '/'); } catch (e) {  }
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
    } catch (e) {  }
  }

  function initV3() {
    var head = document.querySelector('.dk-head');
    if (!head) return;
    var zipTable = readJSON('zip-states') || { ranges: [], labels: {} };
    var due = readJSON('dk-due-data') || [];

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

    function regionOk(el) {
      if (!state) return true;
      var attr = el.getAttribute('data-region') || 'unknown';
      if (attr === 'all' || attr === 'online' || attr === 'unknown') return true;
      return attr.split(',').indexOf(state) !== -1;
    }

    var backdrop = document.getElementById('dk-sheet-backdrop');
    function openSheet(id) {
      var sheet = document.getElementById(id);
      if (!sheet || !backdrop) return;
      backdrop.hidden = false;
      sheet.hidden = false;
      if (window.dkSyncScrollLock) window.dkSyncScrollLock();
    }
    function closeSheets() {
      if (backdrop) backdrop.hidden = true;
      ['dk-loc-sheet', 'dk-due-sheet'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = true;
      });

      if (typeof window.dkCloseDeal === 'function') window.dkCloseDeal();
      if (window.dkSyncScrollLock) window.dkSyncScrollLock();
    }
    if (backdrop) backdrop.addEventListener('click', closeSheets);
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-dk-close]')) { closeSheets(); return; }
      if (e.target.closest('#dk-loc')) { openSheet('dk-loc-sheet'); return; }
      if (e.target.closest('#dk-bell')) { openSheet('dk-due-sheet'); return; }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheets(); });

    var dueList = document.getElementById('dk-due-list');
    if (dueList) {
      dueList.innerHTML = due.length ? due.map(function (d) {
        return '<a class="dk-row" href="' + esc(d.slug ? (dueList.getAttribute('data-base') || '') + d.slug + '/' : '#') + '">' +
          '<span class="dk-row-body"><span class="dk-row-store">' + esc(d.store) + '</span>' +
          '<span class="dk-row-deal">' + esc(d.headline) + '</span></span>' +
          (d.pill ? '<span class="dk-pill soon">' + esc(d.pill) + '</span>' : '') + '</a>';
      }).join('') : '<p class="dk-empty">期限が近いお得はありません</p>';
    }

    var zipInput = document.getElementById('zip-input'), zipNote = document.getElementById('zip-note');
    if (zipInput) {
      if (saved && saved.zip) zipInput.value = saved.zip;
      zipInput.addEventListener('input', function () {
        var raw = zipInput.value;
        if (String(raw || '').trim() === '') { state = null; zipSave(null); renderLoc(); applyFilters(); return; }
        if (!/^\s*\d{5}/.test(String(raw))) return;
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

(function () {
  'use strict';
  function initMe() {
    var locBtn = document.getElementById('dk-me-loc');
    var listEl = document.getElementById('dk-saved-list');
    if (!locBtn && !listEl) return;

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

(function () {
  'use strict';
  var IDS = ['dk-deal-sheet', 'dk-loc-sheet', 'dk-due-sheet', 'dk-import-sheet'];
  var y = 0, locked = false;
  function anyOpen() {
    for (var i = 0; i < IDS.length; i++) {
      var el = document.getElementById(IDS[i]);
      if (el && !el.hidden) return true;
    }
    return false;
  }
  function lock() {
    if (locked) return;
    y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var b = document.body;
    b.style.position = 'fixed';
    b.style.top = -y + 'px';
    b.style.left = '0';
    b.style.right = '0';
    b.style.width = '100%';
    locked = true;
  }
  function unlock() {
    if (!locked) return;
    var b = document.body;
    b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.right = ''; b.style.width = '';
    locked = false;
    window.scrollTo(0, y);
  }

  window.dkSyncScrollLock = function () { if (anyOpen()) lock(); else unlock(); };
})();

(function () {
  'use strict';
  var SAVED_KEY = 'pb_deals_saved_v1';
  var MAX_SHARE = 50;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function savedGet() {
    try { var a = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function savedSet(a) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(a)); } catch (e) {  } }

  function catalogs() {
    var out = [];
    ['dk-saved-catalog', 'dk-deal-data'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      try { out.push(JSON.parse(el.textContent) || {}); } catch (e) {  }
    });
    return out;
  }
  function lookup(id) {
    var cs = catalogs();
    for (var i = 0; i < cs.length; i++) { if (cs[i][id]) return cs[i][id]; }
    return null;
  }

  function validIds(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (raw) {
      var id = String(raw || '').trim();
      if (!/^d-\d{8}-[0-9a-z]{4}$/.test(id) || seen[id]) return;
      seen[id] = 1; out.push(id);
    });
    return out;
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  function initExport() {
    var box = document.getElementById('dk-saved-out');
    var copyBtn = document.getElementById('dk-saved-copy');
    var linkBtn = document.getElementById('dk-saved-link');
    var msg = document.getElementById('dk-saved-msg');
    var ta = document.getElementById('dk-saved-ta');
    if (!box || !copyBtn || !linkBtn) return;
    var ids = validIds(savedGet());
    if (!ids.length) return;
    box.hidden = false;

    function say(text) { if (!msg) return; msg.textContent = text; msg.hidden = false; }
    function showFallback(text) {
      if (!ta) return;
      ta.value = text; ta.hidden = false; ta.focus(); ta.select();
    }
    function limited() {
      return ids.length > MAX_SHARE ? ids.slice(0, MAX_SHARE) : ids;
    }

    copyBtn.addEventListener('click', function () {
      var lines = ids.map(function (id) {
        var d = lookup(id);
        if (!d) return id;
        return [d.store || '', d.headline || '', d.period || '期限なし', d.url || ''].join(' / ');
      });
      var text = lines.join('\n');
      copyText(text).then(function () { say(ids.length + '件をコピーしました。'); })
        .catch(function () { say('コピーできなかったので、下の文字を選んで写してください。'); showFallback(text); });
    });

    linkBtn.addEventListener('click', function () {
      var use = limited();
      var url = location.origin + location.pathname + '#saved=' + use.join(',');
      var note = use.length < ids.length
        ? ('50件まで持ち出せます(' + ids.length + '件のうち先頭' + use.length + '件のリンクを作りました)。')
        : (use.length + '件のリンクを作りました。');
      function done(how) { say(note + how); }
      if (navigator.share) {
        navigator.share({ url: url }).then(function () { done(''); })
          .catch(function () { copyText(url).then(function () { done('リンクをコピーしました。'); })
            .catch(function () { done(''); showFallback(url); }); });
      } else {
        copyText(url).then(function () { done('リンクをコピーしました。'); })
          .catch(function () { done(''); showFallback(url); });
      }
    });
  }

  function initImport() {
    var m = location.hash.match(/^#saved=(.*)$/);
    if (!m) return;
    var incoming = validIds(decodeURIComponent(m[1]).split(','));
    var sheet = document.getElementById('dk-import-sheet');
    var lead = document.getElementById('dk-import-lead');
    var listEl = document.getElementById('dk-import-list');
    var goBtn = document.getElementById('dk-import-go');
    var msg = document.getElementById('dk-import-msg');
    var backdrop = document.getElementById('dk-sheet-backdrop');
    if (!sheet || !incoming.length) return;

    var mine = validIds(savedGet());
    var add = incoming.filter(function (id) { return mine.indexOf(id) === -1; });
    if (lead) {
      lead.textContent = incoming.length + '件が入ったリンクです。'
        + (add.length === incoming.length ? 'すべてこの端末にはまだありません。'
           : (add.length ? ('うち' + add.length + '件がこの端末にはまだありません。')
              : 'すべてこの端末にすでにあります。'));
    }
    if (listEl) {
      listEl.innerHTML = '<div class="dk-list">' + incoming.map(function (id) {
        var d = lookup(id);
        var already = mine.indexOf(id) !== -1;
        var store = d ? esc(d.store) : 'このページでは名前が分かりません';
        var head = d ? esc(d.headline) : esc(id);
        return '<div class="dk-row">' +
          '<span class="dk-row-body"><span class="dk-row-store">' + store + '</span>' +
          '<span class="dk-row-deal">' + head + '</span></span>' +
          (already ? '<span class="dk-pill">保存ずみ</span>' : '') + '</div>';
      }).join('') + '</div>';
    }
    if (goBtn) {
      goBtn.disabled = false;
      goBtn.textContent = 'この端末のリストに取り込む';
      if (msg) { msg.hidden = true; msg.textContent = ''; }

      goBtn.onclick = function () {
        var now = validIds(savedGet());
        var added = 0;
        incoming.forEach(function (id) { if (now.indexOf(id) === -1) { now.push(id); added++; } });
        savedSet(now);
        if (msg) {
          msg.textContent = added ? (added + '件を取り込みました。Me の気になるリストに入っています。')
                                  : 'すでに全部この端末にありました。';
          msg.hidden = false;
        }
        goBtn.disabled = true;
        goBtn.textContent = '取り込みました';
      };
    }
    if (backdrop) backdrop.hidden = false;
    sheet.hidden = false;
    if (window.dkSyncScrollLock) window.dkSyncScrollLock();
  }

  function init() { initExport(); initImport(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.addEventListener('hashchange', initImport);
})();

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

      var s = row.getAttribute('data-from') || row.getAttribute('data-start') || '';
      var e = row.getAttribute('data-end') || '';
      if (s && s !== '不明' && s > day) return false;
      if (e && e !== '不明' && e < day) return false;
      return true;
    }

    function notYet(row, day) {
      var st = row.getAttribute('data-start') || '';
      return !!st && st !== '不明' && day < st;
    }

    function stockNote(row, day) {
      var st = row.getAttribute('data-start') || '';
      return row.getAttribute('data-stock') === '店頭現物' && !!st && st !== '不明' && st === day;
    }
    function markSoon(row, day) {
      var body = row.querySelector('.dk-row-body');
      if (!body) return;
      var tag = body.querySelector('.dk-row-soon');
      if (notYet(row, day)) {
        if (!tag) {
          tag = document.createElement('span');
          tag.className = 'dk-row-soon';
          tag.textContent = '明日から';
          body.appendChild(tag);
        }
      } else if (tag) {
        tag.remove();
      }
      var stockTag = body.querySelector('.dk-row-stock');
      if (stockNote(row, day)) {
        if (!stockTag) {
          stockTag = document.createElement('span');
          stockTag.className = 'dk-row-stock';
          stockTag.textContent = '朝のうちに無くなることがあります';
          body.appendChild(stockTag);
        }
      } else if (stockTag) {
        stockTag.remove();
      }
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
        if (ok) { shown++; markSoon(row, day); }
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

(function () {
  'use strict';
  var SAVED_KEY = 'pb_deals_saved_v1';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function mdLabel(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? (parseInt(m[2], 10) + '/' + parseInt(m[3], 10)) : '';
  }
  function savedGet() {
    try { var a = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function savedSet(a) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(a)); } catch (e) {  } }

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
      verify: document.getElementById('dk-sheet-verify'),
      open: document.getElementById('dk-sheet-open'),
      save: document.getElementById('dk-sheet-save'),
      storelink: document.getElementById('dk-sheet-storelink')
    };

    function row(label, value) {
      if (!value) return '';
      return '<div class="row"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
    }

    function bold(t) {
      return t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }
    function fmtSummary(src) {
      var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
      var out = [], para = [], list = [];
      function flushList() {
        if (!list.length) return;
        out.push('<ol>' + list.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>');
        list = [];
      }
      function flushPara() {
        if (!para.length) return;
        out.push('<p>' + para.join('<br>') + '</p>');
        para = [];
      }
      lines.forEach(function (raw) {
        var t = esc(raw.trim());
        if (!t) { flushList(); flushPara(); return; }
        var mh = t.match(/^#{2,4}\s+(.+)$/);
        if (mh) { flushList(); flushPara(); out.push('<h4>' + bold(mh[1]) + '</h4>'); return; }
        var ml = t.match(/^\d+[.)]\s+(.+)$/);
        if (ml) { flushPara(); list.push(bold(ml[1])); return; }
        flushList();
        para.push(bold(t));
      });
      flushList(); flushPara();
      return out.join('');
    }
    function renderSummary(id) {
      var s = summaries && summaries[id];
      if (el.summary) {
        el.summary.innerHTML = (s && s.summary) ? fmtSummary(s.summary) : '';
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
        .catch(function () { summaries = {}; renderSummary(id); });
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
          + row('期間', d.period) + row('地域', d.region) + row('手元メモ', d.personal);
      }
      if (el.src) {

        var site = d.source_site || (d.sources || []).join('・');
        var bits = [];

        var ok = d.verified === '公式';
        if (ok) {
          var kind = d.source_kind;
          var where = kind === 'official' ? ('公式ページ(' + site + ')')
            : kind === 'roundup' ? (site + '(非公式のまとめ)') : site;
          if (site) bits.push('情報元: ' + where);
        }
        if (el.verify) {
          var at = mdLabel(d.verified_at);
          el.verify.className = 'dk-sheet-verify ' + (ok ? 'is-ok' : 'is-un');
          el.verify.innerHTML = ok
            ? DK_ICON_CHECK + esc('店の公式ページで確認しました' + (at ? '(' + at + ')' : '') + '。条件は変わることがあります。')
            : DK_ICON_HELP + esc('店の公式ページではまだ確認できていません' + (at ? '(' + at + ' 時点)' : '') + '。情報元: '
              + (site ? site + (d.source_kind === 'official' ? '' : '(非公式のまとめ)') : '(非公式のまとめ)')
              + '。行く前に店のアプリか公式ページで確かめてください。');
        }
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
      if (window.dkSyncScrollLock) window.dkSyncScrollLock();
      if (push && location.hash !== '#d-' + id) {
        try { history.pushState({ deal: id }, '', '#d-' + id); } catch (e) {  }
      }
      return true;
    }
    function closeDeal(pop) {
      if (sheet.hidden) return;
      sheet.hidden = true;
      if (backdrop) backdrop.hidden = true;
      if (window.dkSyncScrollLock) window.dkSyncScrollLock();
      current = null;
      if (!pop && location.hash.indexOf('#d-') === 0) {
        try { history.back(); } catch (e) {  }
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

    var m0 = location.hash.match(/^#d-(.+)$/);
    if (m0) openDeal(m0[1], false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDealSheet);
  else initDealSheet();
})();

(function () {
  function initIgBand() {
    var closeBtn = document.getElementById('dk-ig-band-close');
    var band = document.getElementById('dk-ig-band');
    if (!closeBtn || !band) return;
    closeBtn.addEventListener('click', function () {
      band.hidden = true;
      try { localStorage.setItem('dk_ig_band_closed', '1'); } catch (e) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initIgBand);
  else initIgBand();
})();

(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtUsd(n) {
    n = Math.round((Number(n) || 0) * 100) / 100;
    if (n === 0) n = 0;
    var isInt = Math.abs(n - Math.round(n)) < 1e-9;
    if (isInt) return '$' + Math.round(n).toLocaleString('en-US');
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function mdLabel(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return '';
    return parseInt(m[2], 10) + '/' + parseInt(m[3], 10);
  }

  function initAnnualFeeTool() {
    var dataEl = document.getElementById('dk-af-data');
    var app = document.getElementById('dk-af-app');
    if (!dataEl || !app) return;
    var cards = [];
    try { cards = JSON.parse(dataEl.textContent) || []; } catch (e) { cards = []; }
    if (!cards.length) return;

    var pickList = document.getElementById('dk-af-pick-list');
    var stepPick = document.getElementById('dk-af-step-pick');
    var stepBenefits = document.getElementById('dk-af-step-benefits');
    var stepResult = document.getElementById('dk-af-step-result');
    var cardTitleEl = document.getElementById('dk-af-card-title');
    var feeLineEl = document.getElementById('dk-af-fee-line');
    var benefitListEl = document.getElementById('dk-af-benefit-list');
    var unvaluedWrap = document.getElementById('dk-af-unvalued');
    var unvaluedListEl = document.getElementById('dk-af-unvalued-list');
    var calcBtn = document.getElementById('dk-af-calc-btn');
    var resultSumEl = document.getElementById('dk-af-result-sum');
    var resultTextEl = document.getElementById('dk-af-result-text');
    var resultNoteEl = document.getElementById('dk-af-result-note');
    if (!pickList || !stepPick || !stepBenefits || !stepResult || !benefitListEl || !calcBtn) return;

    var currentCard = null;

    var state = {};

    function verifyMarkHtml(b) {
      if (b.verified) {
        var label = '公式ページで確認' + (b.as_of ? ('(' + mdLabel(b.as_of) + ')') : '');
        if (b.source_url) {
          return '<a class="dk-vmark is-ok" href="' + esc(b.source_url) +
                 '" target="_blank" rel="noopener">' + DK_ICON_CHECK + esc(label) + '</a>';
        }
        return '<span class="dk-vmark is-ok">' + DK_ICON_CHECK + esc(label) + '</span>';
      }

      return '<span class="dk-vmark is-un">' + DK_ICON_HELP + '出どころ未確認(プレビュー)</span>';
    }

    function benefitRowHtml(b, j) {
      var amt = (typeof b.annual_usd === 'number') ? fmtUsd(b.annual_usd) : '';
      return '' +
        '<div class="dk-af-benefit" data-af-idx="' + j + '">' +
          '<label class="dk-af-benefit-check">' +
            '<input type="checkbox" class="dk-af-use-check">' +
            '<span class="dk-af-benefit-label">' + esc(b.label_ja) + '</span>' +
          '</label>' +
          '<p class="dk-af-benefit-amount"><strong>' + esc(amt) + '</strong>' +
            (b.provisional ? '<span class="badge badge-check">仮の金額(プレビュー)</span>' : '') +
            (b.period_note ? '<span class="dk-af-benefit-period">' + esc(b.period_note) + '</span>' : '') +
          '</p>' +
          (b.note ? '<p class="dk-af-benefit-note">' + esc(b.note) + '</p>' : '') +
          '<div class="dk-af-benefit-input" hidden>' +
            '<label class="dk-af-amount-label">使う額(年額)' +
              '<input type="number" class="dk-af-amount-input" min="0" max="' + b.annual_usd +
              '" step="0.01" value="' + b.annual_usd + '">' +
            '</label>' +
          '</div>' +
          '<p class="dk-af-benefit-verify">' + verifyMarkHtml(b) + '</p>' +
        '</div>';
    }

    function unvaluedRowHtml(b) {
      return '' +
        '<li class="dk-af-unvalued-item">' +
          '<p class="dk-af-unvalued-label">' + esc(b.label_ja) +
            (b.amount ? '<span class="dk-af-unvalued-amount">(' + esc(b.amount) + ')</span>' : '') +
          '</p>' +
          (b.period_note ? '<p class="dk-af-benefit-period">' + esc(b.period_note) + '</p>' : '') +
          (b.note ? '<p class="dk-af-benefit-note">' + esc(b.note) + '</p>' : '') +
          '<p class="dk-af-benefit-verify">' + verifyMarkHtml(b) + '</p>' +
        '</li>';
    }

    function issuerGroupsHtml() {
      var html = '', lastIssuer = null, open = false;
      cards.forEach(function (c, i) {
        if (c.issuer !== lastIssuer) {
          if (open) html += '</div>';
          html += '<div class="dk-af-issuer-group"><h3 class="dk-af-issuer-name">' + esc(c.issuer) + '</h3>';
          lastIssuer = c.issuer; open = true;
        }
        html += '<button type="button" class="dk-af-card-pick" data-af-pick="' + i + '">' +
          '<span class="dk-af-card-pick-ja">' + esc(c.name_ja) + '</span>' +
          '<span class="dk-af-card-pick-en">' + esc(c.name_en) + '</span>' +
          (c.unverified ? '<span class="dk-vmark is-un">' + DK_ICON_HELP + '出どころ未確認(プレビュー)</span>' : '') +
          '</button>';
      });
      if (open) html += '</div>';
      return html;
    }
    pickList.innerHTML = issuerGroupsHtml();

    function showStep(name) {
      stepPick.hidden = name !== 'pick';
      stepBenefits.hidden = name !== 'benefits';
      stepResult.hidden = name !== 'result';
      try { window.scrollTo(0, 0); } catch (e) {  }
    }

    function selectCard(i) {
      currentCard = cards[i];
      if (!currentCard) return;
      state = {};
      (currentCard.benefits_valued || []).forEach(function (b, j) {
        state[j] = { used: false, amount: (typeof b.annual_usd === 'number') ? b.annual_usd : 0 };
      });
      if (cardTitleEl) cardTitleEl.textContent = currentCard.name_ja;
      if (feeLineEl) {
        feeLineEl.textContent = currentCard.first_year_waived
          ? ('初年度は無料・2年目から' + fmtUsd(currentCard.annual_fee))
          : ('年会費 ' + fmtUsd(currentCard.annual_fee));
      }
      benefitListEl.innerHTML = (currentCard.benefits_valued || []).map(benefitRowHtml).join('');
      var uv = currentCard.benefits_unvalued || [];
      if (unvaluedWrap && unvaluedListEl) {
        if (uv.length) {
          unvaluedWrap.hidden = false;
          unvaluedListEl.innerHTML = uv.map(unvaluedRowHtml).join('');
        } else {
          unvaluedWrap.hidden = true;
          unvaluedListEl.innerHTML = '';
        }
      }
      showStep('benefits');
    }

    pickList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-af-pick]');
      if (!btn) return;
      var i = parseInt(btn.getAttribute('data-af-pick'), 10);
      if (!isNaN(i)) selectCard(i);
    });

    benefitListEl.addEventListener('change', function (e) {
      var row = e.target.closest('.dk-af-benefit');
      if (!row) return;
      var idx = row.getAttribute('data-af-idx');
      if (!state[idx]) state[idx] = { used: false, amount: 0 };
      if (e.target.classList.contains('dk-af-use-check')) {
        state[idx].used = e.target.checked;
        var wrap = row.querySelector('.dk-af-benefit-input');
        if (wrap) wrap.hidden = !e.target.checked;
      } else if (e.target.classList.contains('dk-af-amount-input')) {
        var max = parseFloat(e.target.getAttribute('max'));
        if (isNaN(max)) max = 0;
        var v = parseFloat(e.target.value);
        if (isNaN(v) || v < 0) v = 0;
        if (v > max) v = max;
        e.target.value = v;
        state[idx].amount = v;
      }
    });

    calcBtn.addEventListener('click', function () {
      if (!currentCard) return;
      var sum = 0, allMax = true;
      (currentCard.benefits_valued || []).forEach(function (b, j) {
        var s = state[j] || {};
        if (!s.used) return;
        var cap = (typeof b.annual_usd === 'number') ? b.annual_usd : 0;
        var amt = (typeof s.amount === 'number') ? s.amount : cap;
        sum += amt;
        if (amt < cap - 0.005) allMax = false;
      });
      var fee = currentCard.annual_fee || 0;
      var diff = sum - fee;
      if (resultSumEl) {
        resultSumEl.textContent = '特典の合計 ' + fmtUsd(sum) + ' − 年会費 ' + fmtUsd(fee) + ' = 年 ' +
          (diff >= 0 ? '+' : '−') + fmtUsd(Math.abs(diff));
      }
      if (resultTextEl) {
        var prefix = allMax ? '上限いっぱい使った場合、' : 'この使い方なら、';
        var tail;
        if (diff > 0.005) tail = '特典の合計は年会費より ' + fmtUsd(diff) + ' 多くなります。';
        else if (diff < -0.005) tail = '特典の合計は年会費より ' + fmtUsd(Math.abs(diff)) + ' 少なくなります。';
        else tail = '特典の合計と年会費は同じ額です。';
        resultTextEl.textContent = prefix + tail;
      }
      if (resultNoteEl) {
        var uvCount = (currentCard.benefits_unvalued || []).length;
        if (uvCount > 0) {
          resultNoteEl.hidden = false;
          resultNoteEl.textContent = 'ほかに金額にしない特典が' + uvCount +
            '件あります(マイル・無料宿泊など)。使う人は、上の差額より実際は多くなります。';
        } else {
          resultNoteEl.hidden = true;
          resultNoteEl.textContent = '';
        }
      }
      showStep('result');
    });

    app.addEventListener('click', function (e) {
      var back = e.target.closest('[data-af-back]');
      if (!back) return;
      showStep(back.getAttribute('data-af-back'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAnnualFeeTool);
  else initAnnualFeeTool();
})();
