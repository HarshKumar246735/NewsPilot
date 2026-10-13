import { responsiveImage } from '../utils/cloudinary.js';
import './Img.css';

// Always renders with intrinsic width/height so the browser reserves space (no layout shift).
// `priority` is for the single above-the-fold image: loaded eagerly, never lazy. Its high-priority preload
// is emitted in <head> by head.js, so there is no hydration-sensitive markup in the body.
export default function Img({ image, sizes = '100vw', priority = false, className = '' }) {
  if (!image?.url) return <div className={`img-fallback ${className}`} aria-hidden="true" />;
  const r = responsiveImage(image);
  return (
    <img className={`img ${className}`} src={r.src} srcSet={r.srcSet} sizes={r.srcSet ? sizes : undefined}
      width={image.width} height={image.height} alt={image.alt || ''}
      loading={priority ? 'eager' : 'lazy'} decoding={priority ? undefined : 'async'} />
  );
}
