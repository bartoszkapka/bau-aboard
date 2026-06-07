import "./globals.css";

export const metadata = {
  title: "VHS QUIZ",
  description: "Retro quiz na impreze — host, uczestnicy i tryb TV",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
