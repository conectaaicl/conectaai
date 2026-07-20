import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const BASE_URL = "https://conectaai.cl";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "ConectaAI Condominios — Software de Gestión Inteligente",
    template: "%s | ConectaAI Condominios"
  },
  description: "Plataforma SaaS para gestión de condominios: control de acceso biométrico, cámaras, conserje digital, portería, finanzas y más. Todo en una app. Chile.",
  keywords: [
    "software condominios chile",
    "gestion condominios",
    "control acceso condominio",
    "porteria digital",
    "conserje virtual condominio",
    "sistema condominios saas",
    "biometrico condominio",
    "camaras seguridad condominio",
    "finanzas condominio"
  ],
  authors: [{ name: "ConectaAI" }],
  creator: "ConectaAI",
  publisher: "ConectaAI SpA",
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
  verification: {
    google: "google39b4a51d86750223",
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "ConectaAI Condominios",
    locale: "es_CL",
    title: "ConectaAI — Software Inteligente para Condominios",
    description: "Gestiona tu condominio con IA: acceso biométrico, portería digital, cámaras, visitantes, paquetería, finanzas y WhatsApp integrado.",
    images: [
      {
        url: `${BASE_URL}/og-conectaai.jpg`,
        width: 1200,
        height: 630,
        alt: "ConectaAI Condominios — Plataforma de Gestión",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ConectaAI — Software para Condominios en Chile",
    description: "Control de acceso, portería digital, finanzas y más para tu condominio. Plataforma SaaS con IA.",
    images: [`${BASE_URL}/og-conectaai.jpg`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ConectaAI Condominios",
    "url": BASE_URL,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "Plataforma SaaS para gestión integral de condominios: control de acceso biométrico, cámaras de seguridad, conserje digital, finanzas y comunicación con residentes.",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "CLP",
      "availability": "https://schema.org/InStock"
    },
    "provider": {
      "@type": "Organization",
      "name": "ConectaAI SpA",
      "url": BASE_URL,
      "areaServed": { "@type": "Country", "name": "Chile" }
    }
  };

  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0F766E" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ConectaAI" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} min-h-screen bg-slate-50 text-slate-900 antialiased`}>
        <script dangerouslySetInnerHTML={{__html: "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}"}}/>
        {children}
      </body>
    </html>
  );
}
