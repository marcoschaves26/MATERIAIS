/* Subconjunto de LaTeX usado nas listas: frações, raízes, potências, índices,
   letras gregas e símbolos comuns. Converte para OMML (Word) e para texto
   Unicode (PowerPoint). A pré-visualização usa o KaTeX. */
(function (global) {
  'use strict';

  const SYM = {
    pi: 'π', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
    theta: 'θ', lambda: 'λ', mu: 'μ', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ',
    omega: 'ω', Delta: 'Δ', Omega: 'Ω', Sigma: 'Σ', Phi: 'Φ', Gamma: 'Γ', Lambda: 'Λ', Pi: 'Π',
    cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥',
    neq: '≠', ne: '≠', approx: '≈', cong: '≅', equiv: '≡', sim: '∼', infty: '∞', degree: '°',
    circ: '°', rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', Leftrightarrow: '⇔',
    leftrightarrow: '↔', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩',
    emptyset: '∅', varnothing: '∅', forall: '∀', exists: '∃', angle: '∠', perp: '⊥',
    parallel: '∥', ldots: '…', cdots: '⋯', dots: '…', partial: '∂', nabla: '∇', sum: '∑',
    prod: '∏', int: '∫', '%': '%', '$': '$', '{': '{', '}': '}', '#': '#', '&': '&', '_': '_',
    ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ', quad: ' ', qquad: '  ',
    lbrace: '{', rbrace: '}', langle: '⟨', rangle: '⟩', vert: '|', mid: '|', backslash: '\\',
    triangle: '△', square: '□', checkmark: '✓', prime: '′'
  };
  const FUNCS = ['sin', 'cos', 'tan', 'tg', 'sen', 'cotg', 'cot', 'sec', 'csc', 'cossec', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'arcsen', 'arcsin', 'arccos', 'arctan'];
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'k': 'ᵏ', 'm': 'ᵐ', 'o': 'ᵒ', 't': 'ᵗ', '°': '°', '∘': '°' };
  const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'i': 'ᵢ', 'n': 'ₙ', 'm': 'ₘ', 'k': 'ₖ', 't': 'ₜ' };

  // ---------- parser ----------
  function parse(src) {
    let i = 0;
    const s = String(src || '');
    function peek() { return s[i]; }
    function readCommand() {
      // at '\\'
      i++;
      if (i >= s.length) return '';
      if (/[A-Za-z]/.test(s[i])) {
        let j = i;
        while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
        const name = s.slice(i, j); i = j;
        return name;
      }
      return s[i++];
    }
    function skipSpaces() { while (i < s.length && /\s/.test(s[i])) i++; }
    function parseGroupArg() {
      skipSpaces();
      if (s[i] === '{') { i++; const items = parseList('}'); i++; return { t: 'group', items }; }
      // single token
      const a = parseAtomBase();
      return a || { t: 'group', items: [] };
    }
    function parseOptArg() {
      skipSpaces();
      if (s[i] === '[') { i++; const items = parseList(']'); i++; return { t: 'group', items }; }
      return null;
    }
    function parseAtomBase() {
      skipSpaces();
      const c = s[i];
      if (c === undefined) return null;
      if (c === '{') { i++; const items = parseList('}'); i++; return { t: 'group', items }; }
      if (c === '\\') {
        const name = readCommand();
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') { const n = parseGroupArg(); const d = parseGroupArg(); return { t: 'frac', n, d }; }
        if (name === 'sqrt') { const deg = parseOptArg(); const e = parseGroupArg(); return { t: 'sqrt', e, deg }; }
        if (name === 'text' || name === 'mathrm' || name === 'textrm' || name === 'mbox' || name === 'operatorname') {
          skipSpaces();
          if (s[i] === '{') { i++; let depth = 1, j = i; while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; } const txt = s.slice(i, j - 1); i = j; return { t: 'text', v: txt, plain: true }; }
          return { t: 'text', v: '' };
        }
        if (name === 'textbf' || name === 'mathbf' || name === 'boldsymbol') { const g = parseGroupArg(); return { t: 'bold', e: g }; }
        if (name === 'overline' || name === 'bar') { const g = parseGroupArg(); return { t: 'over', e: g, chr: '‾' }; }
        if (name === 'vec' || name === 'overrightarrow') { const g = parseGroupArg(); return { t: 'over', e: g, chr: '→' }; }
        if (name === 'hat' || name === 'widehat') { const g = parseGroupArg(); return { t: 'over', e: g, chr: '^' }; }
        if (name === 'left' || name === 'right' || name === 'big' || name === 'Big' || name === 'bigg' || name === 'Bigg') {
          skipSpaces();
          if (s[i] === '\\') { const n2 = readCommand(); if (n2 === '{' || n2 === 'lbrace') return { t: 'text', v: '{' }; if (n2 === '}' || n2 === 'rbrace') return { t: 'text', v: '}' }; return { t: 'text', v: SYM[n2] || '' }; }
          const ch = s[i++]; return { t: 'text', v: ch === '.' ? '' : ch };
        }
        if (FUNCS.includes(name)) return { t: 'text', v: name, plain: true };
        if (name in SYM) return { t: 'text', v: SYM[name] };
        return { t: 'text', v: name };
      }
      if (c === '}' || c === ']') return null;
      i++;
      if (c === '~') return { t: 'text', v: ' ' };
      if (c === '-') return { t: 'text', v: '−' };
      if (c === '*') return { t: 'text', v: '·' };
      return { t: 'text', v: c };
    }
    function parseList(end) {
      const items = [];
      while (i < s.length) {
        if (s[i] === end) break;
        if (/\s/.test(s[i])) { i++; continue; }
        let base = parseAtomBase();
        if (!base) { if (s[i] === end) break; i++; continue; }
        // scripts
        let sup = null, sub = null;
        for (let k = 0; k < 2; k++) {
          skipSpaces();
          if (s[i] === '^' && !sup) { i++; sup = parseGroupArg(); }
          else if (s[i] === '_' && !sub) { i++; sub = parseGroupArg(); }
          else if (s[i] === '\'' ) { i++; base = { t: 'group', items: [base, { t: 'text', v: '′' }] }; }
        }
        if (sup && sub) items.push({ t: 'subsup', b: base, sub, sup });
        else if (sup) items.push({ t: 'sup', b: base, s: sup });
        else if (sub) items.push({ t: 'sub', b: base, s: sub });
        else items.push(base);
      }
      return items;
    }
    const items = parseList(null);
    return { t: 'group', items };
  }

  // ---------- Unicode ----------
  function flatText(n) {
    if (!n) return '';
    switch (n.t) {
      case 'text': return n.v;
      case 'group': return n.items.map(flatText).join('');
      default: return toUnicodeNode(n);
    }
  }
  function isSimple(n) {
    const t = flatText(n);
    return n.t === 'text' || (n.t === 'group' && n.items.length <= 1 && (!n.items[0] || n.items[0].t === 'text')) || /^[\w.,]+$/.test(t);
  }
  function wrap(n) { const t = toUnicodeNode(n); return isSimple(n) && !/[+\-−·×÷/ ]/.test(t) ? t : '(' + t + ')'; }
  function scriptText(n, map, mark) {
    const t = toUnicodeNode(n);
    if ([...t].every(ch => map[ch])) return [...t].map(ch => map[ch]).join('');
    return mark + (t.length > 1 ? '(' + t + ')' : t);
  }
  function toUnicodeNode(n) {
    if (!n) return '';
    switch (n.t) {
      case 'text': return n.v;
      case 'group': return n.items.map(toUnicodeNode).join('');
      case 'frac': return wrap(n.n) + '/' + wrap(n.d);
      case 'sqrt': {
        const pre = n.deg ? ({ '3': '∛', '4': '∜' }[toUnicodeNode(n.deg)] || scriptText(n.deg, SUP, '') + '√') : '√';
        return pre + wrap(n.e);
      }
      case 'sup': return toUnicodeNode(n.b) + scriptText(n.s, SUP, '^');
      case 'sub': return toUnicodeNode(n.b) + scriptText(n.s, SUB, '_');
      case 'subsup': return toUnicodeNode(n.b) + scriptText(n.sub, SUB, '_') + scriptText(n.sup, SUP, '^');
      case 'bold': return toUnicodeNode(n.e);
      case 'over': {
        const t = toUnicodeNode(n.e);
        if (n.chr === '‾') return [...t].map(c => c + '̅').join('');
        if (n.chr === '→') return [...t].map(c => c + '⃗').join('');
        return t + '̂';
      }
    }
    return '';
  }
  function toUnicode(src) { return toUnicodeNode(parse(src)).replace(/\s+/g, ' ').trim(); }

  // ---------- OMML ----------
  const RPR = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>';
  function xmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function run(v, plain) {
    if (!v) return '';
    return '<m:r>' + (plain ? '<m:rPr><m:sty m:val="p"/></m:rPr>' : '') + RPR + '<m:t xml:space="preserve">' + xmlEsc(v) + '</m:t></m:r>';
  }
  function omNode(n) {
    if (!n) return '';
    switch (n.t) {
      case 'text': {
        // números e operadores retos; letras em itálico (padrão do Word)
        return run(n.v, n.plain);
      }
      case 'group': return n.items.map(omNode).join('');
      case 'frac': return '<m:f><m:num>' + omNode(n.n) + '</m:num><m:den>' + omNode(n.d) + '</m:den></m:f>';
      case 'sqrt': return n.deg
        ? '<m:rad><m:deg>' + omNode(n.deg) + '</m:deg><m:e>' + omNode(n.e) + '</m:e></m:rad>'
        : '<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>' + omNode(n.e) + '</m:e></m:rad>';
      case 'sup': return '<m:sSup><m:e>' + omNode(n.b) + '</m:e><m:sup>' + omNode(n.s) + '</m:sup></m:sSup>';
      case 'sub': return '<m:sSub><m:e>' + omNode(n.b) + '</m:e><m:sub>' + omNode(n.s) + '</m:sub></m:sSub>';
      case 'subsup': return '<m:sSubSup><m:e>' + omNode(n.b) + '</m:e><m:sub>' + omNode(n.sub) + '</m:sub><m:sup>' + omNode(n.sup) + '</m:sup></m:sSubSup>';
      case 'bold': return omNode(n.e);
      case 'over':
        if (n.chr === '‾') return '<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>' + omNode(n.e) + '</m:e></m:bar>';
        return '<m:acc><m:accPr><m:chr m:val="' + (n.chr === '→' ? '⃗' : '̂') + '"/></m:accPr><m:e>' + omNode(n.e) + '</m:e></m:acc>';
    }
    return '';
  }
  function toOMML(src) { return '<m:oMath>' + omNode(parse(src)) + '</m:oMath>'; }

  global.LoghusLatex = { parse, toUnicode, toOMML, SYM };
})(window);
