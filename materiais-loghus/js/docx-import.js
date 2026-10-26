/* Lê um .docx do professor e devolve linhas no formato rico
   (texto, **negrito**, \( fórmulas \) e [[img:ID]]), além das imagens. */
(function (global) {
  'use strict';

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  function kids(el) { return el ? Array.from(el.children) : []; }
  function child(el, name) { return kids(el).find(c => c.localName === name) || null; }
  function attr(el, name) {
    if (!el) return null;
    for (const a of el.attributes) if (a.localName === name) return a.value;
    return null;
  }

  // ---------- OMML -> LaTeX ----------
  const UNI2TEX = { 'π': '\\pi ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '·': '\\cdot ', '×': '\\times ', '÷': '\\div ', '±': '\\pm ', '∞': '\\infty ', '≅': '\\cong ', '≈': '\\approx ', '°': '^\\circ ', '∆': '\\Delta ', 'Δ': '\\Delta ', 'θ': '\\theta ', 'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'λ': '\\lambda ', 'μ': '\\mu ', 'ρ': '\\rho ', 'σ': '\\sigma ', 'ω': '\\omega ', 'φ': '\\varphi ', '∈': '\\in ', '→': '\\to ', '⇒': '\\Rightarrow ', '∠': '\\angle ', '−': '-', '…': '\\ldots ', '⋅': '\\cdot ', '∗': '*', '√': '\\surd ', '%': '\\%', '#': '\\#', '&': '\\&', '{': '\\{', '}': '\\}', '_': '\\_', '$': '\\$' };
  function texText(s, plain) {
    let out = '';
    for (const ch of s) {
      if (ch === ' ' || ch === ' ') out += '\\ ';
      else if (UNI2TEX[ch]) out += UNI2TEX[ch];
      else if (ch === '\\') out += '\\backslash ';
      else out += ch;
    }
    if (plain && /[A-Za-zÀ-ú]{2,}/.test(s)) return '\\text{' + s.replace(/[{}\\]/g, '') + '}';
    return out;
  }
  function g(s) { return '{' + s + '}'; }
  function ommlList(el) { return kids(el).map(ommlNode).join(''); }
  function ommlNode(el) {
    switch (el.localName) {
      case 'r': {
        const t = kids(el).filter(c => c.localName === 't').map(c => c.textContent).join('');
        const rPr = child(el, 'rPr');
        const sty = rPr ? attr(child(rPr, 'sty'), 'val') : null;
        const nor = rPr && child(rPr, 'nor');
        return texText(t, sty === 'p' || !!nor);
      }
      case 'f': return '\\frac' + g(ommlList(child(el, 'num'))) + g(ommlList(child(el, 'den')));
      case 'rad': {
        const deg = child(el, 'deg');
        const d = deg ? ommlList(deg) : '';
        return '\\sqrt' + (d ? '[' + d + ']' : '') + g(ommlList(child(el, 'e')));
      }
      case 'sSup': return g(ommlList(child(el, 'e'))) + '^' + g(ommlList(child(el, 'sup')));
      case 'sSub': return g(ommlList(child(el, 'e'))) + '_' + g(ommlList(child(el, 'sub')));
      case 'sSubSup': return g(ommlList(child(el, 'e'))) + '_' + g(ommlList(child(el, 'sub'))) + '^' + g(ommlList(child(el, 'sup')));
      case 'sPre': return '{}_' + g(ommlList(child(el, 'sub'))) + '^' + g(ommlList(child(el, 'sup'))) + g(ommlList(child(el, 'e')));
      case 'd': {
        const pr = child(el, 'dPr');
        let beg = '(', end = ')', sep = ',';
        if (pr) {
          const b = child(pr, 'begChr'), e = child(pr, 'endChr'), s = child(pr, 'sepChr');
          if (b) beg = attr(b, 'val') || ''; if (e) end = attr(e, 'val') || ''; if (s) sep = attr(s, 'val') || ',';
        }
        const fix = c => c === '{' ? '\\{' : c === '}' ? '\\}' : c === '|' ? '|' : c === '⌊' ? '\\lfloor ' : c === '⌋' ? '\\rfloor ' : c === '[' ? '[' : c;
        const es = kids(el).filter(c => c.localName === 'e').map(ommlList);
        return '\\left' + (fix(beg) || '.') + es.join(sep) + '\\right' + (fix(end) || '.');
      }
      case 'func': return ommlList(child(el, 'fName')) + '\\,' + g(ommlList(child(el, 'e')));
      case 'nary': {
        const pr = child(el, 'naryPr');
        const chr = pr && child(pr, 'chr') ? attr(child(pr, 'chr'), 'val') : '∫';
        const op = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '⋃': '\\bigcup', '⋂': '\\bigcap' }[chr] || chr;
        const sub = child(el, 'sub'), sup = child(el, 'sup');
        return op + (sub && sub.children.length ? '_' + g(ommlList(sub)) : '') + (sup && sup.children.length ? '^' + g(ommlList(sup)) : '') + g(ommlList(child(el, 'e')));
      }
      case 'bar': return '\\overline' + g(ommlList(child(el, 'e')));
      case 'acc': {
        const pr = child(el, 'accPr');
        const chr = pr && child(pr, 'chr') ? attr(child(pr, 'chr'), 'val') : '̂';
        const cmd = /[⃗→]/.test(chr) ? '\\vec' : /[̅‾¯]/.test(chr) ? '\\overline' : '\\hat';
        return cmd + g(ommlList(child(el, 'e')));
      }
      case 'limLow': return ommlList(child(el, 'e')) + '_' + g(ommlList(child(el, 'lim')));
      case 'limUpp': return ommlList(child(el, 'e')) + '^' + g(ommlList(child(el, 'lim')));
      case 'groupChr': case 'box': case 'borderBox': case 'phant': return ommlList(child(el, 'e'));
      case 'eqArr': return kids(el).filter(c => c.localName === 'e').map(ommlList).join('\\\\ ');
      case 'm': return kids(el).filter(c => c.localName === 'mr').map(mr => kids(mr).filter(c => c.localName === 'e').map(ommlList).join(' & ')).join('\\\\ ');
      case 'oMath': case 'e': case 'num': case 'den': case 'oMathPara': return ommlList(el);
      default:
        if (/Pr$/.test(el.localName) || el.localName === 'ctrlPr' || el.localName === 'argPr') return '';
        return ommlList(el);
    }
  }
  function ommlToLatex(el) {
    let s = ommlNode(el).replace(/\s+/g, ' ').trim();
    s = s.replace(/(\\ )+$/g, '').replace(/^(\\ )+/g, '');
    return s;
  }

  // ---------- numeração automática do Word ----------
  function numberingInfo(numXml) {
    const info = { nums: {}, abs: {} };
    if (!numXml) return info;
    for (const an of numXml.getElementsByTagNameNS(W, 'abstractNum')) {
      const id = attr(an, 'abstractNumId'); const lvls = {};
      for (const lv of an.getElementsByTagNameNS(W, 'lvl')) {
        const il = attr(lv, 'ilvl');
        lvls[il] = { fmt: attr(child(lv, 'numFmt'), 'val'), text: attr(child(lv, 'lvlText'), 'val'), start: +(attr(child(lv, 'start'), 'val') || 1) };
      }
      info.abs[id] = lvls;
    }
    for (const n of numXml.getElementsByTagNameNS(W, 'num')) {
      info.nums[attr(n, 'numId')] = attr(child(n, 'abstractNumId'), 'val');
    }
    return info;
  }

  async function importDocx(arrayBuffer, addImage) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();
    const docXml = parser.parseFromString(await zip.file('word/document.xml').async('string'), 'application/xml');
    const relsFile = zip.file('word/_rels/document.xml.rels');
    const rels = {};
    if (relsFile) {
      const rx = parser.parseFromString(await relsFile.async('string'), 'application/xml');
      for (const r of rx.getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target');
    }
    const numFile = zip.file('word/numbering.xml');
    const numInfo = numberingInfo(numFile ? parser.parseFromString(await numFile.async('string'), 'application/xml') : null);
    const counters = {};
    const warnings = [];
    const imgCache = {};

    async function imageFor(rid, emuW) {
      const target = rels[rid];
      if (!target) return null;
      const path = target.startsWith('/') ? target.slice(1) : 'word/' + target.replace(/^\.\//, '');
      const norm = path.split('/').reduce((a, p) => { if (p === '..') a.pop(); else a.push(p); return a; }, []).join('/');
      if (imgCache[norm]) return imgCache[norm];
      const f = zip.file(norm);
      if (!f) return null;
      const ext = norm.split('.').pop().toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) { warnings.push('Uma imagem em formato ' + ext.toUpperCase() + ' não pôde ser lida (reinsira como PNG/JPG).'); return null; }
      const b64 = await f.async('base64');
      const mime = ext === 'jpg' ? 'image/jpeg' : 'image/' + ext;
      const id = await addImage('data:' + mime + ';base64,' + b64, emuW ? emuW / 12700 : null);
      imgCache[norm] = id;
      return id;
    }

    async function inlineFrom(el, ctx, out) {
      for (const c of kids(el)) {
        const n = c.localName;
        if (c.namespaceURI === M && (n === 'oMath' || n === 'oMathPara')) {
          const maths = n === 'oMathPara' ? kids(c).filter(k => k.localName === 'oMath') : [c];
          for (const mm of maths) { const tex = ommlToLatex(mm); if (tex) out.push({ t: 'math', v: tex }); }
          continue;
        }
        if (n === 'r') { await runFrom(c, out); continue; }
        if (['hyperlink', 'ins', 'smartTag', 'fldSimple', 'customXml', 'sdtContent', 'sdt', 'moveTo'].includes(n)) { await inlineFrom(c, ctx, out); continue; }
        if (n === 'AlternateContent') { const ch = child(c, 'Choice') || child(c, 'Fallback'); if (ch) await inlineFrom(ch, ctx, out); continue; }
        if (n === 'del' || n === 'moveFrom' || n === 'pPr' || n === 'proofErr' || n === 'bookmarkStart' || n === 'bookmarkEnd') continue;
      }
    }
    async function runFrom(r, out, inhB, inhI) {
      const rPr = r.__alt ? null : child(r, 'rPr');
      const on = name => { const e = rPr && child(rPr, name); if (!e) return false; const v = attr(e, 'val'); return !(v === '0' || v === 'false' || v === 'none'); };
      const b = r.__alt ? inhB : on('b'), it = r.__alt ? inhI : on('i');
      const vert = rPr && child(rPr, 'vertAlign') ? attr(child(rPr, 'vertAlign'), 'val') : null;
      for (const c of kids(r)) {
        const n = c.localName;
        if (n === 't') {
          let t = c.textContent;
          if (vert === 'superscript' && t) out.push({ t: 'math', v: '^{\\text{' + t + '}}' });
          else if (vert === 'subscript' && t) out.push({ t: 'math', v: '_{\\text{' + t + '}}' });
          else out.push({ t: 'text', v: t, b, i: it });
        }
        else if (n === 'tab') out.push({ t: 'text', v: ' ', b, i: it });
        else if (n === 'br' || n === 'cr') { const ty = attr(c, 'type'); if (ty !== 'page' && ty !== 'column') out.push({ t: 'br' }); }
        else if (n === 'sym') { const code = parseInt(attr(c, 'char'), 16); out.push({ t: 'text', v: symbolChar(attr(c, 'font'), code), b, i: it }); }
        else if (n === 'noBreakHyphen') out.push({ t: 'text', v: '-', b, i: it });
        else if (n === 'AlternateContent') {
          const choice = child(c, 'Choice') || child(c, 'Fallback');
          if (choice) await runFrom({ children: choice.children, attributes: [] , __alt: true }, out, b, it);
        }
        else if (n === 'drawing' || n === 'pict' || n === 'object') {
          await drawingFrom(c, out);
        }
      }
    }
    async function drawingFrom(el, out) {
      // DrawingML: a:blip r:embed ; VML: v:imagedata r:id
      const blips = el.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'blip');
      let extentEmu = null;
      const ext = el.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')[0];
      if (ext) extentEmu = +ext.getAttribute('cx');
      if (blips.length) {
        const rid = blips[0].getAttributeNS(R, 'embed') || blips[0].getAttributeNS(R, 'link');
        const id = await imageFor(rid, extentEmu);
        if (id) out.push({ t: 'img', v: id });
        return;
      }
      const vml = el.getElementsByTagNameNS('urn:schemas-microsoft-com:vml', 'imagedata')[0];
      if (vml) {
        const rid = vml.getAttributeNS(R, 'id');
        const id = await imageFor(rid, null);
        if (id) out.push({ t: 'img', v: id });
        else warnings.push('Há um objeto (fórmula antiga ou desenho) que não pôde ser convertido.');
        return;
      }
      // caixa de texto: extrai o texto
      const tx = el.getElementsByTagNameNS(W, 'p');
      if (tx.length) for (const p of tx) await inlineFrom(p, {}, out);
    }

    function symbolChar(font, code) {
      if (code >= 0xF000) code -= 0xF000;
      if (font && /symbol/i.test(font)) {
        const map = { 0x70: 'π', 0xB4: '×', 0xB1: '±', 0xA3: '≤', 0xB3: '≥', 0xB9: '≠', 0xBB: '≈', 0xD6: '√', 0xB0: '°', 0x44: 'Δ', 0x71: 'θ', 0x61: 'α', 0x62: 'β', 0xAE: '→', 0xDE: '⇒', 0x2D: '−' };
        if (map[code]) return map[code];
      }
      return String.fromCharCode(code);
    }

    function segsToLine(segs) {
      // junta texto vizinho com a mesma formatação
      const lines = [[]];
      for (const s of segs) { if (s.t === 'br') lines.push([]); else lines[lines.length - 1].push(s); }
      return lines.map(arr => {
        let out = '';
        let i = 0;
        while (i < arr.length) {
          const s = arr[i];
          if (s.t === 'text') {
            let v = s.v, j = i + 1;
            while (j < arr.length && arr[j].t === 'text' && !!arr[j].b === !!s.b && !!arr[j].i === !!s.i) { v += arr[j].v; j++; }
            i = j;
            if (s.b && v.trim()) v = v.replace(/^(\s*)(.*?)(\s*)$/s, '$1**$2**$3');
            if (s.i && v.trim()) v = v.replace(/^(\s*)(.*?)(\s*)$/s, '$1__$2__$3');
            out += v;
            continue;
          }
          if (s.t === 'math') {
            let v = s.v, j = i + 1;
            while (j < arr.length && arr[j].t === 'math') { v += ' ' + arr[j].v; j++; }
            i = j;
            out += '\\(' + v + '\\)';
            continue;
          }
          if (s.t === 'img') { out += (out && !/\s$/.test(out) ? ' ' : '') + '[[img:' + s.v + ']]'; i++; continue; }
          i++;
        }
        return out.replace(/ /g, ' ');
      });
    }

    function numPrefix(p) {
      const pPr = child(p, 'pPr');
      const numPr = pPr && child(pPr, 'numPr');
      if (!numPr) return '';
      const numId = attr(child(numPr, 'numId'), 'val');
      const ilvl = attr(child(numPr, 'ilvl'), 'val') || '0';
      if (!numId || numId === '0') return '';
      const absId = numInfo.nums[numId];
      const lvl = absId && numInfo.abs[absId] ? numInfo.abs[absId][ilvl] : null;
      const key = absId + ':' + ilvl;
      // reinicia níveis inferiores
      for (const k of Object.keys(counters)) if (k.startsWith(absId + ':') && +k.split(':')[1] > +ilvl) delete counters[k];
      counters[key] = (counters[key] || ((lvl && lvl.start) || 1) - 1) + 1;
      const n = counters[key];
      const fmt = lvl ? lvl.fmt : 'decimal';
      if (fmt === 'bullet') return '';
      if (fmt === 'upperLetter') return String.fromCharCode(64 + n) + ') ';
      if (fmt === 'lowerLetter') return String.fromCharCode(96 + n) + ') ';
      if (fmt === 'decimal' || fmt === 'decimalZero') return n + '. ';
      return '';
    }

    const lines = [];
    const body = docXml.getElementsByTagNameNS(W, 'body')[0];
    async function block(el) {
      if (el.localName === 'p') {
        const segs = [];
        await inlineFrom(el, {}, segs);
        const pre = numPrefix(el);
        const ls = segsToLine(segs);
        if (pre && ls.length) ls[0] = pre + ls[0];
        lines.push(...ls);
      } else if (el.localName === 'tbl') {
        warnings.push('Uma tabela do Word foi convertida em texto — confira a questão ou cole a tabela como imagem.');
        for (const tr of kids(el).filter(c => c.localName === 'tr')) {
          const cells = [];
          for (const tc of kids(tr).filter(c => c.localName === 'tc')) {
            const parts = [];
            for (const p of kids(tc).filter(c => c.localName === 'p')) { const segs = []; await inlineFrom(p, {}, segs); parts.push(segsToLine(segs).join(' ')); }
            cells.push(parts.join(' ').trim());
          }
          lines.push(cells.join('  |  '));
        }
      } else if (el.localName === 'sdt') {
        const content = child(el, 'sdtContent');
        if (content) for (const c of kids(content)) await block(c);
      }
    }
    for (const el of kids(body)) await block(el);
    return { lines, warnings: Array.from(new Set(warnings)) };
  }

  global.DocxImport = { importDocx, ommlToLatex };
})(window);
