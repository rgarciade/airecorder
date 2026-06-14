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
 *
 * Key: item.label (raw). Multiple items with the same label across branches
 * are unlikely but would share the same seek time — acceptable edge case.
 */
function buildMarkdown(branches = []) {
  const seekMap = new Map();
  const lines = ['# Reunión'];

  for (const branch of branches) {
    lines.push(`## ${branch.title}`);
    for (const item of branch.items || []) {
      const ts = item.start != null ? ` *(${formatTs(item.start)})*` : '';
      lines.push(`- ${item.label}${ts}`);
      if (item.start != null) {
        seekMap.set(item.label, item.start);
      }
    }
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

  // Click → seek: find the closest markmap node, extract label, look up in map
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleClick = (e) => {
      const nodeEl = e.target.closest('g.markmap-node');
      if (!nodeEl) return;

      // markmap renders node text inside <text> or <foreignObject>
      const textEl = nodeEl.querySelector('text') || nodeEl.querySelector('foreignObject');
      if (!textEl) return;

      const label = labelFromNodeText(textEl.textContent || '');
      const seconds = seekMapRef.current.get(label);
      if (seconds != null) onSeek?.(seconds);
    };

    svg.addEventListener('click', handleClick);
    return () => svg.removeEventListener('click', handleClick);
  }, [onSeek]);

  useImperativeHandle(ref, () => ({
    exportPng(filename = 'esquema.png') {
      const svg = svgRef.current;
      if (!svg) return;

      const clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      let w, h;
      try {
        const bbox = svg.getBBox();
        w = bbox.width || svg.clientWidth || 1100;
        h = bbox.height || svg.clientHeight || 600;
      } catch {
        w = svg.clientWidth || 1100;
        h = svg.clientHeight || 600;
      }
      clone.setAttribute('width', w);
      clone.setAttribute('height', h);

      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(clone);
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((pngBlob) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(pngBlob);
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }, 'image/png');
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    }
  }));

  return (
    <div className={styles.wrapper}>
      <svg ref={svgRef} className={styles.svg} />
    </div>
  );
});

export default SchemaMindMap;
