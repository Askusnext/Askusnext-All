import React from 'react';
import { DatePicker, Form, Input, InputNumber, Select } from 'antd';
import type { TicketType } from '../types';

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#666',
  marginBottom: 4,
  marginTop: 2,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 7,
  border: '1px solid #e0e0e0',
  background: '#fff',
  fontSize: 12,
  color: '#111',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 2px 16px rgba(21,101,192,0.08)',
  padding: '20px 24px 8px',
  marginBottom: 16,
};

const cardTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#1565C0',
  letterSpacing: 0.3,
  marginBottom: 16,
  paddingBottom: 10,
  borderBottom: '1px solid #e8f0fe',
};

const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0 16px',
};

const fullWidth = { width: '100%' };

function InsuranceFields() {
  return (
    <div style={card}>
      <div style={cardTitle}>Insurance Ticket Details</div>
      <div style={grid2}>
        <Form.Item name="insurer" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Insurer *</label>
          <Select placeholder="Select insurer" style={fullWidth}>
            {['HDFC Ergo', 'Bajaj Allianz', 'ICICI Lombard', 'New India Assurance', 'Oriental Insurance', 'United India', 'Reliance General', 'Tata AIG'].map((i) => (
              <Select.Option key={i} value={i}>{i}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="policyType" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Policy Type *</label>
          <Select placeholder="Select policy type" style={fullWidth}>
            {['Comprehensive', 'ThirdParty', 'OwnDamage', 'ZeroDep'].map((t) => (
              <Select.Option key={t} value={t}>{t}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="policyNumber" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Policy Number</label>
          <Input placeholder="POL-00012345" style={inputStyle} />
        </Form.Item>

        <Form.Item name="idv" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>IDV (INR)</label>
          <InputNumber style={fullWidth} placeholder="920000" />
        </Form.Item>

        <Form.Item name="netPremium" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Net Premium (INR) *</label>
          <InputNumber style={fullWidth} placeholder="15000" />
        </Form.Item>

        <Form.Item name="ncb" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>NCB %</label>
          <Select placeholder="Select NCB" style={fullWidth}>
            {[0, 20, 25, 35, 45, 50].map((n) => (
              <Select.Option key={n} value={n}>{n}%</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="startDate" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Start Date *</label>
          <DatePicker style={fullWidth} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="expiryDate" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Expiry Date *</label>
          <DatePicker style={fullWidth} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="insuranceStatus" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Insurance Status</label>
          <Select placeholder="Select status" style={fullWidth}>
            {['Active', 'ExpiringSoon', 'Expired', 'NewPolicy'].map((s) => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="paymentStatus" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Payment Status</label>
          <Select placeholder="Select payment status" style={fullWidth}>
            {['Pending', 'Paid', 'Partial'].map((s) => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      </div>
    </div>
  );
}

function O2TaxiFields() {
  return (
    <div style={card}>
      <div style={cardTitle}>O2 Taxi Query Ticket Details</div>
      <div style={grid2}>
        <Form.Item name="taxiQueryType" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Query Type *</label>
          <Select placeholder="Select query type" style={fullWidth}>
            {[
              ['BookingIssue', 'Booking Issue'],
              ['PaymentIssue', 'Payment Issue'],
              ['TripIssue', 'Trip Issue'],
              ['DriverIssue', 'Driver Issue'],
              ['AppIssue', 'App Issue'],
              ['Other', 'Other'],
            ].map(([value, label]) => (
              <Select.Option key={value} value={value}>{label}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="taxiSeverity" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Severity</label>
          <Select placeholder="Select severity" style={fullWidth}>
            {['Low', 'Medium', 'High', 'Critical'].map((s) => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="taxiIssueSummary" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Issue Summary *</label>
          <Input.TextArea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Describe the taxi app issue" />
        </Form.Item>

        <Form.Item name="taxiReporterName" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Rider/Driver Name</label>
          <Input placeholder="Name" style={inputStyle} />
        </Form.Item>

        <Form.Item name="taxiReporterContact" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Contact Number</label>
          <Input placeholder="Mobile number" style={inputStyle} />
        </Form.Item>

        <Form.Item name="taxiTripId" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Trip ID</label>
          <Input placeholder="Trip reference" style={inputStyle} />
        </Form.Item>

        <Form.Item name="taxiExpectedResolution" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Expected Resolution Date</label>
          <DatePicker style={fullWidth} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="taxiRemarks" style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Remarks</label>
          <Input.TextArea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Additional notes" />
        </Form.Item>
      </div>
    </div>
  );
}

function GeneralFields() {
  return (
    <div style={card}>
      <div style={cardTitle}>General Ticket Details</div>
      <div style={grid2}>
        <Form.Item name="generalRequestCategory" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Request Category *</label>
          <Select placeholder="Select category" style={fullWidth}>
            {[
              ['PaymentFollowup', 'Payment Follow-up'],
              ['CompanyLogo', 'Company Logo Creation'],
              ['AdminTask', 'Admin Task'],
              ['DocumentTask', 'Document Task'],
              ['Other', 'Other'],
            ].map(([value, label]) => (
              <Select.Option key={value} value={value}>{label}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="generalAssignedTeam" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Assigned Team</label>
          <Input placeholder="Design, Accounts, Ops..." style={inputStyle} />
        </Form.Item>

        <Form.Item name="generalRequestTitle" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Request Title *</label>
          <Input placeholder="Short title" style={inputStyle} />
        </Form.Item>

        <Form.Item name="generalRequestDescription" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Request Description *</label>
          <Input.TextArea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Describe the request" />
        </Form.Item>

        <Form.Item name="generalRequestedBy" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Requested By</label>
          <Input placeholder="Name" style={inputStyle} />
        </Form.Item>

        <Form.Item name="generalTargetDate" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Target Date</label>
          <DatePicker style={fullWidth} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="generalBudgetAmount" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Budget (INR)</label>
          <InputNumber style={fullWidth} placeholder="0" />
        </Form.Item>

        <Form.Item name="generalRemarks" style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Remarks</label>
          <Input.TextArea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Additional remarks" />
        </Form.Item>
      </div>
    </div>
  );
}

function DailyActivityFields() {
  return (
    <div style={card}>
      <div style={cardTitle}>Daily Activity Ticket Details</div>
      <div style={grid2}>
        <Form.Item name="dailyEmployeeName" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Employee Name *</label>
          <Input placeholder="Employee name" style={inputStyle} />
        </Form.Item>

        <Form.Item name="dailyActivityDate" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Activity Date *</label>
          <DatePicker style={fullWidth} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="dailyTaskTitle" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Task Title *</label>
          <Input placeholder="Short activity title" style={inputStyle} />
        </Form.Item>

        <Form.Item name="dailyTaskDescription" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Task Description *</label>
          <Input.TextArea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="What work was assigned" />
        </Form.Item>

        <Form.Item name="dailyExpectedCompletion" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Expected Completion</label>
          <DatePicker style={fullWidth} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="dailyActualCompletion" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Actual Completion</label>
          <DatePicker style={fullWidth} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="dailyWorkStatus" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Work Status</label>
          <Select placeholder="Select status" style={fullWidth}>
            {[
              ['NotStarted', 'Not Started'],
              ['InProgress', 'In Progress'],
              ['Completed', 'Completed'],
              ['Blocked', 'Blocked'],
            ].map(([value, label]) => (
              <Select.Option key={value} value={value}>{label}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="dailyBlockers" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Blockers</label>
          <Input placeholder="Dependencies or issues" style={inputStyle} />
        </Form.Item>

        <Form.Item name="dailyManagerNotes" style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Manager Notes</label>
          <Input.TextArea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Completion notes" />
        </Form.Item>
      </div>
    </div>
  );
}

function SupportFields() {
  return (
    <div style={card}>
      <div style={cardTitle}>Support Ticket Details</div>
      <div style={grid2}>
        <Form.Item name="supportChannel" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Channel *</label>
          <Select placeholder="Select channel" style={fullWidth}>
            {['Call', 'WhatsApp', 'Email', 'InPerson', 'Portal'].map((c) => (
              <Select.Option key={c} value={c}>{c}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="supportIssueCategory" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Issue Category *</label>
          <Select placeholder="Select category" style={fullWidth}>
            {[
              ['Technical', 'Technical'],
              ['CustomerQuery', 'Customer Query'],
              ['PaymentSupport', 'Payment Support'],
              ['PolicySupport', 'Policy Support'],
              ['Other', 'Other'],
            ].map(([value, label]) => (
              <Select.Option key={value} value={value}>{label}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="supportIssueSummary" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Issue Summary *</label>
          <Input.TextArea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Describe the issue" />
        </Form.Item>

        <Form.Item name="supportReporterName" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Reported By</label>
          <Input placeholder="Name" style={inputStyle} />
        </Form.Item>

        <Form.Item name="supportReporterContact" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Contact</label>
          <Input placeholder="Mobile or email" style={inputStyle} />
        </Form.Item>

        <Form.Item name="supportSeverity" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Severity</label>
          <Select placeholder="Select severity" style={fullWidth}>
            {['Low', 'Medium', 'High', 'Critical'].map((s) => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="supportResolvedAt" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Resolved At</label>
          <DatePicker style={fullWidth} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="supportRootCause" style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Root Cause</label>
          <Input.TextArea rows={2} style={{ ...inputStyle, resize: 'none' }} placeholder="What caused this issue" />
        </Form.Item>

        <Form.Item name="supportResolutionNotes" style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Resolution Notes</label>
          <Input.TextArea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="How it was resolved" />
        </Form.Item>
      </div>
    </div>
  );
}

export function renderTicketTypeFields(ticketType: TicketType) {
  switch (ticketType) {
    case 'Insurance':
      return <InsuranceFields />;
    case 'O2Taxi':
      return <O2TaxiFields />;
    case 'General':
    case 'Payment':
      return <GeneralFields />;
    case 'DailyActivity':
    case 'Office':
      return <DailyActivityFields />;
    case 'Support':
    case 'Other':
      return <SupportFields />;
    default:
      return <InsuranceFields />;
  }
}
