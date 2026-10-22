import * as d3 from 'd3';
import { findNode } from './findNode';
import { drawWithZoomTransform } from './zoom';
import type {
  VisualizationConfig,
  DelaunayData,
  InteractionState,
  ZoomState,
  VisualizationNode,
  PlatformData,
  BuildingBlockData,
} from '../types';

export interface SetupTouchOptions {
  canvasSelector: string;
  config: VisualizationConfig;
  delaunayData: DelaunayData;
  interactionState: InteractionState;
  canvas: HTMLCanvasElement;
  contextClick: CanvasRenderingContext2D;
  contextHover: CanvasRenderingContext2D;
  getNodes: () => VisualizationNode[];
  setClicked: (state: InteractionState, node: VisualizationNode) => void;
  clearClick: (state: InteractionState) => void;
  clearHover: (state: InteractionState) => void;
  setDelaunay: (
    state: InteractionState,
    delaunay: d3.Delaunay<[number, number]>,
    nodesDelaunay: VisualizationNode[],
  ) => void;
  drawHoverState: (
    context: CanvasRenderingContext2D,
    node: VisualizationNode,
    showTooltip?: boolean,
  ) => void;
  zoomState?: ZoomState | null;
  tooltipEl: HTMLElement;
  tooltipContentEl: HTMLElement;
  onTooltipShow?: (node: VisualizationNode) => void;
  onTooltipDismiss?: () => void;
}

const MAX_LIST_ITEMS = 14;

/**
 * Renders the mobile tooltip HTML for a given node.
 * Exported for unit testing.
 */
export function renderMobileTooltip(node: VisualizationNode): string {
  if (node.type === 'platform') {
    const data = node.data as PlatformData;
    const names = data.links_original.map((l) => ({
      name: l.buildingBlock!,
      interested: l.status === 'interested',
    }));
    return renderTooltipHtml('Platform', data.platform_name, names, 'Building Block', 'Building Blocks');
  }

  const data = node.data as BuildingBlockData;
  const names = data.links_original.map((l) => ({
    name: l.platform!,
    interested: l.status === 'interested',
  }));
  return renderTooltipHtml('Building Block', data.name, names, 'platform', 'platforms');
}

function renderTooltipHtml(
  typeLabel: string,
  title: string,
  names: { name: string; interested: boolean }[],
  singular: string,
  plural: string,
): string {
  const count = names.length;
  const visible = names.slice(0, MAX_LIST_ITEMS);
  const hidden = count - MAX_LIST_ITEMS;
  const listItems = visible
    .map((n) => {
      const suffix = n.interested ? ' <em class="tooltip-interested">(future)</em>' : '';
      return `<span>${escapeHtml(n.name)}${suffix}</span>`;
    })
    .join(' · ');
  const overflowLine = hidden > 0 ? `<p class="tooltip-subtitle">+ ${hidden} more</p>` : '';

  return `
    <p class="tooltip-type-label">${escapeHtml(typeLabel)}</p>
    <p class="tooltip-title">${escapeHtml(title)}</p>
    <p class="tooltip-subtitle">${count} ${count === 1 ? escapeHtml(singular) : escapeHtml(plural)}</p>
    <div class="tooltip-section">
      <p>${listItems}</p>
      ${overflowLine}
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sets up touch interaction handlers on the canvas for mobile devices.
 * Manages a DOM tooltip and canvas highlight state via a single touchstart handler.
 */
export function setupTouch(options: SetupTouchOptions): void {
  const {
    canvasSelector,
    config,
    delaunayData,
    interactionState,
    canvas,
    contextClick,
    contextHover,
    getNodes,
    setClicked,
    clearClick,
    clearHover,
    setDelaunay,
    drawHoverState,
    tooltipEl,
    tooltipContentEl,
  } = options;
  const { WIDTH, HEIGHT } = config;
  let activeNode: VisualizationNode | null = null;

  function dismiss(): void {
    clearClick(interactionState);
    clearHover(interactionState);
    contextClick.clearRect(0, 0, WIDTH, HEIGHT);
    contextHover.clearRect(0, 0, WIDTH, HEIGHT);
    canvas.style.opacity = '1';
    const currentNodes = getNodes();
    delaunayData.nodesDelaunay = currentNodes;
    delaunayData.delaunay = d3.Delaunay.from(
      currentNodes.map((n) => [n.x, n.y] as [number, number]),
    );
    setDelaunay(interactionState, delaunayData.delaunay, delaunayData.nodesDelaunay);
    activeNode = null;
    options.onTooltipDismiss?.();
  }

  const canvasEl = document.querySelector(canvasSelector) as HTMLElement;
  const TAP_MOVE_THRESHOLD = 10;
  const TAP_TIME_THRESHOLD = 300;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerStartTime = 0;

  canvasEl.addEventListener(
    'pointerdown',
    (event: PointerEvent) => {
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      pointerStartTime = Date.now();
    },
    { passive: true },
  );

  canvasEl.addEventListener(
    'pointerup',
    (event: PointerEvent) => {
      const dx = event.clientX - pointerStartX;
      const dy = event.clientY - pointerStartY;
      const elapsed = Date.now() - pointerStartTime;

      if (elapsed > TAP_TIME_THRESHOLD || Math.sqrt(dx * dx + dy * dy) > TAP_MOVE_THRESHOLD) return;

      const rect = canvasEl.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;

      const zoomTransform = options.zoomState?.zoomTransform ?? null;
      const [d, FOUND] = findNode(mx, my, config, delaunayData, interactionState, zoomTransform);

      if (!FOUND || !d) {
        dismiss();
        return;
      }

      if (activeNode === d) {
        dismiss();
        return;
      }

      // SELECT: new node
      clearClick(interactionState);
      clearHover(interactionState);
      contextClick.clearRect(0, 0, WIDTH, HEIGHT);
      contextHover.clearRect(0, 0, WIDTH, HEIGHT);

      setClicked(interactionState, d);

      delaunayData.nodesDelaunay = d.neighbors ? [...d.neighbors, d] : getNodes();
      delaunayData.delaunay = d3.Delaunay.from(
        delaunayData.nodesDelaunay.map((n) => [n.x, n.y] as [number, number]),
      );
      setDelaunay(interactionState, delaunayData.delaunay, delaunayData.nodesDelaunay);

      canvas.style.opacity = d.type === 'platform' ? '0.15' : '0.2';

      drawWithZoomTransform(contextClick, config, options.zoomState ?? null, () => {
        drawHoverState(contextClick, d, false);
      });
      contextHover.clearRect(0, 0, WIDTH, HEIGHT);

      tooltipContentEl.innerHTML = renderMobileTooltip(d);
      tooltipEl.dataset.nodeType = d.type;
      options.onTooltipShow?.(d);
      activeNode = d;
    },
    { passive: true },
  );

  const closeBtn = tooltipEl.querySelector('#mobile-drawer-tooltip-close');
  closeBtn?.addEventListener('click', () => {
    dismiss();
  });
}
