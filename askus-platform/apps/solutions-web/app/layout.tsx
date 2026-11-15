import '../src/index.css';
import '../src/App.css';

export const metadata = {
  title: 'AskusNext Global Solutions Private Limited — TMS',
  description: 'AskusNext Global Solutions Private Limited Ticket Management System',
  icons: { icon: '/askus-icon.png', apple: '/askus-icon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
