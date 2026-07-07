import { useMemo, useState } from 'react'
import {
  CALCULATOR_LABELS,
  calculateInstallmentPlan,
  formatEgp,
  formatFlatRate,
  parsePrincipalInput,
  type CalculatorProductSettings,
  type CalculatorType,
} from '@/utils/installmentCalculator'

const fieldClass =
  'w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color] placeholder:text-slate-400 focus:border-gochat focus:outline-none focus:ring-0'

const tabBtnClass =
  'flex-1 rounded-lg border px-2 py-2 text-center text-[11px] font-medium leading-tight transition-colors'

type Props = {
  onClose: () => void
  allowedTypes?: CalculatorType[]
  productSettings?: Partial<Record<CalculatorType, CalculatorProductSettings>>
}

export function InstallmentCalculatorPanel({ onClose, allowedTypes, productSettings }: Props) {
  const types = allowedTypes?.length
    ? allowedTypes
    : (Object.keys(CALCULATOR_LABELS) as CalculatorType[])
  const [type, setType] = useState<CalculatorType>(types[0] ?? 'cash-it')
  const [principalInput, setPrincipalInput] = useState('10000')

  const activeType = types.includes(type) ? type : types[0] ?? 'cash-it'

  const principal = parsePrincipalInput(principalInput)
  const rows = useMemo(
    () =>
      principal != null
        ? calculateInstallmentPlan(activeType, principal, productSettings?.[activeType])
        : [],
    [principal, activeType, productSettings],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-drag shrink-0 border-b border-widget-strong px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Installment calculator</p>
            <p className="text-[10px] text-slate-500">Approximate values for agents</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-gochat hover:text-gochat"
          >
            Back to chat
          </button>
        </div>

        <div className="mt-2.5 flex gap-1">
          {types.map((key) => {
            const active = activeType === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className={`${tabBtnClass} ${
                  active
                    ? 'border-gochat bg-gochat/10 text-gochat-dark'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                {CALCULATOR_LABELS[key]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="no-drag min-h-0 flex-1 overflow-y-auto px-3.5 py-3 [scrollbar-color:rgba(148,163,184,0.6)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Principal (EGP)</span>
          <input
            type="text"
            inputMode="decimal"
            value={principalInput}
            onChange={(e) => setPrincipalInput(e.target.value)}
            placeholder="e.g. 10000"
            className={fieldClass}
          />
        </label>

        {principal == null && principalInput.trim() !== '' && (
          <p className="mt-2 text-xs text-rose-600">Enter a valid amount greater than zero.</p>
        )}

        {rows.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-widget-strong">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-widget-strong bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-2.5 py-2">Months</th>
                  <th className="px-2.5 py-2 text-right">Installment</th>
                  <th className="px-2.5 py-2 text-right">Interest</th>
                  <th className="px-2.5 py-2 text-right">Flat rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.months}
                    className="border-b border-slate-100 last:border-b-0 odd:bg-white even:bg-slate-50/60"
                  >
                    <td className="px-2.5 py-2 font-medium text-slate-800">{row.months}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-slate-900">
                      {formatEgp(row.installment)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-slate-700">
                      {formatEgp(row.totalInterest)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">
                      {formatFlatRate(row.monthlyFlatRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          تقريبياً — share amounts as approximate with the customer.
        </p>
      </div>
    </div>
  )
}
