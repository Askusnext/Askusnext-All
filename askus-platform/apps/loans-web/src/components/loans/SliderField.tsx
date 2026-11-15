import React, { useId } from 'react'

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format: (v: number) => string
  /** Optional segmented quick-pick values (e.g. tenure presets). */
  presets?: { label: string; value: number }[]
}

export const SliderField: React.FC<SliderFieldProps> = ({ label, value, min, max, step, onChange, format, presets }) => {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</label>
        <output htmlFor={id} className="rounded-lg bg-[#f2f7ff] px-3 py-1 text-sm font-semibold text-[#0066ff]">{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ background: `linear-gradient(to right,#0066ff ${pct}%,#e4e4e3 ${pct}%)` }}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#0066ff]"
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
      {presets && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(Math.min(max, Math.max(min, p.value)))}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                value === p.value ? 'border-[#0066ff] bg-[#f2f7ff] text-[#0066ff]' : 'border-[#e4e4e3] text-slate-600 hover:border-[#0066ff]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
