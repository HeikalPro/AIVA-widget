import { useMemo, useState } from 'react'
import type { ResolvedLocation } from '@/types/widgetFeatures'

const fieldClass =
  'w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color] placeholder:text-slate-400 focus:border-gochat focus:outline-none focus:ring-0'

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

type Props = {
  onClose: () => void
  locations: ResolvedLocation[]
}

export function LocationsPanel({ onClose, locations }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return locations
    return locations.filter((loc) =>
      [loc.name, loc.area, loc.address].some((v) => v?.toLowerCase().includes(q)),
    )
  }, [locations, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-drag shrink-0 border-b border-widget-strong px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Our locations</p>
            <p className="text-[10px] text-slate-500">
              {locations.length} branch{locations.length === 1 ? '' : 'es'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-gochat hover:text-gochat"
          >
            Back to chat
          </button>
        </div>
        {locations.length > 5 && (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, area or address…"
            dir="auto"
            className={`${fieldClass} mt-2.5 py-2 text-xs`}
          />
        )}
      </div>

      <div className="no-drag min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3 [scrollbar-color:rgba(148,163,184,0.6)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-500">
            {locations.length === 0 ? 'No locations available.' : 'No locations match your search.'}
          </p>
        )}
        {filtered.map((loc, i) => (
          <div key={`${loc.name}-${i}`} className="rounded-xl border border-slate-300 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <p dir="auto" className="min-w-0 text-sm font-semibold text-slate-900">
                {loc.name}
              </p>
              {loc.area && (
                <span
                  dir="auto"
                  className="shrink-0 rounded-full border border-gochat bg-gochat/10 px-2 py-0.5 text-[10px] font-medium text-gochat"
                >
                  {loc.area}
                </span>
              )}
            </div>
            {loc.address && (
              <p dir="auto" className="mt-1 text-xs leading-relaxed text-slate-600">
                {loc.address}
              </p>
            )}
            {(loc.phone || loc.hours) && (
              <p dir="auto" className="mt-1 text-[11px] text-slate-500">
                {loc.phone && (
                  <a href={`tel:${loc.phone.replace(/\s+/g, '')}`} className="hover:text-gochat">
                    {loc.phone}
                  </a>
                )}
                {loc.phone && loc.hours && ' · '}
                {loc.hours}
              </p>
            )}
            {loc.mapsUrl && (
              <a
                href={loc.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-gochat hover:underline"
              >
                <IconMapPin className="h-3 w-3 shrink-0" /> Open in Maps
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
