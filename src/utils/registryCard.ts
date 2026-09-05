import type { Elephant } from '../types/elephant';

const CARD_W = 1080;
const CARD_H = 1920; // 9:16 — ideal for WhatsApp / stories

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.length > 0) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last.endsWith('…') ? last : last + '…';
  }
  return lines;
}

/**
 * Build a beautiful AliMedia registry card as a PNG Blob (9:16).
 * Suitable for WhatsApp / Instagram Story sharing.
 */
export async function generateRegistryCardBlob(elephant: Elephant): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, '#062E22');
  bg.addColorStop(0.45, '#0A3D30');
  bg.addColorStop(1, '#021A14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Decorative gold ring accents
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CARD_W - 80, 120, 160, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(80, CARD_H - 200, 120, 0, Math.PI * 2);
  ctx.stroke();

  // Brand header
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AliMedia', CARD_W / 2, 72);
  ctx.font = '500 22px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(212, 175, 55, 0.95)';
  ctx.fillText('Sri Lankan Elephant Registry', CARD_W / 2, 108);

  // Photo frame
  const frameX = 72;
  const frameY = 160;
  const frameW = CARD_W - 144;
  const frameH = 980;
  const photo = (elephant.photos || []).find((p) => typeof p === 'string' && p.trim()) ||
    'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80';

  ctx.save();
  roundRect(ctx, frameX, frameY, frameW, frameH, 36);
  ctx.clip();
  try {
    const img = await loadImage(photo);
    drawCoverImage(ctx, img, frameX, frameY, frameW, frameH);
  } catch {
    ctx.fillStyle = '#1A2C26';
    ctx.fillRect(frameX, frameY, frameW, frameH);
  }
  ctx.restore();

  // Gold border around photo
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
  ctx.lineWidth = 4;
  roundRect(ctx, frameX, frameY, frameW, frameH, 36);
  ctx.stroke();

  // Status badge
  const isMemorial = elephant.status === 'memorial';
  const badgeText = isMemorial ? 'MEMORIAL' : elephant.isLive ? 'LIVE' : 'LIVING';
  const badgeColor = isMemorial ? '#6B7280' : elephant.isLive ? '#DC2626' : '#059669';
  ctx.font = '800 26px system-ui, sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 48;
  const badgeX = frameX + 28;
  const badgeY = frameY + 28;
  ctx.fillStyle = badgeColor;
  roundRect(ctx, badgeX, badgeY, badgeW, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(badgeText, badgeX + 24, badgeY + 33);

  if (elephant.verified) {
    ctx.font = '700 22px system-ui, sans-serif';
    const vText = 'VERIFIED';
    const vW = ctx.measureText(vText).width + 40;
    ctx.fillStyle = 'rgba(6, 46, 34, 0.85)';
    roundRect(ctx, frameX + frameW - vW - 28, badgeY, vW, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#D4AF37';
    ctx.fillText(vText, frameX + frameW - vW - 8, badgeY + 33);
  }

  // Names
  let y = frameY + frameH + 70;
  const eng = (elephant.name || '').trim() || 'Unnamed';
  const sin = (elephant.sinhalaName || '').trim();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 56px system-ui, "Noto Sans Sinhala", sans-serif';
  const primary = sin || eng;
  for (const line of wrapText(ctx, primary, CARD_W - 120, 2)) {
    ctx.fillText(line, CARD_W / 2, y);
    y += 64;
  }

  if (sin && eng && sin !== eng) {
    ctx.fillStyle = 'rgba(212, 175, 55, 0.95)';
    ctx.font = '600 36px system-ui, sans-serif';
    ctx.fillText(eng, CARD_W / 2, y);
    y += 52;
  }

  // Type + gender chips
  y += 12;
  const typeLabel = elephant.type === 'tusker' ? 'Tusker · ඇතා' : 'Elephant · අලියා';
  const genderLabel = elephant.gender === 'female' ? 'Female' : 'Male';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`${typeLabel}  ·  ${genderLabel}`, CARD_W / 2, y);
  y += 56;

  // Temple / location card
  const infoY = y;
  const infoH = 200;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, 72, infoY, CARD_W - 144, infoH, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, 72, infoY, CARD_W - 144, infoH, 28);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(212, 175, 55, 0.9)';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('TEMPLE / CUSTODY', 110, infoY + 48);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 34px system-ui, "Noto Sans Sinhala", sans-serif';
  const org = (elephant.organization || elephant.location || 'Sri Lanka').trim();
  let orgY = infoY + 100;
  for (const line of wrapText(ctx, org, CARD_W - 220, 2)) {
    ctx.fillText(line, 110, orgY);
    orgY += 42;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '500 26px system-ui, sans-serif';
  ctx.fillText(elephant.location || 'Sri Lanka', 110, infoY + infoH - 36);

  // Footer CTA
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillText('Open on AliMedia · Sign in to view full profile', CARD_W / 2, CARD_H - 80);
  ctx.fillStyle = 'rgba(212, 175, 55, 0.8)';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText('alimedia · Sri Lankan heritage', CARD_W / 2, CARD_H - 42);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export card'));
      },
      'image/png',
      0.95
    );
  });
}

export function registryCardFileName(elephant: Elephant): string {
  const safe = (elephant.name || 'elephant')
    .replace(/[^\w\u0D80-\u0DFF\-]+/g, '_')
    .slice(0, 40);
  return `AliMedia_${safe}_registry_card.png`;
}

/** Share registry card image + deep link (WhatsApp-friendly on mobile). */
export async function shareRegistryCard(
  elephant: Elephant,
  options?: { notify?: (msg: string) => void; language?: 'en' | 'si' }
): Promise<void> {
  const lang = options?.language || 'en';
  const notify = options?.notify;
  const id = elephant.id || encodeURIComponent(elephant.name || '');
  const shareUrl = `${window.location.origin}/#e/${id}`;
  const eng = elephant.name || 'Elephant';
  const sin = elephant.sinhalaName ? ` (${elephant.sinhalaName})` : '';
  const title = `${eng}${sin} · AliMedia Registry`;
  const text =
    lang === 'si'
      ? `${eng}${sin} — AliMedia හීලෑ අලි ලේඛනය. සම්පූර්ණ පැතිකඩ බැලීමට පිවිසෙන්න:\n${shareUrl}`
      : `${eng}${sin} — AliMedia elephant registry card. Sign in to view the full profile:\n${shareUrl}`;

  let file: File | null = null;
  try {
    const blob = await generateRegistryCardBlob(elephant);
    file = new File([blob], registryCardFileName(elephant), { type: 'image/png' });
  } catch (err) {
    console.warn('Registry card render failed:', err);
  }

  // Prefer native share with image (mobile WhatsApp / iOS share sheet)
  if (file && typeof navigator !== 'undefined' && navigator.share) {
    const canFiles =
      typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : true;
    try {
      if (canFiles) {
        await navigator.share({
          title,
          text,
          url: shareUrl,
          files: [file],
        });
        return;
      }
      await navigator.share({ title, text, url: shareUrl });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn('Share failed, falling back:', err);
    }
  }

  // Fallback: download card + copy link
  if (file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  try {
    await navigator.clipboard.writeText(shareUrl);
    notify?.(
      lang === 'si'
        ? 'කාඩ්පත බාගත විය · සබැඳිය පිටපත් විය! WhatsApp හි paste කරන්න.'
        : 'Card downloaded · link copied! Paste it in WhatsApp.'
    );
  } catch {
    notify?.(
      lang === 'si'
        ? `බෙදාගන්න: ${shareUrl}`
        : `Share this link: ${shareUrl}`
    );
  }
}
