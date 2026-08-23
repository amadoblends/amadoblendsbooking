import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, Geist_Mono } from "next/font/google";
import { SwRegister } from "@/components/pwa/sw-register";
import { NativeShell } from "@/components/native-shell";
import { AppSplash } from "@/components/ui/app-splash";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { AccentProvider, ACCENT_BOOTSTRAP } from "@/components/theme/accent-provider";
import "./globals.css";

// Same pairing as the barber app so both share one identity
const sans = Plus_Jakarta_Sans({
  variable: "--font-sans-app",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const display = Playfair_Display({
  variable: "--font-display-app",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const mono = Geist_Mono({
  variable: "--font-mono-app",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Amado Blends – Reserva tu cita",
  description: "Agenda tu cita en Amado Blends Barbershop",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Amado Blends",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#faf9f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full`}
    >
      <head>
        {/*
          * Applies the stored accent before React runs. Without it, every load
          * paints the default for a frame and then flips — which reads as a
          * bug rather than a preference.
          */}
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOTSTRAP }} />
      </head>
      <body className="h-full bg-background text-foreground">
        <SwRegister />
        <NativeShell />
        {/* Covers the blank gap before the first paint */}
        <AppSplash />
        <AccentProvider>
          {/* Every destructive action asks through our own dialog, not the browser's */}
          <ConfirmProvider>{children}</ConfirmProvider>
        </AccentProvider>
      </body>
    </html>
  );
}
