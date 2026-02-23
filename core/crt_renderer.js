(function bootstrapCrtRenderer(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const crtConfig = ns.CONSTS?.RENDER?.CRT || {};

  if (!resizeCanvasToDisplaySize) {
    throw new Error('CRT renderer requires canvas utils. Load core/canvas_utils.js first.');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function num(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function createScanlinePattern(cfg) {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(0, 0, 0, ${cfg.scanlinePatternDarkA})`;
    ctx.fillRect(0, 0, 2, 1);
    ctx.fillStyle = `rgba(255, 255, 255, ${cfg.scanlinePatternLight})`;
    ctx.fillRect(0, 1, 2, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${cfg.scanlinePatternDarkB})`;
    ctx.fillRect(0, 2, 2, 1);
    return ctx.createPattern(canvas, 'repeat');
  }

  function createMaskPattern(cfg) {
    const canvas = document.createElement('canvas');
    canvas.width = 6;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgba(255, 0, 0, ${cfg.maskPatternRed})`;
    ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = `rgba(0, 255, 0, ${cfg.maskPatternGreen})`;
    ctx.fillRect(2, 0, 2, 2);
    ctx.fillStyle = `rgba(0, 110, 255, ${cfg.maskPatternBlue})`;
    ctx.fillRect(4, 0, 2, 2);
    return ctx.createPattern(canvas, 'repeat');
  }

  class CrtRenderer {
    constructor({ screenCanvas }) {
      if (!screenCanvas) {
        throw new Error('CrtRenderer requires screenCanvas.');
      }

      this.screenCanvas = screenCanvas;
      this.screenCtx = screenCanvas.getContext('2d');
      if (!this.screenCtx) {
        throw new Error('CrtRenderer requires 2D context.');
      }

      this.gameCanvas = document.createElement('canvas');
      this.gameCtx = this.gameCanvas.getContext('2d');
      if (!this.gameCtx) {
        throw new Error('CrtRenderer failed to create hidden game canvas context.');
      }

      // Hint for resize util: hidden game canvas should match this visible canvas size.
      this.gameCanvas.__displaySourceCanvas = this.screenCanvas;

      this.trailCanvas = document.createElement('canvas');
      this.trailCtx = this.trailCanvas.getContext('2d');
      if (!this.trailCtx) {
        throw new Error('CrtRenderer failed to create trail canvas context.');
      }

      this.fxCanvas = document.createElement('canvas');
      this.fxCtx = this.fxCanvas.getContext('2d');
      if (!this.fxCtx) {
        throw new Error('CrtRenderer failed to create compose canvas context.');
      }

      this.tmpCanvas = document.createElement('canvas');
      this.tmpCtx = this.tmpCanvas.getContext('2d');
      if (!this.tmpCtx) {
        throw new Error('CrtRenderer failed to create tmp canvas context.');
      }

      this.pixelCanvas = document.createElement('canvas');
      this.pixelCtx = this.pixelCanvas.getContext('2d');
      if (!this.pixelCtx) {
        throw new Error('CrtRenderer failed to create pixel canvas context.');
      }

      this.cfg = {
        pixelScale: num(crtConfig.pixelScale, 0.25),
        pixelMinWidth: num(crtConfig.pixelMinWidth, 120),
        pixelMaxWidth: num(crtConfig.pixelMaxWidth, 320),
        pixelMinHeight: num(crtConfig.pixelMinHeight, 90),
        pixelMaxHeight: num(crtConfig.pixelMaxHeight, 250),

        trailMixAlpha: num(crtConfig.trailMixAlpha, 0.2),
        trailFadeAlpha: num(crtConfig.trailFadeAlpha, 0.22),
        trailPersistAlpha: num(crtConfig.trailPersistAlpha, 0.92),

        bloomOffset: num(crtConfig.bloomOffset, 2),
        bloomXAlpha: num(crtConfig.bloomXAlpha, 0.13),
        bloomYAlpha: num(crtConfig.bloomYAlpha, 0.08),

        scanlinePatternDarkA: num(crtConfig.scanlinePatternDarkA, 0.2),
        scanlinePatternLight: num(crtConfig.scanlinePatternLight, 0.02),
        scanlinePatternDarkB: num(crtConfig.scanlinePatternDarkB, 0.12),
        scanlineAlphaBase: num(crtConfig.scanlineAlphaBase, 0.4),
        scanlineAlphaWave: num(crtConfig.scanlineAlphaWave, 0.03),
        scanlineWaveFreq: num(crtConfig.scanlineWaveFreq, 24),

        maskPatternRed: num(crtConfig.maskPatternRed, 0.06),
        maskPatternGreen: num(crtConfig.maskPatternGreen, 0.05),
        maskPatternBlue: num(crtConfig.maskPatternBlue, 0.06),
        maskAlpha: num(crtConfig.maskAlpha, 0.21),

        sweepSpeed: num(crtConfig.sweepSpeed, 78),
        sweepTravelPadding: num(crtConfig.sweepTravelPadding, 180),
        sweepHalfHeight: num(crtConfig.sweepHalfHeight, 50),
        sweepPeakAlpha: num(crtConfig.sweepPeakAlpha, 0.075),

        noiseSize: num(crtConfig.noiseSize, 96),
        noiseRefreshSec: num(crtConfig.noiseRefreshSec, 0.045),
        noisePixelAlpha: num(crtConfig.noisePixelAlpha, 34),
        noiseAlpha: num(crtConfig.noiseAlpha, 0.09),
        staticLineChance: num(crtConfig.staticLineChance, 0.2),
        staticLineMinAlpha: num(crtConfig.staticLineMinAlpha, 0.03),
        staticLineMaxAlpha: num(crtConfig.staticLineMaxAlpha, 0.08),

        vignetteInnerRadius: num(crtConfig.vignetteInnerRadius, 0.16),
        vignetteOuterRadius: num(crtConfig.vignetteOuterRadius, 0.82),
        vignetteMidStop: num(crtConfig.vignetteMidStop, 0.72),
        vignetteMidAlpha: num(crtConfig.vignetteMidAlpha, 0.22),
        vignetteOuterAlpha: num(crtConfig.vignetteOuterAlpha, 0.62),

        flickerBase: num(crtConfig.flickerBase, 0.982),
        flickerWaveA: num(crtConfig.flickerWaveA, 0.012),
        flickerWaveAFreq: num(crtConfig.flickerWaveAFreq, 59),
        flickerWaveB: num(crtConfig.flickerWaveB, 0.006),
        flickerWaveBFreq: num(crtConfig.flickerWaveBFreq, 19),
        flickerMaxAlpha: num(crtConfig.flickerMaxAlpha, 0.03),

        screenMarginBase: num(crtConfig.screenMarginBase, 8),
        borderRadiusFactor: num(crtConfig.borderRadiusFactor, 0.065),
        borderRadiusMin: num(crtConfig.borderRadiusMin, 24),
        borderStrokeAlpha: num(crtConfig.borderStrokeAlpha, 0.06),
        borderStrokeWidthDpr: num(crtConfig.borderStrokeWidthDpr, 2),
        edgeDarkOuterAlpha: num(crtConfig.edgeDarkOuterAlpha, 0.3),
        edgeDarkInnerAlpha: num(crtConfig.edgeDarkInnerAlpha, 0.04),

        rowStepDprFactor: num(crtConfig.rowStepDprFactor, 2),
        curvatureReferenceWidth: num(crtConfig.curvatureReferenceWidth, 700),
        curvatureBase: num(crtConfig.curvatureBase, 0.082),
        curvatureScale: num(crtConfig.curvatureScale, 0.00006),
        curvatureMin: num(crtConfig.curvatureMin, 0.082),
        curvatureMax: num(crtConfig.curvatureMax, 0.13),
        wobbleAmplitudeDpr: num(crtConfig.wobbleAmplitudeDpr, 0.45),
        wobbleFrequency: num(crtConfig.wobbleFrequency, 14),
        wobbleSpeed: num(crtConfig.wobbleSpeed, 1.4),
      };

      this.noiseCanvas = document.createElement('canvas');
      this.noiseCanvas.width = Math.max(16, Math.floor(this.cfg.noiseSize));
      this.noiseCanvas.height = Math.max(16, Math.floor(this.cfg.noiseSize));
      this.noiseCtx = this.noiseCanvas.getContext('2d');
      if (!this.noiseCtx) {
        throw new Error('CrtRenderer failed to create noise canvas context.');
      }

      this.width = 1;
      this.height = 1;
      this.outputWidth = 1;
      this.outputHeight = 1;
      this.dpr = 1;

      this.isRunning = false;
      this.frameId = null;
      this.renderHook = null;
      this.lastTimestamp = 0;
      this.noiseTimer = 0;

      this.scanlinePattern = createScanlinePattern(this.cfg);
      this.maskPattern = createMaskPattern(this.cfg);

      this.boundFrame = this.frame.bind(this);
      this.boundResize = this.onResize.bind(this);
    }

    getGameCanvas() {
      return this.gameCanvas;
    }

    setRenderHook(hook) {
      this.renderHook = typeof hook === 'function' ? hook : null;
    }

    start() {
      if (this.isRunning) {
        return;
      }

      this.isRunning = true;
      this.ensureSize();
      window.addEventListener('resize', this.boundResize);
      this.lastTimestamp = performance.now();
      this.frameId = requestAnimationFrame(this.boundFrame);
    }

    stop() {
      if (this.frameId !== null) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }

      window.removeEventListener('resize', this.boundResize);
      this.isRunning = false;
      this.renderHook = null;
    }

    clear() {
      this.ensureSize();
      this.gameCtx.clearRect(0, 0, this.width, this.height);
      this.trailCtx.clearRect(0, 0, this.outputWidth, this.outputHeight);
      this.fxCtx.clearRect(0, 0, this.outputWidth, this.outputHeight);
      this.tmpCtx.clearRect(0, 0, this.outputWidth, this.outputHeight);
      this.screenCtx.clearRect(0, 0, this.outputWidth, this.outputHeight);
    }

    onResize() {
      this.ensureSize();
    }

    ensureSize() {
      const viewport = resizeCanvasToDisplaySize(this.screenCanvas, null);
      this.width = viewport.width;
      this.height = viewport.height;
      this.dpr = viewport.dpr;

      const targetW = this.screenCanvas.width;
      const targetH = this.screenCanvas.height;
      this.outputWidth = targetW;
      this.outputHeight = targetH;

      if (this.gameCanvas.width !== targetW || this.gameCanvas.height !== targetH) {
        this.gameCanvas.width = targetW;
        this.gameCanvas.height = targetH;
        this.gameCanvas.style.width = `${this.width}px`;
        this.gameCanvas.style.height = `${this.height}px`;
      }

      if (this.trailCanvas.width !== targetW || this.trailCanvas.height !== targetH) {
        this.trailCanvas.width = targetW;
        this.trailCanvas.height = targetH;
      }
      if (this.fxCanvas.width !== targetW || this.fxCanvas.height !== targetH) {
        this.fxCanvas.width = targetW;
        this.fxCanvas.height = targetH;
      }
      if (this.tmpCanvas.width !== targetW || this.tmpCanvas.height !== targetH) {
        this.tmpCanvas.width = targetW;
        this.tmpCanvas.height = targetH;
      }

      const pixelW = clamp(
        Math.round(this.width * this.cfg.pixelScale),
        this.cfg.pixelMinWidth,
        this.cfg.pixelMaxWidth
      );
      const pixelH = clamp(
        Math.round((pixelW / Math.max(1, this.width)) * this.height),
        this.cfg.pixelMinHeight,
        this.cfg.pixelMaxHeight
      );
      if (this.pixelCanvas.width !== pixelW || this.pixelCanvas.height !== pixelH) {
        this.pixelCanvas.width = pixelW;
        this.pixelCanvas.height = pixelH;
      }

      this.screenCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.gameCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.trailCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.fxCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.tmpCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.pixelCtx.setTransform(1, 0, 0, 1, 0, 0);

      this.screenCtx.imageSmoothingEnabled = false;
      this.trailCtx.imageSmoothingEnabled = false;
      this.fxCtx.imageSmoothingEnabled = false;
      this.tmpCtx.imageSmoothingEnabled = false;
      this.pixelCtx.imageSmoothingEnabled = false;
    }

    frame(timestamp) {
      if (!this.isRunning) {
        return;
      }

      this.ensureSize();

      if (this.renderHook) {
        this.renderHook();
      }

      const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;
      this.composeFrame(dt, timestamp * 0.001);

      this.frameId = requestAnimationFrame(this.boundFrame);
    }

    refreshNoise() {
      const w = this.noiseCanvas.width;
      const h = this.noiseCanvas.height;
      const image = this.noiseCtx.createImageData(w, h);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = clamp(Math.round(this.cfg.noisePixelAlpha), 0, 255);
      }
      this.noiseCtx.putImageData(image, 0, 0);
    }

    composeFrame(dt, tSec) {
      const w = this.outputWidth;
      const h = this.outputHeight;

      if (w <= 0 || h <= 0) {
        return;
      }

      const fx = this.fxCtx;
      const tmp = this.tmpCtx;
      const sctx = this.screenCtx;
      const trail = this.trailCtx;
      const pixel = this.pixelCtx;

      // 1) Downscale game frame to low-res buffer (explicit pixelation stage).
      pixel.clearRect(0, 0, this.pixelCanvas.width, this.pixelCanvas.height);
      pixel.imageSmoothingEnabled = true;
      pixel.drawImage(this.gameCanvas, 0, 0, this.gameCanvas.width, this.gameCanvas.height, 0, 0, this.pixelCanvas.width, this.pixelCanvas.height);

      // 2) Compose CRT frame on fx buffer.
      fx.fillStyle = '#000';
      fx.fillRect(0, 0, w, h);

      fx.globalAlpha = this.cfg.trailMixAlpha;
      fx.drawImage(this.trailCanvas, 0, 0, w, h);
      fx.globalAlpha = 1;

      fx.imageSmoothingEnabled = false;
      fx.drawImage(this.pixelCanvas, 0, 0, w, h);

      // Glow / bloom from low-res source.
      fx.globalCompositeOperation = 'lighter';
      fx.globalAlpha = this.cfg.bloomXAlpha;
      fx.drawImage(this.pixelCanvas, -this.cfg.bloomOffset, 0, w + this.cfg.bloomOffset * 2, h);
      fx.drawImage(this.pixelCanvas, this.cfg.bloomOffset, 0, w + this.cfg.bloomOffset * 2, h);
      fx.globalAlpha = this.cfg.bloomYAlpha;
      fx.drawImage(this.pixelCanvas, 0, -this.cfg.bloomOffset, w, h + this.cfg.bloomOffset * 2);
      fx.drawImage(this.pixelCanvas, 0, this.cfg.bloomOffset, w, h + this.cfg.bloomOffset * 2);
      fx.globalAlpha = 1;
      fx.globalCompositeOperation = 'source-over';

      // Scanline and shadow mask.
      if (this.scanlinePattern) {
        fx.globalAlpha = this.cfg.scanlineAlphaBase + Math.sin(tSec * this.cfg.scanlineWaveFreq) * this.cfg.scanlineAlphaWave;
        fx.fillStyle = this.scanlinePattern;
        fx.fillRect(0, 0, w, h);
        fx.globalAlpha = 1;
      }
      if (this.maskPattern) {
        fx.globalAlpha = this.cfg.maskAlpha;
        fx.fillStyle = this.maskPattern;
        fx.fillRect(0, 0, w, h);
        fx.globalAlpha = 1;
      }

      // Rolling beam.
      const sweepY = ((tSec * this.cfg.sweepSpeed) % (h + this.cfg.sweepTravelPadding)) - this.cfg.sweepTravelPadding * 0.5;
      const sweep = fx.createLinearGradient(0, sweepY - this.cfg.sweepHalfHeight, 0, sweepY + this.cfg.sweepHalfHeight);
      sweep.addColorStop(0, 'rgba(255,255,255,0)');
      sweep.addColorStop(0.5, `rgba(255,255,255,${this.cfg.sweepPeakAlpha})`);
      sweep.addColorStop(1, 'rgba(255,255,255,0)');
      fx.fillStyle = sweep;
      fx.fillRect(0, sweepY - this.cfg.sweepHalfHeight, w, this.cfg.sweepHalfHeight * 2);

      // Grain/noise refresh.
      this.noiseTimer -= dt;
      if (this.noiseTimer <= 0) {
        this.noiseTimer = this.cfg.noiseRefreshSec;
        this.refreshNoise();
      }
      fx.globalAlpha = this.cfg.noiseAlpha;
      fx.imageSmoothingEnabled = false;
      fx.drawImage(this.noiseCanvas, 0, 0, w, h);
      fx.globalAlpha = 1;

      // Occasional horizontal static lines.
      if (Math.random() < this.cfg.staticLineChance) {
        const y = Math.floor(Math.random() * h);
        const lineH = Math.max(1, Math.floor(this.dpr));
        const alpha = this.cfg.staticLineMinAlpha + Math.random() * (this.cfg.staticLineMaxAlpha - this.cfg.staticLineMinAlpha);
        fx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        fx.fillRect(0, y, w, lineH);
      }

      // Vignette.
      const vignette = fx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * this.cfg.vignetteInnerRadius,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * this.cfg.vignetteOuterRadius
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(this.cfg.vignetteMidStop, `rgba(0,0,0,${this.cfg.vignetteMidAlpha})`);
      vignette.addColorStop(1, `rgba(0,0,0,${this.cfg.vignetteOuterAlpha})`);
      fx.fillStyle = vignette;
      fx.fillRect(0, 0, w, h);

      // Small global flicker.
      const flicker = this.cfg.flickerBase + Math.sin(tSec * this.cfg.flickerWaveAFreq) * this.cfg.flickerWaveA + Math.sin(tSec * this.cfg.flickerWaveBFreq) * this.cfg.flickerWaveB;
      const flickerAlpha = clamp(1 - flicker, 0, this.cfg.flickerMaxAlpha);
      if (flickerAlpha > 0) {
        fx.fillStyle = `rgba(0, 0, 0, ${flickerAlpha.toFixed(4)})`;
        fx.fillRect(0, 0, w, h);
      }

      // Save composed frame for persistence.
      trail.globalCompositeOperation = 'source-over';
      trail.fillStyle = `rgba(0,0,0,${this.cfg.trailFadeAlpha})`;
      trail.fillRect(0, 0, w, h);
      trail.globalAlpha = this.cfg.trailPersistAlpha;
      trail.drawImage(this.fxCanvas, 0, 0, w, h);
      trail.globalAlpha = 1;

      // 3) Curvature pass to screen.
      tmp.clearRect(0, 0, w, h);
      tmp.drawImage(this.fxCanvas, 0, 0);

      sctx.fillStyle = '#000';
      sctx.fillRect(0, 0, w, h);

      const margin = Math.max(8, Math.floor(this.cfg.screenMarginBase * this.dpr));
      const radius = Math.max(this.cfg.borderRadiusMin, Math.floor(Math.min(w, h) * this.cfg.borderRadiusFactor));
      sctx.save();
      this.roundedRectPath(sctx, margin, margin, w - margin * 2, h - margin * 2, radius);
      sctx.clip();

      const rowStep = Math.max(1, Math.floor(this.cfg.rowStepDprFactor * this.dpr));
      const curvature = clamp(
        this.cfg.curvatureBase + (this.width - this.cfg.curvatureReferenceWidth) * this.cfg.curvatureScale,
        this.cfg.curvatureMin,
        this.cfg.curvatureMax
      );
      for (let y = 0; y < h; y += rowStep) {
        const ny = (y / Math.max(1, h - 1)) * 2 - 1;
        const shrink = 1 - (ny * ny) * curvature;
        const dstW = w * shrink;
        const wobble = Math.sin((y / Math.max(1, h)) * this.cfg.wobbleFrequency + tSec * this.cfg.wobbleSpeed) * (this.cfg.wobbleAmplitudeDpr * this.dpr);
        const x = (w - dstW) * 0.5 + wobble;
        sctx.drawImage(this.tmpCanvas, 0, y, w, rowStep, x, y, dstW, rowStep);
      }

      const edgeGrad = sctx.createLinearGradient(0, 0, w, 0);
      edgeGrad.addColorStop(0, `rgba(0,0,0,${this.cfg.edgeDarkOuterAlpha})`);
      edgeGrad.addColorStop(0.1, `rgba(0,0,0,${this.cfg.edgeDarkInnerAlpha})`);
      edgeGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
      edgeGrad.addColorStop(0.9, `rgba(0,0,0,${this.cfg.edgeDarkInnerAlpha})`);
      edgeGrad.addColorStop(1, `rgba(0,0,0,${this.cfg.edgeDarkOuterAlpha})`);
      sctx.fillStyle = edgeGrad;
      sctx.fillRect(0, 0, w, h);
      sctx.restore();

      sctx.strokeStyle = `rgba(255,255,255,${this.cfg.borderStrokeAlpha})`;
      sctx.lineWidth = Math.max(1, Math.floor(this.cfg.borderStrokeWidthDpr * this.dpr));
      this.roundedRectPath(sctx, margin, margin, w - margin * 2, h - margin * 2, radius);
      sctx.stroke();
    }

    roundedRectPath(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, width * 0.5, height * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    }
  }

  ns.CrtRenderer = CrtRenderer;
})(window);
