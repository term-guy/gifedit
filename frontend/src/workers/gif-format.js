import { ByteArray, LZWEncoder } from './gif-lzw.js'

export function GIFEncoder(width, height) {
  this.width = width
  this.height = height
  this.repeat = -1
  this.out = new ByteArray()
}

GIFEncoder.prototype.writeHeader = function writeHeader() {
  this.out.writeUTFBytes('GIF89a')
}

GIFEncoder.prototype.writeShort = function writeShort(value) {
  this.out.writeByte(value & 0xff)
  this.out.writeByte((value >> 8) & 0xff)
}

GIFEncoder.prototype.writeLSD = function writeLSD() {
  this.writeShort(this.width)
  this.writeShort(this.height)
  this.out.writeByte(0x70)
  this.out.writeByte(0)
  this.out.writeByte(0)
}

GIFEncoder.prototype.writeNetscapeExt = function writeNetscapeExt() {
  this.out.writeByte(0x21)
  this.out.writeByte(0xff)
  this.out.writeByte(11)
  this.out.writeUTFBytes('NETSCAPE2.0')
  this.out.writeByte(3)
  this.out.writeByte(1)
  this.writeShort(this.repeat)
  this.out.writeByte(0)
}

GIFEncoder.prototype.writeGraphicCtrlExt = function writeGraphicCtrlExt(delay, transparentIndex, dispose) {
  this.out.writeByte(0x21)
  this.out.writeByte(0xf9)
  this.out.writeByte(4)
  const transp = transparentIndex == null ? 0 : 1
  const packed = ((dispose & 0x7) << 2) | transp
  this.out.writeByte(packed)
  this.writeShort(Math.max(0, Math.round(delay / 10)))
  this.out.writeByte(transparentIndex ?? 0)
  this.out.writeByte(0)
}

GIFEncoder.prototype.writeImageDesc = function writeImageDesc(left, top, width, height, paletteSize) {
  this.out.writeByte(0x2c)
  this.writeShort(left)
  this.writeShort(top)
  this.writeShort(width)
  this.writeShort(height)
  this.out.writeByte(0x80 | (paletteSize & 0x07))
}

GIFEncoder.prototype.writePalette = function writePalette(colorTab) {
  this.out.writeBytes(colorTab)
  const remaining = 768 - colorTab.length
  for (let i = 0; i < remaining; i++) this.out.writeByte(0)
}

GIFEncoder.prototype.writePixels = function writePixels(indexedPixels, width, height) {
  const encoder = new LZWEncoder(width, height, indexedPixels, 8)
  encoder.encode(this.out)
}

GIFEncoder.prototype.finish = function finish() {
  this.out.writeByte(0x3b)
}
