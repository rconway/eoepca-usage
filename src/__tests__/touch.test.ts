import { describe, it, expect } from 'vitest';
import { renderMobileTooltip } from '../interaction/touch';
import type { VisualizationNode, PlatformData, BuildingBlockData, LinkData, LinkStatus } from '../types';

function makeBuildingBlock(name: string): BuildingBlockData {
  return {
    name,
    color: '#F5A623',
    links_original: [],
    platforms: [],
    index: 0,
  };
}

function makePlatform(name: string): PlatformData {
  return {
    platform_name: name,
    color: '#22D3EE',
    platform_lines: [],
    platform_max_width: 0,
    links_original: [],
    buildingBlocks: [],
    index: 0,
  };
}

function makeLink(platform: string, buildingBlock: string, status: LinkStatus = 'active'): LinkData {
  return { source: platform, target: buildingBlock, platform, buildingBlock, status };
}

function makePlatformNode(buildingBlockCount = 2, statuses: LinkStatus[] = []): VisualizationNode {
  const data = makePlatform('CDSE openEO');
  data.buildingBlocks = Array.from({ length: buildingBlockCount }, (_, i) => makeBuildingBlock(`Building Block ${i}`));
  data.links_original = data.buildingBlocks.map((b, i) =>
    makeLink('CDSE openEO', b.name, statuses[i] ?? 'active'),
  );
  return {
    id: 'CDSE openEO',
    type: 'platform',
    label: 'CDSE openEO',
    x: 0,
    y: 0,
    r: 10,
    index: 0,
    degree: buildingBlockCount,
    color: '#22D3EE',
    data,
  } as VisualizationNode;
}

function makeBuildingBlockNode(platformCount = 20, statuses: LinkStatus[] = []): VisualizationNode {
  const data = makeBuildingBlock('Processing BB: OpenEO');
  data.platforms = Array.from({ length: platformCount }, (_, i) => makePlatform(`Platform ${i}`));
  data.links_original = data.platforms.map((p, i) =>
    makeLink(p.platform_name, 'Processing BB: OpenEO', statuses[i] ?? 'active'),
  );
  return {
    id: 'Processing BB: OpenEO',
    type: 'buildingBlock',
    label: 'Processing BB: OpenEO',
    x: 0,
    y: 0,
    r: 8,
    index: 0,
    degree: platformCount,
    color: '#F5A623',
    data,
  } as VisualizationNode;
}

describe('renderMobileTooltip — platform', () => {
  it('includes type label', () => {
    const html = renderMobileTooltip(makePlatformNode());
    expect(html).toContain('Platform');
  });

  it('includes platform name', () => {
    const html = renderMobileTooltip(makePlatformNode());
    expect(html).toContain('CDSE openEO');
  });

  it('includes Building Block count and names', () => {
    const html = renderMobileTooltip(makePlatformNode(2));
    expect(html).toContain('2 Building Blocks');
    expect(html).toContain('Building Block 0');
    expect(html).toContain('Building Block 1');
  });

  it('uses singular label for a single Building Block', () => {
    const html = renderMobileTooltip(makePlatformNode(1));
    expect(html).toContain('1 Building Block');
    expect(html).not.toContain('1 Building Blocks');
  });

  it('annotates interested (not yet active) links', () => {
    const html = renderMobileTooltip(makePlatformNode(2, ['active', 'interested']));
    expect(html).toContain('<span>Building Block 0</span>');
    expect(html).toContain('Building Block 1 <em class="tooltip-interested">(future)</em>');
  });
});

describe('renderMobileTooltip — buildingBlock', () => {
  it('includes type label', () => {
    const html = renderMobileTooltip(makeBuildingBlockNode());
    expect(html).toContain('Building Block');
  });

  it('includes Building Block name', () => {
    const html = renderMobileTooltip(makeBuildingBlockNode());
    expect(html).toContain('Processing BB: OpenEO');
  });

  it('includes platform count', () => {
    const html = renderMobileTooltip(makeBuildingBlockNode(5));
    expect(html).toContain('5 platforms');
  });

  it('shows up to 14 platforms with overflow note', () => {
    const html = renderMobileTooltip(makeBuildingBlockNode(20));
    expect(html).toContain('Platform 0');
    expect(html).toContain('Platform 13');
    expect(html).toContain('+ 6 more');
    expect(html).not.toContain('Platform 14');
  });

  it('uses singular label for a single platform', () => {
    const html = renderMobileTooltip(makeBuildingBlockNode(1));
    expect(html).toContain('1 platform');
    expect(html).not.toContain('1 platforms');
  });

  it('annotates interested (not yet active) links', () => {
    const html = renderMobileTooltip(makeBuildingBlockNode(2, ['interested', 'active']));
    expect(html).toContain('Platform 0 <em class="tooltip-interested">(future)</em>');
    expect(html).toContain('<span>Platform 1</span>');
  });
});
