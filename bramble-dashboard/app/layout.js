import "./globals.css";

export const metadata = {
  title: "Bramble sales dashboard",
  description: "Private sales dashboard for Bramble cafe.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
