// Generates a 9:16 "Instagram story" image for a game review (Letterboxd-style):
// the game cover, the star rating, the review text and LevelUpXP branding.
// Pure canvas — no extra deps. Falls back to a brand gradient if the cover
// image can't be drawn (cross-origin taint).

interface StoryCardOpts {
  coverUrl?: string | null;
  gameName: string;
  starRating: number;
  reviewText?: string | null;
  userName?: string;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/png");
    } catch {
      resolve(null);
    }
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height;
  const r = w / h;
  let sw: number, sh: number, sx: number, sy: number;
  if (ir > r) {
    sh = img.height;
    sw = sh * r;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / r;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateReviewStoryCard(opts: StoryCardOpts): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const cover = opts.coverUrl ? await loadImage(opts.coverUrl) : null;

  const render = (withCover: boolean) => {
    ctx.clearRect(0, 0, W, H);

    // Background — brand gradient
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#2b1d66");
    g.addColorStop(1, "#10142c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Blurred cover behind + dark overlay
    if (withCover && cover) {
      ctx.save();
      ctx.filter = "blur(60px)";
      drawCover(ctx, cover, -60, -60, W + 120, H + 120);
      ctx.restore();
      ctx.fillStyle = "rgba(12,10,24,0.82)";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.textAlign = "center";

    // Wordmark
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 46px Arial, sans-serif";
    ctx.fillText("LEVELUP", W / 2 - 52, 160);
    ctx.fillStyle = "#a78bfa";
    ctx.fillText("XP", W / 2 + 92, 160);

    let y = 300;

    // Featured cover card
    if (withCover && cover) {
      const cw = 840;
      const ch = Math.min(Math.round(cw * (cover.height / cover.width)), 700);
      const cx = (W - cw) / 2;
      ctx.save();
      roundRect(ctx, cx, y, cw, ch, 28);
      ctx.clip();
      drawCover(ctx, cover, cx, y, cw, ch);
      ctx.restore();
      // subtle border
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      roundRect(ctx, cx, y, cw, ch, 28);
      ctx.stroke();
      y += ch + 90;
    } else {
      y = 560;
    }

    // Game name
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 72px Arial, sans-serif";
    const nameLines = wrapText(ctx, opts.gameName, W - 160).slice(0, 2);
    for (const line of nameLines) {
      ctx.fillText(line, W / 2, y);
      y += 88;
    }
    y += 24;

    // Stars (drawn individually so filled/empty colours both centre)
    ctx.font = "66px Arial, sans-serif";
    const starW = ctx.measureText("★").width;
    const gap = 16;
    const total = 5 * starW + 4 * gap;
    let sx = (W - total) / 2;
    ctx.textAlign = "left";
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < opts.starRating ? "#f5c518" : "rgba(255,255,255,0.25)";
      ctx.fillText(i < opts.starRating ? "★" : "☆", sx, y);
      sx += starW + gap;
    }
    ctx.textAlign = "center";
    y += 110;

    // Review text
    if (opts.reviewText && opts.reviewText.trim()) {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "italic 42px Georgia, serif";
      const lines = wrapText(ctx, `“${opts.reviewText.trim()}”`, W - 200).slice(0, 6);
      for (const line of lines) {
        ctx.fillText(line, W / 2, y);
        y += 56;
      }
    }

    // Footer
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "600 38px Arial, sans-serif";
    ctx.fillText(`${opts.userName || "A gamer"}'s review`, W / 2, H - 180);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "34px Arial, sans-serif";
    ctx.fillText("pixel-pulse-roan.vercel.app", W / 2, H - 128);
  };

  // Try with the cover; if the canvas is tainted (export returns null), redraw
  // without it so we still produce a card.
  render(true);
  let blob = await canvasToBlob(canvas);
  if (!blob && cover) {
    render(false);
    blob = await canvasToBlob(canvas);
  }
  return blob;
}
