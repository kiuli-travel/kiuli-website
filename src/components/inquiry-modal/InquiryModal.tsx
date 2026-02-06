'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useInquiryModal } from './InquiryModalProvider'
import InquiryForm from '@/components/inquiry-form/InquiryForm'

export function InquiryModal() {
  const { isOpen, closeModal } = useInquiryModal()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        className="max-w-[640px] w-[95vw] h-[95vh] md:h-[90vh] md:max-h-[800px] overflow-hidden p-0 border-0 bg-transparent"
        // Remove the default close button since InquiryForm has its own UI
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="w-full h-full overflow-y-auto">
          <InquiryForm />
        </div>
      </DialogContent>
    </Dialog>
  )
}
