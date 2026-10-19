import React from 'react';

/**
 * The RoadWatch mark (location marker rising from two road contours, amber on
 * deep navy). Redrawn inline so it stays razor-sharp at any size; geometry and
 * colours are identical to the provided asset.
 */
export function RoadWatchMark({ size = 40, className, style, ...rest }) {
  return (
    <svg
      viewBox="0 0 176 176"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      {...rest}
    >
      <rect x="4" y="4" width="168" height="168" rx="38" fill="#101F3B" />
      <g fill="none" stroke="#FFB323" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M88 34c-16 0-29 13-29 29 0 21 29 46 29 46s29-25 29-46c0-16-13-29-29-29Z" />
        <path d="m49 116 39 21 39-21M49 133l39 21 39-21" />
      </g>
      <circle cx="88" cy="63" r="6" fill="#FFB323" />
    </svg>
  );
}

/**
 * Horizontal RoadWatch lockup: mark + "RoadWatch" wordmark + "BULACAN ·
 * COMMUNITY SAFETY" tagline + amber underline.
 *
 * Rebuilt with the app's own display/mono fonts so it renders cleaner and
 * sharper than the original SVG (whose <text> fell back to a system font when
 * loaded through an <img>). Proportions, colours and the tagline treatment
 * follow the reference artwork; only the tagline size is nudged up slightly so
 * it stays legible at header sizes.
 *
 * @param {number|string} [height]  height of the mark in px; everything else scales from it
 * @param {boolean} [light]         use light text for dark backgrounds (e.g. the footer)
 */
export default function RoadWatchWordmark({ height = 44, light = false, className, style, ...rest }) {
  const mark = height;
  const wordColor = light ? '#eaf0fb' : '#101F3B';
  const tagColor = light ? '#9db0cf' : '#5E6D83';

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: `calc(${mark} * 0.2)`, ...style }}
      {...rest}
    >
      <RoadWatchMark size={mark} />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <span
          style={{
            fontFamily: "var(--font-display, 'Sora', sans-serif)",
            fontWeight: 800,
            fontSize: `calc(${mark} * 0.44)`,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: wordColor,
          }}
        >
          RoadWatch
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
            fontWeight: 600,
            fontSize: `max(8px, calc(${mark} * 0.13))`,
            lineHeight: 1,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            color: tagColor,
            marginTop: `calc(${mark} * 0.11)`,
          }}
        >
          Bulacan · Community Safety
        </span>
        <span
          aria-hidden="true"
          style={{
            width: `calc(${mark} * 0.5)`,
            height: `max(2px, calc(${mark} * 0.045))`,
            background: '#FFB323',
            borderRadius: 999,
            marginTop: `calc(${mark} * 0.11)`,
          }}
        />
      </span>
    </span>
  );
}
