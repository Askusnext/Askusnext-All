import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const box = (error: boolean) =>
  `relative w-full rounded-[6px] border bg-white transition-colors duration-200 ${error ? 'border-[#E5484D]' : 'border-[#8F9194] focus-within:border-[#0066FF]'}`

const floatLabel = (error: boolean) =>
  `pointer-events-none absolute left-3 top-1/2 origin-left -translate-y-1/2 whitespace-nowrap bg-white px-1 font-poppins text-base transition-all duration-200 ease-out ` +
  `peer-focus:top-0 peer-focus:scale-[0.78] peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:scale-[0.78] ` +
  (error ? 'text-[#E5484D] peer-focus:text-[#E5484D]' : 'text-[#6A6D71] peer-focus:text-[#0066FF]')

interface FieldBase {
  label: string
  required?: boolean
  error?: string
  helper?: React.ReactNode
}

interface FloatingInputProps extends FieldBase {
  value: string
  onChange: (v: string) => void
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  maxLength?: number
  type?: string
  uppercase?: boolean
}

/** Outlined input whose label floats onto the border, as in the reference form. */
export const FloatingInput: React.FC<FloatingInputProps> = ({ label, required, error, helper, value, onChange, inputMode, autoComplete, maxLength, type = 'text', uppercase }) => {
  const id = useId()
  const hasError = Boolean(error)
  return (
    <div className="w-full min-w-0">
      <div className={box(hasError)}>
        <input
          id={id}
          type={type}
          value={value}
          placeholder=" "
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={hasError}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
          className={`peer h-[56px] w-full rounded-[6px] bg-transparent px-[14px] font-poppins text-base leading-6 text-[#1C1D1F] focus:outline-none ${uppercase ? 'uppercase' : ''}`}
        />
        <label htmlFor={id} className={floatLabel(hasError)}>
          {label}
          {required && <span className="ml-0.5 text-[#E5484D]">*</span>}
        </label>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1 pl-4 text-left font-poppins text-[12px] leading-4 text-[#E5484D]">{error}</p>
      ) : (
        helper && <div className="mt-1 pl-4 text-left font-poppins text-[12px] font-medium leading-[18px] text-[#373A3E]">{helper}</div>
      )}
    </div>
  )
}

interface FloatingComboProps extends FieldBase {
  value: string
  onChange: (v: string) => void
  options: string[]
}

/** Searchable dropdown with a floating label (used for the salary bank). */
export const FloatingCombo: React.FC<FloatingComboProps> = ({ label, required, error, helper, value, onChange, options }) => {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [cursor, setCursor] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const hasError = Boolean(error)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q && !options.some((o) => o.toLowerCase() === q) ? options.filter((o) => o.toLowerCase().includes(q)) : options
  }, [query, options])

  const choose = (o: string) => {
    setQuery(o)
    onChange(o)
    setOpen(false)
  }

  return (
    <div ref={root} className="w-full min-w-0">
      <div className={box(hasError)}>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-invalid={hasError}
          autoComplete="off"
          placeholder=" "
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            // Only an exact bank name counts as a selection.
            onChange(options.find((o) => o.toLowerCase() === e.target.value.trim().toLowerCase()) ?? '')
            setOpen(true)
            setCursor(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setCursor((c) => Math.min(c + 1, matches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (e.key === 'Enter' && open && matches[cursor]) {
              e.preventDefault()
              choose(matches[cursor])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          className="peer h-[56px] w-full truncate rounded-[6px] bg-transparent pl-[14px] pr-11 font-poppins text-base leading-6 text-[#1C1D1F] focus:outline-none"
        />
        <label htmlFor={id} className={floatLabel(hasError)}>
          {label}
          {required && <span className="ml-0.5 text-[#E5484D]">*</span>}
        </label>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Show options"
          onClick={() => setOpen((o) => !o)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6A6D71] hover:text-[#0066FF]"
        >
          <ChevronDown size={20} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <ul id={`${id}-list`} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#E4E4E3] bg-white py-1 shadow-xl">
            {matches.length === 0 && <li className="px-4 py-3 font-poppins text-[13px] text-[#6A6D71]">No bank found. Choose &quot;Other bank&quot; from the list.</li>}
            {matches.map((o, i) => (
              <li key={o} role="option" aria-selected={o === value}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(o)}
                  className={`block w-full px-4 py-2.5 text-left font-poppins text-[14px] ${i === cursor ? 'bg-[#F2F7FF] text-[#0066FF]' : 'text-[#1C1D1F]'} ${o === value ? 'font-semibold' : ''}`}
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-1 pl-4 text-left font-poppins text-[12px] leading-4 text-[#E5484D]">{error}</p>
      ) : (
        helper && <div className="mt-1 pl-4 text-left font-poppins text-[10px] font-medium text-[#373A3E]">{helper}</div>
      )}
    </div>
  )
}
