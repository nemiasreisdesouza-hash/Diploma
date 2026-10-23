/* ============================================================
   Certificate renderer
   Desenha o Diploma de Honra ao Mérito (arte oficial) no canvas
   e posiciona os dados variáveis exatamente sobre os campos
   originais do modelo. Nenhum dado sai do navegador.
   ============================================================ */
(function (global) {
  'use strict';

  const WIDTH = 1536;
  const HEIGHT = 1024;

  /* Caminho da arte-base. WebP primeiro (mais leve), PNG como reserva. */
  const SOURCES = [
    'assets/img/diploma-base.webp',
    'assets/img/diploma-base.png'
  ];

  const COLORS = {
    name: '#12243f',
    date: '#1c2a3a',
    signature: '#16202f',
    signatureSub: '#26313f'
  };

  const LAYOUT = {
    name: {
      cx: 748,
      baseline: 566,
      size: 124,
      maxWidth: 700,
      minSize: 62,
      /* quando o nome não cabe em uma linha, ele é dividido em duas */
      twoLines: { bandTop: 476, bandBottom: 589, size: 82, minSize: 40, maxWidth: 660, lineStep: 1.04 }
    },
    date: { cx: 768, baseline: 795, size: 30, maxWidth: 442, minSize: 18 },
    signatureNames: {
      baseline: 880,
      size: 20.8,
      minSize: 15.4,
      maxWidth: 262,
      /* nomes longos viram duas linhas, empurrando o subtítulo um pouco para baixo */
      twoLines: { baselines: [874, 890], size: 15.4, minSize: 11.5, maxWidth: 258 }
    },
    signatureSubs: { baseline: 906, size: 16.6, minSize: 10.5, maxWidth: 252 },
    columns: [380, 772, 1164]
  };

  const FONTS = {
    name: (size) => `italic 500 ${size}px "Cormorant Garamond", Georgia, serif`,
    date: (size) => `400 ${size}px "EB Garamond", Georgia, serif`,
    signature: (size) => `600 ${size}px "EB Garamond", Georgia, serif`,
    signatureSub: (size) => `400 ${size}px "EB Garamond", Georgia, serif`
  };

  const MONTHS = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const REQUIRED_FONTS = [
    'italic 500 100px "Cormorant Garamond"',
    'italic 600 100px "Cormorant Garamond"',
    '400 100px "EB Garamond"',
    '600 100px "EB Garamond"'
  ];

  let templatePromise = null;
  let fontsPromise = null;

  /** Garante que as fontes do certificado estejam carregadas. */
  function ensureFonts() {
    if (!global.document || !global.document.fonts) return Promise.resolve();
    if (!fontsPromise) {
      fontsPromise = Promise.all(
        REQUIRED_FONTS.map((font) =>
          global.document.fonts.load(font).catch(() => null)
        )
      )
        .then(() => global.document.fonts.ready)
        .catch(() => null);
    }
    return fontsPromise;
  }

  /** Carrega (uma única vez) a arte-base do diploma. */
  function loadTemplate() {
    if (templatePromise) return templatePromise;

    templatePromise = new Promise((resolve, reject) => {
      const trySource = (index) => {
        if (index >= SOURCES.length) {
          reject(new Error('Não foi possível carregar a arte do diploma.'));
          return;
        }
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => trySource(index + 1);
        img.src = SOURCES[index];
      };
      trySource(0);
    });

    return templatePromise;
  }

  /** Formata uma data ISO (aaaa-mm-dd) como "23 de outubro de 2026". */
  function formatDate(isoDate) {
    if (!isoDate) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) return '';
    const day = Number(match[3]);
    const month = MONTHS[Number(match[2]) - 1];
    const year = match[1];
    if (!month) return '';
    return `${day} de ${month} de ${year}`;
  }

  /** "23 de outubro de 2026" (usado em textos auxiliares da página). */
  function formatDateLong(isoDate) {
    return formatDate(isoDate);
  }

  /** Data de hoje no formato do input date. */
  function todayISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  /** Normaliza os dados que vão para o diploma. */
  function normalize(data) {
    const city = (data.city || '').trim();
    const dateText = formatDate(data.date);
    const name = (data.name || '').trim();

    let dateLine = '';
    if (city && dateText) dateLine = `${city}, ${dateText}.`;
    else if (dateText) dateLine = `${dateText}.`;
    else if (city) dateLine = `${city}.`;

    return {
      name: name || 'Nome Completo',
      dateLine,
      president: (data.president || '').trim() || 'Nome da Presidente',
      coordinator: (data.coordinator || '').trim() || 'Nome do Coordenador Geral',
      honoree: name || 'Nome do Homenageado'
    };
  }

  function setFont(ctx, descriptor, size) {
    ctx.font = descriptor(size);
  }

  /**
   * Desenha texto centralizado reduzindo o corpo da fonte até caber.
   */
  function drawFitted(ctx, text, opts) {
    const { cx, baseline, color, font, size, minSize, maxWidth, tracking = 0 } = opts;
    let current = size;

    ctx.save();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;

    setFont(ctx, font, current);
    let measured = ctx.measureText(text).width;

    while (measured > maxWidth && current > minSize) {
      current -= Math.max(0.5, current * 0.012);
      setFont(ctx, font, current);
      measured = ctx.measureText(text).width;
    }

    ctx.fillText(text, cx, baseline);
    ctx.restore();
  }

  function measure(ctx, text, font, size, tracking = 0) {
    ctx.save();
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
    setFont(ctx, font, size);
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  }

  /** Divide o nome em duas linhas equilibradas (o mais parecido possível em largura). */
  function splitInTwoLines(text) {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 2) return null;

    let best = null;
    for (let i = 1; i < words.length; i += 1) {
      const top = words.slice(0, i).join(' ');
      const bottom = words.slice(i).join(' ');
      const score = Math.max(top.length, bottom.length);
      if (!best || score < best.score) best = { top, bottom, score };
    }
    return best;
  }

  /**
   * Desenha o nome do homenageado. Usa uma linha grande quando cabe;
   * para nomes longos, divide em duas linhas equilibradas.
   */
  function drawName(ctx, text, color) {
    const cfg = LAYOUT.name;
    const singleWidth = measure(ctx, text, FONTS.name, cfg.size);
    const singleSize = singleWidth <= cfg.maxWidth
      ? cfg.size
      : (cfg.size * cfg.maxWidth) / singleWidth;

    if (singleSize >= 76) {
      drawFitted(ctx, text, {
        cx: cfg.cx,
        baseline: cfg.baseline,
        color,
        font: FONTS.name,
        size: singleSize,
        minSize: cfg.minSize,
        maxWidth: cfg.maxWidth,
        tracking: -0.4
      });
      return;
    }

    const lines = splitInTwoLines(text);
    if (!lines) {
      drawFitted(ctx, text, {
        cx: cfg.cx,
        baseline: cfg.baseline,
        color,
        font: FONTS.name,
        size: singleSize,
        minSize: cfg.minSize,
        maxWidth: cfg.maxWidth,
        tracking: -0.4
      });
      return;
    }

    const two = cfg.twoLines;
    const laid = layoutTwoLines(ctx, [lines.top, lines.bottom], two) ||
      /* nomes muito longos: cai para uma linha bem reduzida dentro da faixa */
      layoutTwoLines(ctx, [lines.top, lines.bottom], {
        ...two,
        size: two.minSize,
        minSize: 28,
        maxWidth: cfg.maxWidth
      });

    if (!laid) return;

    laid.lines.forEach((line, index) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.3px';
      setFont(ctx, FONTS.name, laid.size);
      ctx.fillText(line, cfg.cx, laid.baselines[index]);
      ctx.restore();
    });
  }

  /**
   * Nome na linha de assinatura: uma linha se couber; senão, duas linhas.
   */
  function drawSignatureName(ctx, text, cx) {
    const cfg = LAYOUT.signatureNames;
    const width = measure(ctx, text, FONTS.signature, cfg.size);

    if (width <= cfg.maxWidth) {
      drawFitted(ctx, text, {
        cx,
        baseline: cfg.baseline,
        color: COLORS.signature,
        font: FONTS.signature,
        size: cfg.size,
        minSize: cfg.minSize,
        maxWidth: cfg.maxWidth,
        tracking: 0.1
      });
      return;
    }

    const parts = splitInTwoLines(text);
    const two = cfg.twoLines;
    const fitsTwo = parts && Math.max(
      measure(ctx, parts.top, FONTS.signature, two.size),
      measure(ctx, parts.bottom, FONTS.signature, two.size)
    ) <= two.maxWidth;

    if (fitsTwo) {
      [parts.top, parts.bottom].forEach((line, i) => {
        drawFitted(ctx, line, {
          cx,
          baseline: two.baselines[i],
          color: COLORS.signature,
          font: FONTS.signature,
          size: two.size,
          minSize: two.minSize,
          maxWidth: two.maxWidth,
          tracking: 0.1
        });
      });
      return;
    }

    drawFitted(ctx, text, {
      cx,
      baseline: cfg.baseline,
      color: COLORS.signature,
      font: FONTS.signature,
      size: cfg.size,
      minSize: 11,
      maxWidth: cfg.maxWidth,
      tracking: 0.1
    });
  }

  /**
   * Ajusta duas linhas de nome dentro de uma faixa vertical fixa,
   * reduzindo o corpo até caber em largura e altura.
   */
  function layoutTwoLines(ctx, lines, cfg) {
    for (let size = cfg.size; size >= cfg.minSize; size -= 0.5) {
      ctx.save();
      setFont(ctx, FONTS.name, size);
      const widths = lines.map((line) => ctx.measureText(line).width);
      const m1 = ctx.measureText(lines[0]);
      const m2 = ctx.measureText(lines[1]);
      const ascent = m1.actualBoundingBoxAscent || size * 0.72;
      const descent = m2.actualBoundingBoxDescent || size * 0.26;
      ctx.restore();

      const step = size * cfg.lineStep;
      const blockHeight = ascent + step + descent;
      const fitsWidth = Math.max(...widths) <= cfg.maxWidth;
      const fitsHeight = blockHeight <= cfg.bandBottom - cfg.bandTop;

      if (fitsWidth && fitsHeight) {
        const top = cfg.bandTop + (cfg.bandBottom - cfg.bandTop - blockHeight) / 2;
        const b1 = top + ascent;
        return { size, lines, baselines: [b1, b1 + step] };
      }
    }
    return null;
  }

  /**
   * Renderiza o diploma completo em um canvas existente.
   * @param {HTMLCanvasElement} canvas
   * @param {object} rawData
   * @param {number} scale 1 = 1536×1024, 2 = 3072×2048
   */
  async function render(canvas, rawData, scale = 1) {
    const [img] = await Promise.all([loadTemplate(), ensureFonts()]);
    const data = normalize(rawData || {});

    const w = Math.round(WIDTH * scale);
    const h = Math.round(HEIGHT * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    /* Arte do certificado */
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    /* Trabalha em coordenadas de projeto (1536×1024) */
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    /* Nome do homenageado */
    drawName(ctx, data.name, COLORS.name);

    /* Cidade e data */
    if (data.dateLine) {
      drawFitted(ctx, data.dateLine, {
        cx: LAYOUT.date.cx,
        baseline: LAYOUT.date.baseline,
        color: COLORS.date,
        font: FONTS.date,
        size: LAYOUT.date.size,
        minSize: LAYOUT.date.minSize,
        maxWidth: LAYOUT.date.maxWidth,
        tracking: 0.2
      });
    }

    /* Assinaturas */
    const people = [data.president, data.coordinator, data.honoree];
    const subs = [
      'Direita Espírito Santo Oficial',
      'Direita Espírito Santo Oficial',
      '(por sua honrosa contribuição)'
    ];

    LAYOUT.columns.forEach((cx, index) => {
      drawSignatureName(ctx, people[index], cx);

      drawFitted(ctx, subs[index], {
        cx,
        baseline: LAYOUT.signatureSubs.baseline,
        color: COLORS.signatureSub,
        font: FONTS.signatureSub,
        size: LAYOUT.signatureSubs.size,
        minSize: LAYOUT.signatureSubs.minSize,
        maxWidth: LAYOUT.signatureSubs.maxWidth,
        tracking: 0.1
      });
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas;
  }

  /** Gera um canvas avulso em alta resolução e devolve como Blob PNG. */
  async function toPNGBlob(rawData, scale = 2) {
    const canvas = document.createElement('canvas');
    await render(canvas, rawData, scale);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao gerar a imagem.'));
      }, 'image/png');
    });
  }

  function slugify(text) {
    return (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  function fileName(rawData) {
    const name = (rawData && rawData.name) || '';
    const slug = slugify(name);
    return `diploma-de-honra${slug ? '-' + slug : ''}.png`;
  }

  global.Certificate = {
    WIDTH,
    HEIGHT,
    COLORS,
    LAYOUT,
    loadTemplate,
    ensureFonts,
    render,
    toPNGBlob,
    formatDate,
    formatDateLong,
    todayISO,
    normalize,
    fileName
  };
})(window);
