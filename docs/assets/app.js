var DK_ICON_CHECK = '<svg class="dk-vicon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
var DK_ICON_HELP = '<svg class="dk-vicon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';

window.dkCardsFromHash = function (hash) {
  var m = /(?:^|&)cards=([^&]*)/.exec((hash || '').replace(/^#/, ''));
  if (!m) return [];
  try { return decodeURIComponent(m[1]).split(',').filter(Boolean); } catch (e) { return []; }
};

window.dkMergeCardsIntoHref = function (href, cards) {
  if (!href || !cards || !cards.length) return href;
  var hashIdx = href.indexOf('#');
  if (hashIdx === -1) return href + '#cards=' + cards.join(',');
  var base = href.slice(0, hashIdx);
  var hash = href.slice(hashIdx + 1);
  var m = /(?:^|&)cards=([^&]*)/.exec(hash);
  if (!m) return base + '#' + hash + (hash ? '&' : '') + 'cards=' + cards.join(',');
  var existing = [];
  try { existing = decodeURIComponent(m[1]).split(',').filter(Boolean); } catch (e) { existing = []; }
  var merged = existing.slice();
  cards.forEach(function (s) { if (merged.indexOf(s) === -1) merged.push(s); });
  var at = hash.indexOf(m[0]);
  var replaced = m[0].slice(0, m[0].length - m[1].length) + merged.join(',');
  hash = hash.slice(0, at) + replaced + hash.slice(at + m[0].length);
  return base + '#' + hash;
};

(function () {
  'use strict';

  function isCardsCarryTarget(href) {
    if (!href) return false;
    if (href.charAt(0) === '#') return false;
    if (href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 ||
        href.indexOf('javascript:') === 0) return false;
    var path = href;
    if (href.indexOf('https://dorutoku.com/') === 0) {
      path = href.slice('https://dorutoku.com'.length);

    } else if (href.charAt(0) !== '/') {
      return false;
    }
    if (/\.(css|js|mjs|png|jpe?g|gif|svg|webp|ico|json|xml|txt|webmanifest|pdf)(\?|#|$)/i.test(path)) {
      return false;
    }
    return true;
  }

  function applyCardsCarry() {
    var cards = window.dkCardsFromHash(location.hash);
    if (!cards.length) return;
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
      var href = a.getAttribute('href');
      if (!isCardsCarryTarget(href)) return;
      var next = window.dkMergeCardsIntoHref(href, cards);
      if (next !== href) a.setAttribute('href', next);
    });
  }

  window.dkApplyCardsCarry = applyCardsCarry;

  function run() { applyCardsCarry(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  window.addEventListener('hashchange', run);
})();

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

      if (window.dkApplyCardsCarry) window.dkApplyCardsCarry();
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

      var carriedCards = (window.dkCardsFromHash ? window.dkCardsFromHash(location.hash) : []);
      var url = location.origin + location.pathname + '#saved=' + use.join(',')
        + (carriedCards.length ? '&cards=' + carriedCards.join(',') : '');
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

    var m = /(?:^|&)saved=([^&]*)/.exec((location.hash || '').replace(/^#/, ''));
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
      if (push) {

        var carriedCards = (window.dkCardsFromHash ? window.dkCardsFromHash(location.hash) : []);
        var newHash = '#d-' + id + (carriedCards.length ? '&cards=' + carriedCards.join(',') : '');
        if (location.hash !== newHash) {
          try { history.pushState({ deal: id }, '', newHash); } catch (e) {  }
          if (window.dkApplyCardsCarry) window.dkApplyCardsCarry();
        }
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
      var m = /^#d-([^&]+)/.exec(location.hash || '');
      if (m && deals[m[1]]) openDeal(m[1], false);
      else closeDeal(true);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDeal(false); });

    window.dkCloseDeal = function () { closeDeal(false); };

    var m0 = /^#d-([^&]+)/.exec(location.hash || '');
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
    if (document.getElementById('dk-af-bar')) document.body.classList.add('has-af-bar');
    var cards = [];
    try { cards = JSON.parse(dataEl.textContent) || []; } catch (e) { cards = []; }
    if (!cards.length) return;

    var cardSelect = document.getElementById('dk-af-card-select');
    var benefitsWrap = document.getElementById('dk-af-benefits-wrap');
    var benefitListEl = document.getElementById('dk-af-benefit-list');
    var unvaluedWrap = document.getElementById('dk-af-unvalued');
    var unvaluedListEl = document.getElementById('dk-af-unvalued-list');
    var bar = document.getElementById('dk-af-bar');
    var barPlaceholderEl = document.getElementById('dk-af-bar-placeholder');
    var barInnerEl = document.getElementById('dk-af-bar-inner');
    var barNumEl = document.getElementById('dk-af-bar-num');
    var barFormulaEl = document.getElementById('dk-af-bar-formula');
    var barPhraseEl = document.getElementById('dk-af-bar-phrase');
    var barNeutralEl = document.getElementById('dk-af-bar-neutral');
    var sheet = document.getElementById('dk-af-sheet');
    var sheetBackdrop = document.getElementById('dk-af-sheet-backdrop');
    var sheetBody = document.getElementById('dk-af-sheet-body');
    var disclaimerSrcEl = document.getElementById('dk-af-disclaimer-src');
    if (!cardSelect || !benefitsWrap || !benefitListEl || !bar || !barPlaceholderEl || !barInnerEl ||
        !barNumEl || !barFormulaEl || !barPhraseEl || !barNeutralEl || !sheet || !sheetBackdrop || !sheetBody) return;

    var currentCard = null;

    var carriedCards = [];

    var state = {};

    var touchedState = false;

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

    function toggleDetail(btn) {
      var id = btn.getAttribute('aria-controls');
      var panel = id && document.getElementById(id);
      if (!panel) return;
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.hidden = open;
    }

    function detailBodyHtml(b) {

      var periodText = (typeof b.rate === 'number') ? '' : b.period_note;
      var amountLine = esc(b.amount) + (periodText ? ' ・ ' + esc(periodText) : '');
      return '' +

        (b.no_amount_reason ? '<p class="dk-af-detail-reason">' + esc(b.no_amount_reason) + '</p>' : '') +
        '<p class="dk-af-detail-amount">' + amountLine +
          (b.provisional ? ' <span class="badge badge-check">仮の金額(プレビュー)</span>' : '') +
        '</p>' +
        (b.ends_label ? '<p class="dk-af-detail-ends">' + esc(b.ends_label) + '</p>' : '') +
        (b.note ? '<p class="dk-af-detail-note">' + esc(b.note) + '</p>' : '') +
        (typeof b.rate === 'number' && typeof b.annual_usd === 'number'
          ? '<p class="dk-af-step-hint">使う額は −/+ で' + esc(fmtUsd(b.spend_step || 50)) + 'ずつ。' +
              esc(pctText(b.rate)) + 'なので、' + esc(fmtUsd(b.annual_usd / b.rate)) + '使うと上限の' +
              esc(fmtUsd(b.annual_usd)) + 'に届きます</p>'
          : countMax(b)
          ? '<p class="dk-af-step-hint">−/+ で使う回数を変えます(年' + countMax(b) + '回まで。0回は使わない)</p>'
          : typeof b.step_usd === 'number'
          ? '<p class="dk-af-step-hint">' + (b.step_tenth
              ? '−/+ で' + esc(fmtUsd(b.step_usd)) + 'ずつ(使った額に合わせて直せます)'
              : '−/+ で1回分(' + esc(fmtUsd(b.step_usd)) + ')ずつ') + '</p>' : '') +
        '<p class="dk-af-detail-verify">' + verifyMarkHtml(b) + '</p>';
    }

    function pctText(rate) {
      var p = Math.round(rate * 10000) / 100;
      return (Math.abs(p - Math.round(p)) < 1e-9 ? String(Math.round(p)) : String(p)) + '%';
    }

    function countMax(b) {
      if (typeof b.rate === 'number' || b.step_tenth || b.needs_spend) return 0;
      if (typeof b.step_usd !== 'number' || !(b.step_usd > 0) || typeof b.annual_usd !== 'number') return 0;

      var n = Math.round(b.annual_usd / b.step_usd);
      return n > 1 ? n : 0;
    }

    function rowMode(b) {
      if (countMax(b)) return 'count';
      if (typeof b.rate === 'number') return 'rate';
      if (b.step_tenth && typeof b.step_usd === 'number') return 'tenth';
      return 'binary';
    }

    function stepperShellHtml(minusAttrs, minusLabel, plusAttrs, plusLabel) {
      return '<div class="dk-af-stepper">' +
        '<button type="button" class="dk-af-stepper-btn" ' + minusAttrs + ' aria-label="' + esc(minusLabel) + '">−</button>' +
        '<span class="dk-af-stepper-mid" data-af-mid></span>' +
        '<button type="button" class="dk-af-stepper-btn" ' + plusAttrs + ' aria-label="' + esc(plusLabel) + '">+</button>' +
      '</div>';
    }

    function stepperHtmlForMode(b, mode) {
      if (mode === 'count') {
        return stepperShellHtml('data-af-cnt="-1"', '回数を1回減らす', 'data-af-cnt="1"', '回数を1回増やす');
      }
      if (mode === 'rate') {
        var spendStep = b.spend_step || 50;
        return stepperShellHtml('data-af-spend="-1"', '使う額を' + fmtUsd(spendStep) + '減らす',
          'data-af-spend="1"', '使う額を' + fmtUsd(spendStep) + '増やす');
      }
      if (mode === 'tenth') {
        return stepperShellHtml('data-af-step="-1"', fmtUsd(b.step_usd) + '減らす',
          'data-af-step="1"', fmtUsd(b.step_usd) + '増やす');
      }
      return '';
    }

    function updateRowView(row) {
      var idx = row.getAttribute('data-af-idx');
      var mode = row.getAttribute('data-af-mode');
      var b = currentCard && (currentCard.benefits_valued || [])[parseInt(idx, 10)];
      if (!b) return;
      if (!state[idx]) state[idx] = { used: false, amount: 0 };
      var s = state[idx];
      var used = !!s.used;
      var cap = (typeof b.annual_usd === 'number') ? b.annual_usd : 0;
      var midText = '', basisText = '', amount = 0;
      var minusBtn = row.querySelector('[data-af-cnt="-1"],[data-af-spend="-1"],[data-af-step="-1"]');
      var plusBtn = row.querySelector('[data-af-cnt="1"],[data-af-spend="1"],[data-af-step="1"]');

      if (mode === 'count') {
        var max = countMax(b);
        var n = (typeof s.count === 'number') ? s.count : max;
        midText = n + '回';
        amount = used ? Math.round(b.step_usd * n * 100) / 100 : 0;
        basisText = fmtUsd(b.step_usd) + ' × ' + n + '回';
        if (minusBtn) minusBtn.disabled = n <= 0;
        if (plusBtn) plusBtn.disabled = n >= max;
      } else if (mode === 'rate') {
        var spend = (typeof s.spend === 'number') ? s.spend : 0;
        var amt = Math.min(Math.round(spend * b.rate * 100) / 100, cap);
        midText = fmtUsd(spend);
        amount = used ? amt : 0;
        basisText = fmtUsd(spend) + ' × ' + pctText(b.rate);
        if (minusBtn) minusBtn.disabled = spend <= 0.005;
        if (plusBtn) plusBtn.disabled = amt >= cap - 0.005;
      } else if (mode === 'tenth') {
        var v = (typeof s.spend === 'number') ? s.spend : 0;
        midText = fmtUsd(v);
        amount = used ? v : 0;
        basisText = '年' + fmtUsd(cap) + 'まで';
        if (minusBtn) minusBtn.disabled = v <= 0.005;
        if (plusBtn) plusBtn.disabled = v >= cap - 0.005;
      } else {

        amount = used ? cap : 0;

        basisText = (typeof b.step_usd === 'number' && b.step_usd > 0 && typeof b.annual_usd === 'number')
          ? fmtUsd(b.step_usd) + ' × 年' + Math.round(b.annual_usd / b.step_usd) + '回' : '';
      }

      s.amount = amount;

      var midEl = row.querySelector('[data-af-mid]');
      var amountEl = row.querySelector('[data-af-amount]');
      var basisEl = row.querySelector('[data-af-basis]');
      if (midEl) midEl.textContent = midText;
      if (amountEl) amountEl.textContent = fmtUsd(amount);
      if (basisEl) basisEl.textContent = basisText;

      var checkEl = row.querySelector('.dk-af-use-check');
      if (checkEl) checkEl.checked = used;

      row.classList.toggle('is-off', !used);
    }

    function benefitRowHtml(b, j) {
      var mode = rowMode(b);
      var detailId = 'dk-af-detail-' + j;
      return '' +
        '<div class="dk-af-benefit" data-af-idx="' + j + '" data-af-mode="' + mode + '">' +
          '<div class="dk-af-benefit-row1">' +
            '<label class="dk-af-benefit-check">' +
              '<input type="checkbox" class="dk-af-use-check">' +
              '<span class="dk-af-benefit-namecol">' +
                '<span class="dk-af-benefit-label">' + esc(b.label_ja) + '</span>' +
                (b.tag ? '<span class="dk-af-benefit-tag">' + esc(b.tag) + '</span>' : '') +
              '</span>' +
            '</label>' +
            '<button type="button" class="dk-af-detail-btn" aria-expanded="false" aria-controls="' +
              detailId + '">詳しく</button>' +
          '</div>' +
          '<div class="dk-af-benefit-row2">' +
            stepperHtmlForMode(b, mode) +
            '<div class="dk-af-row2-right">' +
              '<div class="dk-af-amount" data-af-amount></div>' +
              '<div class="dk-af-row2-basis" data-af-basis></div>' +
            '</div>' +
          '</div>' +
          '<div class="dk-af-benefit-detail" id="' + detailId + '" hidden>' + detailBodyHtml(b) + '</div>' +
        '</div>';
    }

    function unvaluedRowHtml(b, k) {
      var detailId = 'dk-af-uv-detail-' + k;
      return '' +
        '<li class="dk-af-unvalued-item" data-af-uv-idx="' + k + '">' +
          '<div class="dk-af-unvalued-row">' +
            '<span class="dk-af-unvalued-namecol">' +
              '<span class="dk-af-unvalued-label">' + esc(b.label_ja) + '</span>' +
              (b.tag ? '<span class="dk-af-benefit-tag">' + esc(b.tag) + '</span>' : '') +
            '</span>' +
            '<button type="button" class="dk-af-detail-btn" aria-expanded="false" aria-controls="' +
              detailId + '">詳しく</button>' +
          '</div>' +
          '<div class="dk-af-benefit-detail" id="' + detailId + '" hidden>' + detailBodyHtml(b) + '</div>' +
        '</li>';
    }

    function selectOptionsHtml() {
      var html = '<option value="" selected disabled>カードを選んでください</option>';
      var lastIssuer = null, open = false;
      cards.forEach(function (c, i) {
        if (c.issuer !== lastIssuer) {
          if (open) html += '</optgroup>';
          html += '<optgroup label="' + esc(c.issuer) + '">';
          lastIssuer = c.issuer; open = true;
        }
        var label = c.name_ja;
        if (c.unverified) label += ' (出どころ未確認・プレビュー)';
        if (c.unchecked) label += ' (照合前・プレビュー)';
        html += '<option value="' + i + '">' + esc(label) + '</option>';
      });
      if (open) html += '</optgroup>';
      return html;
    }
    cardSelect.innerHTML = selectOptionsHtml();

    function hideBenefits() {
      var guideEl = document.getElementById('dk-af-guide');
      if (guideEl) guideEl.hidden = false;
      currentCard = null;
      state = {};
      benefitsWrap.hidden = true;
      bar.classList.add('is-empty');
      bar.setAttribute('aria-expanded', 'false');
      barPlaceholderEl.hidden = false;
      barInnerEl.hidden = true;
      closeSheet();
    }

    function renderCard() {

      if (feeEl) {
        feeEl.innerHTML = '年会費 <strong>' + esc(fmtUsd(currentCard.annual_fee || 0)) + '</strong>' +
          (currentCard.first_year_waived ? '<span class="dk-af-fee-note">初年度は無料</span>' : '');
        feeEl.hidden = false;
      }
      benefitListEl.innerHTML = (currentCard.benefits_valued || []).map(benefitRowHtml).join('');
      Array.prototype.forEach.call(benefitListEl.querySelectorAll('.dk-af-benefit'), updateRowView);
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
      benefitsWrap.hidden = false;
      bar.classList.remove('is-empty');
      barPlaceholderEl.hidden = true;
      barInnerEl.hidden = false;
    }

    var feeEl = document.getElementById('dk-af-fee');

    function selectCard(i) {
      currentCard = cards[i];
      var guideEl = document.getElementById('dk-af-guide');
      if (guideEl) guideEl.hidden = !!currentCard;
      if (!currentCard) { if (feeEl) feeEl.hidden = true; hideBenefits(); return; }
      state = {};
      touchedState = false;
      (currentCard.benefits_valued || []).forEach(function (b, j) {

        state[j] = { used: !b.needs_spend && !b.from_year, amount: (typeof b.annual_usd === 'number') ? b.annual_usd : 0 };

        if (typeof b.rate === 'number' || (b.step_tenth && typeof b.step_usd === 'number')) {
          state[j].amount = 0; state[j].spend = 0;
        }
        if (countMax(b)) state[j].count = countMax(b);
      });
      closeSheet();
      renderCard();
      recalc();
      try { window.scrollTo(0, 0); } catch (e) {  }
    }

    cardSelect.addEventListener('change', function () {
      var i = parseInt(cardSelect.value, 10);
      if (isNaN(i)) { hideBenefits(); return; }
      selectCard(i);
    });

    benefitListEl.addEventListener('change', function (e) {
      if (!e.target.classList.contains('dk-af-use-check')) return;
      var row = e.target.closest('.dk-af-benefit');
      if (!row) return;
      var idx = row.getAttribute('data-af-idx');
      if (!state[idx]) state[idx] = { used: false, amount: 0 };
      var mode = row.getAttribute('data-af-mode');
      if (e.target.checked && mode === 'count' && !state[idx].count) {
        var cb = currentCard && (currentCard.benefits_valued || [])[parseInt(idx, 10)];
        if (cb) state[idx].count = countMax(cb);
      }
      state[idx].used = e.target.checked;
      touchedState = true;
      updateRowView(row);
      recalc();
    });

    benefitListEl.addEventListener('click', function (e) {

      var detailBtn = e.target.closest('.dk-af-detail-btn');
      if (detailBtn) { toggleDetail(detailBtn); return; }

      var btn = e.target.closest('.dk-af-stepper-btn');
      if (!btn || btn.disabled) return;
      var row = btn.closest('.dk-af-benefit');
      if (!row || !currentCard) return;
      var idx = row.getAttribute('data-af-idx');
      var mode = row.getAttribute('data-af-mode');
      var b = (currentCard.benefits_valued || [])[parseInt(idx, 10)];
      if (!b) return;
      if (!state[idx]) state[idx] = { used: false, amount: 0 };
      var s = state[idx];

      if (mode === 'count') {
        var max = countMax(b);
        var cur = (typeof s.count === 'number') ? s.count : max;
        var n = Math.max(0, Math.min(max, cur + parseInt(btn.getAttribute('data-af-cnt'), 10)));
        s.count = n;
        s.used = n > 0;
      } else if (mode === 'rate') {
        var cur2 = (typeof s.spend === 'number') ? s.spend : 0;
        var v2 = Math.max(0, cur2 + (b.spend_step || 50) * parseInt(btn.getAttribute('data-af-spend'), 10));
        v2 = Math.round(v2 * 100) / 100;
        s.spend = v2;
        s.used = v2 > 0.005;
      } else if (mode === 'tenth') {
        var cap2 = (typeof b.annual_usd === 'number') ? b.annual_usd : 0;
        var cur3 = (typeof s.spend === 'number') ? s.spend : 0;
        var v3 = Math.max(0, Math.min(cap2, cur3 + b.step_usd * parseInt(btn.getAttribute('data-af-step'), 10)));
        v3 = Math.round(v3 * 100) / 100;
        s.spend = v3;
        s.used = v3 > 0.005;
      } else {
        return;
      }
      touchedState = true;
      updateRowView(row);
      recalc();
    });

    if (unvaluedListEl) {
      unvaluedListEl.addEventListener('click', function (e) {
        var detailBtn = e.target.closest('.dk-af-detail-btn');
        if (detailBtn) toggleDetail(detailBtn);
      });
    }

    function recalc() {
      if (!currentCard) return;
      var sum = 0, allMax = true;
      var usedRows = [];
      (currentCard.benefits_valued || []).forEach(function (b, j) {
        var s = state[j] || {};
        if (!s.used) return;
        var cap = (typeof b.annual_usd === 'number') ? b.annual_usd : 0;
        var amt = (typeof s.amount === 'number') ? s.amount : cap;
        sum += amt;
        if (amt < cap - 0.005) allMax = false;
        usedRows.push({ label: b.label_ja, amount: amt });
      });
      var fee = currentCard.annual_fee || 0;
      var diff = sum - fee;

      var untouchedZero = !touchedState && usedRows.length === 0;
      bar.classList.toggle('is-positive', !untouchedZero && diff > 0.005);
      if (untouchedZero) {
        barInnerEl.hidden = true;
        barNeutralEl.hidden = false;
      } else {
        barInnerEl.hidden = false;
        barNeutralEl.hidden = true;

        var numText = diff > 0.005 ? ('+' + fmtUsd(diff))
          : (diff < -0.005 ? ('−' + fmtUsd(Math.abs(diff))) : '$0');
        barNumEl.innerHTML = esc(numText) + '<span class="dk-af-bar-unit">/年</span>';
        barFormulaEl.textContent = '特典 ' + fmtUsd(sum) + ' − 年会費 ' + fmtUsd(fee);
        barPhraseEl.textContent = diff > 0.005 ? '特典が年会費より多い'
          : (diff < -0.005 ? '特典が年会費より少ない' : '特典と年会費が同じ');
      }

      if (sheetBody) sheetBody.innerHTML = sheetBodyHtml(sum, fee, diff, allMax, usedRows);
    }

    function sheetBodyHtml(sum, fee, diff, allMax, usedRows) {
      var html = '';
      html += '<h3 class="dk-af-sheet-title">使うにした特典ごとの額</h3>';
      if (usedRows.length) {
        html += '<ul class="dk-af-sheet-list">' + usedRows.map(function (r) {
          return '<li class="dk-af-sheet-row"><span>' + esc(r.label) + '</span><span>' + fmtUsd(r.amount) + '</span></li>';
        }).join('') + '</ul>';
      } else {
        html += '<p class="dk-af-sheet-empty">使うにした特典はありません</p>';
      }
      html += '<p class="dk-af-sheet-total">特典の合計 ' + fmtUsd(sum) + ' / 年会費 ' + fmtUsd(fee) +
        ' / 差額 年 ' + (diff >= 0 ? '+' : '−') + fmtUsd(Math.abs(diff)) + '</p>';

      var prefix = allMax ? '上限いっぱい使った場合、' : 'この使い方なら、';
      var tail;
      if (diff > 0.005) tail = '特典の合計は年会費より ' + fmtUsd(diff) + ' 多くなります。';
      else if (diff < -0.005) tail = '特典の合計は年会費より ' + fmtUsd(Math.abs(diff)) + ' 少なくなります。';
      else tail = '特典の合計と年会費は同じ額です。';
      html += '<p class="dk-af-sheet-text">' + prefix + tail + '</p>';

      var uvCount = (currentCard.benefits_unvalued || []).length;
      if (uvCount > 0) {
        html += '<p class="dk-af-sheet-note">ほかに計算に入れていない特典が' + uvCount +
          '件あります(マイル・無料宿泊など)。使う人は、上の差額より実際は多くなります。</p>';
      }

      var spendOffCount = 0, hasNeedsSpendOff = false, hasFromYearOff = false;
      (currentCard.benefits_valued || []).forEach(function (b, j) {
        if ((state[j] || {}).used) return;
        if (!b.needs_spend && !b.from_year) return;
        spendOffCount++;
        if (b.needs_spend) hasNeedsSpendOff = true;
        if (b.from_year) hasFromYearOff = true;
      });
      if (spendOffCount > 0) {
        var offKinds = [];
        if (hasNeedsSpendOff) offKinds.push('追加の支出が要る');
        if (hasFromYearOff) offKinds.push('2年目から');
        html += '<p class="dk-af-sheet-note">入れていない特典 ' + spendOffCount +
          '件(' + offKinds.join('・') + ')。</p>';
      }

      var cm = /^(\d{4})-(\d{2})-(\d{2})/.exec(currentCard.benefits_checked_at || '');
      if (cm) {
        html += '<p class="dk-af-sheet-checked">このカードの特典は ' + parseInt(cm[2], 10) + '月' +
          parseInt(cm[3], 10) + '日に公式ページと照合しました</p>';
      }

      if (currentCard.first_year_waived) {
        html += '<p class="dk-af-sheet-note">初年度は年会費無料・2年目から ' + fmtUsd(fee) + '</p>';
      }
      if (disclaimerSrcEl) {
        html += '<p class="dk-af-sheet-disclaimer">' + esc(disclaimerSrcEl.textContent) + '</p>';
      }

      var toolLinks = [];
      if (currentCard.card_page_href) {
        var cph = currentCard.card_page_href;
        if (carriedCards.length) cph += (cph.indexOf('#') === -1 ? '#' : '&') + 'cards=' + carriedCards.join(',');
        toolLinks.push('<a data-cardtool-link href="' + esc(cph) + '">このカードのページを見る</a>');
      }
      if (currentCard.pay_tool_href) {
        var pth = currentCard.pay_tool_href;
        var pidx = pth.indexOf('#cards=');
        if (carriedCards.length && pidx !== -1) {
          var merged = pth.slice(pidx + 7).split(',').filter(Boolean);
          carriedCards.forEach(function (s) { if (merged.indexOf(s) === -1) merged.push(s); });
          pth = pth.slice(0, pidx) + '#cards=' + merged.join(',');
        }
        toolLinks.push('<a data-cardtool-link href="' + esc(pth) + '">どのカードで払う?</a>');
      }
      if (toolLinks.length) {
        html += '<nav class="dk-af-sheet-links">' + toolLinks.map(function (l) { return '<p>' + l + '</p>'; }).join('') + '</nav>';
      }
      return html;
    }

    var sheetOpen = false;
    function openSheet() {
      if (!currentCard) return;
      sheet.hidden = false;
      sheetBackdrop.hidden = false;
      sheetOpen = true;
      bar.setAttribute('aria-expanded', 'true');
    }
    function closeSheet() {
      sheet.hidden = true;
      sheetBackdrop.hidden = true;
      sheetOpen = false;
      bar.setAttribute('aria-expanded', 'false');
    }
    bar.addEventListener('click', function () {
      if (!currentCard) return;
      if (sheetOpen) closeSheet(); else openSheet();
    });
    sheetBackdrop.addEventListener('click', closeSheet);
    var closeHandle = document.getElementById('dk-af-sheet-close');
    if (closeHandle) closeHandle.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheetOpen) closeSheet();
    });
    var touchStartY = null;
    sheet.addEventListener('touchstart', function (e) {
      touchStartY = e.touches && e.touches[0] ? e.touches[0].clientY : null;
    }, { passive: true });
    sheet.addEventListener('touchend', function (e) {
      if (touchStartY == null) return;
      var endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : touchStartY;
      if (endY - touchStartY > 60) closeSheet();
      touchStartY = null;
    }, { passive: true });

    hideBenefits();

    function slugFromNameEn(s) {
      return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    try {
      var raw = (location.hash || '').replace(/^#/, '');
      var slugPart = raw, cardsPart = '';
      var amp = raw.indexOf('&cards=');
      if (amp !== -1) {
        slugPart = raw.slice(0, amp);
        cardsPart = raw.slice(amp + 7);
      } else if (raw.indexOf('cards=') === 0) {
        slugPart = '';
        cardsPart = raw.slice(6);
      }
      try { carriedCards = decodeURIComponent(cardsPart).split(',').filter(Boolean); } catch (e2) { carriedCards = []; }
      var hash = decodeURIComponent(slugPart);
      if (hash) {
        for (var hi = 0; hi < cards.length; hi++) {
          if (slugFromNameEn(cards[hi].name_en) === hash) {
            cardSelect.value = String(hi);
            selectCard(hi);
            break;
          }
        }
      }
    } catch (e) {  }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAnnualFeeTool);
  else initAnnualFeeTool();
})();

(function () {
  function initBonusTool() {
    var list = document.getElementById('dk-bn-list');
    if (!list) return;

    list.addEventListener('click', function (e) {
      var btn = e.target.closest('.dk-bn-detail-btn');
      if (!btn) return;
      var id = btn.getAttribute('aria-controls');
      var panel = id && document.getElementById(id);
      if (!panel) return;
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.hidden = open;
    });

    var pillFee0 = document.getElementById('dk-bn-pill-fee0');
    var pillCash = document.getElementById('dk-bn-pill-cash');
    var CASH_ONLY_LABEL = '現金だけ';
    var SHOW_ALL_LABEL = 'ポイント・マイルも出す';

    function applyFilters() {
      var fee0On = !!pillFee0 && pillFee0.getAttribute('aria-pressed') === 'true';
      var cashOn = !!pillCash && pillCash.getAttribute('aria-pressed') === 'true';
      Array.prototype.forEach.call(list.querySelectorAll('.dk-bn-row'), function (row) {
        var hide = (fee0On && row.getAttribute('data-bn-fee0') !== '1') ||
          (cashOn && row.getAttribute('data-bn-cash') !== '1');
        row.hidden = hide;
      });
    }

    if (pillFee0) {
      pillFee0.addEventListener('click', function () {
        var on = pillFee0.getAttribute('aria-pressed') === 'true';
        pillFee0.setAttribute('aria-pressed', on ? 'false' : 'true');
        applyFilters();
      });
    }

    if (pillCash) {
      pillCash.addEventListener('click', function () {
        var next = pillCash.getAttribute('aria-pressed') !== 'true';
        pillCash.setAttribute('aria-pressed', next ? 'true' : 'false');
        pillCash.textContent = next ? SHOW_ALL_LABEL : CASH_ONLY_LABEL;
        applyFilters();
      });
    }

    (function () {
      var raw = (location.hash || '').replace(/^#/, '');
      if (!raw || raw.indexOf('d-') === 0) return;
      var slugPart = raw, cardsPart = '';
      var amp = raw.indexOf('&cards=');
      if (amp !== -1) {
        slugPart = raw.slice(0, amp);
        cardsPart = raw.slice(amp + 7);
      } else if (raw.indexOf('cards=') === 0) {
        slugPart = '';
        cardsPart = raw.slice(6);
      } else if (raw.indexOf('=') !== -1) {
        return;
      }

      if (slugPart) {
        var row = document.getElementById('dk-bn-row-' + slugPart);
        if (row) {
          var btn = row.querySelector('.dk-bn-detail-btn');
          var panelId = btn && btn.getAttribute('aria-controls');
          var panel = panelId && document.getElementById(panelId);
          if (btn && panel) {
            btn.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
          }
          row.scrollIntoView({ block: 'start' });
        }
      }

      var carried = [];
      try { carried = decodeURIComponent(cardsPart).split(',').filter(Boolean); } catch (e) { carried = []; }
      if (!carried.length) return;
      Array.prototype.forEach.call(document.querySelectorAll('a[data-cardtool-link]'), function (a) {
        var href = a.getAttribute('href') || '';
        var idx = href.indexOf('#cards=');
        if (idx !== -1) {
          var merged = href.slice(idx + 7).split(',').filter(Boolean);
          carried.forEach(function (s) { if (merged.indexOf(s) === -1) merged.push(s); });
          a.setAttribute('href', href.slice(0, idx) + '#cards=' + merged.join(','));
        } else {
          a.setAttribute('href', href + '#cards=' + carried.join(','));
        }
      });
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBonusTool);
  else initBonusTool();
})();

(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtUsd(n) {
    var v = Math.round(n * 100) / 100;
    var sign = v < 0 ? '-' : '';
    v = Math.abs(v);
    var s = (v === Math.floor(v)) ? String(v) : v.toFixed(2);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '$' + parts.join('.');
  }
  function fmtNum(n) {
    var v = Math.round(n);
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function normText(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFKC'); } catch (e) {  }
    return s.toLowerCase();
  }
  var UNUSABLE_SHORT = '使えません';

  function initPayTool() {
    var app = document.getElementById('dk-pay-app');
    var dataEl = document.getElementById('dk-pay-data');
    if (!app || !dataEl) return;
    var cards = [];
    try { cards = JSON.parse(dataEl.textContent) || []; } catch (e) { cards = []; }
    if (!cards.length) return;

    var groupsEl = document.getElementById('dk-pay-card-groups');
    var pillsEl = document.getElementById('dk-pay-scene-pills');
    var guideEl = document.getElementById('dk-pay-guide');
    var resultEl = document.getElementById('dk-pay-result');
    var pickerPanel = document.getElementById('dk-pay-picker-panel');
    var reopenBtn = document.getElementById('dk-pay-reopen-btn');
    var doneBtn = document.getElementById('dk-pay-done-btn');
    var searchInput = document.getElementById('dk-pay-search');
    var issuerChipsEl = document.getElementById('dk-pay-issuer-chips');
    var noMatchEl = document.getElementById('dk-pay-no-match');
    var chipsEl = document.getElementById('dk-pay-selected-chips');
    var countEl = document.getElementById('dk-pay-selected-count');
    if (!groupsEl || !pillsEl || !resultEl || !pickerPanel) return;

    var warehouseData = null;
    var whEl = document.getElementById('dk-pay-warehouse-data');
    if (whEl) { try { warehouseData = JSON.parse(whEl.textContent); } catch (e) { warehouseData = null; } }

    var bySlug = {};
    cards.forEach(function (c) { bySlug[c.slug] = c; });
    var selectedScene = null;
    var issuerFilter = '';

    function hashParam(name) {
      var re = new RegExp('(?:^|&)' + name + '=([^&]*)');
      var m = re.exec((location.hash || '').replace(/^#/, ''));
      if (!m) return '';
      try { return decodeURIComponent(m[1]); } catch (e) { return ''; }
    }
    var fromPath = hashParam('from');
    var fromLabel = hashParam('from_label');

    function selectedSlugs() {
      var out = [];
      Array.prototype.forEach.call(groupsEl.querySelectorAll('.dk-pay-card-input:checked'), function (cb) {
        out.push(cb.getAttribute('data-slug'));
      });
      return out;
    }
    function renderFromLink() {
      var el = document.getElementById('dk-pay-from-link');
      if (!el) return;
      if (!fromPath || !fromLabel) { el.hidden = true; return; }
      var slugs = selectedSlugs();
      var href = fromPath + (slugs.length ? '#cards=' + slugs.join(',') : '');
      el.innerHTML = '<a href="' + esc(href) + '">' + esc(fromLabel) + ' に戻る</a>';
      el.hidden = false;
    }
    function syncHash() {
      var slugs = selectedSlugs();
      var parts = [];
      if (slugs.length) parts.push('cards=' + slugs.join(','));
      if (fromPath) parts.push('from=' + encodeURIComponent(fromPath));
      if (fromLabel) parts.push('from_label=' + encodeURIComponent(fromLabel));
      var url = location.pathname + location.search + (parts.length ? '#' + parts.join('&') : '');
      try { history.replaceState(null, '', url); } catch (e) {  }
      renderFromLink();

      if (window.dkApplyCardsCarry) window.dkApplyCardsCarry();
    }
    function restoreFromHash() {
      var raw = hashParam('cards');
      if (!raw) return 0;
      var want = {};
      raw.split(',').forEach(function (s) { if (s) want[s] = true; });
      var n = 0;
      Array.prototype.forEach.call(groupsEl.querySelectorAll('.dk-pay-card-input'), function (cb) {
        if (want[cb.getAttribute('data-slug')]) { cb.checked = true; n++; }
      });
      return n;
    }

    function collapsePicker() {
      pickerPanel.hidden = true;
      if (reopenBtn) reopenBtn.hidden = false;
    }
    function expandPicker() {
      pickerPanel.hidden = false;
      if (reopenBtn) reopenBtn.hidden = true;
    }
    if (reopenBtn) reopenBtn.addEventListener('click', expandPicker);
    if (doneBtn) doneBtn.addEventListener('click', collapsePicker);

    function renderSelectedChips() {
      var checked = Array.prototype.filter.call(groupsEl.querySelectorAll('.dk-pay-card-input'),
        function (cb) { return cb.checked; });
      if (countEl) countEl.textContent = String(checked.length);
      if (!chipsEl) return;
      if (!checked.length) {
        chipsEl.innerHTML = '<span class="dk-pay-selected-empty">まだありません</span>';
        return;
      }
      chipsEl.innerHTML = checked.map(function (cb) {
        var slug = cb.getAttribute('data-slug');
        var name = cb.getAttribute('data-name') || slug;
        return '<span class="dk-pay-selected-chip"><span class="dk-pay-selected-chip-name">' + esc(name) + '</span>' +
          '<button type="button" class="dk-pay-selected-chip-x" data-remove-slug="' + esc(slug) + '" ' +
          'aria-label="' + esc(name) + 'を外す">&times;</button></span>';
      }).join('');
    }
    if (chipsEl) {
      chipsEl.addEventListener('click', function (e) {
        var btn = e.target.closest('.dk-pay-selected-chip-x');
        if (!btn) return;
        var slug = btn.getAttribute('data-remove-slug');
        Array.prototype.forEach.call(groupsEl.querySelectorAll('.dk-pay-card-input'), function (cb) {
          if (cb.getAttribute('data-slug') === slug) cb.checked = false;
        });
        syncHash();
        renderSelectedChips();
        recalc();
      });
    }

    function applyPickerFilter() {
      var q = searchInput ? normText(searchInput.value).trim() : '';
      var active = !!q || !!issuerFilter;
      var anyVisible = false;
      Array.prototype.forEach.call(groupsEl.querySelectorAll('.dk-pay-issuer-group'), function (group) {
        var groupIssuer = group.getAttribute('data-issuer');
        var issuerOk = !issuerFilter || issuerFilter === groupIssuer;
        var cardsWrap = group.querySelector('.dk-pay-issuer-cards');
        var toggle = group.querySelector('.dk-pay-issuer-toggle');
        var groupHasMatch = false;
        Array.prototype.forEach.call(group.querySelectorAll('.dk-pay-card-check'), function (label) {
          var hay = normText(label.getAttribute('data-search'));
          var match = issuerOk && (!q || hay.indexOf(q) !== -1);
          label.hidden = !match;
          if (match) groupHasMatch = true;
        });
        group.hidden = !issuerOk;
        if (issuerOk) anyVisible = anyVisible || (!q || groupHasMatch);
        if (cardsWrap && toggle) {
          if (active) {

            if (groupHasMatch || (issuerOk && !q)) {
              cardsWrap.hidden = false; toggle.setAttribute('aria-expanded', 'true');
            } else {
              cardsWrap.hidden = true; toggle.setAttribute('aria-expanded', 'false');
            }
          } else {
            cardsWrap.hidden = true; toggle.setAttribute('aria-expanded', 'false');
          }
        }
      });
      if (noMatchEl) noMatchEl.hidden = !q || anyVisible;
    }
    if (searchInput) searchInput.addEventListener('input', applyPickerFilter);
    if (issuerChipsEl) {
      issuerChipsEl.addEventListener('click', function (e) {
        var btn = e.target.closest('.dk-pay-issuer-chip');
        if (!btn) return;
        issuerFilter = btn.getAttribute('data-issuer') || '';
        Array.prototype.forEach.call(issuerChipsEl.querySelectorAll('.dk-pay-issuer-chip'), function (b) {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        applyPickerFilter();
      });
    }
    groupsEl.addEventListener('click', function (e) {
      var toggle = e.target.closest('.dk-pay-issuer-toggle');
      if (!toggle) return;
      var cardsWrap = toggle.parentElement.querySelector('.dk-pay-issuer-cards');
      if (!cardsWrap) return;
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      cardsWrap.hidden = open;
    });

    pillsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.dk-pay-scene-pill');
      if (!btn) return;
      Array.prototype.forEach.call(pillsEl.querySelectorAll('.dk-pay-scene-pill'), function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      selectedScene = btn.getAttribute('data-scene');

      if (!pickerPanel.hidden) collapsePicker();
      recalc();
    });

    groupsEl.addEventListener('change', function (e) {
      if (!e.target.classList.contains('dk-pay-card-input')) return;
      syncHash();
      renderSelectedChips();
      recalc();
    });

    function sceneLabel(key) {
      var btn = pillsEl.querySelector('.dk-pay-scene-pill[data-scene="' + key + '"]');
      return btn ? btn.textContent : key;
    }

    function onlineLineText(cell) { return cell.online_note || ''; }
    function merchantLineText(cell) { return cell.merchant_note || ''; }

    function nonComparableRowHtml(name, cell) {
      if (cell.unusable && cell.note === UNUSABLE_SHORT) {
        return '<div class="dk-pay-rest-row"><div class="dk-pay-row1">' +
          '<span class="dk-pay-name">' + esc(name) + '</span>' +
          '<span class="dk-pay-unusable-amount">' + esc(UNUSABLE_SHORT) + '</span></div></div>';
      }
      var lines = [];
      if (cell.variable_label) {
        lines.push(cell.variable_label);
      } else {
        if (cell.mark) lines.push(cell.mark);
        if (cell.note) lines.push(cell.note);
      }
      var onlineText = onlineLineText(cell);
      if (onlineText) lines.push(onlineText);
      var merchantText = merchantLineText(cell);
      if (merchantText) lines.push(merchantText);
      var valueHtml = (typeof cell.points_per_100 === 'number' && cell.unit_word)
        ? '<span class="dk-pay-points-amount">' + fmtNum(cell.points_per_100) + ' ' + esc(cell.unit_word) + ' / $100</span>'
        : '';
      var headHtml = '<div class="dk-pay-rest-row-head"><span class="dk-pay-name">' + esc(name) + '</span>' +
        '<span>' + valueHtml + '<span class="dk-pay-neutral-chip">比較対象外</span></span></div>';
      var bodyHtml = lines.map(function (l) { return '<div class="dk-pay-row2">' + esc(l) + '</div>'; }).join('');
      return '<div class="dk-pay-rest-row">' + headHtml + bodyHtml + '</div>';
    }

    function recalc() {
      var selected = [];
      Array.prototype.forEach.call(groupsEl.querySelectorAll('.dk-pay-card-input:checked'), function (cb) {
        var c = bySlug[cb.getAttribute('data-slug')];
        if (c) selected.push(c);
      });
      if (!selectedScene || !selected.length) {
        resultEl.hidden = true;
        resultEl.innerHTML = '';
        if (guideEl) guideEl.hidden = false;
        return;
      }
      if (guideEl) guideEl.hidden = true;

      var sceneKey = selectedScene.replace(/-/g, '_');
      var comparable = [];
      var others = [];
      selected.forEach(function (c) {
        var cell = (c.scenes || {})[sceneKey];
        if (!cell) return;
        if (cell.comparable) {
          comparable.push({
            name: c.name_ja, amount: cell.amount_usd, label_ja: cell.label_ja,
            mark: cell.mark, excludesNote: cell.excludes_note || '', onlineNote: onlineLineText(cell),
            merchantNote: merchantLineText(cell), merchantCondTag: cell.merchant_cond_tag || '',
            merchantNoteJa: cell.merchant_note_ja || '',
          });
        } else {
          others.push({ name: c.name_ja, cell: cell });
        }
      });
      comparable.sort(function (a, b) { return b.amount - a.amount || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
      others.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });

      var html = '<p class="dk-pay-result-heading">' + esc(sceneLabel(selectedScene)) + ' で $100 払うと</p>';

      if (sceneKey === 'warehouse' && warehouseData && warehouseData.source_url) {
        html += '<p class="dk-pay-warehouse-note">Costco の店頭は Visa のみです' +
          '<a href="' + esc(warehouseData.source_url) + '" target="_blank" rel="noopener">(Costco の会員規約)</a></p>';
      }
      if (comparable.length) {
        var topAmount = comparable[0].amount;
        var top = comparable.filter(function (r) { return Math.abs(r.amount - topAmount) < 0.005; });
        var rest = comparable.filter(function (r) { return Math.abs(r.amount - topAmount) >= 0.005; });
        rest.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });

        function comparableRowHtml(r) {

          var lines = [];
          if (r.label_ja) lines.push(r.label_ja);
          if (r.mark) lines.push(r.mark);

          if (r.merchantCondTag) lines.push(r.merchantCondTag);
          var sub = lines.map(function (l) { return '<div class="dk-pay-row2">' + esc(l) + '</div>'; }).join('');

          var noteJa = r.merchantNoteJa ? '<div class="dk-pay-excludes-note">' + esc(r.merchantNoteJa) + '</div>' : '';
          var excl = r.excludesNote ? '<div class="dk-pay-excludes-note">' + esc(r.excludesNote) + '</div>' : '';
          var onl = r.onlineNote ? '<div class="dk-pay-excludes-note">' + esc(r.onlineNote) + '</div>' : '';
          var mer = r.merchantNote ? '<div class="dk-pay-excludes-note">' + esc(r.merchantNote) + '</div>' : '';
          return sub + noteJa + excl + onl + mer;
        }

        html += '<div class="dk-pay-top-list">' + top.map(function (r) {
          var sameBadge = top.length > 1 ? '<span class="dk-pay-top-same">同じ</span>' : '';
          return '<div class="dk-pay-top-row"><div class="dk-pay-row1">' +
            '<span class="dk-pay-name">' + esc(r.name) + sameBadge + '</span>' +
            '<span class="dk-pay-amount">' + fmtUsd(r.amount) + '</span></div>' +
            comparableRowHtml(r) + '</div>';
        }).join('') + '</div>';

        if (rest.length || others.length) {
          html += '<div class="dk-pay-rest-list">' + rest.map(function (r) {
            return '<div class="dk-pay-rest-row"><div class="dk-pay-row1">' +
              '<span class="dk-pay-name">' + esc(r.name) + '</span>' +
              '<span class="dk-pay-amount">' + fmtUsd(r.amount) + '</span></div>' +
              comparableRowHtml(r) + '</div>';
          }).join('') + others.map(function (r) {
            return nonComparableRowHtml(r.name, r.cell);
          }).join('') + '</div>';
        }
      } else {

        html += '<div class="dk-pay-rest-list">' + others.map(function (r) {
          return nonComparableRowHtml(r.name, r.cell);
        }).join('') + '</div>';
      }
      resultEl.innerHTML = html;
      resultEl.hidden = false;
    }

    var restoredCount = restoreFromHash();
    renderSelectedChips();
    renderFromLink();
    applyPickerFilter();

    if (restoredCount > 0) collapsePicker();
    recalc();
    window.addEventListener('hashchange', function () {
      restoreFromHash();
      renderSelectedChips();
      renderFromLink();
      recalc();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPayTool);
  else initPayTool();
})();

(function () {
  'use strict';
  var section = document.getElementById('dk-store-pay');
  if (!section) return;
  var dataEl = document.getElementById('dk-store-pay-data');
  var emptyEl = document.getElementById('dk-store-pay-empty');
  var resultEl = document.getElementById('dk-store-pay-result');
  if (!dataEl || !emptyEl || !resultEl) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtUsd(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    var sign = v < 0 ? '-' : '';
    v = Math.abs(v);
    var s = (v === Math.floor(v)) ? String(v) : v.toFixed(2);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '$' + parts.join('.');
  }
  var UNUSABLE_SHORT = '使えません';

  var cards = [];
  try { cards = JSON.parse(dataEl.textContent) || []; } catch (e) { cards = []; }
  var bySlug = {};
  cards.forEach(function (c) { bySlug[c.slug] = c; });

  var warehouseData = null;
  var whEl = document.getElementById('dk-store-pay-warehouse');
  if (whEl) { try { warehouseData = JSON.parse(whEl.textContent); } catch (e) { warehouseData = null; } }

  function heldCards() {
    var raw = (location.hash || '').replace(/^#/, '');
    var m = /(?:^|&)cards=([^&]*)/.exec(raw);
    if (!m) return [];
    var slugs = [];
    try { slugs = decodeURIComponent(m[1]).split(',').filter(Boolean); } catch (e) { slugs = []; }

    var out = [];
    slugs.forEach(function (s) { if (bySlug[s] && out.indexOf(bySlug[s]) === -1) out.push(bySlug[s]); });
    return out;
  }

  var currentHeldSlugsCsv = '';
  function nameHtml(c) {
    if (!c.card_page_href) return esc(c.name_ja);
    var href = c.card_page_href + (currentHeldSlugsCsv ? '#cards=' + currentHeldSlugsCsv : '');
    return '<a href="' + esc(href) + '">' + esc(c.name_ja) + '</a>';
  }

  function rowSubHtml(r) {
    var lines = [];
    if (r.label_ja) lines.push(r.label_ja);
    if (r.mark) lines.push(r.mark);
    if (r.merchant_cond_tag) lines.push(r.merchant_cond_tag);
    var sub = lines.map(function (l) { return '<div class="dk-pay-row2">' + esc(l) + '</div>'; }).join('');
    var noteJa = r.merchant_note_ja ? '<div class="dk-pay-excludes-note">' + esc(r.merchant_note_ja) + '</div>' : '';
    var excl = r.excludes_note ? '<div class="dk-pay-excludes-note">' + esc(r.excludes_note) + '</div>' : '';
    var onl = r.online_note ? '<div class="dk-pay-excludes-note">' + esc(r.online_note) + '</div>' : '';
    var mer = r.merchant_note ? '<div class="dk-pay-excludes-note">' + esc(r.merchant_note) + '</div>' : '';
    return sub + noteJa + excl + onl + mer;
  }
  function nonComparableRowHtml(c) {
    if (c.unusable && c.note === UNUSABLE_SHORT) {
      return '<div class="dk-pay-rest-row"><div class="dk-pay-row1">' +
        '<span class="dk-pay-name">' + nameHtml(c) + '</span>' +
        '<span class="dk-pay-unusable-amount">' + esc(UNUSABLE_SHORT) + '</span></div></div>';
    }
    var lines = [];
    if (c.variable_label) {
      lines.push(c.variable_label);
    } else {
      if (c.mark) lines.push(c.mark);
      if (c.note) lines.push(c.note);
    }
    if (c.online_note) lines.push(c.online_note);
    if (c.merchant_note) lines.push(c.merchant_note);
    var valueHtml = (typeof c.points_per_100 === 'number' && c.unit_word)
      ? '<span class="dk-pay-points-amount">' + esc(String(Math.round(c.points_per_100))) + ' ' + esc(c.unit_word) + ' / $100</span>'
      : '';
    var headHtml = '<div class="dk-pay-rest-row-head"><span class="dk-pay-name">' + nameHtml(c) + '</span>' +
      '<span>' + valueHtml + '<span class="dk-pay-neutral-chip">比較対象外</span></span></div>';
    var bodyHtml = lines.map(function (l) { return '<div class="dk-pay-row2">' + esc(l) + '</div>'; }).join('');
    return '<div class="dk-pay-rest-row">' + headHtml + bodyHtml + '</div>';
  }

  function render() {
    var held = heldCards();
    currentHeldSlugsCsv = held.map(function (c) { return c.slug; }).join(',');
    if (!held.length) {
      emptyEl.hidden = false;
      resultEl.hidden = true;
      resultEl.innerHTML = '';
      return;
    }
    emptyEl.hidden = true;

    var comparable = held.filter(function (c) { return c.comparable; });
    var others = held.filter(function (c) { return !c.comparable; });
    comparable.sort(function (a, b) {
      return b.amount_usd - a.amount_usd || (a.name_ja < b.name_ja ? -1 : a.name_ja > b.name_ja ? 1 : 0);
    });
    others.sort(function (a, b) { return a.name_ja < b.name_ja ? -1 : a.name_ja > b.name_ja ? 1 : 0; });

    var sceneLabel = section.getAttribute('data-scene-label') || '';
    var html = '<p class="dk-pay-result-heading">この店で $100 払うと</p>' +
      '<p class="dk-store-pay-scene-note">この店は「' + esc(sceneLabel) + '」として計算しています</p>';
    if (section.getAttribute('data-scene') === 'warehouse' && warehouseData && warehouseData.source_url) {
      html += '<p class="dk-pay-warehouse-note">Costco の店頭は Visa のみです' +
        '<a href="' + esc(warehouseData.source_url) + '" target="_blank" rel="noopener">(Costco の会員規約)</a></p>';
    }

    if (comparable.length) {
      var topAmount = comparable[0].amount_usd;
      var top = comparable.filter(function (r) { return Math.abs(r.amount_usd - topAmount) < 0.005; });
      var rest = comparable.filter(function (r) { return Math.abs(r.amount_usd - topAmount) >= 0.005; });
      rest.sort(function (a, b) { return a.name_ja < b.name_ja ? -1 : a.name_ja > b.name_ja ? 1 : 0; });

      html += '<div class="dk-pay-top-list">' + top.map(function (r) {
        var sameBadge = top.length > 1 ? '<span class="dk-pay-top-same">同じ</span>' : '';
        return '<div class="dk-pay-top-row"><div class="dk-pay-row1">' +
          '<span class="dk-pay-name">' + nameHtml(r) + sameBadge + '</span>' +
          '<span class="dk-pay-amount">' + fmtUsd(r.amount_usd) + '</span></div>' +
          rowSubHtml(r) + '</div>';
      }).join('') + '</div>';

      if (rest.length || others.length) {
        html += '<div class="dk-pay-rest-list">' + rest.map(function (r) {
          return '<div class="dk-pay-rest-row"><div class="dk-pay-row1">' +
            '<span class="dk-pay-name">' + nameHtml(r) + '</span>' +
            '<span class="dk-pay-amount">' + fmtUsd(r.amount_usd) + '</span></div>' +
            rowSubHtml(r) + '</div>';
        }).join('') + others.map(nonComparableRowHtml).join('') + '</div>';
      }
    } else {

      html += '<div class="dk-pay-rest-list">' + others.map(nonComparableRowHtml).join('') + '</div>';
    }

    var emptyLinkA = emptyEl.querySelector('a');
    if (emptyLinkA) {
      var baseHref = emptyLinkA.getAttribute('href') || '';
      var heldSlugs = currentHeldSlugsCsv ? currentHeldSlugsCsv.split(',').filter(Boolean) : [];
      var moreHref = window.dkMergeCardsIntoHref
        ? window.dkMergeCardsIntoHref(baseHref, heldSlugs)
        : (baseHref.indexOf('#') === -1
            ? baseHref + '#cards=' + currentHeldSlugsCsv
            : baseHref.slice(0, baseHref.indexOf('#') + 1) + 'cards=' + currentHeldSlugsCsv + '&' + baseHref.slice(baseHref.indexOf('#') + 1));
      html += '<p class="dk-store-pay-more"><a href="' + esc(moreHref) + '">持っているカードを選び直す</a></p>';
    }

    resultEl.innerHTML = html;
    resultEl.hidden = false;
  }

  render();
  window.addEventListener('hashchange', render);
})();

(function () {
  'use strict';

  var CX = 180, CY = 160, R = 95;
  var AXIS_ORDER = ['cashback', 'benefits', 'bonus'];
  var AXIS_LABELS = { cashback: 'キャッシュバック', benefits: '特典', bonus: '初回ボーナス' };
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtUsd(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    var sign = v < 0 ? '-' : '';
    v = Math.abs(v);
    var s = (v === Math.floor(v)) ? String(v) : v.toFixed(2);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '$' + parts.join('.');
  }

  function compactNumbers(values) {
    return AXIS_ORDER.map(function (key) {
      var amt = fmtUsd(values[key]);
      if (key === 'bonus' && values.bonus_up_to) amt = '最大 ' + amt;
      return AXIS_LABELS[key] + ' ' + amt;
    }).join(' / ');
  }

  function redeemLabelLine(cashbackLabel, bonusLabel) {
    cashbackLabel = (cashbackLabel || '').trim();
    bonusLabel = (bonusLabel || '').trim();
    if (!cashbackLabel && !bonusLabel) return '';
    if (cashbackLabel && bonusLabel && cashbackLabel === bonusLabel) return cashbackLabel;
    var parts = [];
    if (cashbackLabel) parts.push('キャッシュバック: ' + cashbackLabel);
    if (bonusLabel) parts.push('ボーナス: ' + bonusLabel);
    return parts.join(' / ');
  }

  function axisAngle(i) { return (-90 + i * 120) * Math.PI / 180; }
  function axisPoint(ratio, i) {
    var rr = R * Math.max(0, Math.min(ratio, 1));
    var a = axisAngle(i);
    return (CX + rr * Math.cos(a)).toFixed(1) + ',' + (CY + rr * Math.sin(a)).toFixed(1);
  }
  function polygonPoints(values, axisMax) {
    return AXIS_ORDER.map(function (key, i) {
      var v = Number(values[key]) || 0;
      var max = Number(axisMax[key]) || 1;
      return axisPoint(v / max, i);
    }).join(' ');
  }

  function initCardRadar() {
    var svg = document.getElementById('dk-card-radar-svg');
    if (!svg) return;
    var optionsEl = document.getElementById('dk-card-radar-options');
    var axisMaxEl = document.getElementById('dk-card-radar-axis-max');
    var sel1 = document.getElementById('dk-card-radar-vs1');
    var sel2 = document.getElementById('dk-card-radar-vs2');
    var legendOv1 = document.getElementById('dk-card-radar-legend-ov1');
    var legendOv2 = document.getElementById('dk-card-radar-legend-ov2');
    if (!optionsEl || !axisMaxEl || !sel1 || !sel2) return;

    var chartOptions = [];
    var axisMax = {};
    try { chartOptions = JSON.parse(optionsEl.textContent) || []; } catch (e) { chartOptions = []; }
    try { axisMax = JSON.parse(axisMaxEl.textContent) || {}; } catch (e) { axisMax = {}; }
    var bySlug = {};
    chartOptions.forEach(function (c) { bySlug[c.slug] = c; });

    function clearOverlays() {
      Array.prototype.forEach.call(svg.querySelectorAll('.dk-card-radar-ov1, .dk-card-radar-ov2'), function (el) {
        el.parentNode.removeChild(el);
      });
    }

    function updateLegendRow(rowEl, card) {
      if (!rowEl) return;
      if (!card) { rowEl.hidden = true; return; }
      var nameEl = rowEl.querySelector('.dk-card-radar-legend-name');
      var numsEl = rowEl.querySelector('.dk-card-radar-legend-nums');
      var redeemEl = rowEl.querySelector('.dk-card-radar-legend-redeem');
      if (nameEl) nameEl.textContent = card.name_ja;
      if (numsEl) numsEl.textContent = compactNumbers(card);
      if (redeemEl) {
        var line = redeemLabelLine(card.cashback_redeem_label, card.bonus_redeem_label);
        redeemEl.textContent = line;
        redeemEl.hidden = !line;
      }
      rowEl.hidden = false;
    }

    function drawOverlays() {
      clearOverlays();
      var slug1 = sel1.value, slug2 = sel2.value;
      var c1 = slug1 ? bySlug[slug1] : null;
      var c2 = (slug2 && slug2 !== slug1) ? bySlug[slug2] : null;
      if (c1) {
        var poly1 = document.createElementNS(SVG_NS, 'polygon');
        poly1.setAttribute('points', polygonPoints(c1, axisMax));
        poly1.setAttribute('class', 'dk-card-radar-ov1');
        svg.appendChild(poly1);
      }
      if (c2) {
        var poly2 = document.createElementNS(SVG_NS, 'polygon');
        poly2.setAttribute('points', polygonPoints(c2, axisMax));
        poly2.setAttribute('class', 'dk-card-radar-ov2');
        svg.appendChild(poly2);
      }
      updateLegendRow(legendOv1, c1);
      updateLegendRow(legendOv2, c2);
    }

    function syncHash() {
      var slugs = [sel1.value, sel2.value].filter(function (s) { return s; });
      var carried = (window.dkCardsFromHash ? window.dkCardsFromHash(location.hash) : []);
      var parts = [];
      if (slugs.length) parts.push('vs=' + slugs.join(','));
      if (carried.length) parts.push('cards=' + carried.join(','));
      var url = location.pathname + location.search + (parts.length ? '#' + parts.join('&') : '');
      history.replaceState(null, '', url);
      if (window.dkApplyCardsCarry) window.dkApplyCardsCarry();
    }
    function restoreFromHash() {
      var m = /(?:^|&)vs=([^&]*)/.exec((location.hash || '').replace(/^#/, ''));
      if (!m) return;
      var slugs = decodeURIComponent(m[1]).split(',').filter(function (s) { return s && bySlug[s]; });
      if (slugs[0]) sel1.value = slugs[0];
      if (slugs[1]) sel2.value = slugs[1];
    }

    sel1.addEventListener('change', function () { syncHash(); drawOverlays(); });
    sel2.addEventListener('change', function () { syncHash(); drawOverlays(); });
    window.addEventListener('hashchange', function () { restoreFromHash(); drawOverlays(); });

    restoreFromHash();
    drawOverlays();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCardRadar);
  else initCardRadar();
})();
