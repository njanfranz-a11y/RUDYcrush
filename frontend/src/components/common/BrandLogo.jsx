import React from 'react';
import wordmarkSrc from '../../assets/roadwatch-logo.svg';
import markSrc from '../../assets/roadwatch-mark.svg';

const VARIANTS = {
  // Horizontal logo: mark + wordmark + "BULACAN · COMMUNITY SAFETY" tagline.
  wordmark: { src: wordmarkSrc, alt: 'RoadWatch — Bulacan Community Safety' },
  // Square mark on its own, for compact/sidebar areas.
  mark: { src: markSrc, alt: 'RoadWatch' },
};

/**
 * Shared RoadWatch logo, used so every header and compact logo area stays
 * consistent and both assets are reused rather than duplicated.
 *
 * The source artwork is used as-is (never recoloured, cropped or stretched).
 * Only `height` is set; width follows the intrinsic aspect ratio automatically.
 *
 * @param {'wordmark'|'mark'} variant  which provided logo to render
 * @param {number|string} [height]     displayed height in px (default 40)
 */
export default function BrandLogo({ variant = 'mark', height = 40, className, style, alt, ...rest }) {
  const preset = VARIANTS[variant] ?? VARIANTS.mark;

  return (
    <img
      src={preset.src}
      alt={alt ?? preset.alt}
      className={className}
      draggable={false}
      decoding="async"
      style={{
        height,
        width: 'auto',
        display: 'block',
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
      {...rest}
    />
  );
}
