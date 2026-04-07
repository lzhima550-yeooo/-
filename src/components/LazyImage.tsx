import { useEffect, useRef, useState } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { useImageFallback } from '../utils/imageFallback'

interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'loading'> {
  fallbackSrc?: string
}

export function LazyImage({ src = '', alt, className, fallbackSrc, onLoad, onError, ...rest }: LazyImageProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) {
      return
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true)
              observer.disconnect()
            }
          })
        },
        { rootMargin: '240px' },
      )

      observer.observe(node)
      return () => observer.disconnect()
    }

    setIsVisible(true)
    return undefined
  }, [])

  const imageSource = isVisible ? src : ''

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ''}`.trim()}>
      {!isLoaded ? <div className="spirit-loading-shimmer absolute inset-0" aria-hidden /> : null}
      {isVisible ? (
        <img
          src={imageSource}
          alt={alt}
          loading="lazy"
          onLoad={(event) => {
            setIsLoaded(true)
            onLoad?.(event)
          }}
          onError={(event) => {
            useImageFallback(event, fallbackSrc)
            onError?.(event)
          }}
          className={`h-full w-full transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          {...rest}
        />
      ) : null}
    </div>
  )
}
