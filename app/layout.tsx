import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'PatchLlama',
    template: '%s · PatchLlama',
  },
  description:
    'Find the bug. Fix the code. Prove it works. Evidence-based debugging with Meta Muse Spark.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body style={{ margin: 0, background: '#0b0c0f', color: '#e8e8ea' }}>{children}</body>
    </html>
  )
}
