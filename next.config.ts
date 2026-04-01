import type { NextConfig } from "next";

const securityHeaders = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
    },
    {
        key: "Content-Security-Policy",
        value: [
            "default-src 'self'",
            // Tailwind CDN, Babel, React CDN used by landing page iframe preview, Razorpay checkout
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://fonts.googleapis.com https://checkout.razorpay.com https://cdn.razorpay.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.razorpay.com https://instruments-analytics.razorpay.io https://checkout.razorpay.com https://lumberjack.razorpay.com",
            "frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com",
            "object-src 'none'",
            "base-uri 'self'",
        ].join("; "),
    },
]

const nextConfig: NextConfig = {
    serverExternalPackages: ["jspdf", "fflate"],
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: securityHeaders,
            },
        ]
    },
};

export default nextConfig;
