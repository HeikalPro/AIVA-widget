import type {
  CalculatorProductSettings,
  CalculatorType,
  InstallmentTenor,
} from '@/utils/installmentCalculator'
import { INSTALLMENT_TENORS } from '@/utils/installmentCalculator'

export type WidgetCalculatorProductConfig = {
  label?: string | null
  apr?: number | null
  tenors?: number[] | null
  flat_rates?: Record<string, number> | null
}

export type WidgetInstallmentCalculatorConfig = {
  enabled: boolean
  types?: CalculatorType[]
  products?: Record<string, WidgetCalculatorProductConfig> | null
}

export type WidgetBrandingConfig = {
  title?: string | null
  subtitle?: string | null
  accent_color?: string | null
  logo_url?: string | null
}

export type WidgetFeatures = {
  installment_calculator?: WidgetInstallmentCalculatorConfig
  branding?: WidgetBrandingConfig | null
}

export type ResolvedBranding = {
  title?: string
  subtitle?: string
  accentColor?: string
  logoUrl?: string
}

export function resolveBranding(
  features: WidgetFeatures | null | undefined,
): ResolvedBranding {
  const b = features?.branding
  if (!b) return {}
  const out: ResolvedBranding = {}
  if (typeof b.title === 'string' && b.title.trim()) out.title = b.title.trim()
  if (typeof b.subtitle === 'string' && b.subtitle.trim()) out.subtitle = b.subtitle.trim()
  if (typeof b.accent_color === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(b.accent_color.trim())) {
    out.accentColor = b.accent_color.trim()
  }
  if (typeof b.logo_url === 'string' && b.logo_url.trim()) out.logoUrl = b.logo_url.trim()
  return out
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return null
  const n = Number.parseInt(h, 16)
  if (Number.isNaN(n)) return null
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(channel: number, target: number, amount: number): number {
  return Math.round(channel + (target - channel) * amount)
}

/**
 * CSS custom properties for the accent color (and derived dark/light shades),
 * to spread onto the widget root so all `gochat` utilities recolor. Returns an
 * empty object when no/invalid color is given (keeps the default blue).
 */
export function accentCssVars(accentColor?: string): Record<string, string> {
  if (!accentColor) return {}
  const rgb = hexToRgb(accentColor)
  if (!rgb) return {}
  const [r, g, b] = rgb
  const dark: [number, number, number] = [mix(r, 0, 0.28), mix(g, 0, 0.28), mix(b, 0, 0.28)]
  const light: [number, number, number] = [mix(r, 255, 0.14), mix(g, 255, 0.14), mix(b, 255, 0.14)]
  return {
    '--gochat-rgb': `${r} ${g} ${b}`,
    '--gochat-dark-rgb': `${dark[0]} ${dark[1]} ${dark[2]}`,
    '--gochat-light-rgb': `${light[0]} ${light[1]} ${light[2]}`,
  }
}

export type WidgetAccount = {
  id: number
  name: string
  widget_features?: WidgetFeatures | null
}

const ALL_CALCULATOR_TYPES: CalculatorType[] = ['cash-it', 'instant-approval', 'branches']

export function isInstallmentCalculatorEnabled(
  features: WidgetFeatures | null | undefined,
): boolean {
  return Boolean(features?.installment_calculator?.enabled)
}

export function installmentCalculatorTypes(
  features: WidgetFeatures | null | undefined,
): CalculatorType[] {
  if (!isInstallmentCalculatorEnabled(features)) return []
  const raw = features?.installment_calculator?.types
  if (!Array.isArray(raw) || raw.length === 0) return [...ALL_CALCULATOR_TYPES]
  const allowed = new Set(ALL_CALCULATOR_TYPES)
  const filtered = raw.filter((t): t is CalculatorType => allowed.has(t as CalculatorType))
  return filtered.length > 0 ? filtered : [...ALL_CALCULATOR_TYPES]
}

function normalizeTenors(raw: number[] | null | undefined): InstallmentTenor[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const allowed = new Set<InstallmentTenor>(INSTALLMENT_TENORS)
  const out = raw
    .map((month) => Number(month))
    .filter((month): month is InstallmentTenor => allowed.has(month as InstallmentTenor))
  return out.length > 0 ? out : undefined
}

function normalizeFlatRates(
  raw: Record<string, number> | null | undefined,
): Partial<Record<InstallmentTenor, number>> | undefined {
  if (!raw) return undefined
  const out: Partial<Record<InstallmentTenor, number>> = {}
  for (const month of INSTALLMENT_TENORS) {
    const rate = raw[String(month)]
    if (rate != null && Number.isFinite(rate) && rate > 0) {
      out[month] = rate
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function resolveCalculatorProductSettings(
  features: WidgetFeatures | null | undefined,
  type: CalculatorType,
): CalculatorProductSettings | undefined {
  const saved = features?.installment_calculator?.products?.[type]
  if (!saved) return undefined
  const settings: CalculatorProductSettings = {}
  if (typeof saved.label === 'string' && saved.label.trim()) {
    settings.label = saved.label.trim()
  }
  if (saved.apr != null && Number.isFinite(saved.apr) && saved.apr > 0) {
    settings.apr = saved.apr
  }
  const tenors = normalizeTenors(saved.tenors)
  if (tenors) settings.tenors = tenors
  const flatRates = normalizeFlatRates(saved.flat_rates ?? undefined)
  if (flatRates) settings.flatRates = flatRates
  return Object.keys(settings).length > 0 ? settings : undefined
}

export function buildCalculatorProductSettingsMap(
  features: WidgetFeatures | null | undefined,
): Partial<Record<CalculatorType, CalculatorProductSettings>> {
  const types = installmentCalculatorTypes(features)
  const out: Partial<Record<CalculatorType, CalculatorProductSettings>> = {}
  for (const type of types) {
    const settings = resolveCalculatorProductSettings(features, type)
    if (settings) out[type] = settings
  }
  return out
}
