/* Gera o .docx da lista a partir do modelo Word original
   (mesmo cabeçalho, estilos, margens e duas colunas com fio). */
(function (global) {
  'use strict';
  const { tokenize, paragraphs, soloImage } = global.Rich;
  const { imgBox, titleSize, profSize, LETTERS } = global.ListaRender;

  function x(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const CIRC = { A: '🅐', B: '🅑', C: '🅒', D: '🅓', E: '🅔', F: '🅕', G: '🅖', H: '🅗' };

  function dataUrlParts(src) {
    const m = /^data:(image\/[\w+.-]+);base64,(.*)$/.exec(src);
    return m ? { mime: m[1], b64: m[2] } : null;
  }

  async function build(lista, images, templateBuf) {
    const zip = await JSZip.loadAsync(templateBuf);
    const media = []; // {id, rid, file}
    const ridOf = {};
    let docPr = 2000;

    function imageRid(id) {
      if (ridOf[id]) return ridOf[id];
      const im = images[id];
      const parts = dataUrlParts(im.src);
      if (!parts) return null;
      const ext = parts.mime === 'image/jpeg' ? 'jpeg' : 'png';
      const rid = 'rIdImg' + (media.length + 1);
      const file = 'img' + (media.length + 1) + '.' + ext;
      media.push({ rid, file, b64: parts.b64 });
      ridOf[id] = rid;
      return rid;
    }

    function drawing(id, wPt, hPt) {
      const rid = imageRid(id);
      if (!rid) return '';
      const cx = Math.round(wPt * 12700), cy = Math.round(hPt * 12700);
      const n = ++docPr;
      return '<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="' + n + '" name="Imagem ' + n + '"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + n + '" name=""/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }

    function runs(segs) {
      return segs.map(s => {
        if (s.t === 'text') {
          const rpr = (s.b ? '<w:b/><w:bCs/>' : '') + (s.i ? '<w:i/><w:iCs/>' : '');
          return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + x(s.v) + '</w:t></w:r>';
        }
        if (s.t === 'math') return global.LoghusLatex.toOMML(s.v);
        if (s.t === 'img') {
          const im = images[s.v];
          if (!im) return '';
          const box = imgBox(im, 200, 80);
          return drawing(s.v, box.w, box.h);
        }
        return '';
      }).join('');
    }
    const P = (inner, jc) => '<w:p><w:pPr><w:pStyle w:val="Corpodetexto"/>' + (jc ? '<w:jc w:val="' + jc + '"/>' : '') + '</w:pPr>' + inner + '</w:p>';

    const body = [];
    let n = Math.max(1, parseInt(lista.numeroInicial, 10) || 1);
    lista.questoes.forEach((q, qi) => {
      if (qi > 0) body.push(P(''));
      const num = n++;
      const paras = paragraphs(q.enunciado).filter(p => p.trim() !== '');
      if (!paras.length) paras.push('');
      let numbered = false;
      for (const p of paras) {
        const segs = tokenize(p);
        const solo = soloImage(segs);
        if (solo) {
          if (!numbered) { body.push(P(runs([{ t: 'text', v: num + '.' }]))); numbered = true; }
          const im = images[solo];
          if (im) { const box = imgBox(im); body.push(P(drawing(solo, box.w, box.h), 'center')); }
          continue;
        }
        if (!numbered) { segs.unshift({ t: 'text', v: num + '. ' }); numbered = true; }
        let cur = [];
        const flush = () => { if (cur.some(c => !(c.t === 'text' && !c.v.trim()))) body.push(P(runs(cur))); cur = []; };
        for (const s of segs) {
          if (s.t === 'img' && images[s.v] && segs.length > 1) {
            flush();
            const box = imgBox(images[s.v]);
            body.push(P(drawing(s.v, box.w, box.h), 'center'));
          } else cur.push(s);
        }
        flush();
      }
      (q.alternativas || []).forEach((a, ai) => {
        if (!a || !a.trim()) return;
        const L = LETTERS[ai];
        const glyph = '<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:cs="Segoe UI Symbol"/></w:rPr><w:t>' + CIRC[L] + '</w:t></w:r>';
        const segs = tokenize(a.trim());
        segs.unshift({ t: 'text', v: ' ' });
        body.push(P(glyph + runs(segs), 'left'));
      });
    });

    if (lista.gabarito && lista.questoes.some(q => q.correta >= 0)) {
      body.push(P(''));
      body.push(P('<w:r><w:rPr><w:rFonts w:ascii="Helvetica" w:hAnsi="Helvetica"/><w:b/></w:rPr><w:t>GABARITO</w:t></w:r>', 'center'));
      const start = Math.max(1, parseInt(lista.numeroInicial, 10) || 1);
      const items = lista.questoes.map((q, i) => (start + i) + '. ' + (q.correta >= 0 ? LETTERS[q.correta] : '–'));
      for (let i = 0; i < items.length; i += 5) body.push(P('<w:r><w:t xml:space="preserve">' + x(items.slice(i, i + 5).join('     ')) + '</w:t></w:r>', 'left'));
    }

    // documento
    let doc = await zip.file('word/document.xml').async('string');
    doc = doc.replace('{{BODY}}', body.join(''));
    zip.file('word/document.xml', doc);

    // cabeçalho
    const t = (lista.disciplina || '').toUpperCase(), p = (lista.professor || '').toUpperCase();
    let hdr = await zip.file('word/header1.xml').async('string');
    hdr = hdr.split('{{DISCIPLINA}}').join(x(t)).split('{{PROFESSOR}}').join(x(p));
    const ts = titleSize(t) * 2, ps = profSize(p) * 2;
    if (ts !== 36) hdr = hdr.split('<w:sz w:val="36"/>').join('<w:sz w:val="' + ts + '"/>').split('<w:szCs w:val="36"/>').join('<w:szCs w:val="' + ts + '"/>');
    if (ps !== 24) {
      // aplica tamanho só nas execuções com o nome do professor
      hdr = hdr.replace(new RegExp('(<w:r>(?:(?!</w:r>).)*?)(<w:t>' + x(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</w:t>)', 'g'), (m, a, b) => {
        if (/<w:rPr>/.test(a)) return a.replace('</w:rPr>', '<w:sz w:val="' + ps + '"/><w:szCs w:val="' + ps + '"/></w:rPr>') + b;
        return a + '<w:rPr><w:sz w:val="' + ps + '"/></w:rPr>' + b;
      });
    }
    zip.file('word/header1.xml', hdr);

    // imagens e relações
    let rels = await zip.file('word/_rels/document.xml.rels').async('string');
    const add = media.map(m => '<Relationship Id="' + m.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + m.file + '"/>').join('');
    rels = rels.replace('</Relationships>', add + '</Relationships>');
    zip.file('word/_rels/document.xml.rels', rels);
    for (const m of media) zip.file('word/media/' + m.file, m.b64, { base64: true });
    let ct = await zip.file('[Content_Types].xml').async('string');
    if (!/Extension="jpeg"/.test(ct)) ct = ct.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ');
    if (!/Extension="png"/.test(ct)) ct = ct.replace('<Default ', '<Default Extension="png" ContentType="image/png"/><Default ');
    zip.file('[Content_Types].xml', ct);

    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  }

  global.ListaDocx = { build };
})(window);
