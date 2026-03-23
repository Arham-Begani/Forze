import type { Metadata, Viewport } from 'next'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-dm-sans',
})

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
    title: 'Forze - Autonomous Venture Orchestrator',
    description: 'Transform a raw business concept into a production-ready, market-validated venture in minutes with AI-powered agents.',
    keywords: ['startup', 'AI', 'venture', 'business', 'automation'],
    authors: [{ name: 'Forze' }],
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
        { media: '(prefers-color-scheme: dark)', color: '#111110' },
    ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang='en' suppressHydrationWarning className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
            <body className='antialiased'>{children}</body>
        </html>
    )
}
