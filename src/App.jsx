import React, { useEffect, useState, useMemo } from 'react';
import { 
  Layout, Table, Select, Button, Card, Space, 
  message, Tag, Flex, Typography, DatePicker, Row, Col, Tooltip,
  Modal, Form, InputNumber, Input, Radio, Grid, AutoComplete 
} from 'antd';
import { 
  ReloadOutlined, ArrowUpOutlined, 
  ArrowDownOutlined, PrinterOutlined, 
  FileExcelOutlined, LogoutOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { supabase } from './supabaseClient';

import ImportStock from './components/ImportStock';
import ExportStock from './components/ExportStock';
import { printReportHistory, exportExcelReportHistory } from './utils/exportWebUtils';
import Auth from './components/Auth';

dayjs.extend(isBetween);

const { Header, Content } = Layout;
const { Title } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

export default function App() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentView, setCurrentView] = useState('HISTORY');
  
  // Quản lý phiên đăng nhập & kiểm duyệt tài khoản
  const [sessionUser, setSessionUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Bộ lọc loại giao dịch & ngày tháng
  const [filterType, setFilterType] = useState('ALL');
  const [dateRange, setDateRange] = useState(null);

  // Giá trị các bộ lọc đang chọn
  const [searchProduct, setSearchProduct] = useState(null);
  const [searchCustomer, setSearchCustomer] = useState(null);
  const [searchReceiver, setSearchReceiver] = useState(null);
  const [searchPosition, setSearchPosition] = useState(null);
  const [searchVehicle, setSearchVehicle] = useState(null);
  const [searchTicket, setSearchTicket] = useState(null);

  // State cho Modal Điều chỉnh kiểm kê Tồn kho
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [form] = Form.useForm();

  // Theo dõi giá trị form để hiển thị trực quan số lượng dự kiến
  const watchAdjustType = Form.useWatch('adjust_type', form);
  const watchQuantity = Form.useWatch('quantity', form);

  // =========================================================================
  // XÁC THỰC TÀI KHOẢN VÀ KIỂM TRA IS_PRO TỪ BẢNG PROFILES
  // =========================================================================
  useEffect(() => {
    const checkUserSession = async () => {
      setCheckingAuth(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_pro')
            .eq('id', session.user.id)
            .single();

          if (!error && profile?.is_pro === true) {
            setSessionUser(session.user);
            setSelectedUser(session.user.id);
          } else {
            await supabase.auth.signOut();
            setSessionUser(null);
            setSelectedUser(null);
          }
        } else {
          setSessionUser(null);
          setSelectedUser(null);
        }
      } catch (err) {
        console.error('Lỗi kiểm tra session:', err);
        setSessionUser(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkUserSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_pro')
          .eq('id', session.user.id)
          .single();

        if (profile?.is_pro === true) {
          setSessionUser(session.user);
          setSelectedUser(session.user.id);
        } else {
          await supabase.auth.signOut();
          setSessionUser(null);
          setSelectedUser(null);
        }
      } else {
        setSessionUser(null);
        setSelectedUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSessionUser(null);
    setSelectedUser(null);
    message.info('Đã đăng xuất!');
  };

  // =========================================================================
  // TẢI DỮ LIỆU GIAO DỊCH TỪ SUPABASE
  // =========================================================================
  const fetchData = async (userId = selectedUser) => {
    if (!userId) return;
    setLoading(true);
    let query = supabase.from('stock_transaction').select('*').order('id', { ascending: false });
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) message.error('Lỗi: ' + error.message);
    else setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedUser) {
      fetchData(selectedUser);
    }
  }, [selectedUser]);

  // =========================================================================
  // BÓC TÁCH DANH SÁCH DISTINCT TỪ SUPABASE ĐỂ ĐỔ VÀO DROPDOWN
  // =========================================================================
  const distinctOptions = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { products: [], customers: [], receivers: [], positions: [], vehicles: [], tickets: [] };
    }

    const prodSet = new Set();
    const cusSet = new Set();
    const recSet = new Set();
    const posSet = new Set();
    const vehSet = new Set();
    const tickSet = new Set();

    transactions.forEach((r) => {
      if (r.product_name) prodSet.add(r.product_name.trim());
      if (r.customer_name) cusSet.add(r.customer_name.trim());
      if (r.receiver_name) recSet.add(r.receiver_name.trim());
      if (r.position_name) posSet.add(r.position_name.trim());
      
      if (r.note) {
        const m = r.note.match(/\|Xe:\s*([^|]+)/);
        const v = m ? m[1].trim() : '';
        if (v && v !== 'null' && v !== 'nulll') vehSet.add(v);
      }

      const t = (r.type || '').toUpperCase();
      if (r.so_phieu) {
        if (filterType === 'OUT' && (t === 'OUT' || t === 'XUẤT')) tickSet.add(r.so_phieu.trim());
        else if ((filterType === 'IN' || filterType === 'STOCK') && (t === 'IN' || t === 'NHẬP')) tickSet.add(r.so_phieu.trim());
        else if (filterType === 'ADJUST_IN' && t === 'ADJUST_IN') tickSet.add(r.so_phieu.trim());
        else if (filterType === 'ADJUST_OUT' && t === 'ADJUST_OUT') tickSet.add(r.so_phieu.trim());
        else if (filterType === 'ALL') tickSet.add(r.so_phieu.trim());
      }
    });

    const toOptions = (set) => Array.from(set).filter(Boolean).map((v) => ({ label: v, value: v }));

    return {
      products: toOptions(prodSet),
      customers: toOptions(cusSet),
      receivers: toOptions(recSet),
      positions: toOptions(posSet),
      vehicles: toOptions(vehSet),
      tickets: toOptions(tickSet),
    };
  }, [transactions, filterType]);

  const handleResetFilters = () => {
    setDateRange(null);
    setSearchProduct(null);
    setSearchCustomer(null);
    setSearchReceiver(null);
    setSearchPosition(null);
    setSearchVehicle(null);
    setSearchTicket(null);
    fetchData(selectedUser);
  };

  // =========================================================================
  // XỬ LÝ MỞ & LƯU PHIẾU ĐIỀU CHỈNH KHO
  // =========================================================================
  const handleOpenAdjustModal = (record) => {
    setSelectedStockItem(record);
    form.setFieldsValue({
      adjust_type: 'ADJUST_IN',
      quantity: 1,
      note: ''
    });
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (values) => {
    if (!selectedStockItem || !sessionUser) return;
    setAdjustLoading(true);

    try {
      const todayStr = dayjs().format('YYYY-MM-DD');
      const timeStamp = Date.now();
      const rawUuid = crypto.randomUUID ? crypto.randomUUID() : `${timeStamp}_${Math.random().toString(36).substring(2, 9)}`;

      const isAdjustOut = values.adjust_type === 'ADJUST_OUT';
      const finalType = isAdjustOut ? 'ADJUST_OUT' : 'ADJUST_IN';
      
      const txUuid = `TX_${rawUuid}`;
      const refUuid = `${isAdjustOut ? 'AJO' : 'AJI'}_${rawUuid}`;
      const autoTicket = `${isAdjustOut ? 'AJO' : 'AJI'}_${dayjs().format('YYYYMMDD_HHmmss')}`;

      const originStockUuid = selectedStockItem.stock_uuid || selectedStockItem.uuid || selectedStockItem.ref_uuid || null;

      const newRecord = {
        uuid: txUuid,
        ref_uuid: refUuid,
        stock_uuid: originStockUuid,
        user_id: sessionUser.id,
        date: todayStr,
        so_phieu: autoTicket,
        ref_so_phieu: autoTicket,
        type: finalType,
        product_code: selectedStockItem.product_code || '',
        product_name: selectedStockItem.product_name,
        customer_code: selectedStockItem.customer_code || '',
        customer_name: selectedStockItem.customer_name || '',
        position_code: selectedStockItem.position_code || '',
        position_name: selectedStockItem.position_name || selectedStockItem.pos || 'HOÀNG LIÊN',
        lot_no: selectedStockItem.lot_no || null,
        dvt: selectedStockItem.dvt || 'Thùng',
        so_luong: Number(values.quantity),
        net: Number(selectedStockItem.net || 0),
        tong_net: Math.round(Number(values.quantity) * Number(selectedStockItem.net || 0) * 100) / 100,
        price: Number(selectedStockItem.price || 0),
        note: values.note ? values.note : 'Sửa giảm Số lượng!'
      };

      const { error } = await supabase.from('stock_transaction').insert([newRecord]);

      if (error) {
        message.error('Lỗi khi lưu phiếu điều chỉnh: ' + error.message);
      } else {
        message.success(`Đã tạo phiếu ${isAdjustOut ? 'ĐIỀU CHỈNH GIẢM' : 'ĐIỀU CHỈNH TĂNG'} thành công!`);
        setIsAdjustModalOpen(false);
        fetchData(selectedUser);
      }
    } catch (err) {
      message.error('Có lỗi xảy ra: ' + err.message);
    } finally {
      setAdjustLoading(false);
    }
  };

  // =========================================================================
  // LOGIC LỌC DỮ LIỆU TỔNG HỢP
  // =========================================================================
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    const checkDateInRange = (itemDate) => {
      if (!dateRange || !dateRange[0] || !dateRange[1]) return true;
      if (!itemDate) return false;
      const start = dateRange[0].startOf('day');
      const end = dateRange[1].endOf('day');
      const current = dayjs(itemDate);
      return current.isBetween(start, end, null, '[]');
    };

    const checkProductMatch = (prodName) => {
      if (!searchProduct) return true;
      const current = (prodName || '').trim().toLowerCase();
      const keyword = searchProduct.trim().toLowerCase();

      const isExactChosen = distinctOptions.products?.some(
        (p) => (p.value || '').trim().toLowerCase() === keyword
      );

      return isExactChosen ? current === keyword : current.includes(keyword);
    };

    if (filterType === 'STOCK') {
      const stockMap = new Map();

      transactions.forEach((row) => {
        const t = (row.type || '').toUpperCase();
        const prodName = (row.product_name || '').trim();
        const posName = (row.position_name || row.pos || 'KHO_CHINH').trim();

        if (!prodName) return;

        const key = `${prodName}_${posName}`;

        if (!stockMap.has(key)) {
          stockMap.set(key, {
            ...row,
            key: key,
            id: `TON_${key}`,
            type: 'STOCK',
            in_qty: 0,
            out_qty: 0,
            adjust_in_qty: 0,
            adjust_out_qty: 0,
            so_luong: 0,
            tong_net: 0,
          });
        }

        const item = stockMap.get(key);
        const qty = Number(row.so_luong || 0);

        if (t === 'IN' || t === 'NHẬP') {
          item.in_qty += qty;
          item.product_name = row.product_name || item.product_name;
          item.customer_name = row.customer_name || item.customer_name;
          item.position_name = row.position_name || item.position_name;
          item.dvt = row.dvt || item.dvt;

          item.net = Number(row.net || item.net || 0);
          item.price = Number(row.price || item.price || 0);
          item.so_phieu = row.so_phieu || item.so_phieu;
          item.date = row.date || item.date;
          item.note = row.note || item.note;
        } else if (t === 'OUT' || t === 'XUẤT') {
          item.out_qty += qty;
        } else if (t === 'ADJUST_IN') {
          item.adjust_in_qty += qty;
          item.dvt = row.dvt || item.dvt;
        } else if (t === 'ADJUST_OUT') {
          item.adjust_out_qty += qty;
        }
      });

      const listStock = [];
      stockMap.forEach((val) => {
        const tonQty = (val.in_qty + val.adjust_in_qty) - (val.out_qty + val.adjust_out_qty);
        if (tonQty > 0) {
          listStock.push({
            ...val,
            so_luong: tonQty,
            tong_net: Math.round(tonQty * (val.net || 0) * 100) / 100,
          });
        }
      });

      return listStock.filter((item) => {
        const matchProduct = checkProductMatch(item.product_name);
        const matchCustomer = !searchCustomer || item.customer_name === searchCustomer;
        const matchPosition = !searchPosition || item.position_name === searchPosition;
        const matchVehicle = !searchVehicle || item.note?.includes(searchVehicle);
        const matchTicket = !searchTicket || item.so_phieu === searchTicket;
        const matchDate = checkDateInRange(item.date);

        return matchProduct && matchCustomer && matchPosition && matchVehicle && matchTicket && matchDate;
      });
    }

    return transactions.filter((item) => {
      const t = (item.type || '').toUpperCase();
      let matchType = false;
      
      if (filterType === 'ALL') {
        matchType = true;
      } else if (filterType === 'IN') {
        matchType = (t === 'IN' || t === 'NHẬP' || t === 'ADJUST_IN' || t === 'ADJUST_OUT');
      } else if (filterType === 'OUT') {
        matchType = (t === 'OUT' || t === 'XUẤT');
      } else {
        matchType = (t === filterType);
      }

      const matchDate = checkDateInRange(item.date);
      const matchProduct = checkProductMatch(item.product_name);
      const matchCustomer = !searchCustomer || item.customer_name === searchCustomer;
      const matchReceiver = !searchReceiver || item.receiver_name === searchReceiver;
      const matchPosition = !searchPosition || item.position_name === searchPosition;
      const matchVehicle = !searchVehicle || item.note?.includes(searchVehicle);
      const matchTicket = !searchTicket || item.so_phieu === searchTicket;

      return matchType && matchDate && matchProduct && matchCustomer && matchReceiver && matchPosition && matchVehicle && matchTicket;
    });
  }, [
    transactions, 
    filterType, 
    dateRange, 
    searchProduct, 
    searchCustomer, 
    searchReceiver, 
    searchPosition, 
    searchVehicle, 
    searchTicket,
    distinctOptions.products
  ]);

  // =========================================================================
  // TÍNH TOÁN TỔNG SỐ LƯỢNG, TỔNG NET & TỔNG TIỀN (ĐÃ FIX LỖI TRẮNG TRANG)
  // =========================================================================
  const summaryStats = useMemo(() => {
    let totalQty = 0;
    let totalNetWeight = 0;
    let totalPrice = 0;

    filteredTransactions.forEach((item) => {
      const t = (item.type || '').toUpperCase();
      const qty = Number(item.so_luong) || 0;
      const net = Number(item.net) || 1;
      const price = Number(item.price) || 0;
      
      const lineTotal = qty * net * price;
      const lineNet = qty * net;

      if (t === 'ADJUST_OUT') {
        totalQty -= qty;
        totalNetWeight -= lineNet;
        totalPrice -= lineTotal;
      } else {
        totalQty += qty;
        totalNetWeight += lineNet;
        totalPrice += lineTotal;
      }
    });

    return {
      totalRows: filteredTransactions.length,
      totalQty,
      totalNetWeight: Math.round(totalNetWeight * 100) / 100,
      totalPrice,
    };
  }, [filteredTransactions]);

  const columns = [
    { 
      title: 'TT', 
      key: 'stt', 
      width: 55, 
      align: 'center',
      render: (_text, _record, index) => <b>{index + 1}</b>
    },
    { title: 'Ngày', dataIndex: 'date', key: 'date', width: 105, align: 'center', render: (d) => <b>{d}</b> },
    { title: 'Số Phiếu', dataIndex: 'so_phieu', key: 'so_phieu', width: 105 },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 95,
      align: 'center',
      render: (type) => {
        const t = (type || '').toUpperCase();
        if (t === 'NHẬP' || t === 'IN') return <Tag color="green">NHẬP</Tag>;
        if (t === 'XUẤT' || t === 'OUT') return <Tag color="blue">XUẤT</Tag>;
        if (t === 'ADJUST_IN') return <Tag color="cyan">Đ/C +</Tag>;
        if (t === 'ADJUST_OUT') return <Tag color="volcano">Đ/C -</Tag>;
        if (t === 'STOCK') return <Tag color="gold">TỒN</Tag>;
        return <Tag>{type}</Tag>;
      }
    },
    { title: 'Tên Sản Phẩm', dataIndex: 'product_name', key: 'product_name', render: (t) => <b>{t}</b> },
    { 
      title: 'Place / Đối tác', 
      render: (_, r) => r.position_name || r.customer_name || r.receiver_name || r.pos || '-' 
    },
    { 
      title: 'Số Lượng', 
      dataIndex: 'so_luong', 
      align: 'right', 
      width: 120,
      render: (sl, r) => {
        const t = (r.type || '').toUpperCase();
        const isAdjustOut = t === 'ADJUST_OUT';
        return (
          <span style={{ 
            color: r.type === 'STOCK' ? '#d46b08' : isAdjustOut ? '#cf1322' : 'inherit', 
            whiteSpace: 'nowrap',
            fontWeight: isAdjustOut ? 'bold' : 'normal'
          }}>
            <b>{isAdjustOut ? `-${sl?.toLocaleString()}` : sl?.toLocaleString()}</b> {r.dvt ? `(${r.dvt})` : ''}
          </span>
        );
      } 
    },
    { 
      title: 'Đơn Giá', 
      dataIndex: 'price', 
      align: 'right', 
      width: 105,
      render: (p) => <span style={{ whiteSpace: 'nowrap' }}>{p ? `${p.toLocaleString()} đ` : '-'}</span> 
    },
    { 
      title: 'Ghi Chú', 
      dataIndex: 'note', 
      key: 'note', 
      ellipsis: { showTitle: false },
      render: (note) => (
        <Tooltip placement="topLeft" title={note || ''}>
          <span style={{ cursor: 'pointer' }}>{note || '-'}</span>
        </Tooltip>
      ),
    },
    ...(filterType === 'STOCK' ? [{
      title: 'Thao Tác',
      key: 'action',
      width: 90,
      align: 'center',
      render: (_, record) => (
        <Button 
          type="primary" 
          size="small" 
          style={{ background: '#722ed1', borderColor: '#722ed1', fontWeight: 'bold' }}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenAdjustModal(record);
          }}
        >
          ✏️ Đ/C
        </Button>
      )
    }] : [])
  ];

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#001529', color: '#fff' }}>
        Đang tải thông tin đăng nhập...
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <Auth 
        onLoginSuccess={(user) => {
          setSessionUser(user);
          setSelectedUser(user.id);
        }} 
      />
    );
  }

  const currentStockQty = Number(selectedStockItem?.so_luong || 0);
  const adjustType = watchAdjustType || 'ADJUST_IN';
  const adjustQty = Number(watchQuantity || 0);
  const projectedStock = adjustType === 'ADJUST_IN' 
    ? currentStockQty + adjustQty 
    : Math.max(0, currentStockQty - adjustQty);

  return (
    <Layout style={{ minHeight: '100vh', background: '#4b8ef3', width: '100%', overflowX: 'hidden' }}>
      
      {/* HEADER: Co giãn sát 2 mép viền */}
      <Header style={{ 
        background: '#001529', 
        color: '#fff', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: isMobile ? '0 8px' : '0 24px',
        height: 'auto',
        minHeight: 56,
        flexWrap: 'wrap',
        gap: 6
      }}>
        <span style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: 'bold' }}>QUẢN LÝ KHO</span>
        
        <Flex align="center" gap={6}>
          <Tag color="blue" style={{ fontSize: 11, margin: 0, maxWidth: isMobile ? 180 : 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            👤 {sessionUser?.email?.split('@')[0] || 'User'}
          </Tag>
          <Button 
            type="primary" 
            danger 
            size="small" 
            icon={<LogoutOutlined />} 
            onClick={handleLogout}
          >
            {isMobile ? '' : 'Đăng xuất'}
          </Button>
        </Flex>
      </Header>

      {/* CONTENT: Đệm 6px trên mobile giúp tối đa hóa không gian */}
      <Content style={{ padding: isMobile ? '6px' : '16px 20px', width: '100%', boxSizing: 'border-box' }}>
        {currentView === 'HISTORY' && (
          <Flex vertical gap={isMobile ? 'small' : 'middle'} style={{ width: '100%' }}>
            
            {/* TIÊU ĐỀ & DÀN NÚT HÀNH ĐỘNG */}
            <Flex justify="space-between" align="center" wrap="wrap" gap="small">
              <Title level={isMobile ? 5 : 4} style={{ margin: 0, color: '#fff', fontSize: isMobile ? 16 : 20 }}>
                {filterType === 'STOCK' ? '📦 Tồn Kho Khả Dụng' : 'Lịch Sử Giao Dịch'}
              </Title>
              
              <Space wrap size={[6, 6]}>
                <Button 
                  size={isMobile ? 'small' : 'middle'}
                  icon={<PrinterOutlined />} 
                  onClick={() => printReportHistory({ filterType, dateRange, transactions, filteredData: filteredTransactions })}
                  style={{ background: '#faad14', color: '#fff', fontWeight: 'bold' }}
                >
                  In Báo Cáo
                </Button>
                
                <Button 
                  size={isMobile ? 'small' : 'middle'}
                  icon={<FileExcelOutlined />} 
                  onClick={() => exportExcelReportHistory({ filterType, filteredData: filteredTransactions })}
                  style={{ background: '#13c2c2', color: '#fff', fontWeight: 'bold' }}
                >
                  Xuất Excel
                </Button>

                <Button 
                  type="primary" 
                  size={isMobile ? 'small' : 'middle'}
                  style={{ background: '#52c41a' }} 
                  icon={<ArrowDownOutlined />} 
                  onClick={() => setCurrentView('IMPORT')}
                >
                  Nhập Kho
                </Button>
                
                <Button 
                  type="primary" 
                  danger 
                  size={isMobile ? 'small' : 'middle'}
                  icon={<ArrowUpOutlined />} 
                  onClick={() => setCurrentView('EXPORT')}
                >
                  Xuất Kho
                </Button>
              </Space>
            </Flex>

            {/* KHUNG TÍM CHÍNH */}
            <Card 
              variant="borderless" 
              bodyStyle={{ padding: isMobile ? '8px' : '16px' }}
              style={{ background: '#9e2782', borderRadius: '8px', width: '100%' }}
            >
              <Flex vertical gap="small">
                
                {/* DÒNG BỘ LỌC CHÍNH */}
                <Flex justify="space-between" wrap="wrap" gap="small" align="center">
                  <Flex wrap="wrap" gap="small" style={{ width: isMobile ? '100%' : 'auto' }}>
                    <Select 
                      value={filterType} 
                      onChange={(val) => {
                        setFilterType(val);
                        setSearchTicket(null);
                      }} 
                      style={{ width: isMobile ? '100%' : 160, fontWeight: 'bold' }} 
                      options={[
                        { label: 'Tất cả GD', value: 'ALL' },
                        { label: '📥 Nhập kho', value: 'IN' },
                        { label: '📤 Xuất kho', value: 'OUT' },
                        { label: '➕ Đ/C Tăng', value: 'ADJUST_IN' },
                        { label: '➖ Đ/C Giảm', value: 'ADJUST_OUT' },
                        { label: '📦 Tồn kho (> 0)', value: 'STOCK' }
                      ]} 
                    />

                    <RangePicker 
                      value={dateRange} 
                      onChange={setDateRange} 
                      format="YYYY-MM-DD"
                      placeholder={['Từ ngày', 'Đến ngày']}
                      style={{ width: isMobile ? '100%' : 240 }} 
                      allowClear 
                    />
                  </Flex>

                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={handleResetFilters} 
                    loading={loading}
                    style={{ width: isMobile ? '100%' : 'auto' }}
                  >
                    Làm mới
                  </Button>
                </Flex>

                {/* BỘ LỌC CHI TIẾT TRONG KHUNG TRẮNG */}
                <Card size="small" bodyStyle={{ padding: isMobile ? '8px' : '12px' }} style={{ background: '#ffffff', borderRadius: '6px' }}>
                  <Row gutter={[8, 8]}>
                    <Col xs={24} sm={12} md={6}>
                      <AutoComplete
                        allowClear
                        placeholder="🔍 Nhập hoặc chọn Sản Phẩm..." 
                        style={{ width: '100%' }}
                        value={searchProduct}
                        onChange={(val) => setSearchProduct(val)}
                        onSelect={(val) => setSearchProduct(val)}
                        onSearch={(val) => setSearchProduct(val)}
                        options={distinctOptions.products}
                        filterOption={(inputValue, option) =>
                          (option?.value ?? '').toLowerCase().includes((inputValue || '').toLowerCase())
                        }
                      />
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                      <Select 
                        showSearch
                        allowClear
                        placeholder="🏢 Chọn Khách hàng..." 
                        style={{ width: '100%' }}
                        value={searchCustomer}
                        onChange={setSearchCustomer}
                        options={distinctOptions.customers}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                      <Select 
                        showSearch
                        allowClear
                        placeholder="📍 Chọn Vị trí kho..." 
                        style={{ width: '100%' }}
                        value={searchPosition}
                        onChange={setSearchPosition}
                        options={distinctOptions.positions}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                      <Select 
                        showSearch
                        allowClear
                        placeholder="🚚 Chọn Biển số xe..." 
                        style={{ width: '100%' }}
                        value={searchVehicle}
                        onChange={setSearchVehicle}
                        options={distinctOptions.vehicles}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Col>

                    {(filterType === 'OUT' || filterType === 'ALL' || filterType === 'ADJUST_OUT') && (
                      <Col xs={24} sm={12} md={6}>
                        <Select 
                          showSearch
                          allowClear
                          placeholder="👤 Chọn Người nhận..." 
                          style={{ width: '100%' }}
                          value={searchReceiver}
                          onChange={setSearchReceiver}
                          options={distinctOptions.receivers}
                          filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                        />
                      </Col>
                    )}

                    <Col xs={24} sm={12} md={6}>
                      <Select 
                        showSearch
                        allowClear
                        placeholder={
                          filterType === 'OUT' 
                            ? '📄 Số phiếu xuất...' 
                            : filterType === 'IN' 
                            ? '📄 Số phiếu nhập...' 
                            : '📄 Số phiếu...'
                        } 
                        style={{ width: '100%' }}
                        value={searchTicket}
                        onChange={setSearchTicket}
                        options={distinctOptions.tickets}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Col>
                  </Row>
                </Card>

                {/* BẢNG DỮ LIỆU */}
                <Table 
                  rowKey="id" 
                  size={isMobile ? 'small' : 'middle'}
                  dataSource={filteredTransactions} 
                  columns={columns} 
                  loading={loading}
                  scroll={{ x: 'max-content' }}
                  onRow={(record) => ({
                    onDoubleClick: () => {
                      if (filterType === 'STOCK') {
                        handleOpenAdjustModal(record);
                      }
                    },
                    style: {
                      cursor: filterType === 'STOCK' ? 'pointer' : 'default',
                    },
                  })}
                  pagination={{ 
                    defaultPageSize: 20,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    showSizeChanger: !isMobile,
                    simple: isMobile,
                    showTotal: isMobile ? undefined : (total, range) => `${range[0]}-${range[1]} / Tổng ${total} dòng`
                  }}
                  style={{ borderRadius: '6px', overflow: 'hidden' }}
                />

              </Flex>
            </Card>

            {/* TIẾN ĐỘ GOM ĐỦ CONT (MỤC TIÊU: 2.800 THÙNG) */}
            <Card 
              size="small" 
              style={{ 
                background: '#002329', 
                border: '1px solid #13c2c2', 
                borderRadius: '8px', 
                marginBottom: '8px' 
              }}
            >
              <Flex justify="space-between" align="center" wrap="wrap" gap="small">
                <div>
                  <span style={{ color: '#87e8de', fontSize: isMobile ? 12 : 13 }}>
                    🚢 Tiến độ Cont (Mục tiêu: 2.800 thùng):
                  </span>
                  <div style={{ color: '#fff', fontSize: isMobile ? 15 : 17, fontWeight: 'bold' }}>
                    Đã gom: <span style={{ color: '#52c41a' }}>{summaryStats.totalQty.toLocaleString()}</span> / 2.800 thùng
                    <span style={{ fontSize: 13, color: '#13c2c2', marginLeft: 8 }}>
                      ({(summaryStats.totalNetWeight || 0).toLocaleString()} kg Net)
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                  <span style={{ color: '#ffccc7', fontSize: isMobile ? 12 : 13 }}>Còn thiếu để đủ cont:</span>
                  <div style={{ color: '#ff4d4f', fontSize: isMobile ? 16 : 18, fontWeight: 'bold' }}>
                    {Math.max(0, 2800 - summaryStats.totalQty).toLocaleString()} thùng
                    <span style={{ fontSize: 13, color: '#faad14', marginLeft: 6 }}>
                      (~{Math.max(0, Math.round((2800 - summaryStats.totalQty) * 8.8)).toLocaleString()} kg)
                    </span>
                  </div>
                </div>
              </Flex>

              {/* Thanh phần trăm tiến độ */}
              <div style={{ marginTop: 8, background: '#00474f', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${Math.min(100, Math.round((summaryStats.totalQty / 2800) * 100))}%`, 
                    background: summaryStats.totalQty >= 2800 ? '#52c41a' : '#13c2c2', 
                    height: '100%',
                    transition: 'width 0.3s ease'
                  }} 
                />
              </div>
              <div style={{ textAlign: 'right', color: '#87e8de', fontSize: 11, marginTop: 4 }}>
                Đạt {Math.round((summaryStats.totalQty / 2800) * 100)}% cont
              </div>
            </Card>

            {/* THỐNG KÊ TỔNG QUAN */}
            <Card 
              size="small" 
              style={{ 
                background: '#f6ffed', 
                border: '1px solid #b7eb8f', 
                borderRadius: '6px' 
              }}
            >
              <Flex justify="space-around" align="center" wrap="wrap" gap="small">
                <div>
                  <span style={{ color: '#595959', fontSize: isMobile ? 12 : 14 }}>📋 Dòng: </span>
                  <b style={{ fontSize: isMobile ? '14px' : '16px', color: '#1890ff' }}>
                    {summaryStats.totalRows.toLocaleString()}
                  </b>
                </div>

                <div>
                  <span style={{ color: '#595959', fontSize: isMobile ? 12 : 14 }}>📦 Tổng số lượng: </span>
                  <b style={{ fontSize: isMobile ? '15px' : '18px', color: '#52c41a' }}>
                    {summaryStats.totalQty.toLocaleString()}
                  </b>
                </div>

                <div>
                  <span style={{ color: '#595959', fontSize: isMobile ? 12 : 14 }}>⚖️ Tổng Net: </span>
                  <b style={{ fontSize: isMobile ? '15px' : '18px', color: '#13c2c2' }}>
                    {(summaryStats.totalNetWeight || 0).toLocaleString()} kg
                  </b>
                </div>

                {summaryStats.totalPrice > 0 && (
                  <div>
                    <span style={{ color: '#595959', fontSize: isMobile ? 12 : 14 }}>💰 Tổng tiền: </span>
                    <b style={{ fontSize: isMobile ? '15px' : '18px', color: '#fa8c16' }}>
                      {summaryStats.totalPrice.toLocaleString()} đ
                    </b>
                  </div>
                )}
              </Flex>
            </Card> 

          </Flex>
        )}

        {currentView === 'IMPORT' && (
          <ImportStock 
            selectedUser={selectedUser} 
            onBack={() => { setCurrentView('HISTORY'); fetchData(selectedUser); }} 
          />
        )}

        {currentView === 'EXPORT' && (
          <ExportStock 
            selectedUser={selectedUser} 
            onBack={() => { setCurrentView('HISTORY'); fetchData(selectedUser); }} 
          />
        )}

        {/* MODAL ĐIỀU CHỈNH TĂNG / GIẢM */}
        <Modal
          title={`⚖️ Đ/C: ${selectedStockItem?.product_name || ''}`}
          open={isAdjustModalOpen}
          onCancel={() => setIsAdjustModalOpen(false)}
          onOk={() => form.submit()}
          confirmLoading={adjustLoading}
          okText="Lưu phiếu"
          cancelText="Hủy"
          width={isMobile ? '95%' : 520}
        >
          <div style={{ marginBottom: 12, background: '#f5f5f5', padding: 10, borderRadius: 6 }}>
            <div>Vị trí: <b>{selectedStockItem?.position_name || selectedStockItem?.pos || 'Mặc định'}</b></div>
            <div style={{ marginTop: 4 }}>
              Tồn hiện tại: <b style={{ color: '#d46b08', fontSize: 14 }}>{currentStockQty.toLocaleString()} {selectedStockItem?.dvt}</b>
            </div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #d9d9d9' }}>
              Tồn sau điều chỉnh: {' '}
              <b style={{ color: adjustType === 'ADJUST_IN' ? '#389e0d' : '#cf1322', fontSize: 15 }}>
                {projectedStock.toLocaleString()} {selectedStockItem?.dvt}
              </b>
              {adjustType === 'ADJUST_OUT' && adjustQty > currentStockQty && (
                <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>
                  ⚠️ Số lượng giảm lớn hơn số tồn hiện có!
                </div>
              )}
            </div>
          </div>

          <Form form={form} layout="vertical" onFinish={handleSaveAdjustment}>
            <Form.Item name="adjust_type" label="Loại điều chỉnh" rules={[{ required: true }]}>
              <Radio.Group buttonStyle="solid" style={{ width: '100%', display: 'flex' }}>
                <Radio.Button value="ADJUST_IN" style={{ flex: 1, textAlign: 'center', color: '#389e0d' }}>➕ TĂNG</Radio.Button>
                <Radio.Button value="ADJUST_OUT" style={{ flex: 1, textAlign: 'center', color: '#cf1322' }}>➖ GIẢM</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item 
              name="quantity" 
              label="Số lượng điều chỉnh"
              rules={[
                { required: true, message: 'Vui lòng nhập số lượng!' },
                { 
                  validator: (_, value) => {
                    if (value <= 0) return Promise.reject(new Error('Số lượng phải lớn hơn 0!'));
                    if (adjustType === 'ADJUST_OUT' && value > currentStockQty) {
                      return Promise.reject(new Error(`Số lượng giảm không được vượt quá số tồn (${currentStockQty})!`));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <InputNumber 
                min={1} 
                max={adjustType === 'ADJUST_OUT' ? currentStockQty : undefined}
                style={{ width: '100%' }} 
                placeholder="Nhập số lượng..." 
              />
            </Form.Item>

            <Form.Item name="note" label="Lý do điều chỉnh">
              <Input.TextArea rows={2} placeholder="Ví dụ: Kiểm kê thừa/thiếu..." />
            </Form.Item>
          </Form>
        </Modal>

      </Content>
    </Layout>
  );
}