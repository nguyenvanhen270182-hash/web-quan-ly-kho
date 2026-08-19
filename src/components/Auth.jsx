import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Flex, message, Tabs, Alert } from 'antd';
import { MailOutlined, LockOutlined, LoginOutlined, UserAddOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient';

const { Title, Text } = Typography;

export default function Auth({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState(false);

  // ĐĂNG NHẬP
  const handleLogin = async (values) => {
    setLoading(true);
    setRegisterSuccessMsg(false);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      message.error(`Đăng nhập thất bại: ${error.message}`);
      setLoading(false);
      return;
    }

    // Đọc trạng thái duyệt từ bảng profiles qua cột is_pro
    const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', data.user.id)
    .single();

    // Nếu chưa được duyệt -> tự động đăng xuất và báo chờ Admin
    if (profileErr || !profile || profile.is_pro !== true) {
      await supabase.auth.signOut();
      message.warning('⏳ Tài khoản của bạn đang chờ Admin phê duyệt trước khi có thể sử dụng!');
      setLoading(false);
      return;
    }

    message.success('Đăng nhập thành công!');
    if (onLoginSuccess) onLoginSuccess(data.user);
    setLoading(false);
  };

  // ĐĂNG KÝ
  const handleRegister = async (values) => {
    setLoading(true);
    setRegisterSuccessMsg(false);

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });

    if (error) {
      message.error(`Đăng ký thất bại: ${error.message}`);
    } else {
      setRegisterSuccessMsg(true);
      message.success('Đã gửi yêu cầu đăng ký thành công!');
      setActiveTab('login');
    }
    setLoading(false);
  };

  return (
    <Flex justify="center" align="center" style={{ minHeight: '100vh', background: '#001529', padding: 16 }}>
      <Card style={{ width: 400, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
        <Flex vertical align="center" style={{ marginBottom: 20 }}>
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>QUẢN LÝ KHO</Title>
          <Text type="secondary">Xác thực tài khoản người dùng</Text>
        </Flex>

        {registerSuccessMsg && (
          <Alert
            message="Đăng ký thành công!"
            description="Tài khoản của bạn đã được tạo. Vui lòng liên hệ Admin để duyệt trước khi đăng nhập."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Tabs 
          activeKey={activeTab} 
          onChange={(k) => {
            setActiveTab(k);
            setRegisterSuccessMsg(false);
          }} 
          centered
          items={[
            { key: 'login', label: 'Đăng Nhập' },
            { key: 'register', label: 'Tạo Tài Khoản Mới' },
          ]} 
        />

        {activeTab === 'login' && (
          <Form layout="vertical" onFinish={handleLogin}>
            <Form.Item name="email" rules={[{ required: true, message: 'Nhập email', type: 'email' }]}>
              <Input prefix={<MailOutlined />} placeholder="Email đăng nhập" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<LoginOutlined />} loading={loading} block size="large">
              ĐĂNG NHẬP
            </Button>
          </Form>
        )}

        {activeTab === 'register' && (
          <Form layout="vertical" onFinish={handleRegister}>
            <Form.Item name="email" rules={[{ required: true, message: 'Nhập email', type: 'email' }]}>
              <Input prefix={<MailOutlined />} placeholder="Email đăng ký" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu (>= 6 ký tự)" size="large" />
            </Form.Item>
            <Button type="primary" style={{ background: '#52c41a' }} htmlType="submit" icon={<UserAddOutlined />} loading={loading} block size="large">
              GỬI YÊU CẦU ĐĂNG KÝ
            </Button>
          </Form>
        )}
      </Card>
    </Flex>
  );
}