import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import styles from './SchemaMindMap.module.css';

const transformer = new Transformer();

function formatTs(secs) {
  const total = Math.floor(secs);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Converts schema branches to clean Markdown (no seek tags).
 * Returns { md, seekMap } where seekMap: Map<label → start_seconds>.
 * Supports arbitrary nesting via node.children (new format) with fallback
 * to node.items (legacy flat format).
 */
function buildMarkdown(branches = []) {
  const seekMap = new Map();
  const lines = ['# Reunión'];

  function renderChildren(children, depth) {
    const indent = '  '.repeat(depth - 1);
    for (const child of children) {
      const label = child.label || '';
      const ts = child.start != null ? ` *(${formatTs(child.start)})*` : '';
      lines.push(`${indent}- ${label}${ts}`);
      if (child.start != null) seekMap.set(label, child.start);
      if (child.children?.length) renderChildren(child.children, depth + 1);
    }
  }

  for (const branch of branches) {
    lines.push(`## ${branch.title}`);
    const nodes = branch.children || branch.items || [];
    if (nodes.length) renderChildren(nodes, 1);
  }

  return { md: lines.join('\n'), seekMap };
}

/**
 * Given a markmap node's textContent, extract the raw label
 * by stripping the trailing " (MM:SS)" that markmap renders from italic markdown.
 */
function labelFromNodeText(text = '') {
  return text.replace(/\s*\(\d{2}:\d{2}\)\s*$/, '').trim();
}

/**
 * Mind-map using markmap-view.
 * Nodes with a timestamp show "(MM:SS)" — clicking them triggers onSeek.
 * Exposes exportPng(filename) via ref.
 */
const SchemaMindMap = forwardRef(function SchemaMindMap({ branches = [], onSeek }, ref) {
  const svgRef = useRef(null);
  const markmapRef = useRef(null);
  const seekMapRef = useRef(new Map());

  // Build and render whenever branches change
  useEffect(() => {
    if (!svgRef.current) return;

    const { md, seekMap } = buildMarkdown(branches);
    seekMapRef.current = seekMap;

    const { root } = transformer.transform(md);

    if (markmapRef.current) {
      markmapRef.current.setData(root);
      markmapRef.current.fit();
    } else {
      markmapRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 300,
        maxWidth: 320,
      }, root);
    }
  }, [branches]);

  // Click → seek + hover cursor: only on nodes with a timestamp in seekMap
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const getNodeLabel = (e) => {
      const nodeEl = e.target.closest('g.markmap-node');
      if (!nodeEl) return null;
      const textEl = nodeEl.querySelector('text') || nodeEl.querySelector('foreignObject');
      if (!textEl) return null;
      return labelFromNodeText(textEl.textContent || '');
    };

    const handleClick = (e) => {
      const label = getNodeLabel(e);
      if (label == null) return;
      const seconds = seekMapRef.current.get(label);
      if (seconds != null) onSeek?.(seconds);
    };

    const handleMouseOver = (e) => {
      const label = getNodeLabel(e);
      svg.style.cursor = (label != null && seekMapRef.current.has(label)) ? 'pointer' : 'default';
    };

    const handleMouseOut = () => { svg.style.cursor = 'default'; };

    svg.addEventListener('click', handleClick);
    svg.addEventListener('mouseover', handleMouseOver);
    svg.addEventListener('mouseout', handleMouseOut);
    return () => {
      svg.removeEventListener('click', handleClick);
      svg.removeEventListener('mouseover', handleMouseOver);
      svg.removeEventListener('mouseout', handleMouseOut);
    };
  }, [onSeek]);

  useImperativeHandle(ref, () => ({
    async exportPng(filename = 'esquema.png') {
      const svg = svgRef.current;
      if (!svg) return;

      // markmap uses foreignObject for text — XMLSerializer + canvas fails silently.
      // Use Electron's native capturePage instead: screenshot the exact SVG bounding rect.
      const rect = svg.getBoundingClientRect();
      try {
        const result = await window.electronAPI.captureAreaPng({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
        if (!result.success) throw new Error(result.error);

        const blob = new Blob([result.buffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        console.error('[exportPng] Error:', err);
      }
    }
  }));

  return (
    <div className={styles.wrapper}>
      <svg ref={svgRef} className={styles.svg} />
    </div>
  );
});

export default SchemaMindMap;
