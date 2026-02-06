'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface InquiryModalContextType {
  isOpen: boolean
  openModal: () => void
  closeModal: () => void
}

const InquiryModalContext = createContext<InquiryModalContextType | null>(null)

export function useInquiryModal() {
  const context = useContext(InquiryModalContext)
  if (!context) {
    throw new Error('useInquiryModal must be used within InquiryModalProvider')
  }
  return context
}

export function InquiryModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)

  return (
    <InquiryModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
    </InquiryModalContext.Provider>
  )
}
