import React from 'react';
import SiteChrome from './SiteChrome';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
	return <SiteChrome>{children}</SiteChrome>;
}
