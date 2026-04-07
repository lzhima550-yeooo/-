interface SpiritAvatarProps {
  src: string
  alt: string
  size?: 'sm' | 'md'
}

const sizeClassMap: Record<NonNullable<SpiritAvatarProps['size']>, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
}

export function SpiritAvatar({ src, alt, size = 'sm' }: SpiritAvatarProps) {
  return (
    <div
      className={`${sizeClassMap[size]} shrink-0 overflow-hidden rounded-full border border-emerald-200/80 bg-[linear-gradient(145deg,#f7fcf8,#e8f4ea)] shadow-[0_8px_18px_rgba(16,185,129,0.18)]`}
    >
      <img
        src={src}
        alt={alt}
        onError={(event) => {
          event.currentTarget.src = '/images/914ec19753ff41c467235a1cc8413f5f.jpg'
        }}
        className="h-full w-full object-cover object-[50%_24%]"
      />
    </div>
  )
}
