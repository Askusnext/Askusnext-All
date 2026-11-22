/**
 * Sample data for the browser demo modules. Names, numbers and phone numbers
 * are fictional. Dates are relative to "today" so dashboards stay meaningful.
 */
type Seed = Record<string, any>;

const iso = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const thisYear = new Date().getFullYear();
const md = (offset: number) => iso(offset).slice(5); // MM-DD, for birthdays

export const BRANCHES = ['Coimbatore (HO)', 'Chennai', 'Madurai', 'Tiruppur'];
export const INSURANCE_PRODUCTS = ['Car Insurance', 'Bike Insurance', 'Health Insurance', 'Term Life', 'Commercial Vehicle', 'Auto Rickshaw'];
export const LEAD_SOURCES = ['Direct', 'Referral', 'Website', 'Facebook', 'WhatsApp Campaign', 'Walk-in', 'Cold Call', 'Expo', 'Partner Dealer'];
export const LEAD_STATUSES = ['New', 'Interested', 'Quoted', 'On Hold', 'Won', 'Lost'];
export const DEPARTMENTS = ['Sales', 'Operations', 'Customer Success', 'Claims', 'Accounts', 'HR & Admin', 'Technology'];

const EMPLOYEES: Seed[] = [
  ['ASK0001', 'Arun Prakash', 'Branch Manager', 'Sales', 'Coimbatore (HO)', 72000, -1800, md(0)],
  ['ASK0002', 'Divya Ramesh', 'Sales Executive', 'Sales', 'Coimbatore (HO)', 28000, -620, md(4)],
  ['ASK0003', 'Karthik Selvam', 'Sales Team Lead', 'Sales', 'Chennai', 42000, -1100, md(31)],
  ['ASK0004', 'Meena Sundar', 'Operations Executive', 'Operations', 'Coimbatore (HO)', 26000, -400, md(60)],
  ['ASK0005', 'Naveen Kumar', 'Claims Officer', 'Claims', 'Madurai', 34000, -900, md(-3)],
  ['ASK0006', 'Priya Natarajan', 'HR Manager', 'HR & Admin', 'Coimbatore (HO)', 55000, -1500, md(90)],
  ['ASK0007', 'Ramya Krishnan', 'Accounts Executive', 'Accounts', 'Coimbatore (HO)', 30000, -700, md(120)],
  ['ASK0008', 'Saravanan M', 'Relationship Manager', 'Customer Success', 'Tiruppur', 36000, -800, md(2)],
  ['ASK0009', 'Vignesh Babu', 'Sales Executive', 'Sales', 'Madurai', 25000, -300, md(150)],
  ['ASK0010', 'Lakshmi Devi', 'Customer Success Executive', 'Customer Success', 'Chennai', 27000, -500, md(200)],
  ['ASK0011', 'Gokul Raj', 'Developer', 'Technology', 'Coimbatore (HO)', 48000, -950, md(250)],
  ['ASK0012', 'Harini S', 'Sales Manager', 'Sales', 'Coimbatore (HO)', 60000, -1300, md(300)],
].map(([code, name, designation, department, branch, salary, joined, dob], i) => ({
  code, name, designation, department, branch, salary,
  type: 'Employee', status: 'Active',
  mobile: `90000${String(10001 + i).slice(-5)}`,
  email: `${String(name).toLowerCase().replace(/[^a-z]+/g, '.')}@askus.example`,
  joinDate: iso(joined as number),
  dob: `${thisYear - 26 - (i % 9)}-${dob}`,
  reportingTo: i === 0 ? '' : 'Arun Prakash',
}));

const INTERNS: Seed[] = [
  ['ASKI001', 'Sneha R', 'Marketing Intern', 'Sales', 8000],
  ['ASKI002', 'Ajay T', 'Developer Intern', 'Technology', 10000],
  ['ASKI003', 'Keerthana P', 'HR Intern', 'HR & Admin', 7000],
].map(([code, name, designation, department, stipend], i) => ({
  code, name, designation, department, branch: 'Coimbatore (HO)', salary: stipend,
  type: 'Intern', status: 'Active', mobile: `91000${String(20001 + i).slice(-5)}`,
  email: `${String(name).toLowerCase().replace(/[^a-z]+/g, '.')}@askus.example`,
  joinDate: iso(-60 - i * 20), dob: `${thisYear - 21}-${md(40 + i * 33)}`, reportingTo: 'Priya Natarajan',
  college: ['PSG College', 'Anna University', 'Kumaraguru College'][i], endDate: iso(90 + i * 15),
}));

const staff = EMPLOYEES.map((e) => e.name as string);
const sales = EMPLOYEES.filter((e) => e.department === 'Sales').map((e) => e.name as string);
const pick = <T,>(list: T[], i: number) => list[i % list.length];

const LEADS: Seed[] = [
  ['Golden Travels', 'Mohan Raj', 'Commercial Vehicle', 'Interested', 'Referral', 54000],
  ['Sri Lakshmi Textiles', 'Ganesh', 'Health Insurance', 'Quoted', 'Direct', 38500],
  ['Kavin Motors', 'Kavin', 'Car Insurance', 'New', 'Partner Dealer', 18200],
  ['Anitha (individual)', 'Anitha', 'Term Life', 'Won', 'Website', 24000],
  ['RVS Group', 'Jagadish', 'Health Insurance', 'Interested', 'Expo', 142000],
  ['City Auto Union', 'Murugan', 'Auto Rickshaw', 'Quoted', 'Cold Call', 9600],
  ['Bharath Logistics', 'Senthil', 'Commercial Vehicle', 'On Hold', 'WhatsApp Campaign', 76000],
  ['Deepak (individual)', 'Deepak', 'Bike Insurance', 'Won', 'Facebook', 1850],
  ['Nila Foods', 'Revathi', 'Health Insurance', 'New', 'Walk-in', 45000],
  ['Kumar & Sons', 'Kumar', 'Car Insurance', 'Lost', 'Direct', 21000],
  ['Sunrise School', 'Principal Office', 'Health Insurance', 'Quoted', 'Referral', 210000],
  ['Vel Transports', 'Velmurugan', 'Commercial Vehicle', 'Interested', 'Partner Dealer', 98000],
  ['Kavin Motors', 'Kavin', 'Car Insurance', 'New', 'Website', 18200],
  ['Prakash (individual)', 'Prakash', 'Term Life', 'New', 'Cold Call', 15500],
].map(([company, contact, product, status, source, value], i) => ({
  leadNo: `LD-${42500 + i}`,
  company, contact, product, status, source, dealValue: value,
  mobile: `98400${String(30001 + (company === 'Kavin Motors' ? 2 : i)).slice(-5)}`,
  email: `${String(contact).toLowerCase().replace(/[^a-z]+/g, '')}@example.com`,
  leadDate: iso(-i * 3), priority: pick(['High', 'Medium', 'Low'], i),
  assignedTo: pick(sales, i), branch: pick(BRANCHES, i), stage: i % 4 === 0 ? 'Pre Sales' : 'Sales',
  lastCall: i % 3 === 0 ? '' : iso(-i), nextFollowUp: iso((i % 5) - 1),
  remarks: i % 2 ? 'Asked for comparison of 3 insurers.' : 'Shared quote on WhatsApp.',
}));

export const SEEDS: Record<string, () => Seed[]> = {
  // ── Shared lists (Setup) ──
  insurers: () => ['Insurer A', 'Insurer B', 'Insurer C'].map((name) => ({ name })),
  branches: () => BRANCHES.map((name, i) => ({ name, code: `BR${i + 1}`, city: name.split(' ')[0], manager: pick(staff, i), phone: `0422-24000${i}` })),

  // ── CRM ──
  crm_leads: () => LEADS,
  crm_sources: () => LEAD_SOURCES.map((name) => ({ name, active: 'Yes' })),
  crm_statuses: () => LEAD_STATUSES.map((name, i) => ({ name, order: i + 1, color: ['blue', 'red', 'orange', 'cyan', 'green', 'default'][i] })),
  crm_products: () => INSURANCE_PRODUCTS.map((name, i) => ({
    name, category: i < 2 || i > 3 ? 'Motor' : i === 2 ? 'Health' : 'Life',
    basePremium: [2094, 538, 9800, 12000, 3000, 2400][i], commissionPct: [15, 15, 20, 30, 12, 15][i], active: 'Yes',
  })),
  crm_call_outcomes: () => ['Interested', 'Call back later', 'Ringing no response', 'Not interested', 'Quote shared', 'Documents pending'].map((name) => ({ name })),
  crm_lead_products: () => LEADS.slice(0, 9).map((l, i) => ({
    leadNo: l.leadNo, company: l.company, product: l.product, insurer: pick(['Insurer A', 'Insurer B', 'Insurer C'], i),
    sumInsured: [500000, 1000000, 750000, 5000000][i % 4], premium: l.dealValue, qty: 1, status: l.status === 'Won' ? 'Issued' : 'Proposed',
  })),
  crm_tasks: () => LEADS.slice(0, 10).map((l, i) => ({
    title: pick(['Follow-up call', 'Share quotation', 'Collect RC copy', 'Collect KYC documents', 'Payment reminder'], i),
    relatedTo: `${l.leadNo} · ${l.company}`, assignedTo: l.assignedTo, dueDate: iso((i % 6) - 2),
    priority: l.priority, status: pick(['Open', 'In Progress', 'Done', 'Open'], i), type: i % 3 === 0 ? 'Follow-up' : 'Task',
  })),
  crm_call_updates: () => LEADS.slice(0, 8).map((l, i) => ({
    leadNo: l.leadNo, company: l.company, contact: l.contact, mobile: l.mobile, date: iso(-i),
    outcome: pick(['Interested', 'Ringing no response', 'Quote shared', 'Call back later'], i),
    notes: pick(['Met and discussed documentation.', 'No answer, sent WhatsApp text.', 'Wants zero-dep add-on.', 'Will decide next week.'], i),
    by: l.assignedTo,
  })),
  crm_quotations: () => LEADS.slice(0, 7).map((l, i) => ({
    quoteNo: `QT-${2400 + i}`, leadNo: l.leadNo, customer: l.company, product: l.product,
    insurer: pick(['Insurer A', 'Insurer B', 'Insurer C'], i), premium: l.dealValue, gst: Math.round(Number(l.dealValue) * 0.18),
    validTill: iso(15 - i), status: pick(['Draft', 'Sent', 'Accepted', 'Sent', 'Rejected'], i), date: iso(-i * 2),
  })),
  crm_day_closing: () => [0, 1, 2, 3].flatMap((d) => sales.slice(0, 3).map((name, i) => ({
    date: iso(-d - 1), employee: name, calls: 18 + i * 4 - d, meetings: 2 + (i % 2), newLeads: 3 + i, converted: d % 2, collection: (d + 1) * 6500 * (i + 1),
    summary: 'Daily summary submitted.', status: d === 0 && i === 2 ? 'Pending' : 'Approved',
  }))),
  crm_price_requests: () => LEADS.slice(0, 5).map((l, i) => ({
    leadNo: l.leadNo, company: l.company, product: l.product, requestedBy: l.assignedTo, date: iso(-i * 2),
    originalPrice: Math.round(Number(l.dealValue) * 1.1), requestedPrice: l.dealValue, discountPct: 10,
    remarks: 'Customer comparing with renewal quote from another broker.', status: i === 4 ? 'Pending' : i === 2 ? 'Rejected' : i === 3 ? 'Pending' : 'Approved',
  })),
  crm_cst_allocation: () => LEADS.filter((l) => l.status === 'Won').concat(LEADS.slice(0, 2)).map((l, i) => ({
    customer: l.company, policyProduct: l.product, salesOwner: l.assignedTo, cstOwner: pick(['Saravanan M', 'Lakshmi Devi'], i),
    allocatedOn: iso(-i * 4), renewalDue: iso(300 - i * 40), status: 'Allocated',
  })),
  crm_cst_day_closing: () => [1, 2, 3].flatMap((d) => ['Saravanan M', 'Lakshmi Devi'].map((name, i) => ({
    date: iso(-d), employee: name, renewalCalls: 12 + i * 3, renewed: 2 + i, claimsAssisted: i, complaints: d % 2, collection: 14500 * (i + 1),
    status: 'Approved',
  }))),

  // ── HRMS ──
  hr_employees: () => EMPLOYEES.concat(INTERNS).concat([
    { code: 'ASK0099', name: 'Former Staff', designation: 'Sales Executive', department: 'Sales', branch: 'Chennai', salary: 24000, type: 'Employee', status: 'Resigned', mobile: '9000099999', email: 'former@askus.example', joinDate: iso(-900), dob: `${thisYear - 30}-01-15`, reportingTo: 'Karthik Selvam', exitDate: iso(-120) },
  ]),
  hr_departments: () => DEPARTMENTS.map((name, i) => ({ name, head: pick(staff, i), description: `${name} team` })),
  hr_designations: () => [...new Set(EMPLOYEES.map((e) => e.designation as string))].map((name) => ({ name })),
  hr_leave_types: () => [
    { name: 'Casual Leave', code: 'CL', annualQuota: 12, paid: 'Paid', carryForward: 'No', maxConsecutive: 3 },
    { name: 'Sick Leave', code: 'SL', annualQuota: 8, paid: 'Paid', carryForward: 'No', maxConsecutive: 5 },
    { name: 'Earned Leave', code: 'EL', annualQuota: 15, paid: 'Paid', carryForward: 'Yes', maxConsecutive: 10 },
    { name: 'Loss of Pay', code: 'LOP', annualQuota: 0, paid: 'Unpaid', carryForward: 'No', maxConsecutive: 30 },
    { name: 'Maternity Leave', code: 'ML', annualQuota: 182, paid: 'Paid', carryForward: 'No', maxConsecutive: 182 },
  ],
  hr_leave_settings: () => [{ monthlyPaidLeave: 1.5, weekOff: 'Sunday', countSaturdayHalf: 'No', sandwichRule: 'No' }],
  hr_permission_settings: () => [{ monthlyCount: 2, maxHoursPerDay: 2, excessToLop: 'Yes', hoursPerLopDay: 8 }],
  hr_attendance_rules: () => [{ shiftStart: '09:30', shiftEnd: '18:30', graceMinutes: 10, halfDayHours: 4, fullDayHours: 8, lateMarksPerHalfDay: 3 }],
  hr_leave_requests: () => [
    ['Divya Ramesh', 'Casual Leave', -10, -9, 'Approved', 'Family function'],
    ['Naveen Kumar', 'Sick Leave', -6, -5, 'Approved', 'Fever'],
    ['Vignesh Babu', 'Casual Leave', 2, 2, 'Pending', 'Personal work'],
    ['Lakshmi Devi', 'Earned Leave', 7, 11, 'Pending', 'Native visit'],
    ['Gokul Raj', 'Loss of Pay', -14, -13, 'Approved', 'Extended travel'],
    ['Meena Sundar', 'Casual Leave', -3, -3, 'Rejected', 'Month-end closing week'],
  ].map(([employee, leaveType, from, to, status, reason]) => ({
    employee, leaveType, fromDate: iso(from as number), toDate: iso(to as number), status, reason, appliedOn: iso(Math.min((from as number) - 3, -1)),
  })),
  hr_permission_requests: () => [
    ['Divya Ramesh', -2, 1.5, 'Approved', 'Bank work'],
    ['Karthik Selvam', -5, 2, 'Approved', 'Hospital visit'],
    ['Karthik Selvam', -1, 1, 'Pending', 'School meeting'],
  ].map(([employee, d, hours, status, reason]) => ({ employee, date: iso(d as number), hours, status, reason })),
  hr_attendance: () => {
    const rows: Seed[] = [];
    for (let d = 1; d <= 62; d++) {
      const date = iso(-d);
      if (new Date(`${date}T00:00:00`).getDay() === 0) continue;
      EMPLOYEES.concat(INTERNS).forEach((e, i) => {
        const roll = (d * 7 + i * 3) % 23;
        const status = roll === 0 ? 'Absent' : roll === 5 ? 'Half Day' : 'Present';
        const late = roll === 3 || roll === 11 ? 25 : 0;
        rows.push({
          date, employee: e.name, status,
          checkIn: status === 'Absent' ? '' : late ? '09:55' : '09:2' + (i % 9),
          checkOut: status === 'Absent' ? '' : status === 'Half Day' ? '13:40' : '18:3' + (i % 9),
          lateMinutes: late, location: 'Office', source: 'Biometric',
        });
      });
    }
    return rows;
  },
  hr_outside_requests: () => [
    ['Divya Ramesh', 'Check-in', -1, 'Pending', 'Client meeting at Saravanampatti', 'Saravanampatti, Coimbatore'],
    ['Vignesh Babu', 'Check-out', -2, 'Approved', 'Policy delivery', 'Anna Nagar, Madurai'],
    ['Karthik Selvam', 'Check-in', -4, 'Approved', 'Dealer visit', 'T Nagar, Chennai'],
    ['Saravanan M', 'Check-out', -6, 'Rejected', 'Location not shared', 'Tiruppur'],
  ].map(([employee, type, d, status, reason, location]) => ({ employee, type, date: iso(d as number), time: '18:46', status, reason, location, remarks: '' })),
  hr_holidays: () => [
    ['New Year', `${thisYear}-01-01`], ['Pongal', `${thisYear}-01-15`], ['Republic Day', `${thisYear}-01-26`],
    ['Tamil New Year', `${thisYear}-04-14`], ['May Day', `${thisYear}-05-01`], ['Independence Day', `${thisYear}-08-15`],
    ['Gandhi Jayanthi', `${thisYear}-10-02`], ['Deepavali', `${thisYear}-11-08`], ['Christmas', `${thisYear}-12-25`],
  ].map(([name, date]) => ({ name, date, type: 'Public' })),
  hr_jobs: () => [
    ['Sales Executive', 'Sales', 'Coimbatore (HO)', 3, 'Open'],
    ['Claims Officer', 'Claims', 'Chennai', 1, 'Open'],
    ['Relationship Manager', 'Customer Success', 'Madurai', 2, 'On Hold'],
  ].map(([title, department, branch, openings, status]) => ({ title, department, branch, openings, status, postedOn: iso(-20), experience: '1-3 years' })),
  hr_candidates: () => [
    ['Bhavani S', 'Sales Executive', 'Screening', 'Naukri'],
    ['Christopher P', 'Sales Executive', 'Interview', 'Referral'],
    ['Murali B', 'Claims Officer', 'Offered', 'Walk-in'],
    ['Poorna C', 'Relationship Manager', 'Rejected', 'LinkedIn'],
  ].map(([name, position, stage, source], i) => ({ name, position, stage, source, mobile: `97000${String(40001 + i).slice(-5)}`, appliedOn: iso(-i * 4), expectedCtc: 300000 + i * 40000 })),
  hr_interviews: () => [
    ['Christopher P', 'Sales Executive', 0, '11:00', 'Arun Prakash', 'Scheduled'],
    ['Bhavani S', 'Sales Executive', 1, '15:30', 'Harini S', 'Scheduled'],
    ['Murali B', 'Claims Officer', -3, '10:00', 'Naveen Kumar', 'Selected'],
  ].map(([candidate, position, d, time, interviewer, status]) => ({ candidate, position, date: iso(d as number), time, interviewer, round: 'Round 1', status, feedback: '' })),
  hr_announcements: () => [
    { title: 'Diwali bonus credited', message: 'Festival bonus has been credited with this month’s salary.', branch: 'All branches', publishOn: iso(-5), status: 'Published' },
    { title: 'Quarterly sales review', message: 'All sales staff to attend the review on Friday 4 PM.', branch: 'Coimbatore (HO)', publishOn: iso(-1), status: 'Published' },
  ],
  hr_visitors: () => [
    ['Poorna C', 'Candidate', 'HR', 'Checked Out', -1], ['Courier – Blue Dart', 'Delivery', 'Admin', 'Checked Out', -1],
    ['Insurer A – RM visit', 'Partner', 'Arun Prakash', 'Checked In', 0], ['Murali B', 'Candidate', 'HR', 'Checked Out', -3],
  ].map(([name, type, toMeet, status, d], i) => ({ name, type, mobile: `96000${String(50001 + i).slice(-5)}`, whomToMeet: toMeet, date: iso(d as number), inTime: '10:20', outTime: status === 'Checked Out' ? '11:30' : '', status, purpose: 'Meeting' })),
  hr_expense_categories: () => ['Petrol', 'Travel', 'Food', 'Stationery', 'Courier', 'Client Entertainment', 'Office Maintenance'].map((name) => ({ name, monthlyLimit: 5000 })),
  hr_expenses: () => [
    ['Divya Ramesh', 'Petrol', 500, 1, 'Pending'], ['Vignesh Babu', 'Travel', 1250, 2, 'Pending'],
    ['Karthik Selvam', 'Client Entertainment', 2200, 3, 'Approved'], ['Saravanan M', 'Courier', 180, 3, 'Approved'],
    ['Meena Sundar', 'Stationery', 640, 3, 'Rejected'], ['Divya Ramesh', 'Food', 320, 2, 'Pending'],
  ].map(([applicant, category, amount, stage, status], i) => ({
    applicant, category, amount, stage, status, date: iso(-i * 2), description: `${category} expense for client visit`,
    receipt: 'Attached', remarks: '',
  })),
  hr_facility_titles: () => ['Air Conditioner', 'Water Purifier', 'Generator', 'CCTV', 'Printer', 'Internet'].map((name) => ({ name })),
  hr_asset_categories: () => ['Laptop', 'Desktop', 'Mobile Phone', 'Furniture', 'Vehicle', 'Printer'].map((name) => ({ name })),
  hr_assets: () => [
    ['AST-001', 'Dell Latitude 5440', 'Laptop', 'Gokul Raj', 'In Use'], ['AST-002', 'HP LaserJet', 'Printer', 'Office', 'In Use'],
    ['AST-003', 'Redmi Note 13', 'Mobile Phone', 'Divya Ramesh', 'In Use'], ['AST-004', 'Lenovo ThinkCentre', 'Desktop', 'Ramya Krishnan', 'Repair'],
  ].map(([tag, name, category, assignedTo, status]) => ({ tag, name, category, assignedTo, status, purchaseDate: iso(-400), value: 45000, branch: 'Coimbatore (HO)' })),
  hr_facility: () => [
    ['Air Conditioner', 'AC service – conference room', 'Completed', -12], ['Water Purifier', 'Filter change', 'Scheduled', 5], ['Internet', 'Backup line renewal', 'Pending', 2],
  ].map(([title, description, status, d]) => ({ title, description, status, dueDate: iso(d as number), vendor: 'Local vendor', cost: 1800, branch: 'Coimbatore (HO)' })),
  hr_cleaning_categories: () => ['Floor mopping', 'Restroom cleaning', 'Pantry cleaning', 'Dusting', 'Waste disposal'].map((name) => ({ name, frequency: 'Daily' })),
  hr_cleaning_sheet: () => [0, -1, -2].flatMap((d) => ['Floor mopping', 'Restroom cleaning', 'Pantry cleaning'].map((task, i) => ({
    date: iso(d), task, area: pick(['Ground floor', 'First floor', 'Pantry'], i), doneBy: 'Housekeeping staff', time: `${String(8 + i).padStart(2, '0')}:30`, status: d === 0 && i === 2 ? 'Pending' : 'Done',
  }))),
  hr_petty_cash: () => [
    { date: iso(-20), category: 'Opening', voucher: 'OB', party: 'Cash in hand', narration: 'Opening balance B/F', debit: 0, credit: 24750, ledger: 'Office Cash' },
    { date: iso(-12), category: 'Stationery', voucher: 'PV-101', party: 'Sri Stationers', narration: 'A4 paper and files', debit: 860, credit: 0, ledger: 'Office Cash' },
    { date: iso(-9), category: 'Courier', voucher: 'PV-102', party: 'Courier', narration: 'Policy copies dispatch', debit: 340, credit: 0, ledger: 'Office Cash' },
    { date: iso(-6), category: 'Housekeeping', voucher: 'HK-21', party: 'Cleaning supplies', narration: 'Monthly cleaning items', debit: 1420, credit: 0, ledger: 'Office Upkeep' },
    { date: iso(-4), category: 'Top-up', voucher: 'RV-11', party: 'Bank withdrawal', narration: 'Cash top-up from bank', debit: 0, credit: 5000, ledger: 'Office Cash' },
    { date: iso(-2), category: 'Food', voucher: 'PV-103', party: 'Tea & snacks', narration: 'Client meeting refreshments', debit: 450, credit: 0, ledger: 'Office Cash' },
  ],
  hr_payroll: () => [],

  // ── CST (customer success & renewals) ──
  cst_customers: () => LEADS.filter((l) => l.status !== 'Lost').slice(0, 10).map((l, i) => ({
    customerId: `CU-${1100 + i}`, name: l.company, contact: l.contact, mobile: l.mobile, email: l.email, branch: l.branch,
    policies: 1 + (i % 3), owner: pick(['Saravanan M', 'Lakshmi Devi'], i), since: iso(-400 + i * 20), health: pick(['Healthy', 'At Risk', 'Healthy', 'Needs Attention'], i),
  })),
  cst_renewals: () => LEADS.slice(0, 10).map((l, i) => ({
    policyNo: `POL/${thisYear}/${7700 + i}`, customer: l.company, product: l.product, insurer: pick(['Insurer A', 'Insurer B', 'Insurer C'], i),
    expiryDate: iso(-5 + i * 7), premium: l.dealValue, owner: pick(['Saravanan M', 'Lakshmi Devi'], i),
    status: pick(['Due', 'Contacted', 'Quote Sent', 'Renewed', 'Due', 'Lost'], i), lastContact: i % 2 ? iso(-i) : '',
  })),
  cst_feedback: () => LEADS.slice(0, 6).map((l, i) => ({ customer: l.company, date: iso(-i * 5), rating: [5, 4, 3, 5, 2, 4][i], channel: pick(['Call', 'WhatsApp', 'Email'], i), comments: pick(['Quick claim support', 'Renewal reminder was helpful', 'Waited long for policy copy'], i), followUp: i === 4 ? 'Required' : 'Not required' })),
  cst_escalations: () => [
    ['Bharath Logistics', 'Claim settlement delayed', 'High', 'Open'], ['Sunrise School', 'Wrong member name on health card', 'Medium', 'In Progress'], ['Deepak (individual)', 'Policy copy not received', 'Low', 'Resolved'],
  ].map(([customer, issue, severity, status], i) => ({ ticketNo: `ESC-${300 + i}`, customer, issue, severity, status, owner: pick(['Saravanan M', 'Lakshmi Devi'], i), raisedOn: iso(-i * 3), tat: `${2 + i} days` })),

  // ── Production (policy servicing work) ──
  prod_projects: () => [
    ['Sunrise School group health', 'Sunrise School', 'Harini S', 65, 'In Progress', 20],
    ['Vel Transports fleet renewal', 'Vel Transports', 'Karthik Selvam', 30, 'In Progress', 35],
    ['Website quote engine refresh', 'Internal', 'Gokul Raj', 80, 'In Progress', 12],
    ['RVS Group employee cover', 'RVS Group', 'Arun Prakash', 100, 'Completed', -4],
  ].map(([name, client, owner, progress, status, due]) => ({ name, client, owner, progress, status, startDate: iso(-30), dueDate: iso(due as number), budgetHours: 120 })),
  prod_tasks: () => [
    ['Collect member list', 'Sunrise School group health', 'Meena Sundar', 'Done'], ['Get quotes from 3 insurers', 'Sunrise School group health', 'Harini S', 'In Progress'],
    ['Vehicle RC verification', 'Vel Transports fleet renewal', 'Meena Sundar', 'To Do'], ['Premium comparison sheet', 'Vel Transports fleet renewal', 'Karthik Selvam', 'In Progress'],
    ['Quote engine API', 'Website quote engine refresh', 'Gokul Raj', 'In Progress'], ['UAT with sales team', 'Website quote engine refresh', 'Ajay T', 'To Do'],
  ].map(([title, project, assignee, status], i) => ({ title, project, assignee, status, priority: pick(['High', 'Medium', 'Low'], i), dueDate: iso(i - 1), estimate: 4 + i })),
  prod_timelogs: () => [0, 1, 2, 3, 4].map((d, i) => ({ date: iso(-d), employee: pick(['Meena Sundar', 'Harini S', 'Gokul Raj', 'Ajay T'], i), project: pick(['Sunrise School group health', 'Vel Transports fleet renewal', 'Website quote engine refresh'], i), task: 'Working session', hours: 2 + (i % 4), billable: i % 2 ? 'Yes' : 'No' })),
  prod_issuance: () => LEADS.filter((l) => ['Won', 'Interested'].includes(l.status as string)).map((l, i) => ({
    proposalNo: `PR-${5500 + i}`, customer: l.company, product: l.product, insurer: pick(['Insurer A', 'Insurer B'], i), premium: l.dealValue,
    stage: pick(['Proposal', 'Documents', 'Payment', 'Issued'], i), handledBy: 'Meena Sundar', date: iso(-i * 2), policyNo: i % 4 === 3 ? `POL/${thisYear}/${8800 + i}` : '',
  })),
  prod_endorsements: () => [
    ['POL/2026/7701', 'Sri Lakshmi Textiles', 'Add family member', 'Submitted'], ['POL/2026/7703', 'Anitha (individual)', 'Nominee change', 'Completed'], ['POL/2026/7706', 'City Auto Union', 'Address change', 'Pending Docs'],
  ].map(([policyNo, customer, type, status], i) => ({ policyNo, customer, type, status, requestedOn: iso(-i * 4), handledBy: 'Meena Sundar' })),

  // ── Accounts ──
  acc_receipts: () => LEADS.filter((l) => l.status !== 'Lost').slice(0, 9).map((l, i) => ({
    receiptNo: `RC-${9100 + i}`, date: iso(-i * 2), customer: l.company, against: `${l.product} premium`,
    amount: l.dealValue, mode: pick(['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Card'], i), reference: `TXN${880000 + i * 37}`, collectedBy: l.assignedTo, branch: l.branch,
  })),
  acc_payments: () => [
    ['Insurer A', 'Premium remittance', 54000, 'Bank Transfer', -3], ['Insurer B', 'Premium remittance', 142000, 'Bank Transfer', -5],
    ['Office rent', 'Rent – Coimbatore HO', 45000, 'Bank Transfer', -8], ['Electricity board', 'EB bill', 6800, 'UPI', -10], ['Internet provider', 'Broadband', 2360, 'UPI', -11],
  ].map(([payee, purpose, amount, mode, d], i) => ({ voucherNo: `PV-${7100 + i}`, date: iso(d as number), payee, purpose, amount, mode, reference: `UTR${550000 + i * 13}`, approvedBy: 'Arun Prakash' })),
  acc_invoices: () => LEADS.slice(0, 6).map((l, i) => ({
    invoiceNo: `INV-${thisYear}-${300 + i}`, date: iso(-i * 4), customer: l.company, description: `${l.product} service fee`,
    amount: Math.round(Number(l.dealValue) * 0.05), gst: Math.round(Number(l.dealValue) * 0.009), dueDate: iso(15 - i * 4),
    status: pick(['Paid', 'Unpaid', 'Overdue', 'Paid', 'Unpaid', 'Partially Paid'], i), paid: i % 3 === 0 ? Math.round(Number(l.dealValue) * 0.059) : 0,
  })),
  acc_commissions: () => LEADS.filter((l) => l.status === 'Won' || l.status === 'Interested').map((l, i) => ({
    insurer: pick(['Insurer A', 'Insurer B', 'Insurer C'], i), policyNo: `POL/${thisYear}/${7800 + i}`, customer: l.company, product: l.product,
    premium: l.dealValue, rate: [15, 20, 12][i % 3], amount: Math.round((Number(l.dealValue) * [15, 20, 12][i % 3]) / 100), status: pick(['Receivable', 'Received', 'Receivable'], i), dueDate: iso(20 - i * 5),
  })),
  acc_bank_accounts: () => [
    { name: 'Current Account – HO', bank: 'Sample Bank', accountNo: 'XXXX4521', ifsc: 'SMPL0000123', openingBalance: 450000, type: 'Current' },
    { name: 'Collections Account', bank: 'Sample Bank', accountNo: 'XXXX8890', ifsc: 'SMPL0000123', openingBalance: 120000, type: 'Current' },
  ],
};
