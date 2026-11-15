import { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, message,
  Space, Switch, Typography, Tooltip, Upload, Checkbox, Alert, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, ReloadOutlined, UploadOutlined, FileSearchOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  userApi, type ManagedUser, SUPER_ADMIN_EMAIL, ALLOWED_EMAIL_DOMAIN,
} from '../api/mockApi';
import { PERMISSION_OPTIONS, type UserRole } from '../types';
import { useAppSelector } from '../store';

const { Title, Text } = Typography;

const ROLE_COLORS: Record<UserRole | 'Customer', string> = {
  SuperAdmin: 'gold',
  Customer: 'default',
  Admin: 'red',
  Employee: 'blue',
  Agent: 'green',
};

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Admin', value: 'Admin' },
  { label: 'Employee', value: 'Employee' },
  { label: 'Agent', value: 'Agent' },
];
const AADHAAR_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const AADHAAR_MAX_BYTES = 5 * 1024 * 1024;

export default function UserManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [approving, setApproving] = useState<ManagedUser | null>(null);
  const [approveForm] = Form.useForm();
  const approveRole = Form.useWatch('role', approveForm) as UserRole | undefined;
  const selectedRole = Form.useWatch('role', form) as UserRole | undefined;

  // Only Super Admin can create Admins; an Admin manages Employees and Agents.
  const isSuperAdmin = useAppSelector((s) => s.auth.user?.role) === 'SuperAdmin';
  const roleOptions = isSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value !== 'Admin');

  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await userApi.list());
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      u.mobile.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q),
    );
  }, [users, search]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: 'Agent', permissions: [] });
    setModalOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditing(user);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      mobile: user.mobile.replace(/^\+91/, ''),
      role: user.role,
      permissions: user.permissions ?? [],
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await userApi.update(editing.id, {
          name: values.name,
          mobile: values.mobile,
          role: values.role,
        });
        if (values.role !== 'Admin') await userApi.setPermissions(editing.id, values.permissions ?? []);
        message.success('User updated');
      } else {
        await userApi.create({
          name: values.name,
          email: values.email,
          mobile: values.mobile,
          role: values.role,
          aadhaar: values.aadhaar?.[0]?.originFileObj as File | undefined,
          permissions: values.role === 'Admin' ? [] : values.permissions ?? [],
        });
        message.success(
          isSuperAdmin ? 'User created' : 'Sent to Super Admin for approval. They can sign in once approved.',
        );
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const viewAadhaar = async (user: ManagedUser) => {
    try {
      window.open(await userApi.aadhaarUrl(user.id), '_blank', 'noopener');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not open Aadhaar');
    }
  };

  const handleReview = async (user: ManagedUser, approve: boolean) => {
    try {
      await userApi.review(user.id, approve);
      message.success(approve ? `${user.name} approved` : `${user.name} rejected`);
      await loadUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const isRequest = (u: ManagedUser) => u.approvalStatus === 'PENDING' && (u.role as string) === 'Customer';

  const openApprove = (u: ManagedUser) => {
    setApproving(u);
    approveForm.resetFields();
    approveForm.setFieldsValue({ role: 'Agent', permissions: [] });
  };

  const confirmApprove = async () => {
    if (!approving) return;
    const v = await approveForm.validateFields();
    setSaving(true);
    try {
      await userApi.review(approving.id, true, { role: v.role, permissions: v.role === 'Admin' ? [] : v.permissions ?? [] });
      message.success(`${approving.name} approved as ${v.role}`);
      setApproving(null);
      await loadUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = users.filter((u) => u.approvalStatus === 'PENDING').length;

  const handleToggleActive = async (user: ManagedUser, next: boolean) => {
    try {
      await userApi.setActive(user.id, next);
      message.success(next ? 'User activated' : 'User deactivated');
      await loadUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const columns: ColumnsType<ManagedUser> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, u) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {u.email?.toLowerCase() === SUPER_ADMIN_EMAIL && (
            <Tag color="gold" style={{ marginTop: 2 }}>Super Admin</Tag>
          )}
        </Space>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      filters: ROLE_OPTIONS.map(r => ({ text: r.label, value: r.value })),
      onFilter: (value, record) => record.role === value,
      render: (role: UserRole) => <Tag color={ROLE_COLORS[role]}>{role}</Tag>,
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[] | undefined, u) =>
        u.role === 'Admin' || u.role === 'SuperAdmin'
          ? <Text type="secondary">Full access</Text>
          : (permissions?.length
              ? permissions.map((p) => <Tag key={p}>{p}</Tag>)
              : <Text type="secondary">None</Text>),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, u) => {
        if (u.approvalStatus === 'PENDING') return <Tag color="orange">{(u.role as string) === 'Customer' ? 'Access request' : 'Pending approval'}</Tag>;
        const isSuper = u.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
        return (
          <Space>
            <Switch
              checked={isActive}
              disabled={isSuper}
              onChange={(next) => handleToggleActive(u, next)}
            />
            <Text type={isActive ? 'success' : 'secondary'}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, u) => (
        <Space>
          {u.approvalStatus === 'PENDING' && (isSuperAdmin || isRequest(u)) && (
            <>
              {isRequest(u)
                ? <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openApprove(u)}>Review</Button>
                : (
                  <Popconfirm title={`Approve ${u.name}?`} okText="Approve" onConfirm={() => handleReview(u, true)}>
                    <Button size="small" type="primary" icon={<CheckOutlined />}>Approve</Button>
                  </Popconfirm>
                )}
              <Popconfirm title={`Reject ${u.name}?`} okText="Reject" okButtonProps={{ danger: true }} onConfirm={() => handleReview(u, false)}>
                <Button size="small" danger icon={<CloseOutlined />}>Reject</Button>
              </Popconfirm>
            </>
          )}
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(u)} />
          </Tooltip>
          <Tooltip title="View Aadhaar">
            <Button size="small" icon={<FileSearchOutlined />} disabled={!u.hasAadhaar} onClick={() => viewAadhaar(u)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>User Management</Title>
          <Text type="secondary">
            Manage staff accounts and roles. Staff sign in with a one-time code sent to their email or mobile.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadUsers}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add User</Button>
        </Space>
      </div>

      {pendingCount > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={isSuperAdmin
            ? `${pendingCount} staff account${pendingCount > 1 ? 's' : ''} or request${pendingCount > 1 ? 's' : ''} waiting for review`
            : `${pendingCount} account${pendingCount > 1 ? 's' : ''} waiting for Super Admin approval`}
        />
      )}

      <Input.Search
        placeholder="Search by name, email, mobile or role"
        allowClear
        style={{ maxWidth: 360, marginBottom: 16 }}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 10, showSizeChanger: false }}
      />

      <Modal
        title={`Approve ${approving?.name ?? ''}`}
        open={!!approving}
        onOk={confirmApprove}
        confirmLoading={saving}
        onCancel={() => setApproving(null)}
        okText="Approve"
        destroyOnClose
      >
        <Space direction="vertical" size={2} style={{ marginBottom: 16 }}>
          <Text type="secondary">{approving?.email ?? '—'} · {approving?.mobile || '—'}</Text>
          {approving?.hasAadhaar && (
            <Button size="small" icon={<FileSearchOutlined />} onClick={() => approving && viewAadhaar(approving)}>View Aadhaar</Button>
          )}
        </Space>
        <Form form={approveForm} layout="vertical">
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Select a role' }]}>
            <Select options={roleOptions} />
          </Form.Item>
          {approveRole !== 'Admin' && (
            <Form.Item name="permissions" label="Permissions">
              <Checkbox.Group options={PERMISSION_OPTIONS.map((p) => ({ label: p.label, value: p.value }))} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Create / Edit modal */}
      <Modal
        title={editing ? 'Edit User' : 'Add User'}
        open={modalOpen}
        onOk={handleSave}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        okText={editing ? 'Save' : 'Create'}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="name"
            label="Full name"
            rules={[{ required: true, message: 'Enter the full name' }]}
          >
            <Input placeholder="e.g. Priya Sharma" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Enter an email' },
              { type: 'email', message: 'Enter a valid email' },
              {
                validator: (_, value) =>
                  !value || value.trim().toLowerCase().endsWith('@' + ALLOWED_EMAIL_DOMAIN)
                    ? Promise.resolve()
                    : Promise.reject(new Error(`Email must end with @${ALLOWED_EMAIL_DOMAIN}`)),
              },
            ]}
          >
            <Input placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`} disabled={!!editing} />
          </Form.Item>

          <Form.Item
            name="mobile"
            label="Mobile number"
            rules={[
              { required: true, message: 'Enter a mobile number' },
              { pattern: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit mobile' },
            ]}
          >
            <Input addonBefore="+91" maxLength={10} placeholder="10-digit number" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Select a role' }]}
          >
            <Select
              options={roleOptions}
              disabled={!!editing && editing.email?.toLowerCase() === SUPER_ADMIN_EMAIL}
            />
          </Form.Item>

          {!editing && (
            <Form.Item
              name="aadhaar"
              label="Aadhaar document"
              valuePropName="fileList"
              getValueFromEvent={(e) => e?.fileList}
              extra="JPG, PNG or PDF, up to 5 MB. Stored privately; only Admins can view it."
              rules={[{ required: true, message: 'Upload the Aadhaar document' }]}
            >
              <Upload
                maxCount={1}
                accept=".jpg,.jpeg,.png,.pdf"
                beforeUpload={(file) => {
                  if (!AADHAAR_TYPES.includes(file.type)) { message.error('Aadhaar must be a JPG, PNG or PDF'); return Upload.LIST_IGNORE; }
                  if (file.size > AADHAAR_MAX_BYTES) { message.error('File must be 5 MB or smaller'); return Upload.LIST_IGNORE; }
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>Select file</Button>
              </Upload>
            </Form.Item>
          )}

          {selectedRole !== 'Admin' && (
            <Form.Item name="permissions" label="Permissions">
              <Checkbox.Group options={PERMISSION_OPTIONS.map((p) => ({ label: p.label, value: p.value }))} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
