"use client"

import * as React from "react"
import { useReducer, useRef, useEffect, useState, useCallback } from "react"
import {
  trackFormViewed,
  trackSlideViewed,
  trackSlideCompleted,
  trackFormAbandoned,
  trackFormError,
  trackEngagedVisitor,
  trackFormSubmitted,
  trackGenerateLead,
  trackInquiryConversion,
} from '@/lib/analytics'

// ============================================================================
// TYPES
// ============================================================================

interface FormState {
  currentSlide: number
  direction: number
  destinations: string[]
  timing_type: string | null
  travel_date_start: string | null
  travel_date_end: string | null
  travel_window_earliest: string | null
  travel_window_latest: string | null
  party_type: string | null
  total_travelers: number | null
  children_count: number | null
  interests: string[]
  budget_range: string | null
  stated_budget_cents: number | null
  projected_profit_cents: number | null
  first_name: string
  last_name: string
  email: string
  phone: string
  phone_country_code: string
  how_heard: string | null
  message: string
  contact_consent: boolean
  marketing_consent: boolean
  isSubmitting: boolean
  isComplete: boolean
  touched: Record<string, boolean>
  errors: Record<string, string>
}

type FormAction =
  | { type: "SET_DESTINATIONS"; payload: string[] }
  | { type: "SET_TIMING_TYPE"; payload: string }
  | { type: "SET_TRAVEL_DATE_START"; payload: string | null }
  | { type: "SET_TRAVEL_DATE_END"; payload: string | null }
  | { type: "SET_TRAVEL_WINDOW_EARLIEST"; payload: string | null }
  | { type: "SET_TRAVEL_WINDOW_LATEST"; payload: string | null }
  | { type: "SET_PARTY_TYPE"; payload: string }
  | { type: "SET_TOTAL_TRAVELERS"; payload: number }
  | { type: "SET_CHILDREN_COUNT"; payload: number }
  | { type: "SET_INTERESTS"; payload: string[] }
  | { type: "SET_PRIMARY_INTEREST"; payload: string }
  | { type: "SET_BUDGET"; payload: { range: string; budget: number; profit: number } }
  | { type: "SET_FIELD"; payload: { field: string; value: string | boolean } }
  | { type: "SET_TOUCHED"; payload: string }
  | { type: "SET_ERROR"; payload: { field: string; error: string } }
  | { type: "CLEAR_ERROR"; payload: string }
  | { type: "NEXT_SLIDE" }
  | { type: "PREV_SLIDE" }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_COMPLETE" }

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  teal: "#486A6A",
  tealHover: "#3d5a5a",
  clay: "#DA7A5A",
  charcoal: "#404040",
  gray: "#DADADA",
  ivory: "#F5F3EB",
  white: "#FFFFFF",
  descriptionGray: "#666666",
  placeholder: "#999999",
  error: "#dc3545",
}

const DESTINATIONS = [
  { label: "Tanzania", description: "Serengeti, Ngorongoro, Zanzibar", value: "TZ" },
  { label: "Kenya", description: "Maasai Mara, Amboseli, Laikipia", value: "KE" },
  { label: "Botswana", description: "Okavango Delta, Chobe, Kalahari", value: "BW" },
  { label: "Rwanda", description: "Mountain gorillas, Volcanoes", value: "RW" },
  { label: "Uganda", description: "Gorillas, chimps, Murchison Falls", value: "UG" },
  { label: "South Africa", description: "Kruger, Cape Town, winelands", value: "ZA" },
  { label: "Namibia", description: "Sossusvlei, Etosha, Skeleton Coast", value: "NA" },
  { label: "Zambia", description: "South Luangwa, Victoria Falls", value: "ZM" },
  { label: "Zimbabwe", description: "Victoria Falls, Hwange, Mana Pools", value: "ZW" },
]

const TIMING_OPTIONS = [
  { label: "I have specific dates in mind", value: "specific" },
  { label: "I'm flexible on dates", value: "flexible" },
  { label: "I'm just exploring for now", value: "exploring" },
]

const PARTY_OPTIONS = [
  { label: "Just me", value: "solo", showPartB: false },
  { label: "Couple", value: "couple", showPartB: false },
  { label: "Family", value: "family", showPartB: true },
  { label: "Multi-generational", value: "multigenerational", showPartB: true },
  { label: "Friends traveling together", value: "friends", showPartB: true },
  { label: "2+ families", value: "multiple_families", showPartB: true },
  { label: "Other", value: "other", showPartB: true },
]

const TRAVELER_OPTIONS = [
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "11-15", value: 13 },
  { label: "16-20", value: 18 },
  { label: "More than 20", value: 21 },
]

const CHILDREN_OPTIONS = [
  { label: "None", value: 0 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10+", value: 11 },
]

const EXPERIENCES_OPTIONS = [
  { label: "The Great Migration", value: "migration", description: "Witness millions of wildebeest crossing the Serengeti" },
  { label: "Gorilla & primate trekking", value: "gorillas", description: "Track mountain gorillas in Rwanda or Uganda" },
  { label: "Big cats & wildlife", value: "big_cats", description: "Expert-guided game drives focused on predators" },
  { label: "Beach & island escape", value: "beach", description: "Zanzibar, Mozambique, Seychelles or coastal retreats" },
  { label: "Cultural immersion", value: "culture", description: "Meet local communities, visit villages, learn traditions" },
  { label: "Walking & hiking safaris", value: "walking", description: "Explore the bush on foot with armed rangers" },
  { label: "Wine & culinary experiences", value: "wine_culinary", description: "South African wine regions and fine dining" },
  { label: "Luxury lodges & camps", value: "luxury_camp", description: "Focus on the world's finest safari accommodations" },
  { label: "Honeymoon or celebration", value: "celebration", description: "Anniversary, birthday, milestone or romantic getaway" },
  { label: "Photography safari", value: "photography", description: "Specialist vehicles and guides for serious photographers" },
  { label: "Horse riding safari", value: "horse_riding", description: "Ride alongside wildlife in Botswana, Kenya or South Africa" },
  { label: "Something else", value: "other", description: "We'll discuss your unique interests" },
]

const BUDGET_OPTIONS = [
  { label: "$10,000 – $15,000 per person", value: "10k-15k", budget: 1250000, profit: 250000 },
  { label: "$15,000 – $25,000 per person", value: "15k-25k", budget: 2000000, profit: 400000 },
  { label: "$25,000 – $40,000 per person", value: "25k-40k", budget: 3250000, profit: 650000 },
  { label: "$40,000 – $60,000 per person", value: "40k-60k", budget: 5000000, profit: 1000000 },
  { label: "$60,000 – $80,000 per person", value: "60k-80k", budget: 7000000, profit: 1400000 },
  { label: "$80,000 – $100,000 per person", value: "80k-100k", budget: 9000000, profit: 1800000 },
  { label: "$100,000+ per person", value: "100k+", budget: 12500000, profit: 2500000 },
  { label: "I'm not sure yet", value: "unsure", budget: 5000000, profit: 1000000 },
]

const HOW_HEARD_OPTIONS = [
  { label: "Google search", value: "google" },
  { label: "ChatGPT / AI assistant", value: "ai" },
  { label: "Friend or family recommendation", value: "referral" },
  { label: "Travel advisor", value: "advisor" },
  { label: "Magazine or publication", value: "press" },
  { label: "Social media", value: "social" },
  { label: "Podcast", value: "podcast" },
  { label: "I've traveled with Kiuli before", value: "returning" },
  { label: "Other", value: "other" },
]

const COUNTRIES = [
  { name: "United States", code: "US", dial: "+1", flag: "🇺🇸" },
  { name: "Australia", code: "AU", dial: "+61", flag: "🇦🇺" },
  { name: "Brazil", code: "BR", dial: "+55", flag: "🇧🇷" },
  { name: "Canada", code: "CA", dial: "+1", flag: "🇨🇦" },
  { name: "France", code: "FR", dial: "+33", flag: "🇫🇷" },
  { name: "Germany", code: "DE", dial: "+49", flag: "🇩🇪" },
  { name: "Hong Kong", code: "HK", dial: "+852", flag: "🇭🇰" },
  { name: "India", code: "IN", dial: "+91", flag: "🇮🇳" },
  { name: "Japan", code: "JP", dial: "+81", flag: "🇯🇵" },
  { name: "Mexico", code: "MX", dial: "+52", flag: "🇲🇽" },
  { name: "Netherlands", code: "NL", dial: "+31", flag: "🇳🇱" },
  { name: "Singapore", code: "SG", dial: "+65", flag: "🇸🇬" },
  { name: "South Africa", code: "ZA", dial: "+27", flag: "🇿🇦" },
  { name: "Switzerland", code: "CH", dial: "+41", flag: "🇨🇭" },
  { name: "United Arab Emirates", code: "AE", dial: "+971", flag: "🇦🇪" },
  { name: "United Kingdom", code: "GB", dial: "+44", flag: "🇬🇧" },
]

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// ============================================================================
// REDUCER
// ============================================================================

const initialState: FormState = {
  currentSlide: 0,
  direction: 1,
  destinations: [],
  timing_type: null,
  travel_date_start: null,
  travel_date_end: null,
  travel_window_earliest: null,
  travel_window_latest: null,
  party_type: null,
  total_travelers: null,
  children_count: null,
  interests: [],
  budget_range: null,
  stated_budget_cents: null,
  projected_profit_cents: null,
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  phone_country_code: "US",
  how_heard: null,
  message: "",
  contact_consent: false,
  marketing_consent: false,
  isSubmitting: false,
  isComplete: false,
  touched: {},
  errors: {},
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_DESTINATIONS":
      return { ...state, destinations: action.payload }
    case "SET_TIMING_TYPE":
      return {
        ...state,
        timing_type: action.payload,
        travel_date_start: action.payload !== "specific" ? null : state.travel_date_start,
        travel_date_end: action.payload !== "specific" ? null : state.travel_date_end,
        travel_window_earliest: action.payload !== "flexible" ? null : state.travel_window_earliest,
        travel_window_latest: action.payload !== "flexible" ? null : state.travel_window_latest,
      }
    case "SET_TRAVEL_DATE_START":
      return { ...state, travel_date_start: action.payload }
    case "SET_TRAVEL_DATE_END":
      return { ...state, travel_date_end: action.payload }
    case "SET_TRAVEL_WINDOW_EARLIEST":
      return { ...state, travel_window_earliest: action.payload }
    case "SET_TRAVEL_WINDOW_LATEST":
      return { ...state, travel_window_latest: action.payload }
    case "SET_PARTY_TYPE": {
      const option = PARTY_OPTIONS.find((o) => o.value === action.payload)
      let total = state.total_travelers
      let children = state.children_count
      if (action.payload === "solo") {
        total = 1
        children = 0
      } else if (action.payload === "couple") {
        total = 2
        children = 0
      } else if (!option?.showPartB) {
        total = null
        children = null
      }
      return { ...state, party_type: action.payload, total_travelers: total, children_count: children }
    }
    case "SET_TOTAL_TRAVELERS":
      return { ...state, total_travelers: action.payload }
    case "SET_CHILDREN_COUNT":
      return { ...state, children_count: action.payload }
    case "SET_INTERESTS":
      return { ...state, interests: action.payload }
    case "SET_BUDGET":
      return {
        ...state,
        budget_range: action.payload.range,
        stated_budget_cents: action.payload.budget,
        projected_profit_cents: action.payload.profit,
      }
    case "SET_FIELD":
      return { ...state, [action.payload.field]: action.payload.value }
    case "SET_TOUCHED":
      return { ...state, touched: { ...state.touched, [action.payload]: true } }
    case "SET_ERROR":
      return { ...state, errors: { ...state.errors, [action.payload.field]: action.payload.error } }
    case "CLEAR_ERROR": {
      const newErrors = { ...state.errors }
      delete newErrors[action.payload]
      return { ...state, errors: newErrors }
    }
    case "NEXT_SLIDE":
      return { ...state, currentSlide: state.currentSlide + 1, direction: 1 }
    case "PREV_SLIDE":
      return { ...state, currentSlide: state.currentSlide - 1, direction: -1 }
    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.payload }
    case "SET_COMPLETE":
      return { ...state, isComplete: true, currentSlide: 6 }
    default:
      return state
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00")
}

function formatDisplayDate(dateStr: string | null): string {
  if (!dateStr) return "Select date"
  const date = parseDate(dateStr)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatMonthYear(monthStr: string | null): string {
  if (!monthStr) return "Select month"
  const [year, month] = monthStr.split("-")
  return `${MONTHS[parseInt(month) - 1]} ${year}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Format phone number to E.164 format
function formatPhoneE164(phone: string, countryCode: string): string {
  // Get the dial code for the country
  const country = COUNTRIES.find((c) => c.code === countryCode)
  const dialCode = country?.dial || "+1"
  
  // Remove all non-digit characters from phone
  let digits = phone.replace(/\D/g, "")
  
  // If phone starts with 0 (common in UK, etc.), strip the leading zero
  if (digits.startsWith("0")) {
    digits = digits.substring(1)
  }
  
  // Return E.164 format: dialCode + digits
  return dialCode + digits
}

// Validate E.164 phone number format
function isValidE164Phone(phone: string): boolean {
  // Must start with +, followed by 7-15 digits (total 8-16 chars including +)
  if (!phone.startsWith("+")) return false
  const digitsAfterPlus = phone.substring(1)
  if (!/^\d+$/.test(digitsAfterPlus)) return false
  if (phone.length < 8 || phone.length > 16) return false
  return true
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Progress Dots
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="navigation"
      aria-label={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: i < current ? COLORS.teal : i === current ? COLORS.clay : COLORS.gray,
            transform: i === current ? "scale(1.25)" : "scale(1)",
            transition: "all 300ms ease",
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

// Headline with italic first word
function Headline({ children }: { children: string }) {
  const words = children.split(" ")
  const firstWord = words[0]
  const rest = words.slice(1).join(" ")

  return (
    <h2
      className="text-center text-2xl md:text-[32px] leading-tight"
      style={{ fontFamily: "'General Sans', system-ui, sans-serif", fontWeight: 500, color: COLORS.charcoal }}
    >
      <em className="not-italic" style={{ fontStyle: "italic" }}>
        {firstWord}
      </em>{" "}
      {rest}
    </h2>
  )
}

// Subtext
function Subtext({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-center text-sm md:text-base"
      style={{ fontFamily: "'Satoshi', system-ui, sans-serif", fontWeight: 400, color: COLORS.descriptionGray }}
    >
      {children}
    </p>
  )
}

// Selectable Card
interface CardProps {
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
  type?: "checkbox" | "radio"
  disabled?: boolean
  className?: string
}

function SelectableCard({ selected, onSelect, children, type = "radio", disabled = false, className = "" }: CardProps) {
  const [wasSelected, setWasSelected] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  
  // Track when card becomes selected for animation
  useEffect(() => {
    if (selected && !wasSelected) {
      setWasSelected(true)
      const timer = setTimeout(() => setWasSelected(false), 150)
      return () => clearTimeout(timer)
    }
    if (!selected) {
      setWasSelected(false)
    }
  }, [selected, wasSelected])
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (!disabled) onSelect()
    }
  }

  // Calculate transform based on state
  const getTransform = () => {
    if (isPressed) return "scale(0.98)"
    if (wasSelected && selected) return "scale(1.02)"
    return "scale(1)"
  }

  return (
    <div
      role={type}
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={handleKeyDown}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={(e) => {
        setIsPressed(false)
        if (!selected) {
          e.currentTarget.style.borderColor = COLORS.gray
          e.currentTarget.style.boxShadow = "none"
        }
      }}
      onTouchStart={() => !disabled && setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      className={`cursor-pointer rounded-lg p-4 md:px-5 outline-none bg-white ${className}`}
      style={{
        backgroundColor: selected ? "rgba(72, 106, 106, 0.05)" : "#FFFFFF",
        border: selected ? `2px solid ${COLORS.teal}` : `1px solid ${COLORS.gray}`,
        padding: selected ? "15px 19px" : "16px 20px",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transform: getTransform(),
        transition: "all 150ms ease, transform 75ms ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !selected) {
          e.currentTarget.style.borderColor = COLORS.teal
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(72, 106, 106, 0.1)"
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${COLORS.teal}`
        e.currentTarget.style.outlineOffset = "2px"
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none"
      }}
    >
      {children}
    </div>
  )
}

// Checkbox indicator
function CheckboxIndicator({ checked }: { checked: boolean }) {
  return (
    <div
      className="flex h-5 w-5 items-center justify-center rounded border transition-colors duration-150"
      style={{
        borderColor: checked ? COLORS.teal : COLORS.gray,
        backgroundColor: checked ? COLORS.teal : "transparent",
      }}
    >
      {checked && (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
          <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

// Radio indicator
function RadioIndicator({ checked }: { checked: boolean }) {
  return (
    <div
      className="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-150"
      style={{ borderColor: checked ? COLORS.teal : COLORS.gray }}
    >
      {checked && <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.teal }} />}
    </div>
  )
}

// Primary Button
interface ButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
}

function PrimaryButton({ onClick, disabled = false, loading = false, children }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="rounded-lg px-8 py-4 transition-colors duration-150 outline-none"
      style={{
        backgroundColor: disabled || loading ? COLORS.gray : COLORS.teal,
        color: COLORS.white,
        fontFamily: "'General Sans', system-ui, sans-serif",
        fontWeight: 600,
        fontSize: "16px",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        minWidth: "160px",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.backgroundColor = COLORS.tealHover
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.backgroundColor = COLORS.teal
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${COLORS.teal}`
        e.currentTarget.style.outlineOffset = "2px"
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none"
      }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Submitting...
        </span>
      ) : (
        children
      )}
    </button>
  )
}

// Secondary Button (text link)
function SecondaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="transition-colors duration-150 outline-none"
      style={{
        background: "transparent",
        border: "none",
        color: COLORS.charcoal,
        fontFamily: "'Satoshi', system-ui, sans-serif",
        fontWeight: 400,
        fontSize: "16px",
        textDecoration: "underline",
        textUnderlineOffset: "4px",
        cursor: "pointer",
        padding: "8px 0",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = COLORS.teal
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = COLORS.charcoal
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${COLORS.teal}`
        e.currentTarget.style.outlineOffset = "2px"
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none"
      }}
    >
      {children}
    </button>
  )
}

// Outlined Button (for confirmation)
function OutlinedButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-8 py-4 transition-colors duration-150 outline-none"
      style={{
        backgroundColor: "transparent",
        border: `2px solid ${COLORS.teal}`,
        color: COLORS.teal,
        fontFamily: "'General Sans', system-ui, sans-serif",
        fontWeight: 600,
        fontSize: "16px",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(72, 106, 106, 0.05)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent"
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${COLORS.teal}`
        e.currentTarget.style.outlineOffset = "2px"
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none"
      }}
    >
      {children}
    </button>
  )
}

// Text Input
interface InputProps {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  type?: string
  placeholder?: string
  required?: boolean
  maxLength?: number
}

function TextInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  type = "text",
  placeholder,
  required = false,
  maxLength,
}: InputProps) {
  const id = label.toLowerCase().replace(/\s+/g, "-")
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        style={{
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontWeight: 400,
          fontSize: "16px",
          color: COLORS.charcoal,
        }}
      >
        {label}
        {required && <span style={{ color: COLORS.error }}> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={!!error}
        className="w-full rounded-lg p-4 transition-all duration-150 outline-none"
        style={{
          backgroundColor: COLORS.white,
          border: `1px solid ${error ? COLORS.error : COLORS.gray}`,
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontWeight: 400,
          fontSize: "16px",
          color: COLORS.charcoal,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.teal
          e.currentTarget.style.boxShadow = `0 0 0 3px rgba(72, 106, 106, 0.1)`
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.gray
          e.currentTarget.style.boxShadow = "none"
        }}
      />
      {error && (
        <span
          id={errorId}
          style={{
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "14px",
            color: COLORS.error,
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

// Textarea
interface TextareaProps {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  placeholder?: string
  maxLength?: number
  rows?: number
}

function Textarea({ label, value, onChange, onBlur, error, placeholder, maxLength = 500, rows = 3 }: TextareaProps) {
  const id = label.toLowerCase().replace(/\s+/g, "-")

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        style={{
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontWeight: 400,
          fontSize: "16px",
          color: COLORS.charcoal,
        }}
      >
        {label}
      </label>
      <div className="relative">
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          className="w-full resize-none rounded-lg p-4 transition-all duration-150 outline-none"
          style={{
            backgroundColor: COLORS.white,
            border: `1px solid ${error ? COLORS.error : COLORS.gray}`,
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: COLORS.charcoal,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.teal
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(72, 106, 106, 0.1)`
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.gray
            e.currentTarget.style.boxShadow = "none"
          }}
        />
        <span
          className="absolute bottom-3 right-4"
          style={{
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "14px",
            color: COLORS.descriptionGray,
          }}
        >
          {maxLength - value.length}/{maxLength}
        </span>
      </div>
    </div>
  )
}

// Select Dropdown
interface SelectProps {
  label: string
  value: string | number | null
  onChange: (value: string | number) => void
  options: { label: string; value: string | number }[]
  placeholder?: string
  required?: boolean
  error?: string
}

function Select({ label, value, onChange, options, placeholder = "Select...", required = false, error }: SelectProps) {
  const id = label.toLowerCase().replace(/\s+/g, "-")

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        style={{
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontWeight: 400,
          fontSize: "16px",
          color: COLORS.charcoal,
        }}
      >
        {label}
        {required && <span style={{ color: COLORS.error }}> *</span>}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => {
            const val = e.target.value
            const numVal = parseFloat(val)
            onChange(isNaN(numVal) ? val : numVal)
          }}
          className="w-full appearance-none rounded-lg p-4 pr-12 transition-all duration-150 outline-none"
          style={{
            backgroundColor: COLORS.white,
            border: `1px solid ${error ? COLORS.error : COLORS.gray}`,
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: value ? COLORS.charcoal : COLORS.placeholder,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.teal
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(72, 106, 106, 0.1)`
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.gray
            e.currentTarget.style.boxShadow = "none"
          }}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M4 6L8 10L12 6" stroke={COLORS.charcoal} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      {error && (
        <span
          style={{
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "14px",
            color: COLORS.error,
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

// Checkbox
interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
  required?: boolean
  error?: string
}

function Checkbox({ checked, onChange, children, error }: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex cursor-pointer items-start gap-3">
        <div
          role="checkbox"
          aria-checked={checked}
          tabIndex={0}
          onClick={() => onChange(!checked)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onChange(!checked)
            }
          }}
          className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors duration-150 outline-none"
          style={{
            borderColor: error ? COLORS.error : checked ? COLORS.teal : COLORS.gray,
            backgroundColor: checked ? COLORS.teal : "transparent",
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${COLORS.teal}`
            e.currentTarget.style.outlineOffset = "2px"
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = "none"
          }}
        >
          {checked && (
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path
                d="M1 5L4.5 8.5L11 1"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <span
          style={{
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "14px",
            color: COLORS.charcoal,
            lineHeight: 1.5,
          }}
        >
          {children}
        </span>
      </label>
      {error && (
        <span
          style={{
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "14px",
            color: COLORS.error,
            marginLeft: "32px",
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

// Date Picker Popover
interface DatePickerProps {
  value: string | null
  onChange: (date: string) => void
  minDate?: Date
  maxDate?: Date
  placeholder?: string
  label: string
}

function DatePicker({ value, onChange, minDate, maxDate, placeholder = "Select date", label }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) return parseDate(value)
    return new Date()
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const minD = minDate || new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const maxD = maxDate || new Date(today.getTime() + 3 * 365 * 24 * 60 * 60 * 1000)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  const selectDate = (day: number) => {
    const selected = new Date(year, month, day)
    onChange(formatDate(selected))
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  const isDateDisabled = (day: number) => {
    const date = new Date(year, month, day)
    date.setHours(0, 0, 0, 0)
    const minCompare = new Date(minD)
    minCompare.setHours(0, 0, 0, 0)
    const maxCompare = new Date(maxD)
    maxCompare.setHours(23, 59, 59, 999)
    return date < minCompare || date > maxCompare
  }

  const isSelected = (day: number) => {
    if (!value) return false
    const selected = parseDate(value)
    return selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === day
  }

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} />)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const disabled = isDateDisabled(d)
    const selected = isSelected(d)
    days.push(
      <button
        key={d}
        type="button"
        onClick={() => !disabled && selectDate(d)}
        disabled={disabled}
        className="flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors duration-150"
        style={{
          backgroundColor: selected ? COLORS.teal : "transparent",
          color: selected ? COLORS.white : disabled ? COLORS.gray : COLORS.charcoal,
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "'Satoshi', system-ui, sans-serif",
        }}
        onMouseEnter={(e) => {
          if (!disabled && !selected) {
            e.currentTarget.style.backgroundColor = "rgba(72, 106, 106, 0.1)"
          }
        }}
        onMouseLeave={(e) => {
          if (!selected) {
            e.currentTarget.style.backgroundColor = "transparent"
          }
        }}
      >
        {d}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <label
        style={{
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontWeight: 400,
          fontSize: "16px",
          color: COLORS.charcoal,
        }}
      >
        {label}
      </label>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(!isOpen)
          }}
          className="flex w-full items-center justify-between rounded-lg p-4 transition-all duration-150 outline-none"
          style={{
            backgroundColor: COLORS.white,
            border: `1px solid ${COLORS.gray}`,
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: value ? COLORS.charcoal : COLORS.placeholder,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = COLORS.teal
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(72, 106, 106, 0.1)`
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = COLORS.gray
            e.currentTarget.style.boxShadow = "none"
          }}
        >
          {value ? formatDisplayDate(value) : placeholder}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="16" height="14" rx="2" stroke={COLORS.charcoal} strokeWidth="1.5" />
            <path d="M2 8H18" stroke={COLORS.charcoal} strokeWidth="1.5" />
            <path d="M6 2V5" stroke={COLORS.charcoal} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 2V5" stroke={COLORS.charcoal} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-2 w-full min-w-[320px] rounded-lg p-4 shadow-lg"
            style={{ backgroundColor: COLORS.ivory, border: `1px solid ${COLORS.gray}` }}
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150"
                style={{ color: COLORS.charcoal }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(72, 106, 106, 0.1)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <span
                style={{
                  fontFamily: "'General Sans', system-ui, sans-serif",
                  fontWeight: 500,
                  fontSize: "16px",
                  color: COLORS.charcoal,
                }}
              >
                {MONTHS[month]} {year}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150"
                style={{ color: COLORS.charcoal }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(72, 106, 106, 0.1)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div
                  key={day}
                  className="flex h-10 w-10 items-center justify-center text-xs"
                  style={{
                    fontFamily: "'Satoshi', system-ui, sans-serif",
                    fontWeight: 400,
                    color: COLORS.descriptionGray,
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">{days}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// Month Picker Popover
interface MonthPickerProps {
  value: string | null
  onChange: (month: string) => void
  minMonth?: string
  placeholder?: string
  label: string
}

function MonthPicker({ value, onChange, minMonth, placeholder = "Select month", label }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.split("-")[0])
    return new Date().getFullYear()
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()

  const minDate = minMonth ? minMonth : `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
  const [minYear, minMonthNum] = minDate.split("-").map(Number)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  const prevYear = () => setViewYear(viewYear - 1)
  const nextYear = () => setViewYear(viewYear + 1)

  const selectMonth = (monthIndex: number) => {
    const selected = `${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`
    onChange(selected)
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  const isMonthDisabled = (monthIndex: number) => {
    if (viewYear < minYear) return true
    if (viewYear === minYear && monthIndex + 1 < minMonthNum) return true
    return false
  }

  const isSelected = (monthIndex: number) => {
    if (!value) return false
    const [y, m] = value.split("-").map(Number)
    return y === viewYear && m === monthIndex + 1
  }

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <label
        style={{
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontWeight: 400,
          fontSize: "16px",
          color: COLORS.charcoal,
        }}
      >
        {label}
      </label>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between rounded-lg p-4 transition-all duration-150 outline-none"
          style={{
            backgroundColor: COLORS.white,
            border: `1px solid ${COLORS.gray}`,
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: value ? COLORS.charcoal : COLORS.placeholder,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = COLORS.teal
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(72, 106, 106, 0.1)`
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = COLORS.gray
            e.currentTarget.style.boxShadow = "none"
          }}
        >
          {value ? formatMonthYear(value) : placeholder}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="16" height="14" rx="2" stroke={COLORS.charcoal} strokeWidth="1.5" />
            <path d="M2 8H18" stroke={COLORS.charcoal} strokeWidth="1.5" />
            <path d="M6 2V5" stroke={COLORS.charcoal} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 2V5" stroke={COLORS.charcoal} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] rounded-lg p-4 shadow-lg"
            style={{ backgroundColor: COLORS.ivory, border: `1px solid ${COLORS.gray}` }}
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={prevYear}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150"
                style={{ color: COLORS.charcoal }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(72, 106, 106, 0.1)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <span
                style={{
                  fontFamily: "'General Sans', system-ui, sans-serif",
                  fontWeight: 500,
                  fontSize: "16px",
                  color: COLORS.charcoal,
                }}
              >
                {viewYear}
              </span>
              <button
                type="button"
                onClick={nextYear}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150"
                style={{ color: COLORS.charcoal }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(72, 106, 106, 0.1)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MONTHS.map((month, i) => {
                const disabled = isMonthDisabled(i)
                const selected = isSelected(i)
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => !disabled && selectMonth(i)}
                    disabled={disabled}
                    className="rounded-lg px-3 py-2 text-sm transition-colors duration-150"
                    style={{
                      backgroundColor: selected ? COLORS.teal : "transparent",
                      color: selected ? COLORS.white : disabled ? COLORS.gray : COLORS.charcoal,
                      cursor: disabled ? "not-allowed" : "pointer",
                      fontFamily: "'Satoshi', system-ui, sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      if (!disabled && !selected) {
                        e.currentTarget.style.backgroundColor = "rgba(72, 106, 106, 0.1)"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) {
                        e.currentTarget.style.backgroundColor = "transparent"
                      }
                    }}
                  >
                    {month}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Phone Input with Country Selector
interface PhoneInputProps {
  value: string
  countryCode: string
  onChange: (phone: string) => void
  onCountryChange: (code: string) => void
  onBlur?: () => void
  error?: string
}

function PhoneInput({ value, countryCode, onChange, onCountryChange, onBlur, error }: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0]

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <label
        style={{
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontWeight: 400,
          fontSize: "16px",
          color: COLORS.charcoal,
        }}
      >
        Phone <span style={{ color: COLORS.error }}>*</span>
      </label>
      <div className="relative flex">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-l-lg border-r-0 px-3 transition-all duration-150 outline-none"
          style={{
            backgroundColor: COLORS.white,
            border: `1px solid ${error ? COLORS.error : COLORS.gray}`,
            borderRight: "none",
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: COLORS.charcoal,
            minWidth: "100px",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.teal
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.gray
          }}
        >
          <span>{selectedCountry.flag}</span>
          <span>{selectedCountry.dial}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke={COLORS.charcoal} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d\s\-()]/g, ""))}
          onBlur={onBlur}
          placeholder="Phone number"
          className="flex-1 rounded-r-lg p-4 transition-all duration-150 outline-none"
          style={{
            backgroundColor: COLORS.white,
            border: `1px solid ${error ? COLORS.error : COLORS.gray}`,
            borderLeft: "none",
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: COLORS.charcoal,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.teal
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(72, 106, 106, 0.1)`
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.gray
            e.currentTarget.style.boxShadow = "none"
          }}
        />

        {isOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-2 max-h-64 w-64 overflow-y-auto rounded-lg shadow-lg"
            style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.gray}` }}
          >
            {COUNTRIES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onCountryChange(country.code)
                  setIsOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 transition-colors duration-150"
                style={{
                  fontFamily: "'Satoshi', system-ui, sans-serif",
                  fontWeight: 400,
                  fontSize: "14px",
                  color: COLORS.charcoal,
                  backgroundColor: country.code === countryCode ? "rgba(72, 106, 106, 0.05)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(72, 106, 106, 0.1)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    country.code === countryCode ? "rgba(72, 106, 106, 0.05)" : "transparent"
                }}
              >
                <span>{country.flag}</span>
                <span className="flex-1 text-left">{country.name}</span>
                <span style={{ color: COLORS.descriptionGray }}>{country.dial}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <span
          style={{
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "14px",
            color: COLORS.error,
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

// Animated Checkmark
function AnimatedCheckmark() {
  // Circle circumference: 2 * PI * r = 2 * 3.14159 * 28 ≈ 176
  const circleCircumference = 176
  // Checkmark path length (approximate)
  const checkmarkLength = 40
  
  return (
    <div className="flex items-center justify-center">
      <svg width="64" height="64" viewBox="0 0 64 64" className="checkmark-svg">
        {/* Background fill circle */}
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="rgba(72, 106, 106, 0.08)"
        />
        {/* Animated stroke circle */}
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke={COLORS.teal}
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            strokeDasharray: circleCircumference,
            strokeDashoffset: circleCircumference,
            animation: "checkmark-circle 400ms ease forwards",
            transformOrigin: "center",
            transform: "rotate(-90deg)",
          }}
        />
        {/* Checkmark path */}
        <path
          d="M20 32L28 40L44 24"
          fill="none"
          stroke={COLORS.white}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: checkmarkLength,
            strokeDashoffset: checkmarkLength,
            animation: "checkmark-check 300ms ease forwards 400ms",
          }}
        />
        <style>{`
          @keyframes checkmark-circle {
            to { stroke-dashoffset: 0; }
          }
          @keyframes checkmark-check {
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      </svg>
    </div>
  )
}

// ============================================================================
// SLIDE COMPONENTS
// ============================================================================

// Slide 1: Destinations
function DestinationsSlide({
  destinations,
  onChange,
}: {
  destinations: string[]
  onChange: (destinations: string[]) => void
}) {
  const toggleDestination = (value: string) => {
    if (value === "UNDECIDED") {
      onChange(destinations.includes("UNDECIDED") ? [] : ["UNDECIDED"])
    } else {
      const newDestinations = destinations.filter((d) => d !== "UNDECIDED")
      if (newDestinations.includes(value)) {
        onChange(newDestinations.filter((d) => d !== value))
      } else {
        onChange([...newDestinations, value])
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 text-center">
        <Headline>Where in Africa are you dreaming of?</Headline>
        <Subtext>Select all that interest you, or let us help you decide</Subtext>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DESTINATIONS.map((dest) => (
          <SelectableCard
            key={dest.value}
            selected={destinations.includes(dest.value)}
            onSelect={() => toggleDestination(dest.value)}
            type="checkbox"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span
                  style={{
                    fontFamily: "'General Sans', system-ui, sans-serif",
                    fontWeight: 500,
                    fontSize: "16px",
                    color: COLORS.charcoal,
                  }}
                >
                  {dest.label}
                </span>
                <span
                  style={{
                    fontFamily: "'Satoshi', system-ui, sans-serif",
                    fontWeight: 400,
                    fontSize: "14px",
                    color: COLORS.descriptionGray,
                  }}
                >
                  {dest.description}
                </span>
              </div>
              <CheckboxIndicator checked={destinations.includes(dest.value)} />
            </div>
          </SelectableCard>
        ))}
      </div>

      <div className="flex justify-center">
        <SelectableCard
          selected={destinations.includes("UNDECIDED")}
          onSelect={() => toggleDestination("UNDECIDED")}
          type="checkbox"
          className="w-full max-w-md"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span
                style={{
                  fontFamily: "'General Sans', system-ui, sans-serif",
                  fontWeight: 500,
                  fontSize: "16px",
                  color: COLORS.charcoal,
                }}
              >
                {"I'm not sure yet"}
              </span>
              <span
                style={{
                  fontFamily: "'Satoshi', system-ui, sans-serif",
                  fontWeight: 400,
                  fontSize: "14px",
                  color: COLORS.descriptionGray,
                }}
              >
                Help me discover the perfect destination
              </span>
            </div>
            <CheckboxIndicator checked={destinations.includes("UNDECIDED")} />
          </div>
        </SelectableCard>
      </div>
    </div>
  )
}

// Slide 2: Timing
function TimingSlide({
  timingType,
  dateStart,
  dateEnd,
  windowEarliest,
  windowLatest,
  onTimingTypeChange,
  onDateStartChange,
  onDateEndChange,
  onWindowEarliestChange,
  onWindowLatestChange,
}: {
  timingType: string | null
  dateStart: string | null
  dateEnd: string | null
  windowEarliest: string | null
  windowLatest: string | null
  onTimingTypeChange: (type: string) => void
  onDateStartChange: (date: string | null) => void
  onDateEndChange: (date: string | null) => void
  onWindowEarliestChange: (month: string | null) => void
  onWindowLatestChange: (month: string | null) => void
}) {
  const today = new Date()
  const minDate = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const maxDate = new Date(today.getTime() + 3 * 365 * 24 * 60 * 60 * 1000)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 text-center">
        <Headline>When are you hoping to travel?</Headline>
        <Subtext>This helps us match you with the perfect seasonal experiences</Subtext>
      </div>

      <div className="flex flex-col gap-4">
        {TIMING_OPTIONS.map((option) => (
          <div key={option.value} className="flex flex-col gap-4">
            <SelectableCard selected={timingType === option.value} onSelect={() => onTimingTypeChange(option.value)}>
              <div className="flex items-center gap-3">
                <RadioIndicator checked={timingType === option.value} />
                <span
                  style={{
                    fontFamily: "'Satoshi', system-ui, sans-serif",
                    fontWeight: 400,
                    fontSize: "16px",
                    color: COLORS.charcoal,
                  }}
                >
                  {option.label}
                </span>
              </div>
            </SelectableCard>

            {/* Conditional date inputs */}
            {timingType === "specific" && option.value === "specific" && (
              <div
                className="grid grid-cols-1 gap-4 pb-72 pl-4 md:grid-cols-2"
                style={{
                  animation: "slideDown 250ms ease",
                }}
              >
                <DatePicker
                  label="Approximate arrival"
                  value={dateStart}
                  onChange={onDateStartChange}
                  minDate={minDate}
                  maxDate={maxDate}
                />
                <DatePicker
                  label="Approximate departure"
                  value={dateEnd}
                  onChange={onDateEndChange}
                  minDate={dateStart ? parseDate(dateStart) : minDate}
                  maxDate={maxDate}
                />
              </div>
            )}

            {/* Conditional month inputs */}
            {timingType === "flexible" && option.value === "flexible" && (
              <div
                className="grid grid-cols-1 gap-4 pb-48 pl-4 md:grid-cols-2"
                style={{
                  animation: "slideDown 250ms ease",
                }}
              >
                <MonthPicker
                  label="Earliest I could travel"
                  value={windowEarliest}
                  onChange={onWindowEarliestChange}
                />
                <MonthPicker
                  label="Latest I'd want to travel"
                  value={windowLatest}
                  onChange={onWindowLatestChange}
                  minMonth={windowEarliest || undefined}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            max-height: 200px;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// Slide 3: Travelers
function TravelersSlide({
  partyType,
  totalTravelers,
  childrenCount,
  onPartyTypeChange,
  onTotalTravelersChange,
  onChildrenCountChange,
}: {
  partyType: string | null
  totalTravelers: number | null
  childrenCount: number | null
  onPartyTypeChange: (type: string) => void
  onTotalTravelersChange: (count: number) => void
  onChildrenCountChange: (count: number) => void
}) {
  const selectedOption = PARTY_OPTIONS.find((o) => o.value === partyType)
  const showPartB = selectedOption?.showPartB

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 text-center">
        <Headline>Who will be joining this adventure?</Headline>
        <Subtext>This helps us recommend the right lodges and experiences</Subtext>
      </div>

      <div className="flex flex-col gap-4">
        {PARTY_OPTIONS.map((option) => (
          <SelectableCard
            key={option.value}
            selected={partyType === option.value}
            onSelect={() => onPartyTypeChange(option.value)}
          >
            <div className="flex items-center gap-3">
              <RadioIndicator checked={partyType === option.value} />
              <span
                style={{
                  fontFamily: "'Satoshi', system-ui, sans-serif",
                  fontWeight: 400,
                  fontSize: "16px",
                  color: COLORS.charcoal,
                }}
              >
                {option.label}
              </span>
            </div>
          </SelectableCard>
        ))}
      </div>

      {showPartB && (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          style={{
            animation: "slideDown 250ms ease",
          }}
        >
          <Select
            label="How many travelers in total?"
            value={totalTravelers}
            onChange={(v) => onTotalTravelersChange(v as number)}
            options={TRAVELER_OPTIONS}
            required
          />
          <Select
            label="How many are under 18?"
            value={childrenCount}
            onChange={(v) => onChildrenCountChange(v as number)}
            options={CHILDREN_OPTIONS}
            required
          />
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            max-height: 200px;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// Slide 4: Experiences (multi-select)
function ExperiencesSlide({
  interests,
  onChange,
}: {
  interests: string[]
  onChange: (interests: string[]) => void
}) {
  const toggleInterest = (value: string) => {
    if (interests.includes(value)) {
      onChange(interests.filter((i) => i !== value))
    } else {
      onChange([...interests, value])
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 text-center">
        <Headline>What experiences interest you?</Headline>
        <Subtext>{"Select all that appeal — we'll design around your passions"}</Subtext>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" style={{ alignItems: "stretch" }}>
        {EXPERIENCES_OPTIONS.map((option) => (
          <SelectableCard
            key={option.value}
            selected={interests.includes(option.value)}
            onSelect={() => toggleInterest(option.value)}
            type="checkbox"
            className="h-full"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <CheckboxIndicator checked={interests.includes(option.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <span
                  style={{
                    fontFamily: "'Satoshi', system-ui, sans-serif",
                    fontWeight: 400,
                    fontSize: "16px",
                    color: COLORS.charcoal,
                  }}
                >
                  {option.label}
                </span>
                <span
                  style={{
                    fontFamily: "'Satoshi', system-ui, sans-serif",
                    fontWeight: 400,
                    fontSize: "14px",
                    color: COLORS.descriptionGray,
                  }}
                >
                  {option.description}
                </span>
              </div>
            </div>
          </SelectableCard>
        ))}
      </div>
    </div>
  )
}

// Slide 5: Budget
function BudgetSlide({
  budget,
  onChange,
}: {
  budget: string | null
  onChange: (range: string, budgetCents: number, profitCents: number) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 text-center">
        <Headline>What investment level feels right?</Headline>
        <Subtext>
          Luxury African safaris typically range from $10,000 to $100,000+ per person. This helps us tailor
          recommendations to your expectations.
        </Subtext>
      </div>

      <div className="flex flex-col gap-4">
        {BUDGET_OPTIONS.map((option) => (
          <SelectableCard
            key={option.value}
            selected={budget === option.value}
            onSelect={() => onChange(option.value, option.budget, option.profit)}
          >
            <div className="flex items-center gap-3">
              <RadioIndicator checked={budget === option.value} />
              <span
                style={{
                  fontFamily: "'Satoshi', system-ui, sans-serif",
                  fontWeight: 400,
                  fontSize: "16px",
                  color: COLORS.charcoal,
                }}
              >
                {option.label}
              </span>
            </div>
          </SelectableCard>
        ))}
      </div>

      <p
        className="text-center text-sm"
        style={{
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontWeight: 400,
          color: COLORS.descriptionGray,
        }}
      >
        All prices in USD. We can discuss other currencies with your Safari Expert.
      </p>
    </div>
  )
}

// Slide 6: Contact
function ContactSlide({
  state,
  dispatch,
  validateField,
}: {
  state: FormState
  dispatch: React.Dispatch<FormAction>
  validateField: (field: string) => void
}) {
  const setField = (field: string, value: string | boolean) => {
    dispatch({ type: "SET_FIELD", payload: { field, value } })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 text-center">
        <Headline>{"Let's start planning together"}</Headline>
        <Subtext>One of our Safari Experts will be in touch within 24 hours</Subtext>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextInput
            label="First name"
            value={state.first_name}
            onChange={(v) => setField("first_name", v)}
            onBlur={() => validateField("first_name")}
            error={state.touched.first_name ? state.errors.first_name : undefined}
            required
          />
          <TextInput
            label="Last name"
            value={state.last_name}
            onChange={(v) => setField("last_name", v)}
            onBlur={() => validateField("last_name")}
            error={state.touched.last_name ? state.errors.last_name : undefined}
            required
          />
        </div>

        <TextInput
          label="Email"
          type="email"
          value={state.email}
          onChange={(v) => setField("email", v)}
          onBlur={() => validateField("email")}
          error={state.touched.email ? state.errors.email : undefined}
          required
        />

        <PhoneInput
          value={state.phone}
          countryCode={state.phone_country_code}
          onChange={(v) => setField("phone", v)}
          onCountryChange={(c) => setField("phone_country_code", c)}
          onBlur={() => validateField("phone")}
          error={state.touched.phone ? state.errors.phone : undefined}
        />

        <Select
          label="How did you hear about us?"
          value={state.how_heard}
          onChange={(v) => setField("how_heard", v as string)}
          options={HOW_HEARD_OPTIONS}
          required
          error={state.touched.how_heard ? state.errors.how_heard : undefined}
        />

        <Textarea
          label="Message (optional)"
          value={state.message}
          onChange={(v) => setField("message", v)}
          placeholder="Special requests, accessibility needs, occasions to celebrate..."
          maxLength={500}
        />

        <div className="flex flex-col gap-4 pt-2">
          <Checkbox
            checked={state.contact_consent}
            onChange={(v) => setField("contact_consent", v)}
            error={state.touched.contact_consent ? state.errors.contact_consent : undefined}
            required
          >
            {"I agree to Kiuli's "}
            <a
              href="#"
              style={{ color: COLORS.teal, textDecoration: "underline" }}
              onClick={(e) => e.preventDefault()}
            >
              privacy policy
            </a>
            {" and consent to being contacted about my safari inquiry."}
          </Checkbox>

          <Checkbox
            checked={state.marketing_consent}
            onChange={(v) => setField("marketing_consent", v)}
          >
            Keep me inspired with safari insights and travel tips.
          </Checkbox>
        </div>
      </div>
    </div>
  )
}

// Confirmation Screen
function ConfirmationScreen({ firstName }: { firstName: string }) {
  // Capitalize first name
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 py-12 text-center">
      <AnimatedCheckmark />

      <h2
        className="text-2xl md:text-[28px]"
        style={{
          fontFamily: "'General Sans', system-ui, sans-serif",
          fontWeight: 500,
          color: COLORS.charcoal,
        }}
      >
        Your safari journey begins here
      </h2>

      <p
        className="max-w-md text-base"
        style={{
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontWeight: 400,
          color: COLORS.charcoal,
        }}
      >
        Thank you, {displayName}. One of our Safari Experts will be in touch within 24 hours to start planning your
        African adventure.
      </p>

      <OutlinedButton onClick={() => window.open("#itineraries", "_self")}>Browse Itineraries</OutlinedButton>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function InquiryForm() {
  const [state, dispatch] = useReducer(formReducer, initialState)
  const slideRef = useRef<HTMLDivElement>(null)
  const [slideKey, setSlideKey] = useState(0)

  // Aria live region for screen reader announcements
  const [announcement, setAnnouncement] = useState("")

  // Submission error for user-visible display
  const [submitError, setSubmitError] = useState("")

  // Focus management on slide change
  useEffect(() => {
    if (slideRef.current) {
      const firstFocusable = slideRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 300)
      }
    }
    setSlideKey((k) => k + 1)
  }, [state.currentSlide])

  // Analytics: form_viewed (once) + slide_viewed (every slide change)
  useEffect(() => {
    trackFormViewed()
    trackSlideViewed(state.currentSlide)
  }, [state.currentSlide])

  // Analytics: form_abandoned on page hide (fires once via module flag)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !state.isComplete) {
        trackFormAbandoned(state.currentSlide)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [state.currentSlide, state.isComplete])

  // Validation functions
  const validateField = useCallback(
    (field: string) => {
      dispatch({ type: "SET_TOUCHED", payload: field })

      let error = ""

      switch (field) {
        case "first_name":
          if (!state.first_name || state.first_name.length < 2) {
            error = "First name must be at least 2 characters"
          }
          break
        case "last_name":
          if (!state.last_name || state.last_name.length < 2) {
            error = "Last name must be at least 2 characters"
          }
          break
        case "email":
          if (!state.email) {
            error = "Email is required"
          } else if (!isValidEmail(state.email)) {
            error = "Please enter a valid email address"
          }
          break
case "phone":
  if (!state.phone) {
  error = "Phone number is required"
  } else {
  const e164Phone = formatPhoneE164(state.phone, state.phone_country_code)
  if (!isValidE164Phone(e164Phone)) {
  error = "Please enter a valid phone number"
  }
  }
  break
        case "how_heard":
          if (!state.how_heard) {
            error = "Please select how you heard about us"
          }
          break
        case "contact_consent":
          if (!state.contact_consent) {
            error = "You must agree to continue"
          }
          break
      }

      if (error) {
        dispatch({ type: "SET_ERROR", payload: { field, error } })
      } else {
        dispatch({ type: "CLEAR_ERROR", payload: field })
      }

      return !error
    },
    [state]
  )

  // Slide validation
  const isSlideValid = useCallback(() => {
    switch (state.currentSlide) {
      case 0:
        return state.destinations.length > 0
      case 1:
        if (!state.timing_type) return false
        if (state.timing_type === "specific") {
          if (!state.travel_date_start || !state.travel_date_end) return false
          if (parseDate(state.travel_date_end) <= parseDate(state.travel_date_start)) return false
        }
        if (state.timing_type === "flexible") {
          if (!state.travel_window_earliest || !state.travel_window_latest) return false
          if (state.travel_window_latest < state.travel_window_earliest) return false
        }
        return true
      case 2:
        if (!state.party_type) return false
        const partyOption = PARTY_OPTIONS.find((o) => o.value === state.party_type)
        if (partyOption?.showPartB) {
          if (state.total_travelers === null || state.children_count === null) return false
        }
        return true
      case 3:
        return state.interests.length > 0
      case 4:
        return !!state.budget_range
      case 5:
        return (
          state.first_name.length >= 2 &&
          state.last_name.length >= 2 &&
          isValidEmail(state.email) &&
          !!state.how_heard &&
          state.contact_consent
        )
      default:
        return true
    }
  }, [state])

  const handleNext = useCallback(async () => {
    // Analytics: slide_completed with full selections (slides 0-4 internal = 1-5 spec)
    if (state.currentSlide < 5) {
      let selectionsObj: Record<string, unknown> = {}
      switch (state.currentSlide) {
        case 0: selectionsObj = { destinations: state.destinations }; break
        case 1:
          selectionsObj = { timing_type: state.timing_type }
          if (state.timing_type === 'specific') {
            selectionsObj.date_start = state.travel_date_start
            selectionsObj.date_end = state.travel_date_end
          } else if (state.timing_type === 'flexible') {
            selectionsObj.window_earliest = state.travel_window_earliest
            selectionsObj.window_latest = state.travel_window_latest
          }
          break
        case 2: selectionsObj = { party_type: state.party_type, total_travelers: state.total_travelers, children_count: state.children_count }; break
        case 3: selectionsObj = { experiences: state.interests }; break
        case 4: selectionsObj = { budget_range: state.budget_range }; break
      }
      trackSlideCompleted(state.currentSlide, JSON.stringify(selectionsObj))

      // Engaged Visitor conversion: fires when LEAVING experiences slide (internal 3 = spec 4)
      if (state.currentSlide === 3) {
        trackEngagedVisitor()
      }
    }

    if (state.currentSlide === 5) {
      // Validate all fields on submit
      const fields = ["first_name", "last_name", "email", "phone", "how_heard", "contact_consent"]
      let allValid = true
      fields.forEach((field) => {
        const valid = validateField(field)
        if (!valid) allValid = false
      })

      if (allValid) {
        dispatch({ type: "SET_SUBMITTING", payload: true })
        setAnnouncement("Submitting your inquiry...")

        // Collect attribution from browser
        const attribution = typeof window !== 'undefined' ? {
          page_url: window.location.href,
          referrer: document.referrer || undefined,
          gclid: new URLSearchParams(window.location.search).get('gclid') || undefined,
          utm_source: new URLSearchParams(window.location.search).get('utm_source') || undefined,
          utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || undefined,
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
          utm_content: new URLSearchParams(window.location.search).get('utm_content') || undefined,
          utm_term: new URLSearchParams(window.location.search).get('utm_term') || undefined,
        } : {}

        // Construct submission payload with E.164 phone format
        const e164Phone = formatPhoneE164(state.phone, state.phone_country_code)
        const payload = {
          destinations: state.destinations,
          timing_type: state.timing_type,
          travel_date_start: state.travel_date_start,
          travel_date_end: state.travel_date_end,
          travel_window_earliest: state.travel_window_earliest,
          travel_window_latest: state.travel_window_latest,
          party_type: state.party_type,
          total_travelers: state.total_travelers,
          children_count: state.children_count,
          interests: state.interests,
          budget_range: state.budget_range,
          stated_budget_cents: state.stated_budget_cents,
          projected_profit_cents: state.projected_profit_cents,
          first_name: state.first_name,
          last_name: state.last_name,
          email: state.email,
          phone: e164Phone,
          how_heard: state.how_heard,
          message: state.message || undefined,
          contact_consent: state.contact_consent,
          marketing_consent: state.marketing_consent,
          form_started_at: new Date().toISOString(),
          inquiry_type: 'form',
          ...attribution,
        }

        try {
          setSubmitError("")
          const res = await fetch('/api/inquiry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const data = await res.json()
          if (res.ok && data.success) {
            dispatch({ type: "SET_SUBMITTING", payload: false })
            dispatch({ type: "SET_COMPLETE" })
            setAnnouncement("Your inquiry has been submitted successfully.")

            // Analytics: form_submitted + generate_lead + Inquiry Submitted conversion
            const inquiryId = String(data.inquiry_id)
            const profitDollars = state.projected_profit_cents
              ? Math.round(state.projected_profit_cents / 100) : 0
            const destinationsStr = state.destinations.join(',')
            const budgetStr = state.budget_range || ''

            trackFormSubmitted(inquiryId, destinationsStr, budgetStr, profitDollars)
            trackGenerateLead(profitDollars, destinationsStr, budgetStr)
            trackInquiryConversion(profitDollars, inquiryId, state.email)
          } else {
            dispatch({ type: "SET_SUBMITTING", payload: false })
            const errorMsg = data.message || "Please check your information and try again."
            setSubmitError(errorMsg)
            setAnnouncement(errorMsg)
            trackFormError('submission', errorMsg.slice(0, 100), state.currentSlide)
          }
        } catch (err) {
          console.error('Submission failed:', err)
          dispatch({ type: "SET_SUBMITTING", payload: false })
          const errorMsg = "Connection error. Please check your internet and try again."
          setSubmitError(errorMsg)
          setAnnouncement(errorMsg)
          trackFormError('network', errorMsg.slice(0, 100), state.currentSlide)
        }
      } else {
        setAnnouncement("Please correct the errors before submitting.")
        trackFormError('validation', 'Required fields missing on contact slide', state.currentSlide)
      }
    } else {
      dispatch({ type: "NEXT_SLIDE" })
      setAnnouncement(`Moving to step ${state.currentSlide + 2} of 6`)
    }
  }, [state, validateField])

  const handlePrev = useCallback(() => {
    dispatch({ type: "PREV_SLIDE" })
    setAnnouncement(`Returning to step ${state.currentSlide} of 6`)
  }, [state.currentSlide])

  // Render current slide
  const renderSlide = () => {
    switch (state.currentSlide) {
      case 0:
        return (
          <DestinationsSlide
            destinations={state.destinations}
            onChange={(d) => dispatch({ type: "SET_DESTINATIONS", payload: d })}
          />
        )
      case 1:
        return (
          <TimingSlide
            timingType={state.timing_type}
            dateStart={state.travel_date_start}
            dateEnd={state.travel_date_end}
            windowEarliest={state.travel_window_earliest}
            windowLatest={state.travel_window_latest}
            onTimingTypeChange={(t) => dispatch({ type: "SET_TIMING_TYPE", payload: t })}
            onDateStartChange={(d) => dispatch({ type: "SET_TRAVEL_DATE_START", payload: d })}
            onDateEndChange={(d) => dispatch({ type: "SET_TRAVEL_DATE_END", payload: d })}
            onWindowEarliestChange={(m) => dispatch({ type: "SET_TRAVEL_WINDOW_EARLIEST", payload: m })}
            onWindowLatestChange={(m) => dispatch({ type: "SET_TRAVEL_WINDOW_LATEST", payload: m })}
          />
        )
      case 2:
        return (
          <TravelersSlide
            partyType={state.party_type}
            totalTravelers={state.total_travelers}
            childrenCount={state.children_count}
            onPartyTypeChange={(t) => dispatch({ type: "SET_PARTY_TYPE", payload: t })}
            onTotalTravelersChange={(c) => dispatch({ type: "SET_TOTAL_TRAVELERS", payload: c })}
            onChildrenCountChange={(c) => dispatch({ type: "SET_CHILDREN_COUNT", payload: c })}
          />
        )
      case 3:
        return (
          <ExperiencesSlide
            interests={state.interests}
            onChange={(i) => dispatch({ type: "SET_INTERESTS", payload: i })}
          />
        )
      case 4:
        return (
          <BudgetSlide
            budget={state.budget_range}
            onChange={(range, budget, profit) =>
              dispatch({ type: "SET_BUDGET", payload: { range, budget, profit } })
            }
          />
        )
      case 5:
        return <ContactSlide state={state} dispatch={dispatch} validateField={validateField} />
      case 6:
        return <ConfirmationScreen firstName={state.first_name} />
      default:
        return null
    }
  }

  if (state.isComplete) {
    return (
      <div
        className="mx-auto w-full max-w-[640px] rounded-xl px-4 py-8 md:px-6"
        style={{ backgroundColor: COLORS.ivory }}
      >
        <ConfirmationScreen firstName={state.first_name} />
        <div className="sr-only" aria-live="polite">
          {announcement}
        </div>
      </div>
    )
  }

  return (
    <div
      className="mx-auto w-full max-w-[640px] rounded-xl px-4 py-8 md:px-6"
      style={{ backgroundColor: COLORS.ivory }}
    >
      {/* Progress Dots */}
      <div className="mb-4">
        <ProgressDots current={state.currentSlide} total={6} />
      </div>

      {/* Slide Content */}
      <div ref={slideRef} className="relative">
        <div
          key={slideKey}
          className="pt-8 pb-12"
          style={{
            animation: `${state.direction === 1 ? "slideInRight" : "slideInLeft"} 250ms ease`,
          }}
        >
          {renderSlide()}
        </div>
      </div>

      {/* Submission error display */}
      {submitError && (
        <div className="text-red-600 text-sm text-center mb-4" role="alert">
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div
        className="flex items-center justify-between border-t pt-6 md:border-0 md:pt-0"
        style={{ borderColor: COLORS.gray }}
      >
        <div>{state.currentSlide > 0 && <SecondaryButton onClick={handlePrev}>Previous</SecondaryButton>}</div>
        <PrimaryButton onClick={handleNext} disabled={!isSlideValid()} loading={state.isSubmitting}>
          {state.currentSlide === 5 ? "Start My Safari Journey" : "Next Step"}
        </PrimaryButton>
      </div>

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {/* Slide transition styles */}
      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 500px;
          }
        }
        
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        
        /* Focus visible only for keyboard navigation */
        *:focus:not(:focus-visible) {
          outline: none !important;
        }
      `}</style>
    </div>
  )
}
