// Generates a minimal valid 2-frame 200x200 animated GIF89a for e2e tests.
// Large enough for reliable Playwright mouse interactions.
// Run once: node e2e/fixtures/make-test-gif.cjs
'use strict'
const fs = require('fs')
const path = require('path')

function lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize
  const eoi = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = eoi + 1
  const table = new Map()
  for (let i = 0; i < clearCode; i++) table.set(String(i), i)

  const bits = []
  function emitCode(code) {
    for (let i = 0; i < codeSize; i++) bits.push((code >> i) & 1)
  }

  emitCode(clearCode)
  let prefix = String(pixels[0])

  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i]
    const combined = prefix + ',' + k
    if (table.has(combined)) {
      prefix = combined
    } else {
      emitCode(table.get(prefix))
      if (nextCode < 4096) {
        table.set(combined, nextCode++)
        if (nextCode - 1 === 1 << codeSize) codeSize++
      } else {
        emitCode(clearCode)
        table.clear()
        for (let j = 0; j < clearCode; j++) table.set(String(j), j)
        codeSize = minCodeSize + 1
        nextCode = eoi + 1
      }
      prefix = String(k)
    }
  }
  emitCode(table.get(prefix))
  emitCode(eoi)

  // pack bits into bytes (LSB first)
  const bytes = []
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8 && i + j < bits.length; j++) b |= bits[i + j] << j
    bytes.push(b)
  }
  return Buffer.from(bytes)
}

function buildFrame(delay, pixels) {
  const gce = Buffer.from([
    0x21, 0xf9, 0x04,
    0x00,           // disposal = do not dispose
    delay & 0xff, (delay >> 8) & 0xff, // delay in centiseconds
    0x00, 0x00,
  ])

  const imgDesc = Buffer.from([
    0x2c,
    0x00, 0x00, // left
    0x00, 0x00, // top
    0xc8, 0x00, // width = 200
    0xc8, 0x00, // height = 200
    0x00,       // no local color table
  ])

  const minCodeSize = 2
  const lzw = lzwEncode(pixels, minCodeSize)

  // split into sub-blocks (max 255 bytes each)
  const subBlocks = []
  for (let i = 0; i < lzw.length; i += 255) {
    const chunk = lzw.slice(i, i + 255)
    subBlocks.push(Buffer.from([chunk.length]), chunk)
  }
  subBlocks.push(Buffer.from([0x00])) // block terminator

  return Buffer.concat([gce, imgDesc, Buffer.from([minCodeSize]), ...subBlocks])
}

// 200x200 pixels: frame1 all red (index 0), frame2 all green (index 1)
const frame1pixels = new Array(200 * 200).fill(0)
const frame2pixels = new Array(200 * 200).fill(1)

const header = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) // GIF89a
const lsd = Buffer.from([
  0xc8, 0x00, // width = 200
  0xc8, 0x00, // height = 200
  0x80,       // GCT present, 2 colors
  0x00, 0x00,
])
const gct = Buffer.from([0xff, 0x00, 0x00, 0x00, 0xff, 0x00]) // red, green

// Netscape Application Extension (loop forever)
const netscape = Buffer.from([
  0x21, 0xff, 0x0b,
  0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30,
  0x03, 0x01, 0x00, 0x00,
  0x00,
])

const trailer = Buffer.from([0x3b])

const gif = Buffer.concat([
  header, lsd, gct, netscape,
  buildFrame(10, frame1pixels),
  buildFrame(10, frame2pixels),
  trailer,
])

const out = path.join(__dirname, 'test.gif')
fs.writeFileSync(out, gif)
console.log('Wrote', out, '–', gif.length, 'bytes')
