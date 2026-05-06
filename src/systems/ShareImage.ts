/**
 * Generates a 1080x1920 IG Story share image.
 * Optimized for the *viewer* (player's followers): score brag → Trippie → prize → CTA → brand.
 */
export interface ShareStats {
  score: number;
  level: number;
  dotsEaten: number;
  ghostsEaten: number;
}

const HANDLE = '@youtripsg';
const TAGLINE = 'Best rates, every trip.';
// Brand-safety cap on the share artifact only — game score is unbounded so
// real grinders aren't blocked. Caps the visual at $999,999 so dev-tools
// edits can't post "$1 trillion" to IG and damage campaign credibility.
// Anyone legitimately above the cap (top 0.01%) still gets a respectable
// share image; everyone else is unaffected.
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
  trippieCoinsImg: HTMLImageElement,
): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;

  // Background — cover-fit
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

  // Heavier bg darkening — kill city-silhouette bleed-through
  x.fillStyle = 'rgba(13, 13, 26, 0.55)';
  x.fillRect(0, 0, W, H);

  // Card — compact, centered
  const cardW = 900, cardH = 1280;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;
  x.fillStyle = 'rgba(30, 20, 50, 0.88)';
  x.beginPath();
  x.roundRect(cardX, cardY, cardW, cardH, 40);
  x.fill();
  x.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  x.lineWidth = 2;
  x.stroke();

  x.textAlign = 'center';

  // ── Section 1: Brag (2 lines) ──────────────────────────────
  x.fillStyle = 'rgba(255, 255, 255, 0.7)';
  x.font = '700 32px "Press Start 2P", monospace';
  x.fillText('I SAVED', W / 2, 410);

  // Score with overflow guard — shrinks 150 → 130 → 110 → 90 if needed.
  // Score capped at SHARE_SCORE_MAX for brand safety (see top of file).
  const displayScore = Math.min(stats.score, SHARE_SCORE_MAX);
  let scoreSize = 150;
  const scoreText = `$${displayScore.toLocaleString('en-US')}`;
  x.font = `700 ${scoreSize}px "Press Start 2P", monospace`;
  while (x.measureText(scoreText).width > 800 && scoreSize > 90) {
    scoreSize -= 20;
    x.font = `700 ${scoreSize}px "Press Start 2P", monospace`;
  }
  x.fillStyle = '#FFD700';
  drawStrokedText(x, scoreText, W / 2, 590, 10);

  // ── Section 2: Trippie hero with character glow ────────────
  const trippieY = 640;
  const trippieW = 400;
  const trippieH = trippieCoinsImg.complete && trippieCoinsImg.naturalWidth > 0
    ? trippieW * (trippieCoinsImg.naturalHeight / trippieCoinsImg.naturalWidth)
    : 344;

  if (trippieCoinsImg.complete && trippieCoinsImg.naturalWidth > 0) {
    x.shadowColor = 'rgba(216, 180, 254, 0.65)';
    x.shadowBlur = 60;
    x.drawImage(trippieCoinsImg, (W - trippieW) / 2, trippieY, trippieW, trippieH);
    x.shadowColor = 'transparent';
    x.shadowBlur = 0;
  }

  // ── Section 3: Prize — floating text, no border ────────────
  x.fillStyle = 'rgba(255, 255, 255, 0.78)';
  x.font = '700 20px "Press Start 2P", monospace';
  x.fillText('Share your score for a chance to win', W / 2, 1050);

  x.fillStyle = '#FFD700';
  x.font = '700 36px "Press Start 2P", monospace';
  drawStrokedText(x, 'A FREE YEAR OF TRAVEL', W / 2, 1120, 6);

  // ── Section 4: CTA pill — dominant action ──────────────────
  const ctaY = 1190;
  const ctaH = 120;
  const ctaW = cardW - 100;
  const ctaX = cardX + 50;

  x.fillStyle = '#00D2C8';
  x.beginPath();
  x.roundRect(ctaX, ctaY, ctaW, ctaH, ctaH / 2);
  x.fill();
  x.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  x.lineWidth = 3;
  x.stroke();

  x.fillStyle = '#0D0D1A';
  x.font = '700 22px "Press Start 2P", monospace';
  x.fillText('BEAT MY SCORE ON TRIPPIE CHOMP', W / 2, ctaY + 46);
  x.font = '700 40px "Press Start 2P", monospace';
  x.fillText(HANDLE, W / 2, ctaY + 96);

  // ── Section 5: Brand lockup ────────────────────────────────
  x.fillStyle = '#D8B4FE';
  x.font = '700 48px "Press Start 2P", monospace';
  drawStrokedText(x, 'YOUTRIP', W / 2, 1410, 6);

  x.fillStyle = 'rgba(255, 255, 255, 0.75)';
  x.font = '700 24px "Press Start 2P", monospace';
  x.fillText(TAGLINE, W / 2, 1460);

  return new Promise<Blob>((resolve) => {
    c.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

export async function shareToIG(stats: ShareStats, gameOverBgImg: HTMLImageElement, trippieCoinsImg: HTMLImageElement): Promise<void> {
  const blob = await generateShareImage(stats, gameOverBgImg, trippieCoinsImg);
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
