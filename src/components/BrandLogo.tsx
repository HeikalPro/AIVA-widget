type Props = {
  className?: string
  alt?: string
}

export function BrandLogo({ className, alt = 'GoAI' }: Props) {
  return (
    <img
      src="./GoAI_mark.png"
      alt={alt}
      className={className}
      draggable={false}
    />
  )
}
