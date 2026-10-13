// Adds Cloudinary delivery transforms (auto format/quality, width) when the image is hosted there.
// Any other URL (including local demo SVGs) is returned untouched.
const CLD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

export function responsiveImage(image, widths = [480, 768, 1152, 1600]) {
  const m = CLD.exec(image?.url || '');
  if (!m) return { src: image?.url };
  const at = (w) => `${m[1]}f_auto,q_auto,c_limit,w_${w}/${m[2]}`;
  return { src: at(widths[2] ?? widths[widths.length - 1]), srcSet: widths.map((w) => `${at(w)} ${w}w`).join(', ') };
}
