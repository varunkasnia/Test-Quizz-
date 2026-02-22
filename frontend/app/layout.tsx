import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Live GenAI Quiz Platform',
  description: 'Real-time quiz platform powered by AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
