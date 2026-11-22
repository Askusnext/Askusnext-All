import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import {
	AppstoreOutlined, BankOutlined, BarChartOutlined, CalendarOutlined, CheckSquareOutlined, ClockCircleOutlined,
	CloseOutlined, DownOutlined, ExportOutlined, FieldTimeOutlined, FunnelPlotOutlined, HistoryOutlined, LayoutOutlined,
	LogoutOutlined, MenuOutlined, ProfileOutlined, RightOutlined, SafetyOutlined, SyncOutlined, TeamOutlined, UserOutlined,
	AppstoreAddOutlined,
} from '@ant-design/icons';
import { logout, useAppDispatch, useAppSelector } from '../store';
import { STAFF_KEYS, clearSession } from '../api/session';
import { NAV_ITEMS, canOpen, homePath } from '../access';
import { ERP_MODULES, flatNav, moduleForPath, moduleHome, visibleNav, type ErpModule, type ModuleNavItem } from '../erp/modules';
import { clearCollectionCache } from '../erp/store';
import PresenceGate from './PresenceGate';
import Brand from './Brand';
import { stopPresenceForLogout } from '../presence/session';
import '../styles/erp.css';

const NAV_ICONS: Record<string, ReactNode> = {
	'/dashboard': <AppstoreOutlined />,
	'/board': <LayoutOutlined />,
	'/tickets': <ProfileOutlined />,
	'/analytics': <BarChartOutlined />,
	'/calendar': <CalendarOutlined />,
	'/timesheet': <FieldTimeOutlined />,
	'/attendance': <CheckSquareOutlined />,
	'/work-hours': <ClockCircleOutlined />,
	'/presence': <TeamOutlined />,
	'/leads': <FunnelPlotOutlined />,
	'/insurance-requests': <SafetyOutlined />,
	'/loans': <BankOutlined />,
	'/activity': <HistoryOutlined />,
	'/renewals': <SyncOutlined />,
	'/users': <UserOutlined />,
};

const MODULE_KEY = 'askus_erp_module';
type ModuleId = ErpModule['id'];

const initials = (name?: string) =>
	(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';

function NavGroup({ item, pathname, onNavigate }: { item: ModuleNavItem; pathname: string; onNavigate: () => void }) {
	const containsActive = item.children!.some((c) => pathname === c.path);
	const [open, setOpen] = useState(containsActive);
	useEffect(() => { if (containsActive) setOpen(true); }, [containsActive]);
	const id = `nav-group-${item.path.replace(/\W+/g, '-')}`;
	return (
		<div className={`workspace-group${containsActive ? ' has-active' : ''}`}>
			<button type="button" className="workspace-group-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
				<span className="workspace-nav-icon" aria-hidden>{item.icon}</span>
				<span className="workspace-nav-text">{item.label}</span>
				<span className="workspace-group-caret" aria-hidden>{open ? <DownOutlined /> : <RightOutlined />}</span>
			</button>
			{open && (
				<div id={id} className="workspace-subnav">
					{item.children!.map((c) => (
						<NavLink key={c.path} to={c.path} end onClick={onNavigate}>
							<span className="workspace-nav-text">{c.label}</span>
						</NavLink>
					))}
				</div>
			)}
		</div>
	);
}

export default function AppLayout() {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const user = useAppSelector((state) => state.auth.user);
	const isAuthenticated = Boolean(localStorage.getItem('tms_token'));
	const [menuOpen, setMenuOpen] = useState(false);
	const [switcherOpen, setSwitcherOpen] = useState(false);
	const menuButton = useRef<HTMLButtonElement>(null);
	const visibleItems = NAV_ITEMS.filter((item) => canOpen(user, item));
	const [moduleId, setModuleId] = useState<ModuleId>(() => (localStorage.getItem(MODULE_KEY) as ModuleId) || 'workspace');

	const modules = ERP_MODULES.filter((m) => moduleHome(user, m));

	// Keep the chosen module while one of its pages is open; otherwise follow the URL to the module that owns it.
	useEffect(() => {
		const workspaceOwns = visibleItems.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
		const currentOwns = moduleId === 'workspace' ? workspaceOwns : moduleForPath(pathname, moduleId)?.id === moduleId;
		if (currentOwns) return;
		const next: ModuleId = moduleForPath(pathname, null)?.id ?? 'workspace';
		if (next !== moduleId) {
			setModuleId(next);
			localStorage.setItem(MODULE_KEY, next);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname]);

	const activeModule = moduleId === 'workspace' ? null : ERP_MODULES.find((m) => m.id === moduleId) ?? null;
	const moduleItems = activeModule ? visibleNav(user, activeModule) : [];

	const chooseModule = (id: ModuleId) => {
		setSwitcherOpen(false);
		setMenuOpen(false);
		setModuleId(id);
		localStorage.setItem(MODULE_KEY, id);
		const mod = ERP_MODULES.find((m) => m.id === id);
		const target = mod ? moduleHome(user, mod) : homePath(user);
		if (target) navigate(target);
	};

	// Workspace-only typography and controls (also reaches modals/drawers rendered in <body>).
	useEffect(() => {
		if (!isAuthenticated) return undefined;
		document.body.classList.add('ws-app');
		return () => document.body.classList.remove('ws-app');
	}, [isAuthenticated]);

	const handleLogout = () => {
		stopPresenceForLogout(); // End presence while the token is still valid.
		clearSession(STAFF_KEYS);
		clearCollectionCache();
		dispatch(logout());
		navigate('/home', { replace: true });
	};

	if (!isAuthenticated) return <Outlet />;

	const leafItems = flatNav(moduleItems).filter((i) => !i.children);
	const pageLabel = activeModule
		? leafItems.find((i) => pathname === i.path)?.label
			?? leafItems.filter((i) => pathname.startsWith(`${i.path}/`)).sort((a, b) => b.path.length - a.path.length)[0]?.label ?? 'Overview'
		: visibleItems.find((item) => pathname.startsWith(item.to))?.label ?? 'Overview';

	const switcherCards: { id: ModuleId; label: string; description: string; audience: string; icon: ReactNode; tone: string }[] = [
		...modules.map((m) => ({ id: m.id, label: m.label, description: m.description, audience: m.audience, icon: m.icon, tone: m.tone })),
		{ id: 'workspace', label: 'Team', description: 'Tickets, calendar and users.', audience: 'Everyone', icon: <AppstoreOutlined />, tone: 'blue' },
	];

	return (
		<div className="workspace">
			<aside className="workspace-sidebar" onKeyDown={(event) => {
				if (event.key === 'Escape' && menuOpen) {
					setMenuOpen(false);
					menuButton.current?.focus();
				}
			}}>
				<div className="workspace-brand-row">
					<Link to="/home" aria-label="Askus Next Global Solutions Private Limited home"><Brand /></Link>
					<button ref={menuButton} className="workspace-menu" type="button" aria-expanded={menuOpen} aria-controls="workspace-navigation" aria-label={menuOpen ? 'Close workspace navigation' : 'Open workspace navigation'} onClick={() => setMenuOpen(!menuOpen)}>
						{menuOpen ? <CloseOutlined aria-hidden /> : <MenuOutlined aria-hidden />}
					</button>
				</div>
				<div id="workspace-navigation" className={`workspace-panel${menuOpen ? ' is-open' : ''}`}>
					<button type="button" className={`workspace-module-chip tone-${activeModule?.tone ?? 'blue'}`} onClick={() => setSwitcherOpen(true)} aria-haspopup="dialog">
						<span className="workspace-module-icon" aria-hidden>{activeModule?.icon ?? <AppstoreOutlined />}</span>
						<span className="workspace-module-text">
							<strong>{activeModule ? activeModule.label : 'Team'}</strong>
							<span>Switch app</span>
						</span>
						<RightOutlined aria-hidden />
					</button>
					<p className="workspace-label">{activeModule ? `${activeModule.label}` : 'Team'}</p>
					<nav className="workspace-nav" aria-label="Workspace navigation">
						{activeModule
							? moduleItems.map((item) => (item.children ? (
								<NavGroup key={item.path + item.label} item={item} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
							) : (
								<NavLink key={item.path} to={item.path} end onClick={() => setMenuOpen(false)}>
									<span className="workspace-nav-icon" aria-hidden>{item.icon}</span>
									<span className="workspace-nav-text">{item.label}</span>
								</NavLink>
							)))
							: visibleItems.map((item) => (
								<NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
									<span className="workspace-nav-icon" aria-hidden>{NAV_ICONS[item.to]}</span>
									<span className="workspace-nav-text">{item.label}</span>
								</NavLink>
							))}
					</nav>
					<div className="workspace-profile">
						<div className="workspace-presence"><PresenceGate role={user?.role} /></div>
						<div className="workspace-user">
							<span className="workspace-avatar" aria-hidden>{initials(user?.name)}</span>
							<span className="workspace-user-text">
								<strong>{user?.name ?? 'Signed in user'}</strong>
								<span>{user?.role === 'SuperAdmin' ? 'Super Admin' : user?.role ?? 'Agent'}</span>
							</span>
						</div>
						<button type="button" className="workspace-logout" onClick={handleLogout}><LogoutOutlined aria-hidden /> Logout</button>
					</div>
				</div>
			</aside>
			<main className="workspace-main">
				<div className="workspace-heading">
					<span>{activeModule ? activeModule.label : 'Team'} / <strong>{pageLabel}</strong></span>
					<span className="workspace-heading-actions">
						<button type="button" className="workspace-visit" onClick={() => setSwitcherOpen(true)}><AppstoreAddOutlined aria-hidden /> Apps</button>
						<Link to="/home" className="workspace-visit">Visit website <ExportOutlined aria-hidden /></Link>
					</span>
				</div>
				<div className="workspace-content"><Outlet /></div>
			</main>

			<Modal
				open={switcherOpen}
				onCancel={() => setSwitcherOpen(false)}
				footer={null}
				width={880}
				centered
				className="app-launcher"
				title={<div className="app-launcher-title"><strong>Apps</strong><span>Choose where you want to work.</span></div>}
			>
				<div className="app-grid">
					{switcherCards.map((c) => (
						<button key={c.id} type="button" className={`app-tile tone-${c.tone}${c.id === moduleId ? ' is-current' : ''}`} aria-current={c.id === moduleId ? 'true' : undefined} onClick={() => chooseModule(c.id)}>
							<span className="app-tile-icon" aria-hidden>{c.icon}</span>
							<strong>{c.label}</strong>
							<span className="app-tile-desc">{c.description}</span>
							<span className="app-tile-who">For: {c.audience}</span>
							{c.id === moduleId && <span className="app-tile-badge">You are here</span>}
						</button>
					))}
				</div>
			</Modal>
		</div>
	);
}
