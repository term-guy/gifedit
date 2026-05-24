function colorsMatch(
  data: Uint8ClampedArray,
  idx: number,
  r: number,
  g: number,
  b: number,
  a: number,
  tolerance: number,
): boolean {
  return (
    Math.abs(data[idx] - r) <= tolerance &&
    Math.abs(data[idx + 1] - g) <= tolerance &&
    Math.abs(data[idx + 2] - b) <= tolerance &&
    Math.abs(data[idx + 3] - a) <= tolerance
  )
}

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return [r, g, b, 255]
}

export function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillHex: string,
  tolerance = 15,
): ImageData {
  const { data, width, height } = imageData
  const out = new Uint8ClampedArray(data)
  const [fr, fg, fb, fa] = hexToRgba(fillHex)

  const si = (startY * width + startX) * 4
  const targetR = data[si]
  const targetG = data[si + 1]
  const targetB = data[si + 2]
  const targetA = data[si + 3]

  if (
    targetR === fr &&
    targetG === fg &&
    targetB === fb &&
    targetA === fa
  ) {
    return imageData
  }

  const visited = new Uint8Array(width * height)
  const stack: number[] = [startY * width + startX]
  visited[startY * width + startX] = 1

  while (stack.length > 0) {
    const pos = stack.pop()!
    const x = pos % width
    const y = Math.floor(pos / width)
    const idx = pos * 4

    out[idx] = fr
    out[idx + 1] = fg
    out[idx + 2] = fb
    out[idx + 3] = fa

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const npos = ny * width + nx
      if (visited[npos]) continue
      visited[npos] = 1
      const nidx = npos * 4
      if (colorsMatch(data, nidx, targetR, targetG, targetB, targetA, tolerance)) {
        stack.push(npos)
      }
    }
  }

  return new ImageData(out, width, height)
}
