import { Inter } from 'next/font/google';
import './globals.css';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
export const metadata = {
  title: 'ZYRA — AI Business Operating System',
  description: 'Run your entire business on autopilot with ZYRA, the AI Business Operating System.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
