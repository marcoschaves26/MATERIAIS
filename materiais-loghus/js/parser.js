/* Separa um texto colado (ou vindo do Word) em questões e alternativas. */
(function (global) {
  'use strict';

  const LETTERS = 'ABCDEFGH';
  const CIRCLED = { '🅐': 'A', '🅑': 'B', '🅒': 'C', '🅓': 'D', '🅔': 'E', 'Ⓐ': 'A', 'Ⓑ': 'B', 'Ⓒ': 'C', 'Ⓓ': 'D', 'Ⓔ': 'E', 'ⓐ': 'A', 'ⓑ': 'B', 'ⓒ': 'C', 'ⓓ': 'D', 'ⓔ': 'E' };

  // remove marcação para testar o início da linha
  function bare(line) { return line.replace(/\*\*|__/g, '').trim(); }

  const RE_Q = /^(?:quest[ãa]o|q\.?)?\s*(\d{1,3})\s*(?:[.)\-–—:º°]|\s-\s)\s*(.*)$/i;
  const RE_Q_ALONE = /^(?:quest[ãa]o)\s*(\d{1,3})\s*$/i;

  function matchQuestion(line) {
    const b = bare(line);
    let m = b.match(RE_Q_ALONE);
    if (m) return { n: +m[1], rest: '' };
    m = b.match(RE_Q);
    if (!m) return null;
    // "2011, ..." ou "16 m." não são questões: exige separador logo após o número
    return { n: +m[1], rest: stripPrefix(line, b, m[2]) };
  }

  function matchAlt(line) {
    const b = bare(line);
    const first = [...b][0];
    if (CIRCLED[first]) return { L: CIRCLED[first], rest: stripPrefix(line, b, b.slice(first.length).trim()) };
    const m = b.match(/^(?:\(([A-Ha-h])\)|\[([A-Ha-h])\]|([A-Ha-h])\s*[).\-–—](?!\d))\s*(.*)$/);
    if (!m) return null;
    return { L: (m[1] || m[2] || m[3]).toUpperCase(), rest: stripPrefix(line, b, m[4]) };
  }

  // devolve o resto da linha preservando a marcação (negrito, fórmulas, imagens)
  function stripPrefix(line, b, rest) {
    if (!rest) return '';
    const idx = line.lastIndexOf(rest);
    if (idx > -1) return line.slice(idx);
    return rest;
  }

  function endsSentence(s) { return /[.?!:;)"”»]\s*$/.test(bare(s)) || /\]\]\s*$/.test(s) || /\\\)\s*$/.test(s); }

  // Texto copiado de PDF vem com cada linha quebrada: detecta e junta
  function looksWrapped(lines) {
    const ne = lines.map(l => l.trim()).filter(l => l.length > 0 && !/^\[\[img/.test(l));
    if (ne.length < 6) return false;
    const longOpen = ne.filter(l => l.length > 35 && !endsSentence(l)).length;
    return longOpen / ne.length > 0.35;
  }

  function parse(text, opts) {
    opts = opts || {};
    let lines = Array.isArray(text) ? text.slice() : String(text || '').replace(/\r/g, '').split('\n');
    const wrapped = opts.joinLines === undefined ? looksWrapped(lines) : opts.joinLines;
    const questions = [];
    const ignored = [];
    let q = null, lastN = 0, expectAlt = 0, inGabarito = false;
    const gabarito = {};

    function newQ(n, rest) {
      q = { n, enunciado: [], alternativas: [], correta: -1 };
      questions.push(q);
      lastN = n; expectAlt = 0;
      if (rest) q.enunciado.push(rest);
    }
    function appendText(arr, line) {
      if (!arr.length) { arr.push(line); return; }
      const prev = arr[arr.length - 1];
      const soft = !wrapped && prev && !endsSentence(prev) && /^[a-zà-ú0-9(]/.test(line.trim());
      if ((wrapped || soft) && prev && !endsSentence(prev) && !/^\[\[img/.test(line.trim()) && !/^\[\[img/.test(prev.trim())) {
        const hyph = /[a-zà-ú]-$/.test(prev) && /^[a-zà-ú]/.test(line.trim());
        arr[arr.length - 1] = (hyph ? prev.slice(0, -1) : prev + ' ') + line.trim();
      } else arr.push(line);
    }

    for (let raw of lines) {
      const line = raw.replace(/\s+$/, '').replace(/^\s+/, '');
      const b = bare(line);
      if (!b) { if (q && q.enunciado.length && !q.alternativas.length) q.enunciado.push(''); continue; }

      if (/^gabarito\b/i.test(b)) { inGabarito = true; parseGab(b.replace(/^gabarito\s*:?/i, ''), gabarito); continue; }
      if (inGabarito) { parseGab(b, gabarito); continue; }

      const mq = matchQuestion(line);
      const ma = matchAlt(line);
      const isNextQ = mq && (q === null ? true : mq.n === lastN + 1) && !(ma && expectAlt > 0);
      if (isNextQ && (q === null || q.alternativas.length || q.enunciado.join('').trim().length > 0)) {
        newQ(mq.n, mq.rest);
        continue;
      }
      if (q && ma && ma.L === LETTERS[expectAlt]) {
        q.alternativas.push(ma.rest);
        expectAlt++;
        continue;
      }
      if (!q) { ignored.push(line); continue; }
      if (q.alternativas.length) {
        // continuação da última alternativa
        const k = q.alternativas.length - 1;
        if (/^\[\[img/.test(line) || /^\[\[img/.test(q.alternativas[k].trim())) q.alternativas[k] += ' ' + line;
        else q.alternativas[k] = q.alternativas[k] + (wrapped ? ' ' : ' ') + line;
        continue;
      }
      appendText(q.enunciado, line);
    }

    const out = questions.map(qq => {
      // tira linhas vazias repetidas
      const en = [];
      for (const l of qq.enunciado) { if (l === '' && (en.length === 0 || en[en.length - 1] === '')) continue; en.push(l); }
      while (en.length && en[en.length - 1] === '') en.pop();
      const corr = gabarito[qq.n];
      return {
        n: qq.n,
        enunciado: en.filter(l => l !== '').join('\n'),
        alternativas: qq.alternativas.map(a => a.trim()),
        correta: corr !== undefined ? LETTERS.indexOf(corr) : -1
      };
    });
    return { questions: out, ignored, wrapped };
  }

  function parseGab(s, gab) {
    const re = /(\d{1,3})\s*[).\-–:=]?\s*\(?([A-Ea-e])\)?(?![a-z])/g;
    let m;
    while ((m = re.exec(s))) gab[+m[1]] = m[2].toUpperCase();
  }

  global.ListParser = { parse, matchQuestion, matchAlt };
})(window);
