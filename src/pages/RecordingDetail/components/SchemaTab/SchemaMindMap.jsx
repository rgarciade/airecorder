import React, { useRef, useEffect, useState } from 'react';
import styles from './SchemaMindMap.module.css';

// ── Layout constants ──────────────────────────────────────────────────────────
const SVG_W = 1100;
const SVG_H = 620;
const CX = SVG_W / 2;   // center x
const CY = SVG_H / 2;   // center y

const CENTER_RX = 64;
const CENTER_RY = 26;
const BRANCH_RX = 72;
const BRANCH_RY = 20;
const ITEM_RX = 80;
const ITEM_RY = 16;

const ITEM_GAP = 38;       // vertical gap between items
const BRANCH_GAP = 200;    // vertical gap between the two branches on each side
const BRANCH_X_OFFSET = 220; // horizontal distance center → branch
const ITEM_X_OFFSET = 180;   // horizontal distance branch → item

// Branch colors (one per branch index)
const BRANCH_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

function formatSeconds(secs) {
  if (secs == null) return null;
  const total = Math.floor(secs);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Renders a curved bezier path between two points.
 * (x1,y1) → control → (x2,y2)
 */
function bezier(x1, y1, x2, y2) {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

/**
 * Pure-SVG mind-map for a recording schema.
 *
 * Layout: left branches (idx 0,1) on the left, right branches (idx 2,3) on the right.
 * Each branch has items extending further in the same direction.
 *
 * @param {{ branches: Array, title: string, onSeek: Function }} props
 */
export default function SchemaMindMap({ branches = [], title = '', onSeek }) {
  const svgRef = useRef(null);
  const [hoveredItem, setHoveredItem] = useState(null);

  // Assign branches to sides: first half → left, second half → right
  const leftBranches = branches.slice(0, Math.ceil(branches.length / 2));
  const rightBranches = branches.slice(Math.ceil(branches.length / 2));

  /**
   * Compute Y position for branch idx within a side group.
   * Centers the group around CY.
   */
  function branchY(idx, total) {
    const totalHeight = (total - 1) * BRANCH_GAP;
    const startY = CY - totalHeight / 2;
    return startY + idx * BRANCH_GAP;
  }

  /**
   * Compute Y positions for items of a branch.
   */
  function itemYs(branch, bY) {
    const count = branch.items?.length ?? 0;
    if (count === 0) return [];
    const totalH = (count - 1) * ITEM_GAP;
    const startY = bY - totalH / 2;
    return (branch.items || []).map((_, i) => startY + i * ITEM_GAP);
  }

  const nodes = [];
  const paths = [];

  // ── Left branches ─────────────────────────────────────────────────────────
  leftBranches.forEach((branch, lIdx) => {
    const globalIdx = lIdx;
    const color = BRANCH_COLORS[globalIdx % BRANCH_COLORS.length];
    const bX = CX - BRANCH_X_OFFSET;
    const bY = branchY(lIdx, leftBranches.length);

    // Center → Branch line
    paths.push(
      <path
        key={`lp-${globalIdx}`}
        d={bezier(CX - CENTER_RX, CY, bX + BRANCH_RX, bY)}
        stroke={color}
        strokeWidth={2}
        fill="none"
        opacity={0.6}
      />
    );

    // Branch node
    nodes.push(
      <g key={`lb-${globalIdx}`}>
        <rect
          x={bX - BRANCH_RX}
          y={bY - BRANCH_RY}
          width={BRANCH_RX * 2}
          height={BRANCH_RY * 2}
          rx={BRANCH_RY}
          fill={color}
          opacity={0.15}
          stroke={color}
          strokeWidth={1.5}
        />
        <text
          x={bX}
          y={bY + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={600}
          fill={color}
        >
          {branch.title?.length > 18 ? branch.title.slice(0, 17) + '…' : branch.title}
        </text>
      </g>
    );

    // Items
    const iX = bX - ITEM_X_OFFSET;
    const iYArr = itemYs(branch, bY);
    (branch.items || []).forEach((item, iIdx) => {
      const iY = iYArr[iIdx];
      const ts = formatSeconds(item.start);
      const seekable = item.start != null;
      const isHovered = hoveredItem === `l-${globalIdx}-${iIdx}`;

      // Branch → Item line
      paths.push(
        <path
          key={`lip-${globalIdx}-${iIdx}`}
          d={bezier(bX - BRANCH_RX, bY, iX + ITEM_RX, iY)}
          stroke={color}
          strokeWidth={1.2}
          fill="none"
          opacity={0.4}
        />
      );

      // Item node
      nodes.push(
        <g
          key={`li-${globalIdx}-${iIdx}`}
          style={{ cursor: seekable ? 'pointer' : 'default' }}
          onClick={seekable ? () => onSeek?.(item.start) : undefined}
          onMouseEnter={() => setHoveredItem(`l-${globalIdx}-${iIdx}`)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <rect
            x={iX - ITEM_RX}
            y={iY - ITEM_RY}
            width={ITEM_RX * 2}
            height={ITEM_RY * 2}
            rx={ITEM_RY}
            fill={isHovered && seekable ? color : 'var(--color-surface-secondary, #f9fafb)'}
            stroke={color}
            strokeWidth={1}
            opacity={isHovered && seekable ? 0.9 : 0.7}
          />
          <text
            x={iX}
            y={iY - (ts ? 3 : 1)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9.5}
            fill={isHovered && seekable ? '#fff' : 'var(--color-text-primary, #111)'}
            fontWeight={500}
          >
            {item.label?.length > 20 ? item.label.slice(0, 19) + '…' : item.label}
          </text>
          {ts && (
            <text
              x={iX}
              y={iY + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8}
              fill={isHovered ? '#fff' : color}
              fontWeight={600}
            >
              ▶ {ts}
            </text>
          )}
        </g>
      );
    });
  });

  // ── Right branches ────────────────────────────────────────────────────────
  rightBranches.forEach((branch, rIdx) => {
    const globalIdx = leftBranches.length + rIdx;
    const color = BRANCH_COLORS[globalIdx % BRANCH_COLORS.length];
    const bX = CX + BRANCH_X_OFFSET;
    const bY = branchY(rIdx, rightBranches.length);

    // Center → Branch line
    paths.push(
      <path
        key={`rp-${globalIdx}`}
        d={bezier(CX + CENTER_RX, CY, bX - BRANCH_RX, bY)}
        stroke={color}
        strokeWidth={2}
        fill="none"
        opacity={0.6}
      />
    );

    // Branch node
    nodes.push(
      <g key={`rb-${globalIdx}`}>
        <rect
          x={bX - BRANCH_RX}
          y={bY - BRANCH_RY}
          width={BRANCH_RX * 2}
          height={BRANCH_RY * 2}
          rx={BRANCH_RY}
          fill={color}
          opacity={0.15}
          stroke={color}
          strokeWidth={1.5}
        />
        <text
          x={bX}
          y={bY + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={600}
          fill={color}
        >
          {branch.title?.length > 18 ? branch.title.slice(0, 17) + '…' : branch.title}
        </text>
      </g>
    );

    // Items
    const iX = bX + ITEM_X_OFFSET;
    const iYArr = itemYs(branch, bY);
    (branch.items || []).forEach((item, iIdx) => {
      const iY = iYArr[iIdx];
      const ts = formatSeconds(item.start);
      const seekable = item.start != null;
      const isHovered = hoveredItem === `r-${globalIdx}-${iIdx}`;

      paths.push(
        <path
          key={`rip-${globalIdx}-${iIdx}`}
          d={bezier(bX + BRANCH_RX, bY, iX - ITEM_RX, iY)}
          stroke={color}
          strokeWidth={1.2}
          fill="none"
          opacity={0.4}
        />
      );

      nodes.push(
        <g
          key={`ri-${globalIdx}-${iIdx}`}
          style={{ cursor: seekable ? 'pointer' : 'default' }}
          onClick={seekable ? () => onSeek?.(item.start) : undefined}
          onMouseEnter={() => setHoveredItem(`r-${globalIdx}-${iIdx}`)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <rect
            x={iX - ITEM_RX}
            y={iY - ITEM_RY}
            width={ITEM_RX * 2}
            height={ITEM_RY * 2}
            rx={ITEM_RY}
            fill={isHovered && seekable ? color : 'var(--color-surface-secondary, #f9fafb)'}
            stroke={color}
            strokeWidth={1}
            opacity={isHovered && seekable ? 0.9 : 0.7}
          />
          <text
            x={iX}
            y={iY - (ts ? 3 : 1)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9.5}
            fill={isHovered && seekable ? '#fff' : 'var(--color-text-primary, #111)'}
            fontWeight={500}
          >
            {item.label?.length > 20 ? item.label.slice(0, 19) + '…' : item.label}
          </text>
          {ts && (
            <text
              x={iX}
              y={iY + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8}
              fill={isHovered ? '#fff' : color}
              fontWeight={600}
            >
              ▶ {ts}
            </text>
          )}
        </g>
      );
    });
  });

  return (
    <div className={styles.wrapper}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        height="100%"
        className={styles.svg}
        role="img"
        aria-label="Mind map"
      >
        {/* Paths drawn first (below nodes) */}
        {paths}

        {/* Center node */}
        <ellipse cx={CX} cy={CY} rx={CENTER_RX} ry={CENTER_RY} fill="#6366f1" opacity={0.9} />
        <text
          x={CX}
          y={CY + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fontWeight={700}
          fill="#fff"
        >
          {title?.length > 16 ? title.slice(0, 15) + '…' : (title || 'Reunión')}
        </text>

        {/* Branch + item nodes */}
        {nodes}
      </svg>
    </div>
  );
}
