/* Shared helpers for the CV side pages (resume/, card/): load content.json and pick a language.
 * The main CV page (personalcv/index.html) keeps its own copy of these helpers inline. */
(function(){
  var LANGS = ['zh', 'en', 'ja'];
  var LANG_ATTR = { zh: 'zh-Hant', en: 'en', ja: 'ja' };

  function has(v){ return v != null && String(v).trim() !== ''; }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // A value is a plain string or { zh, en, ja }; empty languages fall back to zh
  function pick(v, lang){
    if(v == null) return '';
    if(typeof v !== 'object') return String(v);
    return has(v[lang]) ? v[lang] : (has(v.zh) ? v.zh : (v.en || v.ja || ''));
  }
  // **bold** -> <strong>
  function md(s){ return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'); }
  function list(v){ return Array.isArray(v) ? v : []; }
  function safeUrl(u){ return /^(https?:|mailto:)/i.test(String(u || '').trim()) ? String(u).trim() : ''; }

  // ?lang= first, then the visitor's last choice on the CV, then the browser language
  function initialLang(){
    var lang = '';
    try{
      var q = new URLSearchParams(location.search).get('lang');
      lang = LANG_ATTR[q] ? q : (LANG_ATTR[localStorage.getItem('cv-lang')] ? localStorage.getItem('cv-lang') : '');
    }catch(e){}
    if(!lang){
      var nav = String(navigator.language || '').toLowerCase();
      lang = nav.indexOf('ja') === 0 ? 'ja' : (nav.indexOf('zh') === 0 ? 'zh' : (nav ? 'en' : 'zh'));
    }
    return lang;
  }
  var jaFonts = false;
  function applyLang(lang, remember){
    if(!LANG_ATTR[lang]) lang = 'zh';
    var root = document.documentElement;
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', LANG_ATTR[lang]);
    if(lang === 'ja' && !jaFonts){
      jaFonts = true;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700;900&family=Noto+Sans+JP:wght@400;700&display=swap';
      document.head.appendChild(link);
    }
    if(remember){
      try{ localStorage.setItem('cv-lang', lang); }catch(e){}
      try{
        var u = new URL(location.href);
        if(lang === 'zh') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang);
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      }catch(e){}
    }
    return lang;
  }
  function initialTheme(){
    var t = '';
    try{ t = localStorage.getItem('cv-theme') || ''; }catch(e){}
    if(t !== 'dark' && t !== 'light') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return t;
  }
  function load(){
    return fetch('/personalcv/content.json', { cache: 'no-cache' }).then(function(r){
      if(!r.ok) throw new Error('content.json ' + r.status);
      return r.json();
    });
  }
  // "2026-10-24" -> per-language date
  function fmtDate(iso, lang){
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if(!m) return iso || '';
    if(lang === 'en'){
      var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return months[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1];
    }
    return m[1] + ' 年 ' + (+m[2]) + ' 月 ' + (+m[3]) + ' 日';
  }
  // ORCID / LinkedIn URLs shown as short handles on paper
  function shortUrl(u){ return String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''); }

  var STATUS = {
    published: { zh: '已發表', en: 'Published',    ja: '掲載済み' },
    accepted:  { zh: '已接受', en: 'Accepted',     ja: '採択済み' },
    review:    { zh: '審查中', en: 'Under review', ja: '査読中' },
    preprint:  { zh: '預印本', en: 'Preprint',     ja: 'プレプリント' },
    draft:     { zh: '撰寫中', en: 'In preparation', ja: '執筆中' }
  };

  window.CV = { LANGS: LANGS, has: has, esc: esc, pick: pick, md: md, list: list, safeUrl: safeUrl,
    initialLang: initialLang, applyLang: applyLang, initialTheme: initialTheme, load: load,
    fmtDate: fmtDate, shortUrl: shortUrl, STATUS: STATUS };
})();
