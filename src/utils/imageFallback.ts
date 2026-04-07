import type { SyntheticEvent } from 'react'

export const communityPostFallbackImage = '/images/community-post-fallback.svg'

export function useImageFallback(event: SyntheticEvent<HTMLImageElement>, fallback = communityPostFallbackImage) {
  const target = event.currentTarget
  if (target.src.endsWith(fallback)) {
    return
  }
  target.src = fallback
}
