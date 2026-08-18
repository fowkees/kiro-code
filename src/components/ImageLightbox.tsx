import { XIcon } from './icons'

export default function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox__close" onClick={onClose} title="Fechar">
        <XIcon width={18} height={18} />
      </button>
      <img src={src} alt="" className="lightbox__image" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
