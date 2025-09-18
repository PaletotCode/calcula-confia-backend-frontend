import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import AppProviders from "@/components/AppProviders";
import "./globals.css";
import { type ReactNode } from "react";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CalculaConfia - Descubra sua restituição de ICMS",
  description:
    "Calcule de forma rápida e segura o valor estimado que você pode receber de restituição do ICMS da conta de luz.",
  metadataBase: new URL("https://calculaconfia.com.br"),
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
        <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/gradient-js/src/gradient.js" strategy="afterInteractive" />
        <Script id="gradient-init" strategy="afterInteractive">
          {`
            // Garante que o script só rode no navegador e depois que a página carregar
            if (typeof window !== 'undefined') {
              var gradient = new Gradient();
              gradient.initGradient("#gradient-canvas");
            }
          `}
        </Script>
      </body>
    </html>
  );
}