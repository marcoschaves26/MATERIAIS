/* Apresentações no modelo "Aulão Loghus": pré-visualização e exportação .pptx
   preenchendo o arquivo-modelo original (slide mestre, fundo e logo). */
(function (global) {
  'use strict';
  const { tokenize, paragraphs, esc } = global.Rich;
  const L = global.LoghusLatex;
  const LETTERS = 'ABCDEFGH';
  const EMU = 12700; // por ponto
  const BLUE = '0040FF', ORANGE = 'FF5C00';

  // Geometria do modelo (pontos; slide 960 x 540)
  const GEO = {
    title: { x: 66, y: 28.75, w: 828, h: 104.4 },
    body: { x: 66, y: 143.75, w: 828, h: 342.6 },
    ctrTitle: { x: 120, y: 88.4, w: 720, h: 188 },
    subTitle: { x: 120, y: 283.6, w: 720, h: 130.4 },
    secTitle: { x: 65.5, y: 134.6, w: 828, h: 224.6 },
    secBody: { x: 65.5, y: 361.4, w: 828, h: 118.1 },
    qTitle: { x: 50, y: 14, w: 680, h: 70 },
    content: { top: 92, bottom: 462 }
  };

  // ---------- texto -> parágrafos ----------
  function segsToRuns(segs, base) {
    const runs = [];
    for (const s of segs) {
      if (s.t === 'text') runs.push(Object.assign({}, base, { t: s.v, b: s.b || (base && base.b), i: s.i }));
      else if (s.t === 'math') runs.push(Object.assign({}, base, { t: L.toUnicode(s.v), math: true, b: s.b || (base && base.b) }));
    }
    return runs;
  }
  function textParas(text, opts) {
    opts = opts || {};
    return paragraphs(text).filter(p => p.trim() !== '').map(p => {
      let lvl = 0, line = p;
      if (opts.bullets) {
        const m1 = /^(?:\s{2,}|\t+)(?:[-–•*]\s+)?|^[-–]\s+/.exec(p);
        const m0 = /^[•*]\s+/.exec(p);
        if (m1) { lvl = 1; line = p.slice(m1[0].length); }
        else if (m0) line = p.slice(m0[0].length);
      }
      return { lvl, bullet: !!opts.bullets, runs: segsToRuns(tokenize(line).filter(s => s.t !== 'img'), {}) };
    });
  }
  function imgsIn(text) { return global.Rich.imageIds(text); }

  // ---------- medição (Calibri / Carlito) ----------
  let host = null;
  function meterEl() {
    if (host && document.body.contains(host)) return host;
    host = document.createElement('div');
    host.className = 'slide-meter';
    host.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
    document.body.appendChild(host);
    return host;
  }
  function parasHTML(paras, sz, kind) {
    return paras.map((p, i) => {
      const lvlSz = p.lvl ? Math.round(sz * 0.86) : sz;
      const before = i === 0 ? 0 : (kind === 'title' ? 0 : kind === 'ph' ? (p.lvl ? 5 : 10) : (p.space != null ? p.space : 6));
      const ind = p.bullet ? (p.lvl ? 54 : 18) : 0;
      const style = 'margin:' + before + 'pt 0 0 0;font-size:' + lvlSz + 'pt;line-height:' + (kind === 'ph' || kind === 'title' ? 1.08 : 1.2) + ';padding-left:' + ind + 'pt;text-indent:' + (p.bullet ? -18 : 0) + 'pt;text-align:' + (p.align || 'left');
      const bullet = p.bullet ? '<span class="bu">•</span>' : '';
      return '<p style="' + style + '">' + bullet + p.runs.map(runHTML).join('') + (p.runs.length ? '' : '&nbsp;') + '</p>';
    }).join('');
  }
  function runHTML(r) {
    let st = '';
    if (r.color) st += 'color:#' + r.color + ';';
    if (r.b) st += 'font-weight:700;';
    if (r.i) st += 'font-style:italic;';
    if (r.sz) st += 'font-size:' + r.sz + 'pt;';
    return '<span style="' + st + '">' + esc(r.t) + '</span>';
  }
  function fit(paras, box, sizes, kind) {
    const m = meterEl();
    const innerW = box.w - 14.4;
    for (const sz of sizes) {
      m.innerHTML = '<div class="stext" style="width:' + innerW + 'pt;font-family:' + (kind === 'title' ? "'Calibri Light','Carlito',Calibri" : "Calibri,'Carlito'") + ',sans-serif">' + parasHTML(paras, sz, kind) + '</div>';
      const h = m.firstChild.getBoundingClientRect().height * 0.75;
      if (h <= box.h - 7.2) return sz;
    }
    return sizes[sizes.length - 1];
  }

  // ---------- slides -> quadros ----------
  function frames(deck, images) {
    const out = [];
    for (const s of deck.slides) {
      if (s.tipo === 'questao') {
        out.push(questionFrame(s, images, false));
        if (s.resposta && s.q && s.q.correta >= 0) out.push(questionFrame(s, images, true));
        if (s.q && s.q.resolucao && s.q.resolucao.trim()) out.push(resolutionFrame(s, images));
      } else out.push(frame(s, images));
    }
    return out;
  }

  function titleShape(text, box, sizes, ph, extra) {
    const paras = [{ runs: [{ t: text || '' }], align: extra && extra.align }];
    const sz = fit(paras, box, sizes, 'title');
    return Object.assign({ kind: 'text', ph, box, paras, sz, anchor: extra && extra.anchor || 'ctr', font: 'title' }, extra || {});
  }

  function picShapes(ids, area, images) {
    ids = ids.filter(id => images[id]);
    if (!ids.length) return [];
    const gap = 10;
    const h = (area.h - gap * (ids.length - 1)) / ids.length;
    return ids.map((id, i) => {
      const im = images[id];
      let w = area.w, hh = w * im.h / im.w;
      if (hh > h) { hh = h; w = hh * im.w / im.h; }
      return { kind: 'pic', id, box: { x: area.x + (area.w - w) / 2, y: area.y + i * (h + gap) + (h - hh) / 2, w, h: hh } };
    });
  }

  function frame(s, images) {
    const f = { layout: 6, shapes: [] };
    switch (s.tipo) {
      case 'capa': {
        f.layout = 1;
        f.shapes.push(titleShape(s.titulo, GEO.ctrTitle, [60, 54, 48, 44, 40, 36, 32], 'ctrTitle', { anchor: 'b', align: 'ctr' }));
        const paras = textParas(s.subtitulo).map(p => Object.assign(p, { align: 'ctr' }));
        f.shapes.push({ kind: 'text', ph: 'subTitle', box: GEO.subTitle, paras, sz: fit(paras, GEO.subTitle, [24, 22, 20, 18, 16], 'ph'), anchor: 't', spcPh: true });
        break;
      }
      case 'secao': {
        f.layout = 3;
        f.shapes.push(titleShape(s.titulo, GEO.secTitle, [60, 54, 48, 44, 40, 36], 'title', { anchor: 'b' }));
        const paras = textParas(s.subtitulo);
        if (paras.length) f.shapes.push({ kind: 'text', ph: 'body', box: GEO.secBody, paras, sz: fit(paras, GEO.secBody, [24, 20, 18, 16], 'ph'), anchor: 't', spcPh: true, color: '595959' });
        break;
      }
      case 'topicos': {
        f.layout = 2;
        f.shapes.push(titleShape(s.titulo, GEO.title, [44, 40, 36, 32, 28], 'title'));
        const paras = textParas(s.texto, { bullets: true });
        f.shapes.push({ kind: 'text', ph: 'body', box: GEO.body, paras, sz: fit(paras, GEO.body, [28, 26, 24, 22, 20, 18, 16, 14, 12], 'ph'), anchor: 't', spcPh: true });
        break;
      }
      case 'imagem': {
        f.shapes.push(titleShape(s.titulo, GEO.title, [44, 40, 36, 32, 28], 'title'));
        const leg = (s.legenda || '').trim();
        const area = { x: 66, y: 140, w: 828, h: leg ? 300 : 325 };
        f.shapes.push(...picShapes(s.imagens || [], area, images));
        if (leg) {
          const paras = [{ runs: segsToRuns(tokenize(leg), { i: true, color: '595959' }), align: 'ctr' }];
          f.shapes.push({ kind: 'text', box: { x: 66, y: 444, w: 660, h: 30 }, paras, sz: fit(paras, { w: 660, h: 30 }, [16, 14, 12, 11], 'tb'), anchor: 't' });
        }
        break;
      }
      case 'texto-imagem': {
        f.shapes.push(titleShape(s.titulo, GEO.title, [44, 40, 36, 32, 28], 'title'));
        const box = { x: 66, y: 143.75, w: 470, h: 320 };
        const paras = textParas(s.texto, { bullets: true });
        f.shapes.push({ kind: 'text', box, paras, sz: fit(paras, box, [28, 26, 24, 22, 20, 18, 16, 14, 12], 'tb'), anchor: 't' });
        f.shapes.push(...picShapes(s.imagens || [], { x: 556, y: 143.75, w: 338, h: 300 }, images));
        break;
      }
    }
    return f;
  }

  function qNum(s) { return s.q && s.q.numero ? String(s.q.numero) : ''; }

  function questionFrame(s, images, answer) {
    const q = s.q || { enunciado: '', alternativas: [], correta: -1 };
    const f = { layout: 6, shapes: [] };
    const base = (s.titulo || ('Questão ' + qNum(s))).trim();
    f.shapes.push(titleShape(answer ? base + ' — resposta' : base, GEO.qTitle, [36, 32, 28, 24], 'title', { anchor: 'ctr', xfrm: true }));
    const ids = imgsIn(q.enunciado);
    const hasImg = ids.some(id => images[id]);
    const top = GEO.content.top, H = GEO.content.bottom - top;
    const tbox = hasImg ? { x: 50, y: top, w: 530, h: H } : { x: 50, y: top, w: 860, h: H };
    const paras = textParas(q.enunciado).map(p => Object.assign(p, { align: 'just' }));
    (q.alternativas || []).forEach((a, ai) => {
      if (!a || !a.trim()) return;
      const right = answer && ai === q.correta;
      const segs = tokenize(a.trim()).map(sg => sg.t === 'img' ? { t: 'text', v: '[figura]' } : sg);
      const runs = [{ t: LETTERS[ai] + ')  ', b: true, color: right ? ORANGE : BLUE }].concat(segsToRuns(segs, right ? { b: true, color: ORANGE } : {}));
      if (right) runs.push({ t: '  ✔', b: true, color: ORANGE });
      paras.push({ runs, space: ai === 0 ? 10 : 3, alt: true });
    });
    f.shapes.push({ kind: 'text', box: tbox, paras, sz: fit(paras, tbox, [28, 26, 24, 22, 20, 18, 17, 16, 15, 14, 13, 12, 11, 10], 'tb'), anchor: hasImg ? 't' : 't' });
    if (hasImg) f.shapes.push(...picShapes(ids, { x: 596, y: top + 4, w: 320, h: 350 }, images));
    return f;
  }

  function resolutionFrame(s, images) {
    const q = s.q;
    const f = { layout: 6, shapes: [] };
    const base = (s.titulo || ('Questão ' + qNum(s))).trim();
    f.shapes.push(titleShape('Resolução — ' + base, GEO.qTitle, [36, 32, 28, 24], 'title', { anchor: 'ctr', xfrm: true }));
    const ids = imgsIn(q.resolucao);
    const hasImg = ids.some(id => images[id]);
    const top = GEO.content.top, H = GEO.content.bottom - top;
    const box = hasImg ? { x: 50, y: top, w: 530, h: H } : { x: 50, y: top, w: 860, h: H };
    const paras = textParas(q.resolucao);
    if (q.correta >= 0) paras.push({ runs: [{ t: 'Resposta: ', b: true }, { t: LETTERS[q.correta], b: true, color: ORANGE }], space: 12 });
    f.shapes.push({ kind: 'text', box, paras, sz: fit(paras, box, [28, 26, 24, 22, 20, 18, 16, 14, 12, 11], 'tb'), anchor: 't' });
    if (hasImg) f.shapes.push(...picShapes(ids, { x: 596, y: top + 4, w: 320, h: 350 }, images));
    return f;
  }

  // ---------- pré-visualização ----------
  function frameHTML(f, images) {
    const parts = f.shapes.map(sh => {
      const b = sh.box;
      const pos = 'left:' + b.x + 'pt;top:' + b.y + 'pt;width:' + b.w + 'pt;height:' + b.h + 'pt';
      if (sh.kind === 'pic') return '<img class="spic" style="' + pos + '" src="' + images[sh.id].src + '" alt="">';
      const font = sh.font === 'title' ? "'Calibri Light','Carlito',Calibri,sans-serif" : "Calibri,'Carlito',sans-serif";
      const jc = sh.anchor === 'b' ? 'flex-end' : sh.anchor === 'ctr' ? 'center' : 'flex-start';
      const paras = sh.paras.map(p => p.align === 'just' ? Object.assign({}, p, { align: 'justify' }) : p.align === 'ctr' ? Object.assign({}, p, { align: 'center' }) : p);
      return '<div class="sbox" style="' + pos + ';justify-content:' + jc + ';font-family:' + font + (sh.color ? ';color:#' + sh.color : '') + '"><div class="stext">' + parasHTML(paras, sh.sz, sh.spcPh || sh.font === 'title' ? 'ph' : 'tb') + '</div></div>';
    });
    return '<div class="slide"><img class="sbg" src="assets/slide-bg.jpg" alt="">' + parts.join('') + '</div>';
  }

  function render(deck, images) {
    return frames(deck, images).map((f, i) => '<figure class="slide-wrap"><div class="slide-scale">' + frameHTML(f, images) + '</div><figcaption>' + (i + 1) + '</figcaption></figure>').join('');
  }

  // ---------- exportação PPTX ----------
  function x(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const E = v => Math.round(v * EMU);
  function xfrm(b) { return '<a:xfrm><a:off x="' + E(b.x) + '" y="' + E(b.y) + '"/><a:ext cx="' + E(b.w) + '" cy="' + E(b.h) + '"/></a:xfrm>'; }

  function runXML(r, sz) {
    let a = '<a:rPr lang="pt-BR"' + (sz ? ' sz="' + Math.round(sz * 100) + '"' : '') + (r.b ? ' b="1"' : '') + (r.i ? ' i="1"' : '') + ' dirty="0">';
    if (r.color) a += '<a:solidFill><a:srgbClr val="' + r.color + '"/></a:solidFill>';
    a += '</a:rPr>';
    return '<a:r>' + a + '<a:t>' + x(r.t) + '</a:t></a:r>';
  }
  function parasXML(sh) {
    return sh.paras.map((p, i) => {
      const sz = p.lvl ? Math.round(sh.sz * 0.86) : sh.sz;
      let ppr = '';
      const algn = p.align === 'ctr' ? ' algn="ctr"' : p.align === 'just' ? ' algn="just"' : '';
      if (sh.ph) {
        ppr = '<a:pPr' + (p.lvl ? ' lvl="1"' : '') + algn + '>' + (sh.ph === 'body' && !p.bullet ? '<a:buNone/>' : '') + '</a:pPr>';
        if (!algn && !p.lvl && !(sh.ph === 'body' && !p.bullet)) ppr = '';
      } else {
        const before = i === 0 ? 0 : (p.space != null ? p.space : 6);
        if (p.bullet) {
          const marL = p.lvl ? 685800 : 228600;
          ppr = '<a:pPr marL="' + marL + '" indent="-228600"' + algn + '><a:spcBef><a:spcPts val="' + Math.round(before * 100) + '"/></a:spcBef><a:buFont typeface="Arial" panose="020B0604020202020204" pitchFamily="34" charset="0"/><a:buChar char="•"/></a:pPr>';
        } else {
          ppr = '<a:pPr' + algn + '><a:spcBef><a:spcPts val="' + Math.round(before * 100) + '"/></a:spcBef><a:buNone/></a:pPr>';
        }
      }
      const runs = p.runs.map(r => runXML(sh.color && !r.color ? Object.assign({}, r, { color: sh.color }) : r, sz)).join('');
      return '<a:p>' + ppr + runs + '<a:endParaRPr lang="pt-BR" sz="' + Math.round(sz * 100) + '" dirty="0"/></a:p>';
    }).join('');
  }

  function slideXML(f, ridOf) {
    let id = 2;
    const shapes = f.shapes.map(sh => {
      const n = id++;
      if (sh.kind === 'pic') {
        return '<p:pic><p:nvPicPr><p:cNvPr id="' + n + '" name="Imagem ' + n + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="' + ridOf(sh.id) + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>' + xfrm(sh.box) + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
      }
      const anchor = sh.anchor === 'b' ? 'b' : sh.anchor === 'ctr' ? 'ctr' : 't';
      if (sh.ph) {
        const phTag = sh.ph === 'ctrTitle' ? '<p:ph type="ctrTitle"/>' : sh.ph === 'subTitle' ? '<p:ph type="subTitle" idx="1"/>' : sh.ph === 'title' ? '<p:ph type="title"/>' : '<p:ph idx="1"/>';
        const phTag2 = sh.ph === 'body' && f.layout === 3 ? '<p:ph type="body" idx="1"/>' : phTag;
        const name = sh.ph === 'title' || sh.ph === 'ctrTitle' ? 'Título ' + n : 'Espaço Reservado ' + n;
        return '<p:sp><p:nvSpPr><p:cNvPr id="' + n + '" name="' + name + '"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>' + phTag2 + '</p:nvPr></p:nvSpPr><p:spPr>' + (sh.xfrm ? xfrm(sh.box) : '') + '</p:spPr><p:txBody><a:bodyPr' + (sh.xfrm || f.layout === 6 ? ' anchor="' + anchor + '"' : '') + '><a:normAutofit/></a:bodyPr><a:lstStyle/>' + parasXML(sh) + '</p:txBody></p:sp>';
      }
      return '<p:sp><p:nvSpPr><p:cNvPr id="' + n + '" name="CaixaDeTexto ' + n + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>' + xfrm(sh.box) + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="' + anchor + '"><a:normAutofit/></a:bodyPr><a:lstStyle/>' + parasXML(sh) + '</p:txBody></p:sp>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' + shapes + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  }

  async function exportPptx(deck, images, templateBuf) {
    const zip = await JSZip.loadAsync(templateBuf);
    const fr = frames(deck, images);
    // limpa slides e histórico de revisões do modelo
    zip.remove('ppt/slides');
    zip.remove('ppt/changesInfos');
    zip.remove('ppt/revisionInfo.xml');
    let prels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
    prels = prels.replace(/<Relationship [^>]*(\/slide"|changesInfo"|revisionInfo")[^>]*\/>/g, '');
    let ct = await zip.file('[Content_Types].xml').async('string');
    ct = ct.replace(/<Override PartName="\/ppt\/(slides\/slide\d+\.xml|changesInfos\/[^"]+|revisionInfo\.xml)"[^>]*\/>/g, '');
    let pres = await zip.file('ppt/presentation.xml').async('string');

    const mediaFiles = {};
    let mediaN = 0;
    const sldIds = [], relsAdd = [], ctAdd = [];
    fr.forEach((f, i) => {
      const k = i + 1;
      const rels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout' + f.layout + '.xml"/>'];
      const local = {};
      const ridOf = id => {
        if (local[id]) return local[id];
        if (!mediaFiles[id]) {
          const m = /^data:(image\/[\w+.-]+);base64,(.*)$/.exec(images[id].src);
          const ext = m && m[1] === 'image/jpeg' ? 'jpeg' : 'png';
          const name = 'loghus_img' + (++mediaN) + '.' + ext;
          zip.file('ppt/media/' + name, m ? m[2] : '', { base64: true });
          mediaFiles[id] = name;
        }
        const rid = 'rId' + (rels.length + 1);
        rels.push('<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + mediaFiles[id] + '"/>');
        local[id] = rid;
        return rid;
      };
      const xml = slideXML(f, ridOf);
      zip.file('ppt/slides/slide' + k + '.xml', xml);
      zip.file('ppt/slides/_rels/slide' + k + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>');
      sldIds.push('<p:sldId id="' + (256 + k) + '" r:id="rIdS' + k + '"/>');
      relsAdd.push('<Relationship Id="rIdS' + k + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + k + '.xml"/>');
      ctAdd.push('<Override PartName="/ppt/slides/slide' + k + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>');
    });
    pres = pres.replace(/<p:sldIdLst>.*?<\/p:sldIdLst>/s, '<p:sldIdLst>' + sldIds.join('') + '</p:sldIdLst>');
    zip.file('ppt/presentation.xml', pres);
    zip.file('ppt/_rels/presentation.xml.rels', prels.replace('</Relationships>', relsAdd.join('') + '</Relationships>'));
    if (!/Extension="jpeg"/.test(ct)) ct = ct.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ');
    zip.file('[Content_Types].xml', ct.replace('</Types>', ctAdd.join('') + '</Types>'));
    zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Template>Tema ppt Aulão Loghus 2025</Template><Application>Microsoft Office PowerPoint</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>' + fr.length + '</Slides><AppVersion>16.0000</AppVersion></Properties>');
    let core = await zip.file('docProps/core.xml').async('string');
    core = core.replace(/<dc:title>.*?<\/dc:title>/s, '').replace('</cp:coreProperties>', '<dc:title>' + x(deck.titulo || 'Aula Loghus') + '</dc:title></cp:coreProperties>');
    zip.file('docProps/core.xml', core);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE' });
  }

  // Lista -> slides
  function fromLista(lista) {
    const start = Math.max(1, parseInt(lista.numeroInicial, 10) || 1);
    const slides = [{ tipo: 'capa', titulo: (lista.disciplina || 'Aula').toUpperCase(), subtitulo: (lista.professor || '') }];
    lista.questoes.forEach((q, i) => {
      slides.push({ tipo: 'questao', titulo: '', resposta: q.correta >= 0, q: { numero: start + i, enunciado: q.enunciado, alternativas: (q.alternativas || []).slice(), correta: q.correta, resolucao: q.resolucao || '' } });
    });
    return slides;
  }

  global.Slides = { render, exportPptx, frames, fromLista };
})(window);
