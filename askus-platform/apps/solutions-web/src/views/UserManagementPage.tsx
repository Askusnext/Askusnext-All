import { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, message,
  Space, Switch, Typography, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  userApi, type ManagedUser, SUPER_ADMIN_EMAIL, ALLOWED_EMAIL_DOMAIN,
} from '../api/mockApi';
import type { UserRole } from '../types';

const { Title, Text } = Typography;

const ROLE_COLORS: Record<UserRole, string> = {
  Admin: 'red',
  Employee: 'blue',
  Agent: 'green',
};

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Admin', value: 'Admin' },
  { label: 'Employee', value: 'Employee' },
  { label: 'Agent', value: 'Agent' },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

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
    form.setFieldsValue({ role: 'Agent' });
    setModalOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditing(user);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      mobile: user.mobile.replace(/^\+91/, ''),
      role: user.role,
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
        message.success('User updated');
      } else {
        await userApi.create({
          name: values.name,
          email: values.email,
          mobile: values.mobile,
          role: values.role,
        });
        message.success('User created');
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

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
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, u) => {
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
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(u)} />
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
              options={ROLE_OPTIONS}
              disabled={!!editing && editing.email?.toLowerCase() === SUPER_ADMIN_EMAIL}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
