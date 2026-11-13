import type { Ticket, DashboardKPIs, PaginatedResponse, User, UserRole, OTPResponse, AuthResponse, TicketStatus, Priority, PolicyType, InsuranceStatus, PaymentStatus } from '../types';
import { apiClient } from './api';

// ── Feature flag: use real backend when VITE_API_BASE_URL is set ──────────────
const USE_REAL_API = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);

const delay = (ms = 400) => new Promise(r => setTimeout(r, ms));

// ── Access policy ─────────────────────────────────────────────────────────────
// Only company email accounts may sign in to AskusNext Global Solutions Private Limited.
export const ALLOWED_EMAIL_DOMAIN = 'askussolutions.in';
export const isAllowedEmail = (email: string): boolean =>
  email.trim().toLowerCase().endsWith('@' + ALLOWED_EMAIL_DOMAIN);

// ── Users (3 roles) ───────────────────────────────────────────────────────────
// Login credentials (account tab) — @askussolutions.in only:
//   rajesh@askussolutions.in    / Askus@2026  → Admin (super admin)
//   employee@askussolutions.in  / Askus@2026  → Employee
//   agent@askussolutions.in     / Askus@2026  → Agent
// Mobile OTP: any 6-digit code works

export const MOCK_USERS: Record<string, User> = {
  admin: {
    id: 'user-001', name: 'Rajesh', mobile: '+919800000001',
    email: 'rajesh@askussolutions.in', role: 'Admin', branchId: 'branch-001',
  },
  employee: {
    id: 'user-002', name: 'Employee', mobile: '+919800000002',
    email: 'employee@askussolutions.in', role: 'Employee', branchId: 'branch-001',
  },
  agent: {
    id: 'user-003', name: 'Agent', mobile: '+919800000003',
    email: 'agent@askussolutions.in', role: 'Agent', branchId: 'branch-001',
  },
};

// Default for OTP login
export const MOCK_USER = MOCK_USERS.admin;

// ── Managed users (User Management) ───────────────────────────────────────────
// Admin-managed directory. Persisted to localStorage in mock mode so it survives
// reloads; delegates to the real backend when VITE_API_BASE_URL is configured.
export const SUPER_ADMIN_EMAIL = 'rajesh@askussolutions.in';

export interface ManagedUser extends User {
  isActive: boolean;
  createdAt: string;
  password?: string;
}

const USERS_STORAGE_KEY = 'tms_managed_users';

function seedManagedUsers(): ManagedUser[] {
  return Object.values(MOCK_USERS).map((u, i) => ({
    ...u,
    isActive: true,
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    password: 'Askus@2026',
  }));
}

function loadManagedUsers(): ManagedUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ManagedUser[];
  } catch { /* ignore */ }
  const seeded = seedManagedUsers();
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveManagedUsers(list: ManagedUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
}

const stripPassword = (u: ManagedUser): ManagedUser => ({ ...u, password: undefined });

export const userApi = {
  list: async (): Promise<ManagedUser[]> => {
    if (USE_REAL_API) {
      const users = await apiClient.getUsers();
      return users.map(u => ({ ...u, isActive: true, createdAt: new Date().toISOString() }));
    }
    await delay(200);
    return loadManagedUsers().map(stripPassword);
  },

  create: async (data: { name: string; email: string; mobile: string; role: UserRole; password?: string }): Promise<ManagedUser> => {
    if (!isAllowedEmail(data.email)) throw new Error(`Only @${ALLOWED_EMAIL_DOMAIN} accounts are allowed`);
    if (USE_REAL_API) {
      const u = await apiClient.createUser({ name: data.name, email: data.email, mobile: data.mobile, role: data.role });
      return { ...u, isActive: true, createdAt: new Date().toISOString() };
    }
    await delay(300);
    const list = loadManagedUsers();
    if (list.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('A user with this email already exists');
    }
    const user: ManagedUser = {
      id: 'user-' + Date.now(),
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      mobile: data.mobile.startsWith('+91') ? data.mobile : '+91' + data.mobile,
      role: data.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL ? 'Admin' : data.role,
      branchId: 'branch-001',
      isActive: true,
      createdAt: new Date().toISOString(),
      password: data.password,
    };
    list.push(user);
    saveManagedUsers(list);
    return stripPassword(user);
  },

  update: async (id: string, data: { name?: string; mobile?: string; role?: UserRole }): Promise<ManagedUser> => {
    if (USE_REAL_API) {
      const u = await apiClient.updateUser(id, data);
      return { ...u, isActive: true, createdAt: new Date().toISOString() };
    }
    await delay(300);
    const list = loadManagedUsers();
    const idx = list.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('User not found');
    // Super admin is always Admin and cannot be demoted.
    const isSuperAdmin = list[idx].email.toLowerCase() === SUPER_ADMIN_EMAIL;
    list[idx] = {
      ...list[idx],
      name: data.name?.trim() ?? list[idx].name,
      mobile: data.mobile
        ? (data.mobile.startsWith('+91') ? data.mobile : '+91' + data.mobile)
        : list[idx].mobile,
      role: isSuperAdmin ? 'Admin' : (data.role ?? list[idx].role),
    };
    saveManagedUsers(list);
    return stripPassword(list[idx]);
  },

  setActive: async (id: string, isActive: boolean): Promise<void> => {
    if (USE_REAL_API) {
      if (!isActive) await apiClient.deleteUser(id);
      return;
    }
    await delay(250);
    const list = loadManagedUsers();
    const idx = list.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('User not found');
    if (list[idx].email.toLowerCase() === SUPER_ADMIN_EMAIL && !isActive) {
      throw new Error('The super admin account cannot be deactivated');
    }
    list[idx].isActive = isActive;
    saveManagedUsers(list);
  },

  resetPassword: async (id: string, newPassword: string): Promise<void> => {
    if (USE_REAL_API) throw new Error('Sign-in uses one-time codes; there is no password to reset');
    await delay(250);
    const list = loadManagedUsers();
    const idx = list.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('User not found');
    list[idx].password = newPassword;
    saveManagedUsers(list);
  },
};

// Validate a managed user's account credentials (mock mode).
function findManagedCredential(email: string, password: string): ManagedUser | null {
  const user = loadManagedUsers().find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.isActive,
  );
  if (user && user.password && user.password === password) return user;
  return null;
}

// ── Demo data generator ───────────────────────────────────────────────────────
// Populates the mock dashboard/board/analytics with realistic sample tickets so
// the app never looks empty in demo (mock) mode. Dates are relative to "now" so
// the charts and expiry alerts always stay current.
const dayMs = 86400000;
const iso = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * dayMs).toISOString();

const INSURERS = ['ICICI Lombard', 'Bajaj Allianz', 'HDFC Ergo', 'Tata AIG', 'Reliance General', 'New India Assurance'];

interface TicketSeed {
  type: Ticket['ticketType'];
  title: string;
  status: TicketStatus;
  priority: Priority;
  customer: string;
  mobile: string;
  reg: string;
  vehicle: string;
  insurer: string;
  policyType: PolicyType;
  premium: number;
  paid: PaymentStatus;
  insStatus: InsuranceStatus;
  expiryDays: number;   // days from now the policy expires
  createdDays: number;  // days ago the ticket was created (negative)
  assignedTo?: keyof typeof MOCK_USERS;
}

const TICKET_SEEDS: TicketSeed[] = [
  { type: 'Insurance', title: 'Comprehensive policy renewal', status: 'Open', priority: 'High', customer: 'Suresh Kumar', mobile: '+919845012301', reg: 'TN01AB1234', vehicle: 'Maruti Swift', insurer: INSURERS[0], policyType: 'Comprehensive', premium: 24500, paid: 'Pending', insStatus: 'ExpiringSoon', expiryDays: 12, createdDays: -3, assignedTo: 'employee' },
  { type: 'Insurance', title: 'Zero-dep renewal follow-up', status: 'InProgress', priority: 'High', customer: 'Meena Ramesh', mobile: '+919845012302', reg: 'TN07CD5678', vehicle: 'Hyundai Creta', insurer: INSURERS[1], policyType: 'ZeroDep', premium: 38900, paid: 'Partial', insStatus: 'ExpiringSoon', expiryDays: 25, createdDays: -6, assignedTo: 'employee' },
  { type: 'Insurance', title: 'Expired policy — urgent renewal', status: 'Open', priority: 'High', customer: 'Karthik Raja', mobile: '+919845012303', reg: 'TN09EF9012', vehicle: 'Honda City', insurer: INSURERS[2], policyType: 'Comprehensive', premium: 31200, paid: 'Pending', insStatus: 'Expired', expiryDays: -6, createdDays: -2, assignedTo: 'employee' },
  { type: 'Insurance', title: 'New comprehensive policy issued', status: 'Completed', priority: 'Medium', customer: 'Divya Nair', mobile: '+919845012304', reg: 'TN10GH3456', vehicle: 'Toyota Innova', insurer: INSURERS[3], policyType: 'Comprehensive', premium: 45600, paid: 'Paid', insStatus: 'Active', expiryDays: 210, createdDays: -40 },
  { type: 'Insurance', title: 'Third-party renewal', status: 'InProgress', priority: 'Medium', customer: 'Anand Prakash', mobile: '+919845012305', reg: 'TN22JK7890', vehicle: 'Bajaj Pulsar', insurer: INSURERS[4], policyType: 'ThirdParty', premium: 8900, paid: 'Pending', insStatus: 'ExpiringSoon', expiryDays: 28, createdDays: -9 },
  { type: 'Insurance', title: 'Own-damage cover add-on', status: 'Completed', priority: 'Low', customer: 'Priya Sundar', mobile: '+919845012306', reg: 'TN05LM2345', vehicle: 'Kia Seltos', insurer: INSURERS[5], policyType: 'OwnDamage', premium: 27300, paid: 'Paid', insStatus: 'Active', expiryDays: 155, createdDays: -70 },
  { type: 'O2Taxi', title: 'Rider booking payment mismatch', status: 'Open', priority: 'High', customer: 'Ravi Chandran', mobile: '+919845012307', reg: 'TN18NP6789', vehicle: 'Ertiga (O2 Fleet)', insurer: INSURERS[0], policyType: 'Comprehensive', premium: 41000, paid: 'Paid', insStatus: 'Active', expiryDays: 120, createdDays: -1 },
  { type: 'O2Taxi', title: 'Driver app trip not closing', status: 'InProgress', priority: 'Medium', customer: 'Ganesh M', mobile: '+919845012308', reg: 'TN18NP1122', vehicle: 'Dzire (O2 Fleet)', insurer: INSURERS[1], policyType: 'Comprehensive', premium: 39500, paid: 'Paid', insStatus: 'Active', expiryDays: 95, createdDays: -12 },
  { type: 'General', title: 'Company logo redesign request', status: 'Open', priority: 'Low', customer: 'Internal — Marketing', mobile: '+919845012309', reg: '—', vehicle: '—', insurer: INSURERS[2], policyType: 'Comprehensive', premium: 0, paid: 'Pending', insStatus: 'Active', expiryDays: 300, createdDays: -5 },
  { type: 'General', title: 'Vendor payment follow-up', status: 'InProgress', priority: 'Medium', customer: 'Internal — Accounts', mobile: '+919845012310', reg: '—', vehicle: '—', insurer: INSURERS[3], policyType: 'Comprehensive', premium: 0, paid: 'Pending', insStatus: 'Active', expiryDays: 300, createdDays: -18 },
  { type: 'DailyActivity', title: 'Field visit — Adyar branch', status: 'Completed', priority: 'Low', customer: 'Team — Operations', mobile: '+919845012311', reg: '—', vehicle: '—', insurer: INSURERS[4], policyType: 'Comprehensive', premium: 0, paid: 'Paid', insStatus: 'Active', expiryDays: 300, createdDays: -4 },
  { type: 'DailyActivity', title: 'Policy document scanning batch', status: 'InProgress', priority: 'Medium', customer: 'Team — Backoffice', mobile: '+919845012312', reg: '—', vehicle: '—', insurer: INSURERS[5], policyType: 'Comprehensive', premium: 0, paid: 'Pending', insStatus: 'Active', expiryDays: 300, createdDays: -22 },
  { type: 'Support', title: 'Customer portal login issue', status: 'Open', priority: 'High', customer: 'Lakshmi Narayan', mobile: '+919845012313', reg: 'TN01QR3344', vehicle: 'Renault Kwid', insurer: INSURERS[0], policyType: 'ThirdParty', premium: 7600, paid: 'Paid', insStatus: 'Active', expiryDays: 60, createdDays: -2 },
  { type: 'Support', title: 'WhatsApp premium receipt request', status: 'Completed', priority: 'Low', customer: 'Balaji S', mobile: '+919845012314', reg: 'TN02ST5566', vehicle: 'Ford EcoSport', insurer: INSURERS[1], policyType: 'Comprehensive', premium: 29800, paid: 'Paid', insStatus: 'Active', expiryDays: 175, createdDays: -33 },
  { type: 'Payment', title: 'Commission reconciliation', status: 'InProgress', priority: 'Medium', customer: 'Vinoth Kumar', mobile: '+919845012315', reg: 'TN04UV7788', vehicle: 'Mahindra XUV700', insurer: INSURERS[2], policyType: 'ZeroDep', premium: 52400, paid: 'Partial', insStatus: 'Active', expiryDays: 140, createdDays: -15 },
  { type: 'Office', title: 'Branch stationery procurement', status: 'Closed', priority: 'Low', customer: 'Internal — Admin', mobile: '+919845012316', reg: '—', vehicle: '—', insurer: INSURERS[3], policyType: 'Comprehensive', premium: 0, paid: 'Paid', insStatus: 'Active', expiryDays: 300, createdDays: -55 },
];

function buildMockTickets(): Ticket[] {
  return TICKET_SEEDS.map((s, i) => {
    const num = i + 1;
    const startDays = s.expiryDays - 365;
    return {
      id: `ticket-${String(num).padStart(3, '0')}`,
      ticketNumber: `TKT-${String(1000 + num)}`,
      title: s.title,
      status: s.status,
      priority: s.priority,
      ticketType: s.type,
      assignedToId: s.assignedTo ? MOCK_USERS[s.assignedTo].id : undefined,
      assignedToName: s.assignedTo ? MOCK_USERS[s.assignedTo].name : undefined,
      dueDate: iso(Math.max(1, s.expiryDays)),
      customerId: `cust-${String(num).padStart(3, '0')}`,
      customerName: s.customer,
      customerMobile: s.mobile,
      vehicleId: `veh-${String(num).padStart(3, '0')}`,
      vehicleRegNo: s.reg,
      vehicleName: s.vehicle,
      policy: {
        id: `pol-${String(num).padStart(3, '0')}`,
        insurer: s.insurer,
        policyNumber: `POL/${2025}/${String(10000 + num)}`,
        policyType: s.policyType,
        idv: s.premium > 0 ? s.premium * 20 : 0,
        netPremium: Math.round(s.premium / 1.18),
        gst: Math.round(s.premium - s.premium / 1.18),
        totalPremium: s.premium,
        ncbPercent: 20,
        startDate: iso(startDays),
        expiryDate: iso(s.expiryDays),
        insuranceStatus: s.insStatus,
      },
      payment: {
        amount: s.premium,
        paymentStatus: s.paid,
        paymentMode: s.paid === 'Paid' ? 'UPI' : undefined,
        paidAt: s.paid === 'Paid' ? iso(s.createdDays + 1) : undefined,
      },
      documents: [],
      activityLog: [
        {
          id: `log-${num}-1`,
          action: 'Ticket created',
          performedByName: 'Rajesh',
          createdAt: iso(s.createdDays),
        },
      ],
      createdAt: iso(s.createdDays),
      updatedAt: iso(Math.min(0, s.createdDays + 1)),
    };
  });
}

const MOCK_TICKETS: Ticket[] = buildMockTickets();

const MOCK_KPIS: DashboardKPIs = {
  totalTickets: 0, openTickets: 0, expiringIn30Days: 0,
  expiredPolicies: 0, premiumCollected: 0, pendingPayments: 0,
  insuranceTickets: 0,
  paymentTickets: 0,
  officeTickets: 0,
  otherTickets: 0,
  o2TaxiTickets: 0,
  generalTickets: 0,
  dailyActivityTickets: 0,
  supportTickets: 0,
};

let tickets = [...MOCK_TICKETS];
let nextNum = 1;

function buildKpis(): DashboardKPIs {
  const now = Date.now();
  const in30 = now + 30 * 86400000;

  const expiringIn30Days = tickets.filter((t) => {
    const d = new Date(t.policy.expiryDate).getTime();
    return Number.isFinite(d) && d >= now && d <= in30;
  }).length;

  const premiumCollected = tickets
    .filter(t => t.payment.paymentStatus === 'Paid')
    .reduce((sum, t) => sum + (t.payment.amount || 0), 0);

  const pendingPayments = tickets
    .filter(t => t.payment.paymentStatus === 'Pending' || t.payment.paymentStatus === 'Partial')
    .reduce((sum, t) => sum + (t.payment.amount || 0), 0);

  const byType = (type: Ticket['ticketType']) => tickets.filter(t => t.ticketType === type).length;

  return {
    totalTickets: tickets.length,
    openTickets: tickets.filter(t => t.status === 'Open' || t.status === 'InProgress').length,
    expiringIn30Days,
    expiredPolicies: tickets.filter(t => t.policy.insuranceStatus === 'Expired').length,
    premiumCollected,
    pendingPayments,
    insuranceTickets: byType('Insurance'),
    paymentTickets: byType('Payment'),
    officeTickets: byType('Office'),
    otherTickets: byType('Other'),
    o2TaxiTickets: byType('O2Taxi'),
    generalTickets: byType('General'),
    dailyActivityTickets: byType('DailyActivity'),
    supportTickets: byType('Support'),
  };
}

// ── Credential map for account login ─────────────────────────────────────────
const CREDENTIALS: Record<string, { password: string; userKey: keyof typeof MOCK_USERS }> = {
  'rajesh@askussolutions.in':   { password: 'Askus@2026', userKey: 'admin' },
  'employee@askussolutions.in': { password: 'Askus@2026', userKey: 'employee' },
  'agent@askussolutions.in':    { password: 'Askus@2026', userKey: 'agent' },
};

// ── Mock implementations ──────────────────────────────────────────────────────
const mockImpl = {
  sendOTP: async (_mobile: string): Promise<OTPResponse> => {
    await delay(600);
    return { success: true, sessionId: 'mock-session-' + Date.now(), message: 'OTP sent' };
  },

  verifyOTP: async (emailOrMobile: string, otpOrPassword: string, sessionId: string): Promise<AuthResponse> => {
    await delay(800);
    // Company-email restriction: any email-based login must use @askussolutions.in
    if (emailOrMobile.includes('@') && !isAllowedEmail(emailOrMobile)) {
      throw new Error('Access restricted to @askussolutions.in accounts');
    }
    const cred = CREDENTIALS[emailOrMobile.toLowerCase()];
    if (cred) {
      // Account login: validate password
      if (otpOrPassword !== cred.password) throw new Error('Invalid credentials');
      return {
        token: 'mock-jwt-' + Date.now(),
        expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
        user: MOCK_USERS[cred.userKey],
      };
    }
    // Account login for Admin-created users (persisted directory)
    if (emailOrMobile.includes('@')) {
      const managed = findManagedCredential(emailOrMobile, otpOrPassword);
      if (managed) {
        return {
          token: 'mock-jwt-' + Date.now(),
          expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
          user: {
            id: managed.id, name: managed.name, email: managed.email,
            mobile: managed.mobile, role: managed.role, branchId: managed.branchId,
          },
        };
      }
    }
    // Mobile OTP login — Firebase-verified or demo mock session
    if (sessionId && (sessionId.startsWith('mock-session-') || sessionId === 'firebase-verified')) {
      return {
        token: 'mock-jwt-' + Date.now(),
        expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
        user: MOCK_USERS.admin,
      };
    }
    throw new Error('Invalid email or password');
  },

  getKPIs: async (): Promise<DashboardKPIs> => { await delay(300); return buildKpis(); },

  getExpiryAlerts: async (days = 30): Promise<Ticket[]> => {
    await delay(300);
    const cutoff = new Date(Date.now() + days * 86400000);
    return tickets.filter(t => new Date(t.policy.expiryDate) <= cutoff).slice(0, 8);
  },

  getMonthlyData: async () => {
    await delay(300);
    const now = new Date();
    const months: { month: string; tickets: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const count = tickets.filter(t => {
        const c = new Date(t.createdAt);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      }).length;
      months.push({ month: d.toLocaleString('en-US', { month: 'short' }), tickets: count });
    }
    return months;
  },

  getTickets: async (params: { search?: string; status?: string; priority?: string; insurer?: string; ticketType?: string; page?: number; pageSize?: number; assignedToId?: string }): Promise<PaginatedResponse<Ticket>> => {
    await delay(350);
    let result = [...tickets];
    if (params.search) {
      const q = params.search.toLowerCase();
      result = result.filter(t =>
        t.vehicleRegNo.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.vehicleName.toLowerCase().includes(q)
      );
    }
    if (params.status)   result = result.filter(t => t.status === params.status);
    if (params.priority) result = result.filter(t => t.priority === params.priority);
    if (params.insurer)  result = result.filter(t => t.policy.insurer === params.insurer);
    if (params.ticketType) result = result.filter(t => t.ticketType === params.ticketType);
    if (params.assignedToId) result = result.filter(t => t.assignedToId === params.assignedToId);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    return { data: result.slice((page - 1) * pageSize, page * pageSize), total: result.length, page, pageSize };
  },

  getTicketById: async (id: string): Promise<Ticket | null> => {
    await delay(250);
    return tickets.find(t => t.id === id) ?? null;
  },

  createTicket: async (data: Partial<Ticket>): Promise<Ticket> => {
    await delay(500);
    const ticket: Ticket = {
      id: 'tkt-' + Date.now(), ticketNumber: `TKT-00${nextNum++}`,
      title: data.title ?? 'New ticket', status: data.status ?? 'Open',
      priority: data.priority ?? 'Medium', ticketType: data.ticketType ?? 'Insurance', assignedToName: data.assignedToName,
      customerId: data.customerId ?? '', customerName: data.customerName ?? '',
      customerMobile: data.customerMobile ?? '', vehicleId: data.vehicleId ?? '',
      vehicleRegNo: data.vehicleRegNo ?? '', vehicleName: data.vehicleName ?? '',
      internalNotes: data.internalNotes, dueDate: data.dueDate,
      policy: data.policy ?? { id: 'pol-' + Date.now(), insurer: '', policyType: 'Comprehensive', netPremium: 0, gst: 0, totalPremium: 0, ncbPercent: 0, startDate: '', expiryDate: '', insuranceStatus: 'Active' },
      payment: data.payment ?? { amount: 0, paymentStatus: 'Pending' },
      paymentTicketData: data.paymentTicketData,
      officeTicketData: data.officeTicketData,
      otherTicketData: data.otherTicketData,
      o2TaxiTicketData: data.o2TaxiTicketData,
      dailyActivityTicketData: data.dailyActivityTicketData,
      supportTicketData: data.supportTicketData,
      generalTicketData: data.generalTicketData,
      documents: [],
      activityLog: [{ id: 'log-' + Date.now(), action: 'created this ticket', performedByName: 'You', createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    tickets.unshift(ticket);
    return ticket;
  },

  updateTicketStatus: async (id: string, status: string, note?: string): Promise<void> => {
    await delay(400);
    const t = tickets.find(t => t.id === id);
    if (t) {
      t.status = status as Ticket['status']; t.updatedAt = new Date().toISOString();
      t.activityLog.push({ id: 'log-' + Date.now(), action: `changed status to ${status}`, note, performedByName: 'You', createdAt: new Date().toISOString() });
    }
  },

  updateTicket: async (id: string, data: Partial<Ticket>): Promise<Ticket> => {
    await delay(500);
    const idx = tickets.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Ticket not found');
    tickets[idx] = { ...tickets[idx], ...data, updatedAt: new Date().toISOString() };
    tickets[idx].activityLog.push({ id: 'log-' + Date.now(), action: 'ticket updated', performedByName: 'You', createdAt: new Date().toISOString() });
    return tickets[idx];
  },

  updatePayment: async (id: string, paymentData: Partial<Ticket['payment']>): Promise<void> => {
    await delay(400);
    const t = tickets.find(t => t.id === id);
    if (t) {
      t.payment = { ...t.payment, ...paymentData };
      t.activityLog.push({ id: 'log-' + Date.now(), action: `payment updated — ${paymentData.paymentStatus}`, performedByName: 'You', createdAt: new Date().toISOString() });
    }
  },

  addComment: async (id: string, note: string): Promise<void> => {
    await delay(300);
    const t = tickets.find(t => t.id === id);
    if (t) t.activityLog.push({ id: 'log-' + Date.now(), action: 'added a comment', note, performedByName: 'You', createdAt: new Date().toISOString() });
  },

  uploadDocument: async (id: string, file: File, type: string): Promise<void> => {
    await delay(600);
    const t = tickets.find(t => t.id === id);
    if (t) {
      t.documents.push({ id: 'doc-' + Date.now(), type: type as 'RC' | 'Insurance' | 'Other', fileName: file.name, fileUrl: URL.createObjectURL(file), fileSizeBytes: file.size, uploadedAt: new Date().toISOString() });
      t.activityLog.push({ id: 'log-' + Date.now(), action: `uploaded ${type} copy`, performedByName: 'You', createdAt: new Date().toISOString() });
    }
  },

  deleteDocument: async (ticketId: string, docId: string): Promise<void> => {
    await delay(300);
    const t = tickets.find(t => t.id === ticketId);
    if (t) t.documents = t.documents.filter(d => d.id !== docId);
  },

  sendReminder: async (_ticketId: string): Promise<void> => { await delay(500); },

  createPaymentOrder: async (_ticketId: string): Promise<{ orderId: string; paymentSessionId: string; env: string; amount: number }> => {
    await delay(400);
    return { orderId: 'MOCK_ORDER', paymentSessionId: 'mock_session', env: 'sandbox', amount: 0 };
  },

  verifyPaymentOrder: async (_ticketId: string, _orderId: string): Promise<{ orderStatus: string; paymentStatus: string }> => {
    await delay(400);
    return { orderStatus: 'PAID', paymentStatus: 'Paid' };
  },
};

// ── Exported api — real backend when available, mock otherwise ────────────────
export const api: typeof mockImpl & {
  verifyOTP(email: string, password: string, sessionId: string): Promise<AuthResponse>;
} = USE_REAL_API
  ? {
      // Auth
      sendOTP: async (identifier: string) => {
        await apiClient.requestOtp(identifier);
        return { success: true, sessionId: 'otp-requested', message: 'OTP sent' };
      },
      verifyOTP: (identifier: string, code: string, _sessionId: string) =>
        apiClient.verifyOtp(identifier, code),

      // Dashboard
      getKPIs:         () => apiClient.getKPIs(),
      getExpiryAlerts: (days = 30) => apiClient.getExpiryAlerts(days),
      getMonthlyData:  () => apiClient.getMonthlyData(),

      // Tickets
      getTickets:          (params) => apiClient.getTickets(params),
      getTicketById:       (id) => apiClient.getTicketById(id),
      createTicket:        (data) => apiClient.createTicket(data),
      updateTicket:        (id, data) => apiClient.updateTicket(id, data),
      updateTicketStatus:  (id, status, note) => apiClient.updateTicketStatus(id, status, note),
      updatePayment:       (id, data) => apiClient.updatePayment(id, data),
      addComment:          (id, note) => apiClient.addComment(id, note),
      uploadDocument:      (id, file, type) => apiClient.uploadDocument(id, file, type),
      deleteDocument:      (ticketId, docId) => apiClient.deleteDocument(ticketId, docId),
      sendReminder:        (id) => apiClient.sendReminder(id),
      createPaymentOrder:  (ticketId) => apiClient.createPaymentOrder(ticketId),
      verifyPaymentOrder:  (ticketId, orderId) => apiClient.verifyPaymentOrder(ticketId, orderId),
    }
  : mockImpl;
