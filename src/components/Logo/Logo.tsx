import clsx from 'clsx'
import Image from 'next/image'
import React from 'react'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: boolean
}

export const Logo = (props: Props) => {
  const { loading: loadingFromProps, priority: priorityFromProps, className } = props

  const loading = loadingFromProps || 'lazy'
  const priority = priorityFromProps || false

  return (
    <Image
      alt="Payload Logo"
      width={193}
      height={34}
      loading={priority ? undefined : loading}
      priority={priority}
      className={clsx('max-w-[9.375rem] w-full h-[34px]', className)}
      src="https://raw.githubusercontent.com/payloadcms/payload/main/packages/ui/src/assets/payload-logo-light.svg"
    />
  )
}
