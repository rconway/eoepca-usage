/**
 * Tooltip rendering for hovered/clicked nodes
 * @module render/tooltip
 */

import { setFont, renderText } from './text';
import type { VisualizationNode, PlatformData, BuildingBlockData } from '../types';

const TOOLTIP_PADDING = 18;
const MAX_LIST_ITEMS = 14;

interface TooltipConfig {
  SF: number;
  COLOR_BACKGROUND: string;
  COLOR_TEXT: string;
  COLOR_PLATFORM: string;
  COLOR_BUILDING_BLOCK: string;
}

/**
 * Builds the display list for a node's tooltip: connected names, with
 * "(future)" appended for links that aren't active use yet.
 */
function getRelated(d: VisualizationNode): { label: string; names: string[] } {
  if (d.type === 'platform') {
    const data = d.data as PlatformData;
    return {
      label: data.buildingBlocks.length === 1 ? 'Building Block' : 'Building Blocks',
      names: data.links_original.map(
        (l) => l.buildingBlock! + (l.status === 'interested' ? ' (future)' : ''),
      ),
    };
  }
  const data = d.data as BuildingBlockData;
  return {
    label: data.platforms.length === 1 ? 'platform' : 'platforms',
    names: data.links_original.map(
      (l) => l.platform! + (l.status === 'interested' ? ' (future)' : ''),
    ),
  };
}

/**
 * Wraps a list of names into lines that fit within a given width,
 * separated by " · ". Caches nothing — recomputed per draw since the
 * data set is small.
 */
function wrapNameList(
  context: CanvasRenderingContext2D,
  names: string[],
  maxWidthPx: number,
): string[] {
  const visible = names.slice(0, MAX_LIST_ITEMS);
  const lines: string[] = [];
  let current = '';
  visible.forEach((name, i) => {
    const chunk = `${name}${i < visible.length - 1 ? ' · ' : ''}`;
    if (context.measureText(`${current}${chunk}`).width * 1.25 > maxWidthPx) {
      lines.push(current.replace(/ · $/, ''));
      current = chunk;
    } else {
      current += chunk;
    }
  });
  if (current !== '') lines.push(current.replace(/ · $/, ''));
  return lines;
}

/**
 * Draws a tooltip above a node: name + count, then a wrapped list of the
 * connected platforms (for a Building Block) or Building Blocks (for a
 * platform).
 */
export function drawTooltip(
  context: CanvasRenderingContext2D,
  d: VisualizationNode,
  config: TooltipConfig,
): void {
  const { SF, COLOR_BACKGROUND, COLOR_TEXT, COLOR_PLATFORM, COLOR_BUILDING_BLOCK } = config;

  const max_radius = d.max_radius;
  const x_base = d.x;
  const y_base = d.y + (d.y < 0 ? 1 : -1) * (max_radius ? max_radius : d.r);

  let W = 320;
  let H = 96;

  const { label: relatedLabel, names } = getRelated(d);

  const fontSize = 15;
  setFont(context, fontSize * SF, 400, 'normal');
  const maxListWidthPx = 0.85 * W * SF;
  let lines = wrapNameList(context, names, maxListWidthPx);

  // Measure title width to widen the tooltip if needed.
  setFont(context, 20 * SF, 700, 'normal');
  let tW = context.measureText(d.label).width * 1.25;
  if (tW + 40 * SF > W * SF) W = tW / SF + 40;

  setFont(context, fontSize * SF, 400, 'normal');
  lines = wrapNameList(context, names, 0.85 * W * SF);
  lines.forEach((l) => {
    const lineWidth = context.measureText(l).width * 1.25;
    if (lineWidth + 40 * SF > W * SF) W = lineWidth / SF + 40;
  });

  const hiddenCount = names.length - MAX_LIST_ITEMS;
  let lineCount = lines.length;
  if (hiddenCount > 0) lineCount += 1;
  H += lineCount * (fontSize * 1.4);

  const maxTooltipWidth = (window.innerWidth - 20) / SF;
  if (W > maxTooltipWidth) W = Math.max(maxTooltipWidth, 200);

  const H_OFFSET = d.y < 0 ? 20 : -H - 20;

  let x_clamped = x_base;
  const canvasHalfW = context.canvas.width / SF / 2;
  const leftEdge = x_clamped - W / 2;
  const rightEdge = x_clamped + W / 2;
  if (leftEdge * SF < -canvasHalfW * SF + 10) {
    x_clamped = -canvasHalfW + W / 2 + 10;
  } else if (rightEdge * SF > canvasHalfW * SF - 10) {
    x_clamped = canvasHalfW - W / 2 - 10;
  }

  context.save();
  context.translate(x_clamped * SF, (y_base + H_OFFSET) * SF);

  const x = 0;
  let y = 0;
  const COL = d.type === 'platform' ? COLOR_PLATFORM : COLOR_BUILDING_BLOCK;

  context.shadowBlur = 6 * SF;
  context.shadowColor = 'rgba(0, 0, 0, 0.4)';
  context.fillStyle = COLOR_BACKGROUND;
  context.fillRect((x - W / 2) * SF, y * SF, W * SF, H * SF);
  context.shadowBlur = 0;

  context.fillStyle = COL;
  context.fillRect((x - W / 2) * SF, y * SF, 4 * SF, H * SF);

  context.textAlign = 'left';
  context.textBaseline = 'middle';

  const xLeft = x - W / 2 + TOOLTIP_PADDING;

  y = 26;
  setFont(context, 15 * SF, 400, 'italic');
  context.fillStyle = COL;
  renderText(
    context,
    d.type === 'platform' ? 'Platform' : 'Building Block',
    xLeft * SF,
    y * SF,
    2.5 * SF,
  );

  context.fillStyle = COLOR_TEXT;
  y += 30;

  setFont(context, 20 * SF, 700, 'normal');
  renderText(context, d.label, xLeft * SF, y * SF, 1.25 * SF);

  y += 26;
  context.globalAlpha = 0.65;
  setFont(context, 14 * SF, 400, 'normal');
  renderText(context, `${names.length} ${relatedLabel}`, xLeft * SF, y * SF, 1.25 * SF);
  context.globalAlpha = 1;

  y += 16;
  context.save();
  context.globalAlpha = 0.22;
  context.strokeStyle = COLOR_TEXT;
  context.lineWidth = Math.round(SF);
  context.beginPath();
  context.moveTo((x - W / 2 + TOOLTIP_PADDING) * SF, Math.round(y * SF) + 0.5);
  context.lineTo((x + W / 2 - TOOLTIP_PADDING) * SF, Math.round(y * SF) + 0.5);
  context.stroke();
  context.restore();

  y += 24;
  context.globalAlpha = 0.9;
  setFont(context, fontSize * SF, 400, 'normal');
  lines.forEach((l) => {
    renderText(context, l, xLeft * SF, y * SF, 1.25 * SF);
    y += fontSize * 1.4;
  });

  if (hiddenCount > 0) {
    context.globalAlpha = 0.5;
    setFont(context, fontSize * SF, 400, 'italic');
    renderText(context, `& ${hiddenCount} more`, xLeft * SF, y * SF, 1.25 * SF);
  }
  context.globalAlpha = 1;

  context.restore();
}
