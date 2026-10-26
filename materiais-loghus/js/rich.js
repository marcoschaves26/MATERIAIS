/* Texto "rico" simples usado em todo o app:
   **negrito**, __itálico__, \( fórmula LaTeX \), [[img:ID]] para imagens.
   Cada linha (\n) é um parágrafo. */
(function (global) {
  'use strict';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Divide um parágrafo em segmentos {t:'text'|'math'|'img', v, b, i}
  function tokenize(line) {
    const segs = [];
    let bold = false, ital = false, buf = '';
    const s = String(line || '');
    function flush() { if (buf) { segs.push({ t: 'text', v: buf, b: bold, i: ital }); buf = ''; } }
    let i = 0;
    while (i < s.length) {
      if (s.startsWith('\\(', i)) {
        const j = s.indexOf('\\)', i + 2);
        if (j > -1) { flush(); segs.push({ t: 'math', v: s.slice(i + 2, j), b: bold }); i = j + 2; continue; }
      }
      if (s.startsWith('[[img:', i)) {
        const j = s.indexOf(']]', i);
        if (j > -1) { flush(); segs.push({ t: 'img', v: s.slice(i + 6, j) }); i = j + 2; continue; }
      }
      if (s.startsWith('**', i)) { flush(); bold = !bold; i += 2; continue; }
      if (s.startsWith('__', i)) { flush(); ital = !ital; i += 2; continue; }
      buf += s[i]; i++;
    }
    flush();
    return segs;
  }

  function paragraphs(text) {
    return String(text || '').replace(/\r/g, '').split('\n');
  }

  // Parágrafo composto só por uma imagem?
  function soloImage(segs) {
    const real = segs.filter(s => !(s.t === 'text' && !s.v.trim()));
    return real.length === 1 && real[0].t === 'img' ? real[0].v : null;
  }

  const katexCache = new Map();
  function mathHTML(tex) {
    if (katexCache.has(tex)) return katexCache.get(tex);
    let html;
    try {
      html = global.katex ? global.katex.renderToString(tex, { throwOnError: false, output: 'html', strict: 'ignore' }) : esc(global.LoghusLatex.toUnicode(tex));
    } catch (e) { html = esc(global.LoghusLatex.toUnicode(tex)); }
    katexCache.set(tex, html);
    return html;
  }

  // HTML de um segmento (imagens inline com altura limitada)
  function segHTML(seg, images, opts) {
    opts = opts || {};
    if (seg.t === 'text') {
      let h = esc(seg.v);
      if (seg.b) h = '<b>' + h + '</b>';
      if (seg.i) h = '<i>' + h + '</i>';
      return h;
    }
    if (seg.t === 'math') return '<span class="m">' + mathHTML(seg.v) + '</span>';
    if (seg.t === 'img') {
      const im = images[seg.v];
      if (!im) return '<span class="img-missing">[imagem]</span>';
      return '<img class="inl" src="' + im.src + '" alt="">';
    }
    return '';
  }

  function segsHTML(segs, images, opts) { return segs.map(s => segHTML(s, images, opts)).join(''); }

  // Divide segmentos em "palavras" atômicas para quebrar parágrafos entre colunas
  function atomize(segs) {
    const out = [];
    for (const s of segs) {
      if (s.t !== 'text') { out.push(s); continue; }
      const parts = s.v.split(/(\s+)/);
      for (const p of parts) if (p) out.push({ t: 'text', v: p, b: s.b, i: s.i });
    }
    return out;
  }

  function plain(text) {
    return tokenize(text).map(s => s.t === 'text' ? s.v : s.t === 'math' ? global.LoghusLatex.toUnicode(s.v) : '').join('');
  }

  function imageIds(text) {
    const ids = [];
    String(text || '').replace(/\[\[img:([^\]]+)\]\]/g, (_, id) => { ids.push(id); return ''; });
    return ids;
  }

  global.Rich = { tokenize, paragraphs, soloImage, segHTML, segsHTML, atomize, mathHTML, esc, plain, imageIds };
})(window);
