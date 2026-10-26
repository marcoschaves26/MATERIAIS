/* Monta as páginas A4 da lista no layout do modelo Loghus
   (cabeçalho na 1ª página, duas colunas com fio separador, Times 12). */
(function (global) {
  'use strict';
  const { tokenize, paragraphs, soloImage, segsHTML, atomize, esc } = global.Rich;

  // Geometria medida no modelo (pontos)
  const G = {
    pageW: 595.3, pageH: 841.9,
    left: 36, colW: 251.9, gap: 19.45,
    top1: 90.5, top: 27.4, bottom: 805.9,
    lh: 13.8
  };
  G.col2 = G.left + G.colW + G.gap;
  G.rule = G.left + G.colW + G.gap / 2;

  const LETTERS = 'ABCDEFGH';
  const PX = 0.75; // 1px CSS = 0.75pt

  function titleSize(t) { const n = (t || '').length; return n <= 16 ? 18 : n <= 22 ? 15 : n <= 28 ? 12 : 10; }
  function profSize(t) { const n = (t || '').length; return n <= 22 ? 12 : n <= 30 ? 10 : 9; }

  function letterSVG(L) {
    return '<svg class="lt" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="#000"/>' +
      '<text x="10" y="14.6" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="13" fill="#fff">' + L + '</text></svg>';
  }

  function imgBox(im, maxW, maxH) {
    const CW = G.colW;
    let w;
    const nat = im.w * PX;
    if (im.size === 'p') w = CW * 0.45;
    else if (im.size === 'm') w = CW * 0.7;
    else if (im.size === 'g') w = CW;
    else w = Math.min(im.ptw || nat, CW, nat * 1.6);
    let h = w * im.h / im.w;
    const capH = maxH || (im.size === 'g' ? 420 : im.size ? 320 : 170);
    if (h > capH) { h = capH; w = h * im.w / im.h; }
    if (maxW && w > maxW) { w = maxW; h = w * im.h / im.w; }
    return { w, h };
  }

  // Constrói a sequência de blocos da lista
  function buildBlocks(lista, images) {
    const blocks = [];
    let n = Math.max(1, parseInt(lista.numeroInicial, 10) || 1);
    lista.questoes.forEach((q, qi) => {
      if (qi > 0) blocks.push({ k: 'gap' });
      const num = n++;
      const paras = paragraphs(q.enunciado).filter(p => p.trim() !== '');
      let numbered = false;
      if (!paras.length) paras.push('');
      paras.forEach((p, pi) => {
        const segs = tokenize(p);
        const solo = soloImage(segs);
        if (solo) {
          if (!numbered) { blocks.push({ k: 'p', segs: [{ t: 'text', v: num + '.' }] }); numbered = true; }
          if (images[solo]) blocks.push({ k: 'img', id: solo });
          return;
        }
        if (!numbered) { segs.unshift({ t: 'text', v: num + '. ' }); numbered = true; }
        // imagens no meio do texto viram blocos próprios
        let cur = [];
        for (const s of segs) {
          if (s.t === 'img' && images[s.v] && segs.length > 1) {
            if (cur.some(c => !(c.t === 'text' && !c.v.trim()))) blocks.push({ k: 'p', segs: cur });
            cur = [];
            blocks.push({ k: 'img', id: s.v });
          } else cur.push(s);
        }
        if (cur.some(c => !(c.t === 'text' && !c.v.trim()))) blocks.push({ k: 'p', segs: cur });
      });
      (q.alternativas || []).forEach((a, ai) => {
        if (!a || !a.trim()) return;
        blocks.push({ k: 'alt', L: LETTERS[ai], segs: tokenize(a.trim()) });
      });
    });
    if (lista.gabarito && lista.questoes.some(q => q.correta >= 0)) {
      blocks.push({ k: 'gap' });
      blocks.push({ k: 'gabtitle' });
      const start = Math.max(1, parseInt(lista.numeroInicial, 10) || 1);
      const items = lista.questoes.map((q, i) => ({ n: start + i, L: q.correta >= 0 ? LETTERS[q.correta] : '–' }));
      for (let i = 0; i < items.length; i += 5) blocks.push({ k: 'gabrow', items: items.slice(i, i + 5) });
    }
    return blocks;
  }

  function blockHTML(b, images, opts) {
    opts = opts || {};
    switch (b.k) {
      case 'raw': return b.html;
      case 'gap': return '<p class="bp gap">&nbsp;</p>';
      case 'p': return '<p class="bp' + (opts.split ? ' split' : '') + '">' + segsHTML(b.segs, images) + '</p>';
      case 'alt': return '<p class="bp alt">' + letterSVG(b.L) + ' ' + segsHTML(b.segs, images) + '</p>';
      case 'img': {
        const im = images[b.id];
        const box = imgBox(im, null, b.maxH);
        return '<p class="bp pimg"><img src="' + im.src + '" style="width:' + box.w.toFixed(1) + 'pt;height:' + box.h.toFixed(1) + 'pt" alt=""></p>';
      }
      case 'gabtitle': return '<p class="bp gabt">GABARITO</p>';
      case 'gabrow': return '<p class="bp gabr">' + b.items.map(it => '<span><b>' + it.n + '.</b> ' + it.L + '</span>').join('') + '</p>';
    }
    return '';
  }

  // ---------- paginação ----------
  let meter = null;
  function getMeter() {
    if (meter && document.body.contains(meter)) return meter;
    meter = document.createElement('div');
    meter.className = 'lista-sheet meter-host';
    meter.innerHTML = '<div class="col" style="width:' + G.colW + 'pt;position:absolute;left:-9999px;top:0;visibility:hidden"></div>';
    document.body.appendChild(meter);
    return meter;
  }
  function measure(html) {
    const col = getMeter().firstChild;
    col.innerHTML = html;
    return col.firstChild ? col.firstChild.getBoundingClientRect().height * PX : 0;
  }

  function paginate(lista, images) {
    const blocks = buildBlocks(lista, images);
    const pages = [];
    let page, colIdx, used, H;
    function newPage() {
      page = { cols: [[], []], used: [0, 0], first: pages.length === 0 };
      pages.push(page);
      colIdx = 0; used = 0;
      H = (page.first ? G.bottom - G.top1 : G.bottom - G.top);
    }
    function nextCol() {
      page.used[colIdx] = used;
      if (colIdx === 0) { colIdx = 1; used = 0; } else newPage();
    }
    newPage();
    const queue = blocks.slice();
    let guard = 0;
    while (queue.length && guard++ < 20000) {
      const b = queue.shift();
      if (b.k === 'gap' && used === 0) continue;
      const html = blockHTML(b, images);
      const h = measure(html);
      if (used + h <= H + 0.5) {
        page.cols[colIdx].push(html); used += h; continue;
      }
      const R = H - used;
      if (b.k === 'p' && R >= G.lh * 2 - 0.5) {
        const parts = splitPara(b, images, R);
        if (parts) {
          page.cols[colIdx].push(parts.html); used += parts.h;
          queue.unshift(parts.rest);
          nextCol();
          continue;
        }
      }
      if (b.k === 'img' && used === 0) {
        // imagem maior que a coluna: reduz
        const nb = Object.assign({}, b, { maxH: H - 4 });
        const nh = blockHTML(nb, images);
        page.cols[colIdx].push(nh); used += measure(nh); continue;
      }
      if (used === 0) { page.cols[colIdx].push(html); used += h; continue; } // não cabe nem sozinho
      // mantém o número da questão junto do que vem depois
      if (b.k !== 'gap') {
        const col = page.cols[colIdx];
        // se o bloco anterior é só "N." (número sozinho), leva junto
        const last = col[col.length - 1];
        if (last && /^<p class="bp">\d+\.<\/p>$/.test(last)) { col.pop(); queue.unshift(b); queue.unshift({ k: 'raw', html: last }); nextCol(); continue; }
      }
      queue.unshift(b);
      nextCol();
    }
    page.used[colIdx] = used;
    // remove página final vazia
    while (pages.length > 1 && !pages[pages.length - 1].cols[0].length) pages.pop();
    return pages;
  }

  function splitPara(b, images, R) {
    const atoms = atomize(b.segs);
    if (atoms.length < 2) return null;
    const htmlOf = (arr, split) => '<p class="bp' + (split ? ' split' : '') + '">' + segsHTML(arr, images) + '</p>';
    let lo = 1, hi = atoms.length - 1, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const h = measure(htmlOf(trimEnd(atoms.slice(0, mid)), true));
      if (h <= R + 0.5) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best < 1) return null;
    // recua até o fim de uma palavra
    while (best > 1 && atoms[best] && atoms[best].t === 'text' && !/^\s+$/.test(atoms[best].v) && atoms[best - 1].t === 'text' && !/^\s+$/.test(atoms[best - 1].v)) best--;
    const first = trimEnd(atoms.slice(0, best));
    const rest = trimStart(atoms.slice(best));
    if (!rest.length) return null;
    const html = htmlOf(first, true);
    return { html, h: measure(html), rest: { k: 'p', segs: rest } };
  }
  function trimEnd(a) { a = a.slice(); while (a.length && a[a.length - 1].t === 'text' && !a[a.length - 1].v.trim()) a.pop(); return a; }
  function trimStart(a) { a = a.slice(); while (a.length && a[0].t === 'text' && !a[0].v.trim()) a.shift(); return a; }

  function headerHTML(lista) {
    const t = (lista.disciplina || '').toUpperCase();
    const p = (lista.professor || '').toUpperCase();
    return '<img class="hlogo" src="assets/logo-preto.png" alt="Curso Loghus">' +
      '<div class="htitle" style="font-size:' + titleSize(t) + 'pt">' + esc(t) + '</div>' +
      '<div class="hprof" style="font-size:' + profSize(p) + 'pt">' + esc(p) + '</div>' +
      '<div class="hrule"></div>';
  }

  function render(lista, images) {
    const pages = paginate(lista, images);
    return pages.map((pg, i) => {
      const top = pg.first ? G.top1 : G.top;
      const ruleH = Math.max(pg.used[0], pg.used[1]);
      const col = (k, left) => '<div class="col" style="left:' + left + 'pt;top:' + top + 'pt;width:' + G.colW + 'pt">' +
        pg.cols[k].join('') + '</div>';
      return '<section class="page">' + (pg.first ? headerHTML(lista) : '') +
        col(0, G.left) + col(1, G.col2) +
        (pg.cols[1].length ? '<div class="crule" style="left:' + G.rule + 'pt;top:' + top + 'pt;height:' + ruleH.toFixed(1) + 'pt"></div>' : '') +
        '</section>';
    }).join('');
  }

  global.ListaRender = { render, G, imgBox, titleSize, profSize, LETTERS, buildBlocks };
})(window);
