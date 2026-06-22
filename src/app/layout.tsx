import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/context/app-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "NORTHVALE INV",
  description: "Manufacturing inventory and BOM planner foundation"
};

export const viewport: Viewport = {
  themeColor: "#111316",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
