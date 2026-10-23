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
    cidadeError: $('cidadeError'),
    dataError: $('dataError'),
    presidenteError: $('presidenteError'),
    coordenadorError: $('coordenadorError'),
    dataExtenso: $('dataExtenso'),
    termosError: $('termosError'),
    formNotice: $('formNotice'),
    generate: $('generate'),
    generateLabel: $('generateLabel'),
    generateCounter: $('generateCounter'),
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

  /* Campos que precisam estar preenchidos para liberar o diploma. */
  const REQUIRED_FIELDS = [
    { key: 'nome', el: 'nome', error: 'nomeError', message: 'Escreva o nome que vai aparecer no diploma.' },
    { key: 'cidade', el: 'cidade', error: 'cidadeError', message: 'Informe a cidade ou o estado.' },
    { key: 'data', el: 'data', error: 'dataError', message: 'Escolha a data do diploma.' },
    { key: 'presidente', el: 'presidente', error: 'presidenteError', message: 'Informe o nome da presidente.' },
    { key: 'coordenador', el: 'coordenador', error: 'coordenadorError', message: 'Informe o nome do coordenador geral.' }
  ];

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

  /** Depois de gerado, qualquer alteração exige gerar novamente. */
  function invalidateResult() {
    if (!state.generated) return;
    state.generated = false;
    els.result.hidden = true;
    if (state.lastBlobUrl) {
      URL.revokeObjectURL(state.lastBlobUrl);
      state.lastBlobUrl = null;
    }
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

  function isFilled(field) {
    return Boolean((els[field.el].value || '').trim());
  }

  /** Quantos campos obrigatórios (inclusive os termos) ainda faltam. */
  function pendingFields() {
    const missing = REQUIRED_FIELDS.filter((field) => !isFilled(field));
    if (!els.termos.checked) missing.push({ key: 'termos' });
    return missing;
  }

  function clearErrors() {
    REQUIRED_FIELDS.forEach((field) => {
      els[field.error].hidden = true;
      els[field.el].classList.remove('is-invalid');
      els[field.el].closest('.field').classList.remove('is-missing');
    });
    els.termosError.hidden = true;
    els.termos.closest('.check').classList.remove('is-missing');
  }

  /**
   * Bloqueia/libera o botão de gerar. O diploma só pode ser criado
   * quando todos os campos estiverem preenchidos e os termos aceitos.
   */
  function refreshGate() {
    const missing = pendingFields();
    const total = REQUIRED_FIELDS.length + 1;
    const ready = missing.length === 0;

    els.generate.disabled = !ready;
    els.generate.setAttribute('aria-disabled', String(!ready));

    if (ready) {
      els.formNotice.textContent = 'Tudo preenchido. Já pode gerar o seu diploma.';
      els.formNotice.classList.add('is-complete');
      els.generateCounter.textContent = '';
    } else {
      const falta = missing.length === 1 ? '1 campo pendente' : `${missing.length} campos pendentes`;
      els.formNotice.textContent =
        `Preencha todos os campos para liberar a geração do diploma (${total - missing.length} de ${total}).`;
      els.formNotice.classList.remove('is-complete');
      els.generateCounter.textContent = falta;

      /* marca suavemente o que falta, sem mostrar erro em vermelho */
      REQUIRED_FIELDS.forEach((field) => {
        const isEmpty = !isFilled(field);
        els[field.el].closest('.field').classList.toggle('is-missing', isEmpty && field.key === missing[0].key);
      });
      els.termos.closest('.check').classList.toggle('is-missing', !els.termos.checked && missing[0].key === 'termos');
    }

    return ready;
  }

  function validate() {
    clearErrors();
    const missing = pendingFields();
    if (!missing.length) return true;

    let firstFocus = null;

    REQUIRED_FIELDS.forEach((field) => {
      if (isFilled(field)) return;
      els[field.error].hidden = false;
      els[field.el].classList.add('is-invalid');
      els[field.el].closest('.field').classList.add('is-missing');
      if (!firstFocus) firstFocus = els[field.el];
    });

    if (!els.termos.checked) {
      els.termosError.hidden = false;
      els.termos.closest('.check').classList.add('is-missing');
      if (!firstFocus) firstFocus = els.termos;
    }

    if (firstFocus) firstFocus.focus();
    return false;
  }

  /* --------------------------- gerar --------------------------- */
  async function generate(event) {
    if (event) event.preventDefault();

    /* bloqueio: sem todos os campos + termos, nada de diploma */
    if (!refreshGate()) {
      validate();
      return;
    }
    if (!validate()) return;

    els.generate.disabled = true;
    els.generate.classList.add('is-busy');
    els.generateLabel.textContent = 'Gerando…';
    els.generateCounter.textContent = '';

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
      els.generate.classList.remove('is-busy');
      els.generateLabel.textContent = 'Gerar meu diploma';
      refreshGate();
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
        if (el.value.trim()) {
          els[key + 'Error'].hidden = true;
          el.classList.remove('is-invalid');
          el.closest('.field').classList.remove('is-missing');
        }
        invalidateResult();
        refreshGate();
        schedulePreview();
        saveToStorage();
      });
      el.addEventListener('change', () => {
        if (key === 'data') updateDateHint();
        invalidateResult();
        refreshGate();
        schedulePreview();
        saveToStorage();
      });
      el.addEventListener('blur', () => {
        if (!el.value.trim()) {
          els[key + 'Error'].hidden = false;
          el.classList.add('is-invalid');
        } else {
          els[key + 'Error'].hidden = true;
          el.classList.remove('is-invalid');
          el.closest('.field').classList.remove('is-missing');
        }
      });
    });

    els.termos.addEventListener('change', () => {
      if (els.termos.checked) {
        els.termosError.hidden = true;
        els.termos.closest('.check').classList.remove('is-missing');
      }
      invalidateResult();
      refreshGate();
    });

    await Promise.all([
      window.Certificate.ensureFonts(),
      document.fonts ? document.fonts.ready : Promise.resolve()
    ]);

    await drawPreview();
    refreshGate();
    document.body.classList.add('is-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
