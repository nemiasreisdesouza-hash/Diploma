/* ============================================================
   Diploma de Honra — lógica da interface
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    canvas: $('previewCanvas'),
    viewport: $('viewport'),
    zoomIn: $('zoomIn'),
    zoomOut: $('zoomOut'),
    resetView: $('resetView'),
    form: $('form'),
    nome: $('nome'),
    cidade: $('cidade'),
    data: $('data'),
    presidente: $('presidente'),
    coordenador: $('coordenador'),
    termos: $('termos'),
    nomeError: $('nomeError'),
    dataExtenso: $('dataExtenso'),
    termosError: $('termosError'),
    generate: $('generate'),
    result: $('result'),
    resultText: $('resultText'),
    download: $('download'),
    share: $('share'),
    print: $('print'),
    openTerms: $('openTerms'),
    closeTerms: $('closeTerms'),
    terms: $('terms')
  };

  const STORAGE_KEY = 'diploma-de-honra:dados';

  const state = {
    zoom: 1,
    tx: 0,
    ty: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    generated: false,
    lastBlobUrl: null
  };

  /* --------------------------- dados --------------------------- */
  function readForm() {
    return {
      name: els.nome.value,
      city: els.cidade.value,
      date: els.data.value,
      president: els.presidente.value,
      coordinator: els.coordenador.value
    };
  }

  function saveToStorage() {
    try {
      const data = readForm();
      delete data.name;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* modo privado */ }
  }

  function restoreFromStorage() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch { saved = null; }

    if (saved) {
      if (saved.city) els.cidade.value = saved.city;
      if (saved.date) els.data.value = saved.date;
      if (saved.president) els.presidente.value = saved.president;
      if (saved.coordinator) els.coordenador.value = saved.coordinator;
    } else {
      els.cidade.value = 'Vitória/ES';
      els.data.value = window.Certificate.todayISO();
    }
  }

  /* --------------------------- prévia -------------------------- */
  let renderToken = 0;
  let renderTimer = null;

  async function drawPreview() {
    const token = ++renderToken;
    await window.Certificate.render(els.canvas, readForm(), 1);
    if (token !== renderToken) return;
  }

  function updateDateHint() {
    const iso = els.data.value;
    const long = iso ? window.Certificate.formatDateLong(iso) : '';
    els.dataExtenso.textContent = long;
  }

  function schedulePreview() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(drawPreview, 90);
  }

  /* --------------------------- zoom/pan ------------------------ */
  function applyTransform(animate = true) {
    els.canvas.style.transition = animate ? '' : 'none';
    els.canvas.style.transform =
      `translate(${state.tx}px, ${state.ty}px) scale(${state.zoom})`;
  }

  function clampPan() {
    const rect = els.viewport.getBoundingClientRect();
    const maxX = (rect.width * (state.zoom - 1)) / 2;
    const maxY = (rect.height * (state.zoom - 1)) / 2;
    state.tx = Math.max(-maxX, Math.min(maxX, state.tx));
    state.ty = Math.max(-maxY, Math.min(maxY, state.ty));
  }

  function setZoom(next, anchor) {
    const wasZoomed = state.zoom > 1.001;
    state.zoom = Math.max(1, Math.min(3, next));
    state.zoom = Math.round(state.zoom * 100) / 100;

    if (state.zoom === 1) {
      state.tx = 0;
      state.ty = 0;
    } else if (anchor) {
      const rect = els.viewport.getBoundingClientRect();
      const cx = anchor.x - rect.left - rect.width / 2;
      const cy = anchor.y - rect.top - rect.height / 2;
      state.tx = cx - (cx - state.tx) * (state.zoom / (wasZoomed ? state.zoom : 1));
      state.ty = cy - (cy - state.ty) * (state.zoom / (wasZoomed ? state.zoom : 1));
    }

    clampPan();
    applyTransform();
    updateZoomUI();
  }

  function updateZoomUI() {
    const zoomed = state.zoom > 1.001;
    els.viewport.classList.toggle('is-zoomed', zoomed);
    els.zoomIn.disabled = state.zoom >= 3;
    els.zoomOut.disabled = state.zoom <= 1;
    if (zoomed) {
      els.resetView.textContent = 'Voltar ao tamanho normal';
    } else {
      els.resetView.innerHTML =
        'Arraste a imagem e use <b>+</b> e <b>−</b> para ajustar o zoom';
    }
  }

  function bindZoomPan() {
    els.zoomIn.addEventListener('click', () => setZoom(state.zoom + 0.35));
    els.zoomOut.addEventListener('click', () => setZoom(state.zoom - 0.35));

    els.resetView.addEventListener('click', () => {
      if (state.zoom > 1.001) setZoom(1);
      else setZoom(1.5);
    });

    els.viewport.addEventListener('pointerdown', (event) => {
      if (state.zoom <= 1.001) return;
      state.dragging = true;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.originX = state.tx;
      state.originY = state.ty;
      els.viewport.classList.add('is-dragging');
      els.viewport.setPointerCapture(event.pointerId);
    });

    els.viewport.addEventListener('pointermove', (event) => {
      if (!state.dragging) return;
      state.tx = state.originX + (event.clientX - state.startX);
      state.ty = state.originY + (event.clientY - state.startY);
      clampPan();
      applyTransform(false);
    });

    const endDrag = (event) => {
      if (!state.dragging) return;
      state.dragging = false;
      els.viewport.classList.remove('is-dragging');
      if (event && event.pointerId != null && els.viewport.hasPointerCapture(event.pointerId)) {
        els.viewport.releasePointerCapture(event.pointerId);
      }
      applyTransform();
    };
    els.viewport.addEventListener('pointerup', endDrag);
    els.viewport.addEventListener('pointercancel', endDrag);

    els.viewport.addEventListener('dblclick', () => {
      setZoom(state.zoom > 1.001 ? 1 : 1.8);
    });

    window.addEventListener('resize', () => {
      clampPan();
      applyTransform(false);
    });

    updateZoomUI();
  }

  /* --------------------------- validação ----------------------- */
  function clearErrors() {
    els.nomeError.hidden = true;
    els.termosError.hidden = true;
    els.nome.classList.remove('is-invalid');
  }

  function validate() {
    clearErrors();
    let valid = true;

    if (!els.nome.value.trim()) {
      els.nomeError.hidden = false;
      els.nome.classList.add('is-invalid');
      els.nome.focus();
      valid = false;
    }

    if (!els.termos.checked) {
      els.termosError.hidden = false;
      if (valid) els.termos.focus();
      valid = false;
    }

    return valid;
  }

  /* --------------------------- gerar --------------------------- */
  async function generate(event) {
    if (event) event.preventDefault();
    if (!validate()) return;

    els.generate.disabled = true;
    els.generate.textContent = 'Gerando…';

    try {
      await window.Certificate.ensureFonts();
      const data = readForm();
      await window.Certificate.render(els.canvas, data, 1);

      const blob = await window.Certificate.toPNGBlob(data, 2);
      if (state.lastBlobUrl) URL.revokeObjectURL(state.lastBlobUrl);
      state.lastBlobUrl = URL.createObjectURL(blob);
      state.generated = true;

      const prettyName = data.name.trim();
      els.resultText.textContent = `Diploma gerado para ${prettyName}.`;
      els.result.hidden = false;
      saveToStorage();

      els.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      console.error(err);
      els.result.hidden = false;
      els.resultText.textContent = 'Não foi possível gerar agora. Tente novamente.';
      els.resultNote.textContent = '';
    } finally {
      els.generate.disabled = false;
      els.generate.textContent = 'Gerar meu diploma';
    }
  }

  /* --------------------------- download ------------------------ */
  async function download() {
    if (!validate()) return;

    els.download.disabled = true;
    try {
      await window.Certificate.ensureFonts();
      const data = readForm();
      const blob = await window.Certificate.toPNGBlob(data, 2);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = window.Certificate.fileName(data);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      els.download.disabled = false;
    }
  }

  /* --------------------------- compartilhar -------------------- */
  async function share() {
    if (!validate()) return;
    const data = readForm();

    try {
      await window.Certificate.ensureFonts();
      const blob = await window.Certificate.toPNGBlob(data, 2);
      const file = new File([blob], window.Certificate.fileName(data), { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Diploma de Honra ao Mérito',
          text: `Diploma de Honra ao Mérito de ${data.name.trim()}.`
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: 'Diploma de Honra ao Mérito',
          text: `Diploma de Honra ao Mérito de ${data.name.trim()}.`
        });
        return;
      }

      await download();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error(err);
      await download();
    }
  }

  /* --------------------------- imprimir ------------------------ */
  async function print() {
    if (!validate()) return;

    els.print.disabled = true;
    try {
      await window.Certificate.ensureFonts();
      const data = readForm();
      const blob = await window.Certificate.toPNGBlob(data, 2);
      const url = URL.createObjectURL(blob);

      const win = window.open('', '_blank');
      if (!win) {
        URL.revokeObjectURL(url);
        await download();
        return;
      }

      win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Diploma de Honra — A4</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; height: 100%; background: #fff; }
  body { display: grid; place-items: center; }
  img { width: 100vw; height: auto; max-height: 100vh; object-fit: contain; }
  @media print { img { width: 100%; } }
</style>
</head>
<body>
  <img src="${url}" alt="Diploma de Honra ao Mérito" onload="window.focus(); window.print();" />
</body>
</html>`);
      win.document.close();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error(err);
    } finally {
      els.print.disabled = false;
    }
  }

  /* --------------------------- termos -------------------------- */
  function bindTerms() {
    const open = () => {
      if (typeof els.terms.showModal === 'function') els.terms.showModal();
      else els.terms.setAttribute('open', '');
    };
    const close = () => {
      if (typeof els.terms.close === 'function') els.terms.close();
      else els.terms.removeAttribute('open');
    };

    els.openTerms.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      open();
    });
    els.closeTerms.addEventListener('click', close);
    els.terms.addEventListener('click', (event) => {
      if (event.target === els.terms) close();
    });
  }

  /* --------------------------- início -------------------------- */
  async function boot() {
    restoreFromStorage();
    updateDateHint();
    bindZoomPan();
    bindTerms();

    els.form.addEventListener('submit', generate);
    els.download.addEventListener('click', download);
    els.share.addEventListener('click', share);
    els.print.addEventListener('click', print);

    ['nome', 'cidade', 'data', 'presidente', 'coordenador'].forEach((key) => {
      const el = els[key];
      el.addEventListener('input', () => {
        if (key === 'data') updateDateHint();
        if (key === 'nome' && el.value.trim()) {
          els.nomeError.hidden = true;
          els.nome.classList.remove('is-invalid');
        }
        schedulePreview();
        saveToStorage();
      });
      el.addEventListener('change', () => {
        if (key === 'data') updateDateHint();
        schedulePreview();
        saveToStorage();
      });
    });

    els.termos.addEventListener('change', () => {
      if (els.termos.checked) els.termosError.hidden = true;
    });

    await Promise.all([
      window.Certificate.ensureFonts(),
      document.fonts ? document.fonts.ready : Promise.resolve()
    ]);

    await drawPreview();
    document.body.classList.add('is-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
