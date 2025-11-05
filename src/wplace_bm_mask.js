// wplace_bm_mask.js
(function () {
  'use strict';

  // ------- CONFIG -------
  const STORAGE_KEY = 'bm_mask_v1'; // BigInt decimal string in localStorage
  const BM_CONTAINER_SELECTOR = '#bm-g'; // container holding the color list
  const COOLDOWN_MS = 5000; // startup cooldown, ignore console-driven changes during this window
  const TOTAL_BITS = 64;

  // Fallback color list (order == visual order in #bm-g). If your page has full 63 colors,
  // replace/extend this list so index mapping matches exactly (top -> index 0).
  // Each item: 'R,G,B' string.
  const FALLBACK_COLORS = [
    '0,0,0','60,60,60','104,70,52','74,107,58','156,132,49','149,104,42','197,173,49','148,140,107',
    '96,0,24','205,197,158','109,100,63','219,164,99','255,250,188','248,178,119','255,127,39','255,255,255',
    '249,221,59','210,210,210','237,28,36','135,255,94','120,120,120','246,170,9','243,141,169','14,185,104',
    '236,31,128','224,159,249','153,177,251','40,80,158','170,56,185'
    // extend to match your full list if necessary
  ];

  // ------- Utilities: BigInt mask -------
  function readMask() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 0n;
      return BigInt(raw);
    } catch (e) {
      return 0n;
    }
  }
  function writeMask(big) {
    try {
      localStorage.setItem(STORAGE_KEY, big.toString());
      // dispatch event so other scripts can observe
      try { window.dispatchEvent(new CustomEvent('bm_mask_updated', { detail: { mask: big.toString() } })); } catch(e) {}
    } catch (e) { console.warn('bm: writeMask failed', e); }
  }
  function setBit(mask, idx, val) {
    if (idx < 0 || idx >= TOTAL_BITS) return mask;
    const bit = 1n << BigInt(idx);
    return val ? (mask | bit) : (mask & ~bit);
  }
  function getBit(mask, idx) {
    if (idx < 0 || idx >= TOTAL_BITS) return 0;
    return ((mask >> BigInt(idx)) & 1n) === 1n ? 1 : 0;
  }

  // ------- DOM helpers: find color rows & swatches -------
  function grabColorRows() {
    const root = document.querySelector(BM_CONTAINER_SELECTOR);
    if (!root) return [];
    // Candidate rows: elements that contain a checkbox input
    const rows = Array.from(root.querySelectorAll('div')).filter(d => d.querySelector && d.querySelector('input[type="checkbox"]'));
    // Only return rows that appear to be the color list rows (heuristic)
    return rows;
  }

  // Try to map each visual row to an RGB triple (from inline style background)
  function buildDomColorMap() {
    const rows = grabColorRows();
    const map = []; // map[index] = { idx, triple, checkboxEl, rowEl }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cb = row.querySelector('input[type="checkbox"]');
      let triple = null;
      try {
        // find child div with background: rgb(...)
        const sw = Array.from(row.querySelectorAll('div')).find(d => {
          const s = d.getAttribute && d.getAttribute('style') || '';
          return /background(?:-color)?\s*:\s*rgb\(/i.test(s);
        });
        if (sw) {
          const s = sw.getAttribute('style') || '';
          const m = s.match(/rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)/i);
          if (m) triple = `${Number(m[1])},${Number(m[2])},${Number(m[3])}`;
        }
      } catch (e) {}
      map.push({ idx: i, triple, checkboxEl: cb, rowEl: row });
    }
    return map;
  }

  // Build a stable color -> index map:
  // Priority: DOM-detected order (best), fallback to FALLBACK_COLORS (top->bottom).
  function buildColorIndexMap() {
    const domMap = buildDomColorMap();
    const colorToIndex = {};
    if (domMap.length) {
      for (const it of domMap) {
        if (it.triple) colorToIndex[it.triple] = it.idx;
      }
    }
    // fill missing from fallback list if not already mapped
    for (let i = 0; i < FALLBACK_COLORS.length; i++) {
      const t = FALLBACK_COLORS[i];
      if (typeof colorToIndex[t] === 'undefined') colorToIndex[t] = i;
    }
    // expose domMap also for checkbox sync
    return { map: colorToIndex, domRows: domMap };
  }

  // ------- UI sync: apply mask -> checkboxes; bind checkbox change handlers -------
  let domRowsCache = []; // elements bound
  function syncUiFromMask() {
    try {
      const mask = readMask();
      const { domRows } = buildColorIndexMap();
      domRowsCache = domRows;
      for (const row of domRows) {
        const cb = row.checkboxEl;
        if (!cb) continue;
        const idx = row.idx;
        const should = Boolean(getBit(mask, idx));
        if (cb.checked !== should) {
          try {
            cb.checked = should;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            cb.dispatchEvent(new Event('input', { bubbles: true }));
          } catch (e) {}
        }
      }
    } catch (e) { console.warn('bm: syncUiFromMask failed', e); }
  }

  function attachCheckboxListeners() {
    try {
      const { domRows } = buildColorIndexMap();
      domRowsCache = domRows;
      for (const row of domRows) {
        const cb = row.checkboxEl;
        if (!cb) continue;
        if (cb.__bm_bound) continue;
        cb.__bm_bound = true;
        cb.addEventListener('change', (ev) => {
          try {
            const checked = !!ev.target.checked;
            const idx = row.idx;
            const mask = readMask();
            const newMask = setBit(mask, idx, checked ? 1 : 0);
            writeMask(newMask);
          } catch (e) { console.warn('bm: checkbox change handler error', e); }
        }, { passive: true });
      }
    } catch (e) { console.warn('bm: attachCheckboxListeners failed', e); }
  }

  // ------- Console parsing & startup cooldown -------
  let allowConsoleAt = Date.now() + COOLDOWN_MS;

  function parseConsoleForBmLine(text) {
    if (!text || typeof text !== 'string') return null;
    // Accept variations: Blue Marble: Enabled 60,60,60  OR  Blue Marble: Disabled 60,60,60
    const m = text.match(/Blue\s*Marble\s*:\s*(Enabled|Disabled)\s*([0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3})/i);
    if (m) {
      const action = m[1].toLowerCase().startsWith('en') ? 'enabled' : 'disabled';
      const triple = m[2].replace(/\s/g, '');
      return { type: 'single', action, triple };
    }
    // Status lines: Enabled/Disabled all colors
    const s = text.match(/Status\s*:\s*(Enabled|Disabled)\s*all\s*colors/i);
    if (s) {
      const action = s[1].toLowerCase().startsWith('en') ? 'all-enabled' : 'all-disabled';
      return { type: 'all', action };
    }
    return null;
  }

  function findIndexForTriple(triple) {
    if (!triple) return null;
    const { map, domRows } = buildColorIndexMap();
    if (map[triple] !== undefined) return map[triple];
    // try scanning dom rows for best match
    for (const r of domRows) {
      if (r.triple === triple) return r.idx;
    }
    // try fallback list search
    const fallbackIdx = FALLBACK_COLORS.indexOf(triple);
    if (fallbackIdx >= 0) return fallbackIdx;
    return null;
  }

  // compute mask with lowest `count` bits set (bounded by TOTAL_BITS)
  function maskWithCountOn(count) {
    const c = Math.max(0, Math.min(Number(count), TOTAL_BITS));
    if (c === 0) return 0n;
    return ((1n << BigInt(c)) - 1n);
  }

  // Hijack console methods (non-destructive) but respect cooldown window
  (function hijackConsoleMethods() {
    try {
      const orig = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
      };

      function handlerForward(fn, args) {
        try {
          // forward log first so visible immediately
          fn(...args);
        } catch (e) {}
        try {
          // do not process console-driven changes during cooldown
          if (Date.now() < allowConsoleAt) return;

          const joined = args.map(a => (typeof a === 'string') ? a : (JSON.stringify(a) || String(a))).join(' ');
          const parsed = parseConsoleForBmLine(joined);
          if (!parsed) return;

          if (parsed.type === 'single') {
            const idx = findIndexForTriple(parsed.triple);
            if (idx === null || idx === undefined) return;
            const mask = readMask();
            const newMask = setBit(mask, idx, parsed.action === 'enabled' ? 1 : 0);
            writeMask(newMask);
            // update checkbox immediately if present
            try {
              const row = domRowsCache && domRowsCache.find(r => r.idx === idx);
              if (row && row.checkboxEl) {
                row.checkboxEl.checked = parsed.action === 'enabled';
                row.checkboxEl.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                // force a full sync
                syncUiFromMask();
              }
            } catch (e) {}
          } else if (parsed.type === 'all') {
            // determine number of colors present (prefer DOM-detected count, else fallback length)
            const { domRows } = buildColorIndexMap();
            const count = Math.max(domRows && domRows.length ? domRows.length : 0, FALLBACK_COLORS.length);
            if (parsed.action === 'all-enabled') {
              const newMask = maskWithCountOn(count);
              writeMask(newMask);
            } else {
              const newMask = 0n;
              writeMask(newMask);
            }
            // immediate UI sync
            try { syncUiFromMask(); } catch (e) {}
          }
        } catch (e) {
          // swallow
        }
      }

      console.log = function (...args) { handlerForward(orig.log, args); };
      console.info = function (...args) { handlerForward(orig.info, args); };
      console.warn = function (...args) { handlerForward(orig.warn, args); };
      console.error = function (...args) { handlerForward(orig.error, args); };
    } catch (e) {
      console.warn('bm: console hijack failed', e);
    }
  })();

  // ------- Initialization flow -------
  // 1) Immediately apply mask from storage to UI
  try {
    // Wait tiny tick to let DOM possibly create the bm list; but we must apply immediately as possible
    setTimeout(() => {
      syncUiFromMask();
      attachCheckboxListeners();
    }, 20);
  } catch (e) {}

  // 2) After COOLDOWN_MS allow console-driven changes
  setTimeout(() => {
    allowConsoleAt = Date.now(); // allow immediately
    // ensure checkboxes bound after potential SPA rendering
    try { attachCheckboxListeners(); } catch (e) {}
  }, COOLDOWN_MS + 10);

  // 3) Observe container for SPA changes, rebind and re-sync
  (function observeContainerForChanges() {
    try {
      const root = document.querySelector(BM_CONTAINER_SELECTOR);
      if (!root) {
        // watch for insertion if panel not present yet
        const mo = new MutationObserver((muts, obs) => {
          const r = document.querySelector(BM_CONTAINER_SELECTOR);
          if (r) {
            syncUiFromMask();
            attachCheckboxListeners();
            obs.disconnect();
            // attach further observer to this root
            observeRoot(r);
          }
        });
        mo.observe(document, { childList: true, subtree: true });
        return;
      }
      observeRoot(root);
    } catch (e) {}
    function observeRoot(rootEl) {
      try {
        const mo2 = new MutationObserver(() => {
          // rebind and resync on structural changes
          syncUiFromMask();
          attachCheckboxListeners();
        });
        mo2.observe(rootEl, { childList: true, subtree: true });
      } catch (e) {}
    }
  })();

  // ------- Expose debug helpers -------
  try {
    window.__bm_mask = {
      read: () => readMask().toString(),
      setBit: (i, v) => { const m = readMask(); writeMask(setBit(m, i, v ? 1 : 0)); },
      forceSyncUi: () => syncUiFromMask(),
      allowConsoleNow: () => { allowConsoleAt = Date.now(); },
      setCooldownMs: (ms) => { allowConsoleAt = Date.now() + Number(ms || COOLDOWN_MS); },
      // helper to set all on/off manually
      setAll: (on) => {
        const { domRows } = buildColorIndexMap();
        const count = Math.max(domRows && domRows.length ? domRows.length : 0, FALLBACK_COLORS.length);
        writeMask(on ? maskWithCountOn(count) : 0n);
        syncUiFromMask();
      }
    };
  } catch (e) {}

})();
(function attachControlButtons() {
  function bindButtons(root = document) {
    try {
      const btnEnable = root.querySelector('#bm-3');
      const btnDisable = root.querySelector('#bm-0');

      if (btnEnable && !btnEnable.__bm_bound) {
        btnEnable.__bm_bound = true;
        btnEnable.addEventListener('click', () => {
          try {
            // set all on and sync UI
            if (window.__bm_mask && typeof window.__bm_mask.setAll === 'function') {
              window.__bm_mask.setAll(true);
            }
          } catch (e) {}
          // Emit console line that existing hijack will parse
          try { console.log('Status: Enabled all colors'); } catch (e) {}
        }, { passive: true });
      }

      if (btnDisable && !btnDisable.__bm_bound) {
        btnDisable.__bm_bound = true;
        btnDisable.addEventListener('click', () => {
          try {
            if (window.__bm_mask && typeof window.__bm_mask.setAll === 'function') {
              window.__bm_mask.setAll(false);
            }
          } catch (e) {}
          try { console.log('Status: Disabled all colors'); } catch (e) {}
        }, { passive: true });
      }
    } catch (err) {
      // silent
    }
  }

  // Try immediate bind (in case buttons already present)
  bindButtons();

  // Observe document for added buttons (SPA / dynamic insertion)
  try {
    const mo = new MutationObserver((muts) => {
      // cheap check: only attempt bind when nodes added
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) {
          bindButtons();
          break;
        }
      }
    });
    mo.observe(document, { childList: true, subtree: true });
  } catch (e) {}
})();