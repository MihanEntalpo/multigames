(function bootstrapConsts(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const existing = ns.CONSTS || {};
  const existingRender = existing.RENDER || {};
  const existingCrt = existingRender.CRT || {};

  const defaults = {
    CRT: {
      // Pixelation stage (low-res intermediate buffer)
      pixelScale: 0.3,
      pixelMinWidth: 120,
      pixelMaxWidth: 400,
      pixelMinHeight: 90,
      pixelMaxHeight: 300,

      // Phosphor trail/persistence
      trailMixAlpha: 0.2,
      trailFadeAlpha: 0.22,
      trailPersistAlpha: 0.92,

      // Bloom from low-res source
      bloomOffset: 2,
      bloomXAlpha: 0.13,
      bloomYAlpha: 0.08,

      // Scanline and shadow-mask base patterns
      scanlinePatternDarkA: 0.2,
      scanlinePatternLight: 0.02,
      scanlinePatternDarkB: 0.12,
      scanlineAlphaBase: 0.4,
      scanlineAlphaWave: 0.03,
      scanlineWaveFreq: 24,

      maskPatternRed: 0.06,
      maskPatternGreen: 0.05,
      maskPatternBlue: 0.06,
      maskAlpha: 0.21,

      // Rolling bright scan band
      sweepSpeed: 78,
      sweepTravelPadding: 180,
      sweepHalfHeight: 50,
      sweepPeakAlpha: 0.075,

      // Grain/static
      noiseSize: 96,
      noiseRefreshSec: 0.045,
      noisePixelAlpha: 34,
      noiseAlpha: 0.09,
      staticLineChance: 0.2,
      staticLineMinAlpha: 0.03,
      staticLineMaxAlpha: 0.08,

      // Vignette + global flicker
      vignetteInnerRadius: 0.16,
      vignetteOuterRadius: 0.82,
      vignetteMidStop: 0.72,
      vignetteMidAlpha: 0.22,
      vignetteOuterAlpha: 0.62,

      flickerBase: 0.982,
      flickerWaveA: 0.012,
      flickerWaveAFreq: 59,
      flickerWaveB: 0.006,
      flickerWaveBFreq: 19,
      flickerMaxAlpha: 0.03,

      // Tube geometry and curvature pass
      screenMarginBase: 8,
      borderRadiusFactor: 0.065,
      borderRadiusMin: 24,
      borderStrokeAlpha: 0.06,
      borderStrokeWidthDpr: 2,
      edgeDarkOuterAlpha: 0.3,
      edgeDarkInnerAlpha: 0.04,

      rowStepDprFactor: 2,
      curvatureReferenceWidth: 700,
      curvatureBase: 0.082,
      curvatureScale: 0.00006,
      curvatureMin: 0.082,
      curvatureMax: 0.13,

      wobbleAmplitudeDpr: 0.45,
      wobbleFrequency: 14,
      wobbleSpeed: 1.4,
    },
  };

  ns.CONSTS = {
    ...existing,
    RENDER: {
      ...defaults,
      ...existingRender,
      CRT: {
        ...defaults.CRT,
        ...existingCrt,
      },
    },
  };
})(window);
