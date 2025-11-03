// injected_style_patch.js (修改版：延后安装 fetch/XHR 拦截器，优先读取 storage 配置)
(function(){
  if (window.__WPLACE_STYLE_PATCH_INJECTED) return;
  window.__WPLACE_STYLE_PATCH_INJECTED = true;

  // 初始保守配置：不要默认移除任何图层，避免拦截器在读取用户配置前破坏样式
  window.__WPLACE_STYLE_PATCH_CONFIG = {
    stripRoads: false,
    stripNames: false,
    targetPrefixes: [
      'https://maps.wplace.live/styles/liberty',
      'https://maps.wplace.live/styles/fiord'
    ]
  };

  // 安全读写助手
  function getCfg() { return window.__WPLACE_STYLE_PATCH_CONFIG || { stripRoads:false, stripNames:false, targetPrefixes:['https://maps.wplace.live/styles/liberty','https://maps.wplace.live/styles/fiord'] }; }
  function setCfg(partial) {
    try {
      const cur = getCfg();
      const out = Object.assign({}, cur, partial || {});
      if (partial && typeof partial.targetPrefix === 'string' && (!out.targetPrefixes || !Array.isArray(out.targetPrefixes))) {
        out.targetPrefixes = [partial.targetPrefix];
      } else if (partial && typeof partial.targetPrefix === 'string' && Array.isArray(out.targetPrefixes) && out.targetPrefixes.indexOf(partial.targetPrefix) === -1) {
        out.targetPrefixes = out.targetPrefixes.concat([partial.targetPrefix]);
      }
      window.__WPLACE_STYLE_PATCH_CONFIG = out;
    } catch (e) {}
  }

  // 监听外部消息以动态开关（content script -> page postMessage）
  window.addEventListener('message', (ev) => {
    try {
      const m = ev && ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.__wplace_style_patch === 'SET_CONFIG') {
        const update = {};
        if ('stripRoads' in m) update.stripRoads = !!m.stripRoads;
        if ('stripNames' in m) update.stripNames = !!m.stripNames;
        if ('targetPrefix' in m && typeof m.targetPrefix === 'string') {
          const cur = getCfg();
          const arr = Array.isArray(cur.targetPrefixes) ? cur.targetPrefixes.slice() : [];
          if (arr.indexOf(m.targetPrefix) === -1) arr.push(m.targetPrefix);
          update.targetPrefixes = arr;
        }
        if ('targetPrefixes' in m && Array.isArray(m.targetPrefixes)) {
          update.targetPrefixes = m.targetPrefixes.slice();
        }
        setCfg(update);
        try { window.postMessage({ __wplace_style_patch: 'CONFIG_UPDATED', config: getCfg() }, '*'); } catch(e){}
      }
    } catch (e) {}
  });

  // ---------- layer classifiers ----------
  function isRoadLayer(layer) {
    if (!layer || typeof layer !== 'object') return false;
    const srcLayer = layer['source-layer'];
    if (typeof srcLayer === 'string') {
      const s = srcLayer.toLowerCase();
      if (s === 'transportation' || s === 'transportation_name' || s.startsWith('transportation')) return true;
    }
    const id = (layer.id || '').toLowerCase();
    if (/\b(road|road_|road-|roadarea|highway|bridge|tunnel|motorway|trunk|primary|secondary|tertiary|link|ramp|path|pedestrian|track|service|rail|transit|one_way|one-way|oneway|road_shield|shield|highway-name|highway-shield)\b/i.test(id)) {
      return true;
    }
    if (layer.type === 'symbol' && layer['source-layer'] && /transportation_name|transportation/.test(layer['source-layer'])) return true;
    if (layer.type === 'symbol' && layer.layout) {
      const lp = layer.layout['symbol-placement'];
      if (lp === 'line') return true;
      const icon = layer.layout['icon-image'];
      if (typeof icon === 'string' && /arrow|shield|road_|motorway|oneway|one_way/.test(icon)) return true;
    }
    if (layer.source && typeof layer.source === 'string' && layer.source.toLowerCase().includes('openmaptiles') && id.includes('transportation')) return true;
    return false;
  }

  function isNameLayer(layer) {
    if (!layer || typeof layer !== 'object') return false;
    const nameSourceLayers = new Set(['place','transportation_name','water_name','waterway','poi','aerodrome_label','aeroway']);
    if (layer['source-layer'] && nameSourceLayers.has(layer['source-layer'])) return true;
    const id = (layer.id || '').toLowerCase();
    if (/\b(label|name|poi|water_name|water_name_line|water_name_point|airport|aerodrome|highway-name|highway-shield|road_shield|shield)\b/i.test(id)) {
      return true;
    }
    if (layer.type === 'symbol' && layer.layout && ('text-field' in layer.layout)) return true;
    return false;
  }

  function stripLayersByConfig(styleJson) {
    if (!styleJson || !Array.isArray(styleJson.layers)) return styleJson;
    const cfg = getCfg();
    let kept = styleJson.layers;
    if (cfg.stripRoads) kept = kept.filter(layer => !isRoadLayer(layer));
    if (cfg.stripNames) kept = kept.filter(layer => !isNameLayer(layer));
    return Object.assign({}, styleJson, { layers: kept });
  }

  function cloneHeaders(h) {
    try {
      const nh = new Headers();
      for (const [k, v] of h.entries()) nh.set(k, v);
      return nh;
    } catch (e) {
      return new Headers({ 'content-type': 'application/json' });
    }
  }

  // helper: 判断 URL 是否命中配置的任一前缀
  function urlMatchesTarget(url) {
    try {
      if (!url || typeof url !== 'string') return false;
      const cfg = getCfg();
      const prefixes = Array.isArray(cfg.targetPrefixes) ? cfg.targetPrefixes : (cfg.targetPrefixes ? [cfg.targetPrefixes] : []);
      if (cfg.targetPrefix && typeof cfg.targetPrefix === 'string' && prefixes.indexOf(cfg.targetPrefix) === -1) prefixes.push(cfg.targetPrefix);
      for (const p of prefixes) {
        try {
          if (!p) continue;
          if (url.indexOf(p) === 0) return true;
        } catch(_) {}
      }
      return false;
    } catch (e) { return false; }
  }

  // ---------- Prepare override installer (延后安装拦截器) ----------
  function installFetchAndXhrOverrides() {
    if (installFetchAndXhrOverrides.installed) return;
    installFetchAndXhrOverrides.installed = true;

    // fetch override
    try {
      const originalFetch = window.fetch;
      window.fetch = async function(input, init) {
        try {
          const url = (typeof input === 'string') ? input : input && input.url;
          if (urlMatchesTarget(typeof url === 'string' ? url : '')) {
            const resp = await originalFetch.apply(this, arguments);
            const contentType = resp.headers.get('content-type') || '';
            if (contentType.includes('application/json') || contentType.includes('application/vnd.mapbox.style+json') || contentType.includes('text/json')) {
              const cloned = resp.clone();
              let json;
              try { json = await cloned.json(); } catch (e) { return resp; }
              const modified = stripLayersByConfig(json);
              const body = JSON.stringify(modified);
              const headers = cloneHeaders(resp.headers);
              return new Response(body, { status: resp.status, statusText: resp.statusText, headers: headers });
            }
            return resp;
          }
        } catch (e) {
          return originalFetch.apply(this, arguments);
        }
        return originalFetch.apply(this, arguments);
      };
    } catch (e) {
      // ignore installation errors
    }

    // XHR override
    try {
      (function(){
        const XHRProto = XMLHttpRequest.prototype;
        const origOpen = XHRProto.open;
        const origSend = XHRProto.send;

        XHRProto.open = function(method, url) {
          this.__intercept_url = (typeof url === 'string') ? url : (url && url.toString && url.toString());
          this.__intercept_method = (method || 'GET').toUpperCase();
          return origOpen.apply(this, arguments);
        };

        XHRProto.send = function(body) {
          try {
            const url = this.__intercept_url || '';
            const method = this.__intercept_method || 'GET';
            if (urlMatchesTarget(url) && method === 'GET') {
              const xhr = this;
              (async () => {
                try {
                  const resp = await window.fetch(url, { method: 'GET', credentials: 'same-origin' });
                  const contentType = resp.headers.get('content-type') || '';
                  if (contentType.includes('application/json') || contentType.includes('application/vnd.mapbox.style+json') || contentType.includes('text/json')) {
                    const json = await resp.json();
                    const modified = stripLayersByConfig(json);
                    const text = JSON.stringify(modified);

                    Object.defineProperty(xhr, 'responseText', { writable: true });
                    Object.defineProperty(xhr, 'response', { writable: true });
                    xhr.status = resp.status;
                    xhr.statusText = resp.statusText || '';
                    xhr.readyState = 4;
                    xhr.responseText = text;
                    xhr.response = text;
                    if (typeof xhr.onreadystatechange === 'function') try { xhr.onreadystatechange(); } catch(e){}
                    try { xhr.dispatchEvent(new Event('load')); } catch(e){}
                    try { xhr.dispatchEvent(new Event('loadend')); } catch(e){}
                    return;
                  } else {
                    const text = await resp.text();
                    Object.defineProperty(xhr, 'responseText', { writable: true });
                    Object.defineProperty(xhr, 'response', { writable: true });
                    xhr.status = resp.status;
                    xhr.statusText = resp.statusText || '';
                    xhr.readyState = 4;
                    xhr.responseText = text;
                    xhr.response = text;
                    if (typeof xhr.onreadystatechange === 'function') try { xhr.onreadystatechange(); } catch(e){}
                    try { xhr.dispatchEvent(new Event('load')); } catch(e){}
                    try { xhr.dispatchEvent(new Event('loadend')); } catch(e){}
                    return;
                  }
                } catch (err) {
                  xhr.readyState = 4;
                  xhr.status = 0;
                  if (typeof xhr.onerror === 'function') try { xhr.onerror(err); } catch(e){}
                  try { xhr.dispatchEvent(new Event('error')); } catch(e){}
                  try { xhr.dispatchEvent(new Event('loadend')); } catch(e){}
                  return;
                }
              })();
              return;
            }
          } catch (e) {}
          return origSend.apply(this, arguments);
        };
      })();
    } catch (e) {
      // ignore
    }
  }

  // 暴露安装函数，方便调试或外部强制调用
  window.__wplace_install_style_overrides = installFetchAndXhrOverrides;

  // 为兼容：将内部 stripLayersByConfig 暴露到窗口（若需要被别的片段重用）
  try { if (typeof stripLayersByConfig === 'function' && !window.__WPLACE_INTERNAL_stripLayersByConfig) window.__WPLACE_INTERNAL_stripLayersByConfig = function(s, c){ const prev=window.__WPLACE_STYLE_PATCH_CONFIG; try{ window.__WPLACE_STYLE_PATCH_CONFIG = Object.assign({}, prev||{}, c||{}); return stripLayersByConfig(s);}finally{ window.__WPLACE_STYLE_PATCH_CONFIG = prev; }}; } catch(e){}

  // applyConfigOnLoad 主流程（读取 storage -> 更新全局 config -> 安装拦截器 -> 对已知 map 实例尝试应用 processed style）
  (async function applyConfigOnLoad() {
    try {
      // 读取配置（优先 chrome.storage.local 回退到 window 全局 / localStorage）
      async function readConfig() {
        const def = { stripRoads: false, stripNames: false, targetPrefixes: ['https://maps.wplace.live/styles/liberty','https://maps.wplace.live/styles/fiord'] };
        try {
          if (window.chrome && chrome.storage && chrome.storage.local) {
            const res = await new Promise(resolve => chrome.storage.local.get(['wplace_map_style_cfg_v2','__WPLACE_STYLE_PATCH_CONFIG','wplace_style_patch_cfg'], resolve)).catch(()=>null);
            const keys = res || {};
            let cfg = keys.wplace_map_style_cfg_v2 || keys.__WPLACE_STYLE_PATCH_CONFIG || keys.wplace_style_patch_cfg || null;
            if (cfg) return Object.assign({}, def, cfg);
          }
        } catch (e) {}
        try {
          // 支持页面上已存在的全局配置（content script 可能已经写入）
          if (window.__WPLACE_STYLE_PATCH_CONFIG) return Object.assign({}, def, window.__WPLACE_STYLE_PATCH_CONFIG);
        } catch (e) {}
        try {
          const raw = localStorage.getItem('wplace_map_style_cfg_v2') || localStorage.getItem('wplace_style_patch_cfg');
          if (raw) {
            try { const parsed = JSON.parse(raw); if (parsed) return Object.assign({}, def, parsed); } catch(e){}
          }
        } catch (e) {}
        return def;
      }

      const cfg = await readConfig();

      // 更新全局 config（覆盖初始保守值）
      try { window.__WPLACE_STYLE_PATCH_CONFIG = Object.assign({}, window.__WPLACE_STYLE_PATCH_CONFIG || {}, cfg || {}); } catch(e){}

      // 在已知配置就绪后安装拦截器（关键步骤）
      try { installFetchAndXhrOverrides(); } catch (e) {}

      // helper: 构造 style.json URL（从 prefix 推断）
      function styleJsonUrlFromPrefix(p) {
        try {
          if (!p) return null;
          if (/\/style\.json($|\?)/i.test(p)) return p;
          if (p.endsWith('/')) return p + 'style.json';
          return p + (p.includes('?') ? '&' : '/') + 'style.json';
        } catch (e) { return null; }
      }

      // cache-bust
      function bust(u) {
        try { const U = new URL(u, location.href); U.searchParams.set('_wplace_bust', Date.now().toString(36)); return U.toString(); } catch (e) {
          return u + (u.indexOf('?') === -1 ? '?' : '&') + '_wplace_bust=' + Date.now().toString(36);
        }
      }

      // safe fetch JSON
      async function fetchJson(u) {
        try {
          const r = await fetch(u, { cache: 'no-store', credentials: 'same-origin' });
          if (!r || !r.ok) return null;
          return await r.json().catch(()=>null);
        } catch (e) { return null; }
      }

      // 尝试找到 maplibre/mapbox 实例集合
      function findMapInstances() {
        const maps = new Set();
        try {
          if (window.map && typeof window.map.setStyle === 'function') maps.add(window.map);
          if (window.mapboxMap && typeof window.mapboxMap.setStyle === 'function') maps.add(window.mapboxMap);
        } catch (e) {}
        try {
          for (const k in window) {
            try {
              const v = window[k];
              if (v && typeof v === 'object' && typeof v.setStyle === 'function' && typeof v.getStyle === 'function') maps.add(v);
            } catch (e) {}
          }
        } catch (e) {}
        try {
          const canv = Array.from(document.querySelectorAll('.mapboxgl-canvas, .maplibregl-canvas, canvas')).slice(0, 30);
          for (const c of canv) {
            let root = c;
            for (let i=0;i<6 && root;i++) {
              root = root.parentElement;
              if (!root) break;
              for (const prop of ['__map','__mapbox','__maplibregl_map','__mapbox_map','map','_map']) {
                try {
                  const maybe = root[prop];
                  if (maybe && typeof maybe.setStyle === 'function') maps.add(maybe);
                } catch(e){}
              }
            }
          }
        } catch(e){}
        return Array.from(maps);
      }

      // 如果内部有 stripLayersByConfig 可直接调用；否则使用本文件的实现（已经可见）
      function applyStripToStyle(styleObj, conf) {
        try {
          if (typeof window.__WPLACE_INTERNAL_stripLayersByConfig === 'function') {
            return window.__WPLACE_INTERNAL_stripLayersByConfig(styleObj, conf);
          }
          if (typeof stripLayersByConfig === 'function') {
            const prev = window.__WPLACE_STYLE_PATCH_CONFIG;
            try { window.__WPLACE_STYLE_PATCH_CONFIG = Object.assign({}, prev||{}, conf||{}); return stripLayersByConfig(styleObj); } finally { window.__WPLACE_STYLE_PATCH_CONFIG = prev; }
          }
        } catch (e) {}
        return styleObj;
      }

      // 主流程：对每个 prefix fetch style.json（带 bust），将处理后的 style 应用于每个 map 实例
      const prefixes = Array.isArray(cfg.targetPrefixes) && cfg.targetPrefixes.length ? cfg.targetPrefixes.slice() : (cfg.targetPrefix ? [cfg.targetPrefix] : []);
      if (!prefixes.length) prefixes.push('https://maps.wplace.live/styles/liberty','https://maps.wplace.live/styles/fiord');

      const mapInstances = findMapInstances();

      for (const p of prefixes) {
        try {
          const sx = styleJsonUrlFromPrefix(p);
          if (!sx) continue;
          const json = await fetchJson(bust(sx));
          if (!json) continue;
          const processed = applyStripToStyle(json, { stripRoads: !!cfg.stripRoads, stripNames: !!cfg.stripNames, targetPrefixes: cfg.targetPrefixes });
          for (const m of mapInstances) {
            try {
              if (typeof m.setStyle === 'function') {
                try {
                  m.setStyle(processed);
                } catch (e) {
                  try { m.setStyle(bust(sx)); } catch(e2){}
                }
              }
            } catch (e) {}
          }
        } catch (e) {}
      }

      try { window.postMessage({ __wplace_style_patch: 'APPLIED_ON_LOAD', config: cfg }, '*'); } catch(e){}
    } catch (err) {
      try { console.warn('WPLACE applyConfigOnLoad failed', err); } catch(e){}
    }
  })();

})();
