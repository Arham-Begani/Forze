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
    title: 'Forze - Ship a Live Landing Page and Stress-Test Your Startup',
    description: 'Forze deploys a live landing page with lead capture, convenes an adversarial Shadow Board, and gives you a venture-aware co-pilot — plus outreach, CRM, and investor materials.',
    keywords: ['startup validation', 'AI landing page', 'landing page builder', 'shadow board', 'venture co-pilot', 'investor kit', 'startup outreach'],
    authors: [{ name: 'Forze' }],
    icons: {
        icon: '/favicon.png',
    },
    openGraph: {
        title: 'Forze - From Raw Idea to a Live, Stress-Tested Venture',
        description: 'Deploy a live landing page, get brutal board-style feedback, and grow with a venture-aware co-pilot, outreach, and CRM.',
        type: 'website',
        url: process.env.NEXT_PUBLIC_BASE_URL || 'https://forze.in',
        images: [
            {
                url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://forze.in'}/api/og`,
                width: 1200,
                height: 630,
                alt: 'Forze - Autonomous Venture Orchestrator',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Forze - From Raw Idea to a Live, Stress-Tested Venture',
        description: 'Deploy a live landing page, get brutal board-style feedback, and grow with a venture-aware co-pilot, outreach, and CRM.',
        images: [`${process.env.NEXT_PUBLIC_BASE_URL || 'https://forze.in'}/api/og`],
    },
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
        { media: '(prefers-color-scheme: dark)', color: '#211f1d' },
    ],
}

const THEME_INIT_SCRIPT = `(function(){try{var d=localStorage.getItem('Forze-dark-mode');if(d==='true'){document.documentElement.classList.add('dark');}var t=localStorage.getItem('Forze-theme');if(t&&t!=='amber'){document.documentElement.classList.add('theme-'+t);}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang='en' suppressHydrationWarning className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
            </head>
            <body className='antialiased'>{children}</body>
        </html>
    )
}
