export function ByteArray() {
  this.page = -1
  this.pages = []
  this.totalLength = 0
  this.newPage()
}

ByteArray.pageSize = 4096

ByteArray.prototype.newPage = function newPage() {
  this.pages[++this.page] = new Uint8Array(ByteArray.pageSize)
  this.cursor = 0
}

ByteArray.prototype.writeByte = function writeByte(value) {
  if (this.cursor >= ByteArray.pageSize) this.newPage()
  this.pages[this.page][this.cursor++] = value & 0xff
  this.totalLength++
}

ByteArray.prototype.writeBytes = function writeBytes(array, offset = 0, length = array.length) {
  for (let i = offset; i < length; i++) this.writeByte(array[i])
}

ByteArray.prototype.writeUTFBytes = function writeUTFBytes(string) {
  for (let i = 0; i < string.length; i++) this.writeByte(string.charCodeAt(i))
}

ByteArray.prototype.toUint8Array = function toUint8Array() {
  const output = new Uint8Array(this.totalLength)
  let written = 0
  for (let i = 0; i < this.pages.length; i++) {
    const page = this.pages[i]
    const length = i === this.pages.length - 1 ? this.cursor : ByteArray.pageSize
    output.set(page.subarray(0, length), written)
    written += length
  }
  return output
}

export function LZWEncoder(width, height, pixels, colorDepth) {
  const EOF = -1
  const BITS = 12
  const HSIZE = 5003
  const masks = [0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095]
  const initCodeSize = Math.max(2, colorDepth)
  const accum = new Uint8Array(256)
  const htab = new Int32Array(HSIZE)
  const codetab = new Int32Array(HSIZE)

  let curAccum = 0
  let curBits = 0
  let aCount = 0
  let freeEnt = 0
  let maxcode = 0
  let clearFlag = false
  let gInitBits = 0
  let clearCode = 0
  let eofCode = 0
  let nBits = 0
  let remaining = 0
  let curPixel = 0

  function charOut(c, outs) {
    accum[aCount++] = c
    if (aCount >= 254) flushChar(outs)
  }

  function flushChar(outs) {
    if (aCount > 0) {
      outs.writeByte(aCount)
      outs.writeBytes(accum, 0, aCount)
      aCount = 0
    }
  }

  function maxCode(bits) {
    return (1 << bits) - 1
  }

  function nextPixel() {
    if (remaining === 0) return EOF
    remaining--
    return pixels[curPixel++] & 0xff
  }

  function output(code, outs) {
    curAccum &= masks[curBits]
    if (curBits > 0) curAccum |= code << curBits
    else curAccum = code
    curBits += nBits

    while (curBits >= 8) {
      charOut(curAccum & 0xff, outs)
      curAccum >>= 8
      curBits -= 8
    }

    if (freeEnt > maxcode || clearFlag) {
      if (clearFlag) {
        nBits = gInitBits
        maxcode = maxCode(nBits)
        clearFlag = false
      } else {
        nBits++
        maxcode = nBits === BITS ? (1 << BITS) : maxCode(nBits)
      }
    }

    if (code === eofCode) {
      while (curBits > 0) {
        charOut(curAccum & 0xff, outs)
        curAccum >>= 8
        curBits -= 8
      }
      flushChar(outs)
    }
  }

  function clearHash(size) {
    for (let i = 0; i < size; i++) htab[i] = -1
  }

  function clearBlock(outs) {
    clearHash(HSIZE)
    freeEnt = clearCode + 2
    clearFlag = true
    output(clearCode, outs)
  }

  function compress(initBits, outs) {
    gInitBits = initBits
    clearFlag = false
    nBits = gInitBits
    maxcode = maxCode(nBits)
    clearCode = 1 << (initBits - 1)
    eofCode = clearCode + 1
    freeEnt = clearCode + 2
    aCount = 0

    let ent = nextPixel()
    let hshift = 0
    for (let fcode = HSIZE; fcode < 65536; fcode *= 2) hshift++
    hshift = 8 - hshift

    const hsizeReg = HSIZE
    clearHash(hsizeReg)
    output(clearCode, outs)

    let c
    while ((c = nextPixel()) !== EOF) {
      const fcode = (c << BITS) + ent
      let i = (c << hshift) ^ ent

      if (htab[i] === fcode) { ent = codetab[i]; continue }

      if (htab[i] >= 0) {
        let disp = hsizeReg - i
        if (i === 0) disp = 1
        do {
          i -= disp
          if (i < 0) i += hsizeReg
          if (htab[i] === fcode) { ent = codetab[i]; break }
        } while (htab[i] >= 0)
        if (htab[i] === fcode) continue
      }

      output(ent, outs)
      ent = c
      if (freeEnt < 1 << BITS) {
        codetab[i] = freeEnt++
        htab[i] = fcode
      } else {
        clearBlock(outs)
      }
    }

    output(ent, outs)
    output(eofCode, outs)
  }

  this.encode = (outs) => {
    outs.writeByte(initCodeSize)
    remaining = width * height
    curPixel = 0
    compress(initCodeSize + 1, outs)
    outs.writeByte(0)
  }
}
