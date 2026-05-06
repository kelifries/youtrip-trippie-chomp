/**
 * Generates a 1080x1920 IG Story share image.
 * Architecture: pre-designed share-card.webp asset overlaid on the
 * game-over-bg, with the player's score drawn into the gap.
 * The card asset bakes in copy, layout, Trippie, brand lockup, T&Cs.
 */
export interface ShareStats {
  score: number;
  level: number;
  dotsEaten: number;
  ghostsEaten: number;
}

const HANDLE = '@youtripsg';
// Brand-safety cap on the share artifact only — game score is unbounded so
// real grinders aren't blocked. Caps the visual at $999,999 so dev-tools
// edits can't post "$1 trillion" to IG and damage campaign credibility.
const SHARE_SCORE_MAX = 999_999;

function drawStrokedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  strokeWidth: number,
): void {
  if (strokeWidth > 0) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillText(text, x, y);
}

export async function generateShareImage(
  stats: ShareStats,
  gameOverBgImg: HTMLImageElement,
  shareCardImg: HTMLImageElement,
): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;

  // Layer 1: game-over-bg, cover-fit
  if (gameOverBgImg.complete && gameOverBgImg.naturalWidth > 0) {
    const imgRatio = gameOverBgImg.naturalWidth / gameOverBgImg.naturalHeight;
    const canvasRatio = W / H;
    let sw: number, sh: number, sx: number, sy: number;
    if (imgRatio > canvasRatio) {
      sh = gameOverBgImg.naturalHeight;
      sw = sh * canvasRatio;
      sx = (gameOverBgImg.naturalWidth - sw) / 2;
      sy = 0;
    } else {
      sw = gameOverBgImg.naturalWidth;
      sh = sw / canvasRatio;
      sx = 0;
      sy = (gameOverBgImg.naturalHeight - sh) / 2;
    }
    x.drawImage(gameOverBgImg, sx, sy, sw, sh, 0, 0, W, H);
  } else {
    x.fillStyle = '#0D0D1A';
    x.fillRect(0, 0, W, H);
  }

  // Layer 2: pre-designed card overlay (1080x1920 PNG/WebP with transparent
  // corners — game-over-bg shows through outside the card area).
  if (shareCardImg.complete && shareCardImg.naturalWidth > 0) {
    x.drawImage(shareCardImg, 0, 0, W, H);
  }

  // Layer 3: score text in the gap between "I SAVED" and Trippie.
  // Mint #10DBAC, centered. Cap protects against fake-score share posts.
  // Await the font explicitly — canvas text rendering needs the font ready
  // synchronously, otherwise it silently falls back to system monospace
  // (which doesn't match the Press Start 2P baked into the card asset).
  const displayScore = Math.min(stats.score, SHARE_SCORE_MAX);
  const scoreText = `$${displayScore.toLocaleString('en-US')}`;
  let scoreSize = 150;
  if ('fonts' in document && typeof document.fonts.load === 'function') {
    try { await document.fonts.load(`${scoreSize}px "Press Start 2P"`); } catch (e) {}
  }
  x.textAlign = 'center';
  x.font = `${scoreSize}px "Press Start 2P", monospace`;
  while (x.measureText(scoreText).width > 800 && scoreSize > 90) {
    scoreSize -= 20;
    x.font = `${scoreSize}px "Press Start 2P", monospace`;
  }
  x.fillStyle = '#10DBAC';
  drawStrokedText(x, scoreText, W / 2, 580, 10);

  return new Promise<Blob>((resolve) => {
    c.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

export async function shareToIG(
  stats: ShareStats,
  gameOverBgImg: HTMLImageElement,
  shareCardImg: HTMLImageElement,
): Promise<void> {
  const blob = await generateShareImage(stats, gameOverBgImg, shareCardImg);
  const file = new File([blob], 'trippie-chomp-score.png', { type: 'image/png' });

  // Cap the share-sheet text score too so it stays consistent with the image.
  const displayScore = Math.min(stats.score, SHARE_SCORE_MAX);
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Trippie Chomp',
        text: `I saved $${displayScore.toLocaleString('en-US')} on Trippie Chomp! Play at ${HANDLE} — share your score for a chance to win a free year of travel.`,
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') downloadImage(blob);
    }
  } else {
    downloadImage(blob);
  }
}

function downloadImage(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trippie-chomp-score.png';
  a.click();
  URL.revokeObjectURL(url);
}
