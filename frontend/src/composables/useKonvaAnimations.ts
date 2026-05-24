import Konva from 'konva'
import { ks, hasSelection } from './konvaState'
import { scheduleSerialize } from './useKonvaSerializer'
import { useKonvaSelection } from './useKonvaSelection'
import { useGifStore } from '@/stores/gifStore'
import { getRenderedTextAnimationState } from '@/composables/useTextAnimations'
import type { TextAnimation } from '@/types'

export function useKonvaAnimations() {
  const gifStore = useGifStore()

  function schedule() { scheduleSerialize(gifStore, ks.selectionOutline) }

  function isSelectedAnimationNode() {
    return Boolean(ks.selectionTarget?.getAttr('isAnimationNode'))
  }

  function syncAnimatedTextVisibility(frameIndex: number, animations: TextAnimation[]) {
    if (!ks.drawLayer) return
    const activeSourceNodeIds = new Set(
      animations
        .filter((anim) =>
          anim.sourceNodeId &&
          frameIndex >= anim.startFrame &&
          frameIndex <= anim.endFrame,
        )
        .map((anim) => anim.sourceNodeId as string),
    )

    let changed = false
    for (const node of ks.drawLayer.getChildren()) {
      if (!(node instanceof Konva.Text)) continue
      const shouldBeVisible = !activeSourceNodeIds.has(node.id())
      if (node.visible() !== shouldBeVisible) {
        node.visible(shouldBeVisible)
        changed = true
      }
    }

    if (!ks.selectionTarget?.isVisible()) {
      const { hideSelectionOutline } = useKonvaSelection()
      ks.transformer?.nodes([])
      hideSelectionOutline()
      hasSelection.value = false
    }

    if (changed) ks.drawLayer.batchDraw()
  }

  function updateAnimationFromNode(node: Konva.Text, anim: TextAnimation, frameIndex: number) {
    if (!ks.stage) return
    const { updateSelectionOutline } = useKonvaSelection()
    const width = ks.stage.width()
    const height = ks.stage.height()
    const scale = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()), 0.1)
    const nextX = node.x() / width
    const nextY = node.y() / height
    const patch: Partial<TextAnimation> = {
      fontSize: Math.max(1, Math.round(node.fontSize() * scale)),
    }

    node.fontSize(patch.fontSize)
    node.scale({ x: 1, y: 1 })
    updateSelectionOutline()

    if (anim.type === 'pan') {
      const range = anim.endFrame - anim.startFrame
      if (anim.panDirection === 'left-to-right' || anim.panDirection === 'right-to-left') {
        const currentX = getRenderedTextAnimationState(anim, frameIndex, width, height).x / width
        const deltaX = nextX - currentX
        patch.panStartX = (anim.panStartX ?? 0) + deltaX
        patch.panEndX = (anim.panEndX ?? 1) + deltaX
        patch.y = nextY
      } else {
        const currentY = getRenderedTextAnimationState(anim, frameIndex, width, height).y / height
        const deltaY = nextY - currentY
        patch.panStartY = (anim.panStartY ?? 0) + deltaY
        patch.panEndY = (anim.panEndY ?? 1) + deltaY
        patch.x = nextX
      }
      if (range <= 0) {
        if (anim.panDirection === 'left-to-right' || anim.panDirection === 'right-to-left') {
          patch.panStartX = nextX
          patch.panEndX = nextX
        } else {
          patch.panStartY = nextY
          patch.panEndY = nextY
        }
      }
    } else {
      patch.x = nextX
      patch.y = nextY
    }

    gifStore.updateTextAnimation(anim.id, patch)
  }

  function renderAnimationNodes(frameIndex: number) {
    if (!ks.animationLayer || !ks.stage) return
    const {
      configureTransformerForNode,
      updateSelectionOutline,
      hideSelectionOutline,
      selectNode,
    } = useKonvaSelection()

    const selectedAnimationId = typeof ks.selectionTarget?.getAttr('animationId') === 'string'
      ? ks.selectionTarget?.getAttr('animationId') as string
      : null
    let selectedNodeToRestore: Konva.Text | null = null

    const nodes = ks.animationLayer.getChildren().filter(
      (node) => node !== ks.transformer && node !== ks.selectionOutline,
    )
    nodes.forEach((node) => node.destroy())

    for (const anim of gifStore.textAnimations) {
      if (frameIndex < anim.startFrame || frameIndex > anim.endFrame) continue
      const state = getRenderedTextAnimationState(anim, frameIndex, ks.stage.width(), ks.stage.height())
      const textNode = new Konva.Text({
        x: state.x,
        y: state.y,
        text: state.text,
        fontSize: anim.fontSize,
        fontFamily: anim.fontFamily,
        fill: anim.color,
        opacity: state.alpha,
        draggable: true,
      })
      textNode.setAttr('animationId', anim.id)
      textNode.setAttr('isAnimationNode', true)
      textNode.on('click tap', () => selectNode(textNode))
      textNode.on('dragstart transformstart', () => schedule())
      textNode.on('dragmove transform', updateSelectionOutline)
      textNode.on('dragend', () => updateAnimationFromNode(textNode, anim, frameIndex))
      textNode.on('transformend', () => updateAnimationFromNode(textNode, anim, frameIndex))
      ks.animationLayer.add(textNode)

      if (selectedAnimationId === anim.id) {
        selectedNodeToRestore = textNode
      }
    }

    if (selectedNodeToRestore) {
      configureTransformerForNode(selectedNodeToRestore)
      ks.transformer?.nodes([selectedNodeToRestore])
      ks.transformer?.visible(true)
      ks.transformer?.forceUpdate()
      ks.selectionTarget = selectedNodeToRestore
      hasSelection.value = true
      updateSelectionOutline()
    } else if (selectedAnimationId) {
      hideSelectionOutline()
      hasSelection.value = false
    }

    ks.transformer?.moveToTop()
    ks.selectionOutline?.moveToTop()
    ks.animationLayer.draw()
  }

  return { syncAnimatedTextVisibility, renderAnimationNodes, isSelectedAnimationNode }
}
