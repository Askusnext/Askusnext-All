import React from 'react';
import SiteChrome from './SiteChrome';

// PublicLayout now delegates to the shared dark SiteChrome so every marketing
// and product page uses the same About Us theme (nav, footer, login modal).
export default function PublicLayout({ children }: { children: React.ReactNode }) {
	return <SiteChrome>{children}</SiteChrome>;
}
