import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Demo desk · Levitate", description: "Your sales demos, in one place." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
