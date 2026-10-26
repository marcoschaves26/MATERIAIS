/* Materiais Loghus — interface */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const LETTERS = 'ABCDEFGH';
  const esc = window.Rich.esc;

  // ---------- estado ----------
  function emptyState() {
    return {
      v: 1,
      lista: { disciplina: '', professor: '', numeroInicial: 1, gabarito: false, questoes: [] },
      deck: { titulo: '', slides: [] },
      images: {}
    };
  }
  let S = emptyState();
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  function newQ() { return { id: uid(), enunciado: '', alternativas: ['', '', '', '', ''], correta: -1, resolucao: '' }; }

  // ---------- armazenamento local (IndexedDB) ----------
  const DB = {
    db: null,
    open() {
      return new Promise(res => {
        try {
          const rq = indexedDB.open('materiais-loghus', 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
          rq.onsuccess = () => { this.db = rq.result; res(true); };
          rq.onerror = () => res(false);
        } catch (e) { res(false); }
      });
    },
    get(k) {
      return new Promise(res => {
        try { const rq = this.db.transaction('kv').objectStore('kv').get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); }
        catch (e) { res(null); }
      });
    },
    set(k, v) {
      try { this.db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) { /* sem armazenamento */ }
    }
  };
  let saveT = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { if (DB.db) DB.set('state', JSON.stringify(S)); }, 600);
  }

  // ---------- utilidades ----------
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms || 3200);
  }
  function busy(on, msg) { const b = $('#busy'); b.textContent = msg || 'Processando…'; b.classList.toggle('on', !!on); }
  function openModal(id) { $(id).classList.add('on'); }
  function closeModal(el) { (typeof el === 'string' ? $(el) : el).classList.remove('on'); }
  $$('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.hasAttribute('data-close')) closeModal(m); });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal.on').forEach(closeModal); });

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function fileSafe(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim() || 'material'; }
  async function asset(path) {
    const b64 = window.LOGHUS_MODELOS && window.LOGHUS_MODELOS[path];
    if (b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
    const r = await fetch(path); if (!r.ok) throw new Error('Não encontrei ' + path); return r.arrayBuffer();
  }

  // Imagens: normaliza (PNG/JPEG, até 1800 px) e guarda no estado
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
  async function addImage(src, ptw) {
    let im;
    try { im = await loadImg(src); } catch (e) { return null; }
    let w = im.naturalWidth, h = im.naturalHeight;
    const max = 1800;
    let out = src;
    const isOk = /^data:image\/(png|jpeg);/.test(src);
    if (!isOk || w > max || h > max || src.length > 2.5e6) {
      const k = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(im, 0, 0, w, h);
      out = c.toDataURL('image/png');
      if (out.length > 1.6e6) out = c.toDataURL('image/jpeg', 0.9);
    }
    let id;
    do { id = 'f' + Math.random().toString(36).slice(2, 7); } while (S.images[id]);
    S.images[id] = { src: out, w, h, ptw: ptw || null, size: '' };
    return id;
  }
  function readFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
  function readBuf(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(file); }); }

  // Insere texto na posição do cursor de um campo
  function insertAt(el, text) {
    const s = el.selectionStart != null ? el.selectionStart : el.value.length;
    const e = el.selectionEnd != null ? el.selectionEnd : s;
    el.value = el.value.slice(0, s) + text + el.value.slice(e);
    const p = s + text.length;
    try { el.setSelectionRange(p, p); } catch (_) { }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }
  function wrapSel(el, mark) {
    const s = el.selectionStart, e = el.selectionEnd;
    const sel = el.value.slice(s, e) || 'texto';
    el.value = el.value.slice(0, s) + mark + sel + mark + el.value.slice(e);
    el.setSelectionRange(s + mark.length, s + mark.length + sel.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }
  function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(520, t.scrollHeight + 2) + 'px'; }

  // Colar / soltar imagens em qualquer campo marcado com data-img
  async function handleImageFiles(files, field) {
    let n = 0;
    for (const f of files) {
      if (!/^image\//.test(f.type)) continue;
      const id = await addImage(await readFile(f));
      if (!id) continue;
      const sep = field.tagName === 'TEXTAREA' ? '\n' : ' ';
      const before = field.value.slice(0, field.selectionStart || 0);
      insertAt(field, (before && !/\n$/.test(before) && sep === '\n' ? '\n' : '') + '[[img:' + id + ']]' + sep);
      n++;
    }
    return n;
  }
  document.addEventListener('paste', async e => {
    const field = e.target.closest && e.target.closest('[data-img]');
    if (!field) return;
    const files = Array.from(e.clipboardData && e.clipboardData.files || []);
    if (files.some(f => /^image\//.test(f.type))) {
      e.preventDefault();
      const n = await handleImageFiles(files, field);
      if (n) toast(n === 1 ? 'Imagem inserida.' : n + ' imagens inseridas.');
    }
  });
  document.addEventListener('dragover', e => { const f = e.target.closest && e.target.closest('[data-img]'); if (f) { e.preventDefault(); f.classList.add('dropping'); } });
  document.addEventListener('dragleave', e => { const f = e.target.closest && e.target.closest('[data-img]'); if (f) f.classList.remove('dropping'); });
  document.addEventListener('drop', async e => {
    const f = e.target.closest && e.target.closest('[data-img]');
    if (!f) return;
    f.classList.remove('dropping');
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) { e.preventDefault(); await handleImageFiles(files, f); }
  });

  // botão "Imagem": escolhe arquivo e insere no campo alvo
  let imgTarget = null, imgCallback = null;
  $('#f-img').addEventListener('change', async e => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (imgCallback) { const cb = imgCallback; imgCallback = null; for (const f of files) { const id = await addImage(await readFile(f)); if (id) cb(id); } return; }
    if (imgTarget) await handleImageFiles(files, imgTarget);
  });
  function pickImage(field) { imgTarget = field; imgCallback = null; $('#f-img').click(); }
  function pickImageCb(cb) { imgTarget = null; imgCallback = cb; $('#f-img').click(); }

  // ---------- fórmula ----------
  let mathTarget = null;
  const KEYS = [
    ['a/b', '\\frac{□}{□}'], ['√', '\\sqrt{□}'], ['ⁿ√', '\\sqrt[□]{□}'], ['x²', '^{□}'], ['x₁', '_{□}'],
    ['π', '\\pi '], ['·', '\\cdot '], ['×', '\\times '], ['÷', '\\div '], ['±', '\\pm '], ['≤', '\\le '], ['≥', '\\ge '], ['≠', '\\ne '], ['≈', '\\approx '],
    ['°', '^\\circ '], ['Δ', '\\Delta '], ['α', '\\alpha '], ['β', '\\beta '], ['θ', '\\theta '], ['∞', '\\infty '], ['AB̅', '\\overline{□}'], ['→', '\\to ']
  ];
  $('#math-keys').innerHTML = KEYS.map((k, i) => '<button class="btn sm" data-k="' + i + '">' + esc(k[0]) + '</button>').join('');
  $('#math-keys').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const inp = $('#math-in');
    const snip = KEYS[+b.dataset.k][1];
    const s = inp.selectionStart, sel = inp.value.slice(s, inp.selectionEnd);
    let txt = snip, caret;
    if (sel && snip.includes('□')) { txt = snip.replace('□', sel); }
    caret = txt.indexOf('□');
    txt = txt.replace(/□/g, '');
    inp.value = inp.value.slice(0, s) + txt + inp.value.slice(inp.selectionEnd);
    const p = s + (caret >= 0 ? caret : txt.length);
    inp.setSelectionRange(p, p); inp.focus();
    mathPreview();
  });
  function mathPreview() {
    const v = $('#math-in').value.trim();
    $('#math-prev').innerHTML = v ? window.Rich.mathHTML(v) : '<span style="color:#999;font-size:14px">A prévia aparece aqui</span>';
  }
  $('#math-in').addEventListener('input', mathPreview);
  $('#math-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#math-ok').click(); } });
  $('#math-ok').addEventListener('click', () => {
    const v = $('#math-in').value.trim();
    closeModal('#m-math');
    if (v && mathTarget) insertAt(mathTarget, '\\(' + v + '\\)');
  });
  function openMath(field) {
    mathTarget = field;
    // se o cursor está dentro de uma fórmula, edita
    const s = field.selectionStart, val = field.value;
    const a = val.lastIndexOf('\\(', s), b = val.indexOf('\\)', a);
    if (a > -1 && b > -1 && s <= b + 2 && val.slice(a, s).indexOf('\\)') === -1) {
      field.setSelectionRange(a, b + 2);
      $('#math-in').value = val.slice(a + 2, b);
    } else $('#math-in').value = '';
    mathPreview(); openModal('#m-math');
    setTimeout(() => $('#math-in').focus(), 30);
  }

  // Barra de ferramentas reutilizável
  function toolbarHTML() {
    return '<div class="toolbar">' +
      '<button class="btn sm" data-tool="img" title="Inserir imagem (ou cole com Ctrl+V)">🖼 Imagem</button>' +
      '<button class="btn sm" data-tool="math" title="Inserir fórmula">∑ Fórmula</button>' +
      '<button class="btn sm" data-tool="b" title="Negrito"><b>N</b></button>' +
      '<button class="btn sm" data-tool="i" title="Itálico"><i>I</i></button></div>';
  }
  document.addEventListener('mousedown', e => { if (e.target.closest('[data-tool]')) e.preventDefault(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    const box = b.closest('[data-toolhost]');
    const field = box && (box._last && document.body.contains(box._last) ? box._last : box.querySelector('[data-img]'));
    if (!field) return;
    const t = b.dataset.tool;
    if (t === 'img') pickImage(field);
    else if (t === 'math') openMath(field);
    else if (t === 'b') wrapSel(field, '**');
    else if (t === 'i') wrapSel(field, '__');
  });
  document.addEventListener('focusin', e => {
    const f = e.target.closest && e.target.closest('[data-img]');
    if (!f) return;
    const host = f.closest('[data-toolhost]');
    if (host) host._last = f;
  });

  function chipsHTML(text, owner) {
    const ids = Array.from(new Set(window.Rich.imageIds(text))).filter(id => S.images[id]);
    return ids.map(id => {
      const im = S.images[id];
      return '<div class="chip" data-chip="' + id + '"><img src="' + im.src + '" alt="">' +
        (owner === 'lista' ? '<select data-size title="Tamanho na lista"><option value="">Auto</option><option value="p"' + (im.size === 'p' ? ' selected' : '') + '>Pequena</option><option value="m"' + (im.size === 'm' ? ' selected' : '') + '>Média</option><option value="g"' + (im.size === 'g' ? ' selected' : '') + '>Grande</option></select>' : '') +
        '<button class="x" data-rmimg title="Remover imagem">×</button></div>';
    }).join('');
  }

  // ---------- LISTA: editor ----------
  const L = () => S.lista;
  function bindHeader() {
    const map = [['#l-disc', 'disciplina'], ['#l-prof', 'professor'], ['#l-num', 'numeroInicial']];
    for (const [sel, key] of map) {
      const el = $(sel);
      el.value = L()[key] || (key === 'numeroInicial' ? 1 : '');
      el.oninput = () => { L()[key] = key === 'numeroInicial' ? (parseInt(el.value, 10) || 1) : el.value; changed('lista', key === 'numeroInicial'); };
    }
    $('#l-gab').checked = !!L().gabarito;
    $('#l-gab').onchange = () => { L().gabarito = $('#l-gab').checked; changed('lista'); };
  }

  const ICON = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
    dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'
  };
  function headBtns() {
    return '<button class="btn icon sm" data-act="up" title="Subir">' + ICON.up + '</button>' +
      '<button class="btn icon sm" data-act="down" title="Descer">' + ICON.down + '</button>' +
      '<button class="btn icon sm" data-act="dup" title="Duplicar">' + ICON.dup + '</button>' +
      '<button class="btn icon sm danger" data-act="del" title="Excluir">' + ICON.del + '</button>';
  }

  function altsHTML(q, name) {
    const rows = q.alternativas.map((a, i) =>
      '<div class="alt-row' + (q.correta === i ? ' right' : '') + '"><input type="radio" name="' + name + '" data-correct="' + i + '"' + (q.correta === i ? ' checked' : '') + ' title="Marcar como correta"><span class="let">' + LETTERS[i] + '</span>' +
      '<input type="text" data-alt="' + i + '" data-img value="' + esc(a) + '" placeholder="Alternativa ' + LETTERS[i] + '"></div>').join('');
    return '<div class="alts">' + rows + '</div><div class="alts-foot"><span>Marque a bolinha da alternativa correta (para o gabarito).</span><span class="sp"></span>' +
      '<button class="btn sm" data-altadd title="Mais uma alternativa">+ alternativa</button><button class="btn sm" data-altrm title="Remover a última alternativa">− alternativa</button></div>';
  }

  function qCardHTML(q, i) {
    const n = (parseInt(L().numeroInicial, 10) || 1) + i;
    return '<article class="card q" data-q="' + q.id + '"><div class="q-head"><b>Questão ' + n + '</b><span class="sp"></span>' + headBtns() + '</div>' +
      '<div class="q-body" data-toolhost>' + toolbarHTML() +
      '<textarea data-f="enunciado" data-img rows="4" placeholder="Enunciado da questão. Cole imagens com Ctrl+V.">' + esc(q.enunciado) + '</textarea>' +
      '<div class="imgs" data-imgs>' + chipsHTML(q.enunciado + ' ' + q.alternativas.join(' '), 'lista') + '</div>' +
      altsHTML(q, 'c_' + q.id) +
      '<details class="res"' + (q.resolucao ? ' open' : '') + '><summary>Resolução (opcional — aparece nos slides)</summary><textarea data-f="resolucao" data-img rows="3" placeholder="Explique a resolução…">' + esc(q.resolucao || '') + '</textarea></details>' +
      '</div></article>';
  }

  function renderQList() {
    const host = $('#q-list');
    if (!L().questoes.length) {
      host.innerHTML = '<div class="empty"><b>Nenhuma questão ainda</b>Importe um arquivo do Word, cole o texto da lista ou clique em “Nova questão”.</div>';
      return;
    }
    host.innerHTML = L().questoes.map(qCardHTML).join('');
    $$('textarea', host).forEach(autoGrow);
  }
  function qOf(el) { const card = el.closest('[data-q]'); return card ? L().questoes.find(q => q.id === card.dataset.q) : null; }
  function refreshChips(card, q) {
    card.querySelector('[data-imgs]').innerHTML = chipsHTML(q.enunciado + ' ' + q.alternativas.join(' '), 'lista');
  }

  $('#q-list').addEventListener('input', e => {
    const q = qOf(e.target); if (!q) return;
    const t = e.target;
    if (t.dataset.f) { q[t.dataset.f] = t.value; if (t.tagName === 'TEXTAREA') autoGrow(t); }
    else if (t.dataset.alt != null) q.alternativas[+t.dataset.alt] = t.value;
    if (/\[\[img:/.test(t.value) || t._hadImg) { t._hadImg = /\[\[img:/.test(t.value); refreshChips(t.closest('[data-q]'), q); }
    changed('lista');
  });
  $('#q-list').addEventListener('change', e => {
    const q = qOf(e.target); if (!q) return;
    const t = e.target;
    if (t.dataset.correct != null) {
      q.correta = +t.dataset.correct;
      $$('.alt-row', t.closest('.alts')).forEach((r, i) => r.classList.toggle('right', i === q.correta));
      changed('lista');
    }
    if (t.hasAttribute('data-size')) {
      const id = t.closest('[data-chip]').dataset.chip;
      S.images[id].size = t.value; changed('lista');
    }
  });
  $('#q-list').addEventListener('click', e => {
    const card = e.target.closest('[data-q]'); if (!card) return;
    const q = qOf(card); const arr = L().questoes; const i = arr.indexOf(q);
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'up' && i > 0) { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); }
      else if (a === 'down' && i < arr.length - 1) { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); }
      else if (a === 'dup') { const c = JSON.parse(JSON.stringify(q)); c.id = uid(); arr.splice(i + 1, 0, c); }
      else if (a === 'del') { if (!confirm('Excluir a questão ' + ((parseInt(L().numeroInicial, 10) || 1) + i) + '?')) return; arr.splice(i, 1); }
      else return;
      renderQList(); changed('lista');
      return;
    }
    if (e.target.closest('[data-altadd]')) { if (q.alternativas.length < 8) { q.alternativas.push(''); renderQList(); changed('lista'); } return; }
    if (e.target.closest('[data-altrm]')) { if (q.alternativas.length) { q.alternativas.pop(); if (q.correta >= q.alternativas.length) q.correta = -1; renderQList(); changed('lista'); } return; }
    const rm = e.target.closest('[data-rmimg]');
    if (rm) {
      const id = rm.closest('[data-chip]').dataset.chip;
      const tok = new RegExp('\\s*\\[\\[img:' + id + '\\]\\]', 'g');
      q.enunciado = q.enunciado.replace(tok, '').replace(/^\n+/, '');
      q.alternativas = q.alternativas.map(a => a.replace(tok, ''));
      renderQList(); changed('lista');
    }
  });
  $('#btn-addq').addEventListener('click', () => {
    L().questoes.push(newQ()); renderQList(); changed('lista');
    const cards = $$('#q-list [data-q]'); const last = cards[cards.length - 1];
    if (last) { last.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => last.querySelector('textarea').focus(), 300); }
  });

  // ---------- LISTA: prévia ----------
  let renderT = null, zoomFit = true;
  function renderListaPreview() {
    const html = window.ListaRender.render(L(), S.images);
    $('#l-pages').innerHTML = html;
    const n = $$('#l-pages .page').length;
    $('#l-info').textContent = L().questoes.length + (L().questoes.length === 1 ? ' questão' : ' questões') + ' · ' + n + (n === 1 ? ' página' : ' páginas');
    fitZoom();
  }
  function fitZoom() {
    const sc = $('#view-lista .pv-scroll');
    const w = sc.clientWidth - 36;
    const z = Math.max(0.3, Math.min(1.2, w / (595.3 / 0.75)));
    $('#l-zoom').style.setProperty('--z', z.toFixed(3));
  }

  // ---------- LISTA: importar ----------
  let pending = null;
  function summaryHTML(res) {
    const qs = res.questions;
    const alts = qs.reduce((a, q) => a + q.alternativas.length, 0);
    const imgs = qs.reduce((a, q) => a + window.Rich.imageIds(q.enunciado + q.alternativas.join(' ')).length, 0);
    const maths = qs.reduce((a, q) => a + ((q.enunciado + q.alternativas.join(' ')).match(/\\\(/g) || []).length, 0);
    const gab = qs.filter(q => q.correta >= 0).length;
    if (!qs.length) return '<b>Não encontrei questões numeradas.</b><br>Confira se cada questão começa com o número (ex.: “1.” ou “1)”) e as alternativas com a letra (ex.: “a)” ou “(A)”).';
    const sem = qs.filter(q => q.alternativas.length === 0).map(q => q.n);
    const poucas = qs.filter(q => q.alternativas.length > 0 && q.alternativas.length < 4).map(q => q.n);
    let h = '<b>Encontrei ' + qs.length + (qs.length === 1 ? ' questão' : ' questões') + '</b> (nº ' + qs[0].n + ' a ' + qs[qs.length - 1].n + ')<ul>' +
      '<li>' + alts + ' alternativas</li>' + (imgs ? '<li>' + imgs + ' imagens</li>' : '') + (maths ? '<li>' + maths + ' fórmulas</li>' : '') + (gab ? '<li>gabarito de ' + gab + ' questões</li>' : '') + '</ul>';
    if (sem.length) h += '<div style="margin-top:6px">Sem alternativas (discursivas?): ' + sem.join(', ') + '</div>';
    if (poucas.length) h += '<div style="margin-top:6px;color:#8a4300">Com menos de 4 alternativas — confira: ' + poucas.join(', ') + '</div>';
    return h;
  }
  function applyImport(res, replace) {
    const qs = res.questions.map(q => {
      const alts = q.alternativas.slice();
      return { id: uid(), enunciado: q.enunciado, alternativas: alts, correta: q.correta, resolucao: '' };
    });
    if (replace) { L().questoes = qs; if (qs.length) L().numeroInicial = res.questions[0].n || 1; }
    else L().questoes.push(...qs);
    if (res.header) {
      if (res.header.disc && (replace || !L().disciplina)) L().disciplina = res.header.disc;
      if (res.header.prof && (replace || !L().professor)) L().professor = res.header.prof;
    }
    bindHeader(); renderQList(); changed('lista');
    toast(qs.length + (qs.length === 1 ? ' questão importada.' : ' questões importadas.') + ' Confira abaixo.');
  }

  $('#btn-colar').addEventListener('click', () => { $('#colar-txt').value = ''; $('#colar-join').checked = false; $('#colar-join').dataset.auto = '1'; $('#colar-sum').innerHTML = 'Cole o texto acima.'; openModal('#m-colar'); setTimeout(() => $('#colar-txt').focus(), 50); });
  $('#colar-txt').setAttribute('data-img', '');
  function parseColar() {
    const txt = $('#colar-txt').value;
    const auto = $('#colar-join').dataset.auto === '1';
    const res = window.ListParser.parse(txt, auto ? {} : { joinLines: $('#colar-join').checked });
    if (auto) $('#colar-join').checked = res.wrapped;
    pending = res;
    $('#colar-sum').innerHTML = txt.trim() ? summaryHTML(res) : 'Cole o texto acima.';
  }
  let colarT = null;
  $('#colar-txt').addEventListener('input', () => { clearTimeout(colarT); colarT = setTimeout(parseColar, 250); });
  $('#colar-join').addEventListener('change', () => { $('#colar-join').dataset.auto = '0'; parseColar(); });
  $('#colar-rep').addEventListener('click', () => { parseColar(); if (!pending || !pending.questions.length) return toast('Não encontrei questões no texto.'); if (L().questoes.length && !confirm('Substituir as ' + L().questoes.length + ' questões atuais?')) return; closeModal('#m-colar'); applyImport(pending, true); });
  $('#colar-add').addEventListener('click', () => { parseColar(); if (!pending || !pending.questions.length) return toast('Não encontrei questões no texto.'); closeModal('#m-colar'); applyImport(pending, false); });

  $('#btn-docx').addEventListener('click', () => $('#f-docx').click());
  $('#f-docx').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!/\.docx$/i.test(f.name)) { toast('Envie um arquivo .docx (Word). Arquivos .doc antigos: abra no Word e “Salvar como” .docx.', 5000); return; }
    busy(true, 'Lendo o arquivo do Word…');
    try {
      const buf = await readBuf(f);
      const out = await window.DocxImport.importDocx(buf, addImage);
      const res = window.ListParser.parse(out.lines, { joinLines: false });
      res.header = await docxHeader(buf);
      pending = res;
      $('#docx-name').textContent = f.name;
      $('#docx-sum').innerHTML = summaryHTML(res) + (res.header && (res.header.disc || res.header.prof) ? '<div style="margin-top:6px">Cabeçalho: ' + esc([res.header.disc, res.header.prof].filter(Boolean).join(' · ')) + '</div>' : '');
      $('#docx-warn').innerHTML = out.warnings.length ? '<div class="warn">' + out.warnings.map(esc).join('<br>') + '</div>' : '';
      openModal('#m-docx');
    } catch (err) {
      console.error(err);
      toast('Não consegui ler este arquivo. Ele abre normalmente no Word?', 5000);
    } finally { busy(false); }
  });
  async function docxHeader(buf) {
    try {
      const zip = await JSZip.loadAsync(buf);
      const files = Object.keys(zip.files).filter(n => /^word\/header\d*\.xml$/.test(n));
      const texts = [];
      for (const n of files) {
        const xml = new DOMParser().parseFromString(await zip.file(n).async('string'), 'application/xml');
        // só o conteúdo "Choice" das caixas de texto (evita duplicados)
        $$('*', xml.documentElement).filter(el => el.localName === 'Fallback').forEach(el => el.remove());
        for (const p of Array.from(xml.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p'))) {
          const t = Array.from(p.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't')).map(x => x.textContent).join('').trim();
          if (t && !texts.includes(t)) texts.push(t);
        }
      }
      const prof = texts.find(t => /^prof/i.test(t)) || '';
      const disc = texts.find(t => t !== prof && t.length <= 40 && /[A-Za-zÀ-ú]/.test(t)) || '';
      return { disc, prof };
    } catch (e) { return null; }
  }
  $('#docx-rep').addEventListener('click', () => { if (!pending || !pending.questions.length) return toast('Não encontrei questões no arquivo.'); if (L().questoes.length && !confirm('Substituir as ' + L().questoes.length + ' questões atuais?')) return; closeModal('#m-docx'); applyImport(pending, true); });
  $('#docx-add').addEventListener('click', () => { if (!pending || !pending.questions.length) return toast('Não encontrei questões no arquivo.'); closeModal('#m-docx'); applyImport(pending, false); });

  // ---------- LISTA: baixar ----------
  function listaName() { return fileSafe('Lista - ' + (L().disciplina || 'Loghus') + (L().professor ? ' - ' + L().professor : '')); }
  function checkLista() {
    if (!L().questoes.length) { toast('Adicione pelo menos uma questão.'); return false; }
    if (!(L().disciplina || '').trim()) { toast('Preencha a disciplina no cabeçalho.'); $('#l-disc').focus(); return false; }
    return true;
  }
  let skipPdfTip = false;
  try { skipPdfTip = localStorage.getItem('loghus-pdf-tip') === '1'; } catch (e) { }
  $('#btn-pdf').addEventListener('click', () => {
    if (!checkLista()) return;
    if (skipPdfTip) doPrint(); else openModal('#m-pdf');
  });
  $('#pdf-go').addEventListener('click', () => {
    if ($('#pdf-nomore').checked) { skipPdfTip = true; try { localStorage.setItem('loghus-pdf-tip', '1'); } catch (e) { } }
    closeModal('#m-pdf'); setTimeout(doPrint, 120);
  });
  async function doPrint() {
    renderListaPreview();
    const root = $('#print-root');
    root.innerHTML = $('#l-pages').innerHTML;
    const imgs = $$('img', root);
    await Promise.all(imgs.map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; })));
    const old = document.title;
    document.title = listaName();
    window.print();
    setTimeout(() => { document.title = old; }, 1000);
  }
  $('#btn-word').addEventListener('click', async () => {
    if (!checkLista()) return;
    busy(true, 'Gerando o arquivo do Word…');
    try {
      const blob = await window.ListaDocx.build(L(), S.images, await asset('assets/modelo-lista.docx'));
      download(blob, listaName() + '.docx');
      toast('Arquivo do Word baixado.');
    } catch (e) { console.error(e); toast('Não consegui gerar o Word: ' + e.message, 5000); }
    finally { busy(false); }
  });
  $('#btn-toslides').addEventListener('click', () => {
    if (!L().questoes.length) return toast('A lista ainda não tem questões.');
    const slides = window.Slides.fromLista(L()).map(s => Object.assign({ id: uid() }, s));
    if (S.deck.slides.length && !confirm('Substituir os slides atuais pelas questões da lista?\n(Cancelar = adicionar ao final)')) {
      S.deck.slides.push(...slides.filter(s => s.tipo === 'questao'));
    } else {
      S.deck.slides = slides;
      if (!S.deck.titulo) S.deck.titulo = 'Aula ' + (L().disciplina || '') + (L().professor ? ' – ' + L().professor : '');
    }
    showTab('slides'); renderSList(); changed('slides');
    toast('Slides criados a partir da lista.');
  });

  // ---------- SLIDES: editor ----------
  const D = () => S.deck;
  const TIPOS = { capa: 'Capa', secao: 'Divisória', topicos: 'Tópicos', 'texto-imagem': 'Texto + imagem', imagem: 'Imagem', questao: 'Questão' };
  function newSlide(tipo) {
    const s = { id: uid(), tipo, titulo: '' };
    if (tipo === 'capa') { s.titulo = (L().disciplina || '').toUpperCase(); s.subtitulo = L().professor || ''; }
    if (tipo === 'secao') s.subtitulo = '';
    if (tipo === 'topicos' || tipo === 'texto-imagem') s.texto = '';
    if (tipo === 'imagem' || tipo === 'texto-imagem') s.imagens = [];
    if (tipo === 'imagem') s.legenda = '';
    if (tipo === 'questao') { s.resposta = true; s.q = { numero: D().slides.filter(x => x.tipo === 'questao').length + 1, enunciado: '', alternativas: ['', '', '', '', ''], correta: -1, resolucao: '' }; }
    return s;
  }
  function imgListHTML(s) {
    return '<div class="imgs" style="display:flex">' + (s.imagens || []).filter(id => S.images[id]).map(id => '<div class="chip" data-chip="' + id + '"><img src="' + S.images[id].src + '" alt=""><button class="x" data-rmsimg title="Remover">×</button></div>').join('') +
      '<button class="btn sm" data-addsimg>🖼 Adicionar imagem</button></div><small style="color:var(--ink-3);font-size:12px">Dica: você também pode colar (Ctrl+V) uma imagem no campo de título.</small>';
  }
  function sCardHTML(s, i) {
    let body = '';
    const f = (key, label, ph, ta, attrs) => '<label class="field"><span>' + label + '</span>' + (ta
      ? '<textarea data-s="' + key + '" rows="' + (ta === true ? 4 : ta) + '" placeholder="' + esc(ph) + '"' + (attrs || '') + '>' + esc(s[key] || '') + '</textarea>'
      : '<input type="text" data-s="' + key + '" value="' + esc(s[key] || '') + '" placeholder="' + esc(ph) + '"' + (attrs || '') + '>') + '</label>';
    switch (s.tipo) {
      case 'capa': body = f('titulo', 'Título', 'AULÃO DE GEOMETRIA') + f('subtitulo', 'Subtítulo', 'Prof. Arthur · Outubro de 2026', 2); break;
      case 'secao': body = f('titulo', 'Título da parte', 'Geometria espacial') + f('subtitulo', 'Texto de apoio (opcional)', 'Cones, cilindros e esferas', 2); break;
      case 'topicos': body = f('titulo', 'Título', 'Volume do cone') + '<div data-toolhost>' + toolbarHTML() + f('texto', 'Tópicos — um por linha (comece com “-” para subtópico)', 'Fórmula do volume\n- V = (área da base × altura) / 3\nExemplo resolvido', 6, ' data-img') + '</div>'; break;
      case 'texto-imagem': body = f('titulo', 'Título', 'Tronco de cone') + '<div data-toolhost>' + toolbarHTML() + f('texto', 'Texto — um tópico por linha', '', 5, ' data-img') + '</div>' + imgListHTML(s); break;
      case 'imagem': body = f('titulo', 'Título', 'Observe a figura', false, ' data-img') + imgListHTML(s) + f('legenda', 'Legenda (opcional)', 'Fonte: ENEM 2019'); break;
      case 'questao': {
        const q = s.q;
        body = '<div class="row">' + f('titulo', 'Título (opcional)', 'Questão ' + (q.numero || '')) + '<label class="field"><span>Número</span><input type="number" min="1" data-qn value="' + esc(q.numero || '') + '"></label></div>' +
          '<div data-toolhost style="display:flex;flex-direction:column;gap:10px">' + toolbarHTML() +
          '<textarea data-qf="enunciado" data-img rows="4" placeholder="Enunciado">' + esc(q.enunciado) + '</textarea>' +
          '<div class="imgs">' + chipsHTML(q.enunciado, 'slides') + '</div>' +
          altsHTML(q, 'sc_' + s.id) +
          '<label class="check"><input type="checkbox" data-resp' + (s.resposta ? ' checked' : '') + '> Criar slide com a resposta destacada</label>' +
          '<details class="res"' + (q.resolucao ? ' open' : '') + '><summary>Resolução (vira um slide próprio)</summary><textarea data-qf="resolucao" data-img rows="3">' + esc(q.resolucao || '') + '</textarea></details></div>';
        break;
      }
    }
    return '<article class="card q" data-sl="' + s.id + '"><div class="q-head"><b>' + (i + 1) + '. ' + TIPOS[s.tipo] + '</b><span class="sp"></span>' + headBtns() + '</div><div class="q-body">' + body + '</div></article>';
  }
  function renderSList() {
    $('#s-title').value = D().titulo || '';
    const host = $('#s-list');
    if (!D().slides.length) { host.innerHTML = '<div class="empty"><b>Nenhum slide ainda</b>Use “Trazer questões da lista” ou adicione slides pelos botões abaixo.</div>'; return; }
    host.innerHTML = D().slides.map(sCardHTML).join('');
    $$('textarea', host).forEach(autoGrow);
  }
  function sOf(el) { const c = el.closest('[data-sl]'); return c ? D().slides.find(s => s.id === c.dataset.sl) : null; }
  $('#s-title').addEventListener('input', e => { D().titulo = e.target.value; persist(); });
  $('#s-list').addEventListener('input', e => {
    const s = sOf(e.target); if (!s) return;
    const t = e.target;
    if (t.dataset.s) {
      // imagem colada no título de um slide de imagem -> vai para a lista de imagens
      const ids = window.Rich.imageIds(t.value);
      if (ids.length && (s.tipo === 'imagem' || s.tipo === 'texto-imagem') && t.dataset.s !== 'texto') {
        t.value = t.value.replace(/\s*\[\[img:[^\]]+\]\]\s*/g, ' ').trim();
        s.imagens = (s.imagens || []).concat(ids);
        s[t.dataset.s] = t.value; renderSList();
      } else s[t.dataset.s] = t.value;
    }
    else if (t.dataset.qf) { s.q[t.dataset.qf] = t.value; if (t.dataset.qf === 'enunciado') t.closest('[data-toolhost]').querySelector('.imgs').innerHTML = chipsHTML(t.value, 'slides'); }
    else if (t.dataset.alt != null) s.q.alternativas[+t.dataset.alt] = t.value;
    else if (t.hasAttribute('data-qn')) s.q.numero = parseInt(t.value, 10) || '';
    if (t.tagName === 'TEXTAREA') autoGrow(t);
    changed('slides');
  });
  $('#s-list').addEventListener('change', e => {
    const s = sOf(e.target); if (!s) return;
    const t = e.target;
    if (t.dataset.correct != null) { s.q.correta = +t.dataset.correct; $$('.alt-row', t.closest('.alts')).forEach((r, i) => r.classList.toggle('right', i === s.q.correta)); changed('slides'); }
    if (t.hasAttribute('data-resp')) { s.resposta = t.checked; changed('slides'); }
  });
  $('#s-list').addEventListener('click', e => {
    const s = sOf(e.target); if (!s) return;
    const arr = D().slides, i = arr.indexOf(s);
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'up' && i > 0) arr.splice(i - 1, 0, arr.splice(i, 1)[0]);
      else if (a === 'down' && i < arr.length - 1) arr.splice(i + 1, 0, arr.splice(i, 1)[0]);
      else if (a === 'dup') { const c = JSON.parse(JSON.stringify(s)); c.id = uid(); arr.splice(i + 1, 0, c); }
      else if (a === 'del') { if (!confirm('Excluir este slide?')) return; arr.splice(i, 1); }
      else return;
      renderSList(); changed('slides'); return;
    }
    if (e.target.closest('[data-addsimg]')) { pickImageCb(id => { s.imagens = (s.imagens || []).concat(id); renderSList(); changed('slides'); }); return; }
    const rms = e.target.closest('[data-rmsimg]');
    if (rms) { const id = rms.closest('[data-chip]').dataset.chip; s.imagens = s.imagens.filter(x => x !== id); renderSList(); changed('slides'); return; }
    const rm = e.target.closest('[data-rmimg]');
    if (rm && s.q) { const id = rm.closest('[data-chip]').dataset.chip; const tok = new RegExp('\\s*\\[\\[img:' + id + '\\]\\]', 'g'); s.q.enunciado = s.q.enunciado.replace(tok, ''); renderSList(); changed('slides'); return; }
    if (e.target.closest('[data-altadd]') && s.q) { if (s.q.alternativas.length < 8) { s.q.alternativas.push(''); renderSList(); changed('slides'); } return; }
    if (e.target.closest('[data-altrm]') && s.q) { s.q.alternativas.pop(); if (s.q.correta >= s.q.alternativas.length) s.q.correta = -1; renderSList(); changed('slides'); }
  });
  $('#s-add').addEventListener('click', e => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    D().slides.push(newSlide(b.dataset.add)); renderSList(); changed('slides');
    const cards = $$('#s-list [data-sl]'); const last = cards[cards.length - 1];
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#btn-fromlista').addEventListener('click', () => $('#btn-toslides').click());

  function renderSlidesPreview() {
    const host = $('#s-prev');
    if (!D().slides.length) { host.innerHTML = ''; $('#s-info').textContent = 'Sem slides'; return; }
    host.innerHTML = window.Slides.render(D(), S.images);
    const n = $$('.slide-wrap', host).length;
    $('#s-info').textContent = n + (n === 1 ? ' slide' : ' slides');
    scaleSlides();
  }
  function scaleSlides() {
    $$('#s-prev .slide-scale').forEach(el => { el.firstChild.style.setProperty('--s', (el.clientWidth / 1280).toFixed(4)); });
  }
  $('#btn-pptx').addEventListener('click', async () => {
    if (!D().slides.length) return toast('Adicione pelo menos um slide.');
    busy(true, 'Gerando o PowerPoint…');
    try {
      const blob = await window.Slides.exportPptx(D(), S.images, await asset('assets/modelo-slides.pptx'));
      download(blob, fileSafe(D().titulo || ('Aula ' + (L().disciplina || 'Loghus'))) + '.pptx');
      toast('PowerPoint baixado.');
    } catch (e) { console.error(e); toast('Não consegui gerar o PowerPoint: ' + e.message, 5000); }
    finally { busy(false); }
  });

  // ---------- abas, mudanças ----------
  let current = 'lista';
  function showTab(t) {
    current = t;
    $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    $('#view-lista').classList.toggle('on', t === 'lista');
    $('#view-slides').classList.toggle('on', t === 'slides');
    if (t === 'lista') renderListaPreview(); else renderSlidesPreview();
    try { history.replaceState(null, '', '#' + t); } catch (e) { }
  }
  $$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  function changed(what, relabel) {
    persist();
    if (relabel) $$('#q-list [data-q] .q-head b').forEach((b, i) => { b.textContent = 'Questão ' + ((parseInt(L().numeroInicial, 10) || 1) + i); });
    clearTimeout(renderT);
    renderT = setTimeout(() => {
      if (what === 'lista' && current === 'lista') renderListaPreview();
      if (what === 'slides' && current === 'slides') renderSlidesPreview();
    }, 350);
  }
  let rzT = null;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { fitZoom(); scaleSlides(); }, 120); });

  // ---------- projeto ----------
  function prunedState() {
    const used = new Set();
    const add = t => window.Rich.imageIds(t).forEach(id => used.add(id));
    L().questoes.forEach(q => { add(q.enunciado); q.alternativas.forEach(add); add(q.resolucao || ''); });
    D().slides.forEach(s => { (s.imagens || []).forEach(id => used.add(id)); ['titulo', 'texto', 'legenda', 'subtitulo'].forEach(k => add(s[k] || '')); if (s.q) { add(s.q.enunciado); s.q.alternativas.forEach(add); add(s.q.resolucao || ''); } });
    const images = {};
    for (const id of used) if (S.images[id]) images[id] = S.images[id];
    return Object.assign({}, S, { images });
  }
  $('#btn-salvar').addEventListener('click', () => {
    const st = prunedState();
    const name = fileSafe((L().disciplina || D().titulo || 'material') + (L().professor ? ' - ' + L().professor : ''));
    download(new Blob([JSON.stringify(st)], { type: 'application/json' }), name + '.loghus');
    toast('Projeto salvo. Use “Abrir” para continuar depois.');
  });
  $('#btn-abrir').addEventListener('click', () => $('#f-proj').click());
  $('#f-proj').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const st = JSON.parse(await f.text());
      if (!st.lista || !st.deck) throw new Error('formato');
      S = Object.assign(emptyState(), st);
      loadAll(); persist(); toast('Projeto aberto.');
    } catch (err) { toast('Este arquivo não é um projeto do Materiais Loghus.', 4000); }
  });
  $('#btn-novo').addEventListener('click', () => {
    if ((L().questoes.length || D().slides.length) && !confirm('Começar do zero? O material atual será apagado deste navegador.\n(Se quiser guardar, use “Salvar projeto” antes.)')) return;
    const keep = { disciplina: L().disciplina, professor: L().professor };
    S = emptyState(); Object.assign(S.lista, keep);
    loadAll(); persist();
  });

  function loadAll() {
    bindHeader(); renderQList(); renderSList();
    showTab(current);
  }

  // ---------- início ----------
  (async function init() {
    if (document.fonts && document.fonts.load) {
      try { await Promise.all(['12pt LoghusSerif', 'bold 12pt LoghusSerif', 'italic 12pt LoghusSerif', '18pt LoghusSans', 'bold 18pt LoghusSans', '20pt Carlito', 'bold 20pt Carlito'].map(f => document.fonts.load(f))); } catch (e) { }
    }
    if (await DB.open()) {
      const raw = await DB.get('state');
      if (raw) { try { const st = JSON.parse(raw); if (st && st.lista) S = Object.assign(emptyState(), st); } catch (e) { } }
    }
    const h = (location.hash || '').slice(1);
    if (h === 'slides') current = 'slides';
    loadAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (current === 'lista') renderListaPreview(); else renderSlidesPreview(); });
  })();

  // para testes automatizados
  window.__loghus = { get state() { return S; }, set state(v) { S = v; loadAll(); }, addImage, renderListaPreview, renderSlidesPreview, showTab };
})();
