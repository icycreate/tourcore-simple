import type { Metadata } from "next";
import "./globals.css";
import "./settings.css";
export const metadata: Metadata = {
  title: "TourCore • Operations, simplified",
  description:
    "Tour operations, expenses and field tools in one calm workspace.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
