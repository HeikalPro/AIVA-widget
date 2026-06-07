type Props = {
  className?: string
  alt?: string
}

export function BrandLogo({ className, alt = 'GoChat247' }: Props) {
  return (
    <img
      src="./GoChat247_blue_transparent.png"
      alt={alt}
      className={className}
      draggable={false}
    />
  )
}
