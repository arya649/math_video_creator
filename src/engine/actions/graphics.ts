// On-screen graphics: words drawn over the picture, unmoved by the camera.

import { type Ctx, TEXT_SIZES, arrive, color, readAppear, registerAction, sizeOf, str, natural } from '../actions';
import type { Pt } from '../geom';
import { layoutText } from '../text';
import { Thing } from '../thing';
import { fillGlyph, roundedRect } from '../shapes';
import { ScriptError, choice, clamp, ease } from '../util';
import { SCREEN_PLACES } from '../world';
import { withAlpha } from '../color';

/** Text in the script: one language already picked by the compiler. */
function words(ctx: Ctx, key: string, required = false): string | undefined {
  return str(ctx, key, required);
}

/** How long a graphic stays: its beat, or to the end of the scene with stay. */
function stayTime(ctx: Ctx): { end: number; leaves: boolean } {
  if (ctx.spec.stay === true) return { end: ctx.world.end, leaves: false };
  const d = ctx.duration ?? (ctx.lineEnd !== undefined ? Math.max(2, ctx.lineEnd - ctx.start) : 3);
  return { end: ctx.start + d, leaves: true };
}

function leave(ctx: Ctx, t: Thing, at: number) {
  ctx.act({ start: at - 0.4, duration: 0.4, apply(u) { if (u >= 1) t.state.visible = false; else t.state.opacity *= 1 - ease('smooth', u); } });
}

function screenText(ctx: Ctx, id: string, text: string, opts: { size: number; at: Pt; color?: string; weight?: number; align?: 'left' | 'center' | 'right'; maxWidth?: number; italic?: boolean; font?: string }): Thing {
  const layout = layoutText(text, {
    size: opts.size, font: opts.font ?? ctx.world.theme.fonts.text, weight: opts.weight ?? 600, align: opts.align ?? 'center',
    maxWidth: opts.maxWidth ?? ctx.world.frameW * 0.8, italic: opts.italic,
  });
  const t = new Thing(id, 'text', [], opts.at);
  t.text = layout;
  t.screen = true;
  t.base.color = opts.color;
  return t;
}

registerAction('title', {
  summary: 'Large headline words.',
  params: ['text', 'kicker', 'sub', 'position', 'size', 'color', 'appear', 'stay'],
  required: ['text'],
  build(ctx) {
    const { world } = ctx;
    const pos = choice(ctx.spec.position, ['center', 'top', 'bottom'] as const, `${ctx.where}.position`, 'center');
    const size = sizeOf(ctx.spec.size, { small: 0.45, medium: 0.6, large: 0.8, huge: 1.15 }, `${ctx.where}.size`, 'large');
    const id = str(ctx, 'id') ?? world.newId('title');
    const main = screenText(ctx, id, words(ctx, 'text', true)!, { size, at: [0, 0], color: color(ctx, 'color'), weight: 700, font: world.theme.fonts.title });
    const kickerText = words(ctx, 'kicker');
    const subText = words(ctx, 'sub');
    const kicker = kickerText ? screenText(ctx, `${id}.kicker`, kickerText.toUpperCase(), { size: size * 0.4, at: [0, 0], color: world.theme.accent, weight: 600 }) : undefined;
    const sub = subText ? screenText(ctx, `${id}.sub`, subText, { size: size * 0.45, at: [0, 0], color: withAlpha(world.theme.ink, 0.72), weight: 500 }) : undefined;
    const parts = [kicker, main, sub].filter(Boolean) as Thing[];
    const gap = size * 0.3;
    const heights = parts.map((p) => p.text!.box.y1 - p.text!.box.y0);
    const total = heights.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
    const cy = pos === 'top' ? world.frameH * 0.3 : pos === 'bottom' ? -world.frameH * 0.27 : 0;
    let y = cy + total / 2;
    parts.forEach((p, i) => {
      y -= heights[i] / 2;
      p.base.y = p.build.y = y;
      y -= heights[i] / 2 + gap;
    });
    const { how } = readAppear(ctx, 'type');
    const { end, leaves } = stayTime(ctx);
    const d = Math.min(1.2, (end - ctx.start) / 2);
    parts.forEach((p, i) => {
      world.add(p, ctx.where);
      arrive(ctx, p, p === main ? how : 'rise', ctx.start + i * 0.15, p === main ? d : 0.5);
      if (leaves) leave(ctx, p, end);
    });
    return { end, thing: main };
  },
}, ['headline']);

const TEXT_STYLES = ['plain', 'box', 'banner', 'quote', 'note'] as const;

registerAction('text', {
  summary: 'Any other words, in a chosen place, style and entrance.',
  params: ['text', 'position', 'style', 'size', 'color', 'appear', 'stay', 'by', 'kicker', 'sub'],
  required: ['text'],
  build(ctx) {
    const { world } = ctx;
    const posName = typeof ctx.spec.position === 'string' ? ctx.spec.position : 'top';
    if (!(SCREEN_PLACES as readonly string[]).includes(posName)) {
      throw new ScriptError(`must be one of ${SCREEN_PLACES.join(', ')}.`, `${ctx.where}.position`);
    }
    const style = choice(ctx.spec.style, TEXT_STYLES, `${ctx.where}.style`, 'plain');
    const size = sizeOf(ctx.spec.size, TEXT_SIZES, `${ctx.where}.size`, 'medium');
    const id = str(ctx, 'id') ?? world.newId('text');
    let body = words(ctx, 'text', true)!;
    if (style === 'quote') body = `“${body}”`;
    const align = posName.includes('left') ? 'left' : posName.includes('right') ? 'right' : 'center';
    const t = screenText(ctx, id, body, {
      size, at: world.screenPlace(posName), color: color(ctx, 'color', style === 'box' || style === 'banner' ? world.theme.onSurface : undefined),
      align, maxWidth: world.frameW * (posName === 'top' || posName === 'bottom' || posName === 'center' ? 0.8 : 0.42),
      italic: style === 'quote' || style === 'note', weight: style === 'note' ? 500 : 600,
    });
    world.add(t, ctx.where);
    const b = t.text!.box;
    // Keep the words inside the frame when they sit at a side.
    const halfW = world.frameW / 2 - 0.5;
    if (b.x1 + t.base.x > halfW) t.base.x = t.build.x = halfW - b.x1;
    if (b.x0 + t.base.x < -halfW) t.base.x = t.build.x = -halfW - b.x0;
    const { end, leaves } = stayTime(ctx);
    if (style === 'box' || style === 'banner') {
      const pad = size * 0.5;
      const panel = new Thing(world.newId('panel'), 'decoration', [fillGlyph([roundedRect(b.x0 - pad, b.y0 - pad * 0.7, b.x1 + pad, b.y1 + pad * 0.7, style === 'box' ? 0.15 : 0.04)], 'panel', { color: world.theme.surface })], [0, 0]);
      panel.parent = t;
      panel.screen = true;
      panel.layer = -1;
      world.add(panel, ctx.where);
      if (style === 'banner') {
        const bar = new Thing(world.newId('bar'), 'decoration', [fillGlyph([roundedRect(b.x0 - pad, b.y0 - pad * 0.7, b.x0 - pad + 0.1, b.y1 + pad * 0.7, 0)], 'bar', { color: world.theme.accent })], [0, 0]);
        bar.parent = t;
        bar.screen = true;
        world.add(bar, ctx.where);
        arrive(ctx, bar, 'fade', ctx.start, 0.3);
      }
      arrive(ctx, panel, 'fade', ctx.start, 0.3);
    }
    if (style === 'note') t.base.rotation = t.build.scale * -0.03;
    const { how } = readAppear(ctx, style === 'note' ? 'type' : 'fade');
    // The beat's length is how long the words stay; arriving takes its own time.
    arrive(ctx, t, how, ctx.start, (how === 'type' ? Math.min(1.5, 0.3 + body.length * 0.03) : 0.5) / ctx.speed);
    if (typeof ctx.spec.by === 'string') {
      const by = screenText(ctx, `${id}.by`, `— ${ctx.spec.by}`, { size: size * 0.6, at: [t.base.x + (b.x1 - b.x0) * (align === 'left' ? 0.5 : 0), t.base.y + b.y0 - size * 0.7], color: withAlpha(world.theme.ink, 0.7), align: 'center' });
      world.add(by, ctx.where);
      arrive(ctx, by, 'fade', ctx.start + 0.5, 0.5);
      if (leaves) leave(ctx, by, end);
    }
    if (leaves) leave(ctx, t, end);
    return { end, thing: t };
  },
}, ['caption', 'quote']);

registerAction('clear', {
  summary: 'Remove on-screen graphics early.',
  params: ['who'],
  required: ['who'],
  build(ctx) {
    const d = natural(ctx, 0.5);
    const list = ctx.spec.who === 'all'
      ? ctx.world.order.filter((t) => t.screen)
      : (Array.isArray(ctx.spec.who) ? ctx.spec.who : [ctx.spec.who]).flatMap((id, i) => {
        const t = ctx.world.get(id, `${ctx.where}.who${Array.isArray(ctx.spec.who) ? `[${i}]` : ''}`);
        return [t, ...ctx.world.order.filter((o) => o.id.startsWith(`${t.id}.`))];
      });
    for (const t of list) {
      ctx.act({ start: ctx.start, duration: d, apply(u) { if (u >= 1) t.state.visible = false; else t.state.opacity *= 1 - ease('smooth', u); } });
    }
    return { end: ctx.start + d };
  },
}, ['dismiss']);

export const clamp01 = clamp;

registerAction('sound', {
  summary: 'Play a sound file once, starting at the beat.',
  params: ['file', 'volume', 'fade_in', 'fade_out'],
  required: ['file'],
  build(ctx) {
    const file = str(ctx, 'file', true)!;
    const volume = typeof ctx.spec.volume === 'number' ? ctx.spec.volume : 1;
    if (volume < 0 || volume > 4) throw new ScriptError('must be from 0 to 4.', `${ctx.where}.volume`);
    const n = (k: string) => (typeof ctx.spec[k] === 'number' ? (ctx.spec[k] as number) : undefined);
    ctx.world.sounds.push({ at: ctx.start, file, duration: ctx.duration, volume, fadeIn: n('fade_in'), fadeOut: n('fade_out') });
    return { end: ctx.start };
  },
}, ['sfx', 'play']);
