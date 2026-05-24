function makeStickerSvg(emoji: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <text
        x="32"
        y="32"
        font-size="52"
        text-anchor="middle"
        dominant-baseline="central"
      >${emoji}</text>
    </svg>
  `.trim()
}

export const stickers = [
  { id: 'star', emoji: '⭐', svg: makeStickerSvg('⭐') },
  { id: 'fire', emoji: '🔥', svg: makeStickerSvg('🔥') },
  { id: 'heart', emoji: '❤️', svg: makeStickerSvg('❤️') },
  { id: 'laugh', emoji: '😂', svg: makeStickerSvg('😂') },
  { id: 'cool', emoji: '😎', svg: makeStickerSvg('😎') },
  { id: 'party', emoji: '🎉', svg: makeStickerSvg('🎉') },
  { id: 'rocket', emoji: '🚀', svg: makeStickerSvg('🚀') },
  { id: 'crown', emoji: '👑', svg: makeStickerSvg('👑') },
  { id: 'sparkle', emoji: '✨', svg: makeStickerSvg('✨') },
  { id: 'thumbsup', emoji: '👍', svg: makeStickerSvg('👍') },
  { id: 'clap', emoji: '👏', svg: makeStickerSvg('👏') },
  { id: 'eyes', emoji: '👀', svg: makeStickerSvg('👀') },
  { id: 'rainbow', emoji: '🌈', svg: makeStickerSvg('🌈') },
  { id: 'lightning', emoji: '⚡', svg: makeStickerSvg('⚡') },
  { id: 'bomb', emoji: '💣', svg: makeStickerSvg('💣') },
  { id: 'alien', emoji: '👽', svg: makeStickerSvg('👽') },
  { id: 'ghost', emoji: '👻', svg: makeStickerSvg('👻') },
  { id: 'diamond', emoji: '💎', svg: makeStickerSvg('💎') },
  { id: 'music', emoji: '🎵', svg: makeStickerSvg('🎵') },
  { id: 'camera', emoji: '📸', svg: makeStickerSvg('📸') },
  { id: 'trophy', emoji: '🏆', svg: makeStickerSvg('🏆') },
  { id: 'wave', emoji: '🌊', svg: makeStickerSvg('🌊') },
  { id: 'dragon', emoji: '🐉', svg: makeStickerSvg('🐉') },
  { id: 'skull', emoji: '💀', svg: makeStickerSvg('💀') },
]

export function stickerToDataUrl(svg: string): string {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  return URL.createObjectURL(blob)
}
