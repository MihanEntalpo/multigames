(function bootstrapCanvasUtils(global) {
  const ns = (global.Minigames = global.Minigames || {});

  function resizeCanvasToDisplaySize(canvas, ctx, options = {}) {
    const parent = canvas.parentElement;
    const width = Math.max(
      1,
      Math.floor(
        options.width ??
          parent?.clientWidth ??
          canvas.clientWidth ??
          window.innerWidth
      )
    );
    const height = Math.max(
      1,
      Math.floor(
        options.height ??
          parent?.clientHeight ??
          canvas.clientHeight ??
          window.innerHeight
      )
    );

    const dpr = options.dpr ?? window.devicePixelRatio ?? 1;
    const targetWidth = Math.max(1, Math.floor(width * dpr));
    const targetHeight = Math.max(1, Math.floor(height * dpr));

    let resized = false;
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      resized = true;
    }

    if (canvas.style.width !== `${width}px`) {
      canvas.style.width = `${width}px`;
    }
    if (canvas.style.height !== `${height}px`) {
      canvas.style.height = `${height}px`;
    }

    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return { width, height, dpr, resized };
  }

  function clearCanvas(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
  }

  ns.resizeCanvasToDisplaySize = resizeCanvasToDisplaySize;
  ns.clearCanvas = clearCanvas;
})(window);
