// jsdom has no layout engine, so CM6's measurement layer gets zero rects.
// Selection drawing and posAtCoords still run, they just see a flat page
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  const zero = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
  Range.prototype.getClientRects = () => []
  Range.prototype.getBoundingClientRect = zero
  Element.prototype.getBoundingClientRect = zero
}
