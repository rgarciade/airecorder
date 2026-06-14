import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import styles from './SchemaMindMap.module.css';

const transformer = new Transformer();

/**
 * Converts schema branches to markmap-compatible Markdown.
 * Each leaf item with a timestamp gets a data attribute so click events can
 * recover the seek time from the rendered SVG node.
 */
function schemaToMarkdown(branches = []) {
  const lines = ['# Reunión'];
  for (const branch of branches) {
    lines.push(`## ${branch.title}`);
    for (const item of branch.items || []) {
      const ts = item.start != null ? ` *(${formatTs(item.start)})*` : '';
      // Embed start seconds as a comment-like suffix markmap ignores but we
      // can parse from text: "Label (MM:SS) [seek:192.4]"
      const seekTag = item.start != null ? ` [seek:${item.start}]` : '';
      lines.push(`- ${item.label}${ts}${seekTag}`);
    }
  }
  return lines.join('\n');
}

function formatTs(secs) {
  const total = Math.floor(secs);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Parses [seek:N] from a markmap node's text content.
 * Returns seconds (number) or null.
 */
function extractSeek(text) {
  const m = text?.match(/\[seek:([\d.]+)\]/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Mind-map using markmap-view.
 * Exposes exportPng(filename) via ref.
 */
const SchemaMindMap = forwardRef(function SchemaMindMap({ branches = [], onSeek }, ref) {
  const svgRef = useRef(null);
  const markmapRef = useRef(null);

  // Build and render whenever branches change
  useEffect(() => {
    if (!svgRef.current) return;

    const md = schemaToMarkdown(branches);
    const { root } = transformer.transform(md);

    if (markmapRef.current) {
      markmapRef.current.setData(root);
      markmapRef.current.fit();
    } else {
      markmapRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 300,
        maxWidth: 300,
        color: ({ depth }) => {
          const palette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
          return palette[depth % palette.length];
        },
      }, root);
    }
  }, [branches]);

  // Click handler: detect seek tags in node text and call onSeek
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleClick = (e) => {
      const textEl = e.target.closest('text, foreignObject, .markmap-node');
      if (!textEl) return;
      const text = textEl.textContent || '';
      const seconds = extractSeek(text);
      if (seconds != null) onSeek?.(seconds);
    };

    svg.addEventListener('click', handleClick);
    return () => svg.removeEventListener('click', handleClick);
  }, [onSeek]);

  useImperativeHandle(ref, () => ({
    exportPng(filename = 'esquema.png') {
      const svg = svgRef.current;
      if (!svg) return;

      // Clone SVG to inline styles (markmap relies on CSS variables)
      const clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const bbox = svg.getBBox?.() ?? { width: svg.clientWidth || 1100, height: svg.clientHeight || 600 };
      clone.setAttribute('width', bbox.width);
      clone.setAttribute('height', bbox.height);

      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(clone);
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = (bbox.width || 1100) * scale;
        canvas.height = (bbox.height || 600) * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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
