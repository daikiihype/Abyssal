// Carregamento de imagens e manifesto dos sprites (tudo local, nada externo).
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar ' + src));
    img.src = src;
  });
}

export async function loadAssets(onProgress) {
  const manifest = await (await fetch('assets/sprites/manifest.json')).json();
  const names = Object.keys(manifest);
  const sprites = {};
  let done = 0;
  await Promise.all(names.map(async (n) => {
    const img = await loadImage(`assets/sprites/${n}.png`);
    sprites[n] = { img, ...manifest[n] };
    done++;
    if (onProgress) onProgress(done / names.length);
  }));
  return sprites;
}

// Desenha o quadro i (coluna/linha) de um sprite, com flip opcional.
export function drawFrame(ctx, spr, i, x, y, { flipX = false, flipY = false, alpha = 1 } = {}) {
  const col = i % spr.cols, row = Math.floor(i / spr.cols);
  const w = spr.w, h = spr.h;
  const px = Math.round(x), py = Math.round(y);
  const prev = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = prev * alpha;
  if (flipX || flipY) {
    ctx.save();
    ctx.translate(px + (flipX ? w : 0), py + (flipY ? h : 0));
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(spr.img, col * w, row * h, w, h, 0, 0, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(spr.img, col * w, row * h, w, h, px, py, w, h);
  }
  ctx.globalAlpha = prev;
}
