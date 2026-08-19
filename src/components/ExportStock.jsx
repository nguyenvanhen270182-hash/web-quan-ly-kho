import React, { useEffect, useState, useMemo } from 'react';
import { 
  Card, Form, Input, InputNumber, DatePicker, Button, 
  Table, Modal, Row, Col, Typography, Flex, Tag, Space, AutoComplete, Alert, message 
} from 'antd';
import { 
  LeftOutlined, PlusCircleOutlined, DeleteOutlined, 
  SaveOutlined, RedoOutlined, HistoryOutlined, SearchOutlined,
  FilePdfOutlined, FileExcelOutlined, PrinterOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';
import { exportPdfPhieuXuat, exportExcelPhieuXuat } from '../utils/exportWebUtils';

const { Text, Title } = Typography;

export default function ExportStock({ selectedUser, onBack }) {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const [loading, setLoading] = useState(false);
  const [savedData, setSavedData] = useState(null);

  // Gợi ý AutoComplete
  const [giamSatOptions, setGiamSatOptions] = useState([]);
  const [receiverList, setReceiverList] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);

  // Modal & Tồn kho
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  const [availableStock, setAvailableStock] = useState([]);
  const [stockSearchText, setStockSearchText] = useState('');
  const [selectedStockRows, setSelectedStockRows] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const formItems = Form.useWatch('items', form) || [];

  // Bóc tách ghi chú
  const parseNoteInfo = (noteStr) => {
    if (!noteStr) return {};
    const addressMatch = noteStr.match(/\|address:\s*([^|]+)/);
    const phoneMatch = noteStr.match(/\|phone:\s*([^|]+)/);
    const xeMatch = noteStr.match(/\|Xe:\s*([^|]+)/);
    const gsMatch = noteStr.match(/\|GS:\s*([^|]+)/);

    const clean = (val) => (val && val !== 'null' && val !== 'nulll' ? val.trim() : '');

    return {
      address: clean(addressMatch ? addressMatch[1] : ''),
      phone: clean(phoneMatch ? phoneMatch[1] : ''),
      xe: clean(xeMatch ? xeMatch[1] : ''),
      gs: clean(gsMatch ? gsMatch[1] : '')
    };
  };

  // 1. TẢI DỮ LIỆU GỢI Ý & TÍNH SỐ PHIẾU XUẤT TIẾP THEO
  const initFormData = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_transaction')
        .select('*')
        .eq('user_id', selectedUser)
        .order('id', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const outTickets = data
          .filter((t) => t.type === 'OUT' && t.so_phieu && t.so_phieu.toUpperCase().startsWith('PX'))
          .map((t) => {
            const numPart = t.so_phieu.replace(/\D/g, '');
            return numPart ? parseInt(numPart, 10) : 0;
          });

        const maxNum = outTickets.length > 0 ? Math.max(...outTickets) : 0;
        form.setFieldsValue({ so_phieu: `PX${String(maxNum + 1).padStart(3, '0')}` });

        const gsSet = new Set();
        const xeSet = new Set();
        const receiverMap = new Map();

        data.forEach((row) => {
          const parsed = parseNoteInfo(row.note);
          if (parsed.gs) gsSet.add(parsed.gs);
          if (parsed.xe) xeSet.add(parsed.xe);

          if (row.receiver_name && !receiverMap.has(row.receiver_name.trim().toLowerCase())) {
            receiverMap.set(row.receiver_name.trim().toLowerCase(), {
              value: row.receiver_name,
              label: row.receiver_name,
              address: parsed.address,
              phone: parsed.phone,
              receiver_code: row.receiver_code || 'R2'
            });
          }
        });

        setGiamSatOptions(Array.from(gsSet).map((gs) => ({ value: gs })));
        setVehicleOptions(Array.from(xeSet).map((xe) => ({ value: xe })));
        setReceiverList(Array.from(receiverMap.values()));
      } else {
        form.setFieldsValue({ so_phieu: 'PX001' });
      }
    } catch (err) {
      form.setFieldsValue({ so_phieu: 'PX001' });
    }
  };

  // 2. CHỌN NGƯỜI NHẬN -> TỰ ĐIỀN ĐỊA CHỈ & SĐT
  const handleSelectReceiver = (val) => {
    const found = receiverList.find((r) => r.value.toLowerCase() === val.toLowerCase());
    if (found) {
      form.setFieldsValue({
        address: found.address || '',
        phone: found.phone || '',
        receiver_code: found.receiver_code || 'R2'
      });
    }
  };

  // 3. TÍNH TOÁN TỒN KHO VÀ GIỮ LẠI NGÀY NHẬP GỐC
  const fetchAvailableStock = async () => {
    setLoadingStock(true);
    try {
      const { data, error } = await supabase
        .from('stock_transaction')
        .select('*')
        .eq('user_id', selectedUser)
        .order('id', { ascending: true });

      if (error) throw error;

      const stockMap = new Map();

      (data || []).forEach((row) => {
        const lotKey = row.type === 'IN' ? (row.ref_uuid || row.stock_uuid || row.uuid) : row.stock_uuid;
        if (!lotKey) return;

        if (!stockMap.has(lotKey)) {
          stockMap.set(lotKey, {
            stock_uuid: lotKey,
            product_name: row.product_name || '',
            product_code: row.product_code || 'PRO0',
            customer_name: row.customer_name || '',
            customer_code: row.customer_code || 'CUS0',
            position_name: row.position_name || '',
            position_code: row.position_code || 'POS0',
            lot_no: row.lot_no || '',
            dvt: row.dvt || 'Thùng',
            net: Number(row.net || 0),
            import_date: row.type === 'IN' ? row.date : '',
            in_qty: 0,
            out_qty: 0,
            mfg: row.mfg || '',
            exp: row.exp || ''
          });
        }

        const item = stockMap.get(lotKey);
        if (row.type === 'IN') {
          item.in_qty += Number(row.so_luong || 0);
          if (row.date) item.import_date = row.date;
          if (row.product_name) item.product_name = row.product_name;
          if (row.customer_name) item.customer_name = row.customer_name;
          if (row.position_name) item.position_name = row.position_name;
          if (row.net) item.net = Number(row.net);
          if (row.dvt) item.dvt = row.dvt;
        } else if (row.type === 'OUT') {
          item.out_qty += Number(row.so_luong || 0);
        }
      });

      const stockAvailableList = [];
      stockMap.forEach((val) => {
        const ton = val.in_qty - val.out_qty;
        if (ton > 0) {
          stockAvailableList.push({
            ...val,
            key: val.stock_uuid,
            ton_sl: ton,
            ton_net: Math.round(ton * val.net * 100) / 100
          });
        }
      });

      setAvailableStock(stockAvailableList);
    } catch (err) {
      messageApi.error('Lỗi tính tồn: ' + err.message);
    }
    setLoadingStock(false);
  };

  useEffect(() => {
    initFormData();
  }, [selectedUser]);

  const handleOpenStockModal = () => {
    setIsModalOpen(true);
    setSelectedStockRows([]);
    setSelectedRowKeys([]);
    fetchAvailableStock();
  };

  // 4. THÊM CÁC DÒNG ĐÃ CHỌN VÀO FORM
  const handleAddSelectedStockToForm = () => {
    if (selectedStockRows.length === 0) {
      messageApi.warning('Vui lòng chọn ít nhất 1 mặt hàng tồn!');
      return;
    }

    const currentItems = form.getFieldValue('items') || [];
    
    const newItems = selectedStockRows.map((stock) => ({
      stock_uuid: stock.stock_uuid,
      product_name: stock.product_name,
      product_code: stock.product_code,
      customer_name: stock.customer_name,
      customer_code: stock.customer_code,
      position_name: stock.position_name,
      position_code: stock.position_code,
      lot_no: stock.lot_no,
      dvt: stock.dvt,
      net: stock.net,
      import_date: stock.import_date || stock.date || '',
      origin_ton: Number(stock.ton_sl),
      so_luong: Number(stock.ton_sl),
      tong_net: Math.round(stock.ton_sl * stock.net * 100) / 100,
      price: 0,
      mfg: stock.mfg ? dayjs(stock.mfg) : null,
      exp: stock.exp ? dayjs(stock.exp) : null,
    }));

    form.setFieldsValue({ items: [...currentItems, ...newItems] });
    setIsModalOpen(false);
  };

  // 5. CẢNH BÁO VƯỢT TỒN
  const handleQuantityChange = (val, fieldIndex) => {
    const items = form.getFieldValue('items') || [];
    const item = items[fieldIndex];
    if (!item) return;

    const net = Number(item.net || 0);
    const originTon = Number(item.origin_ton || 0);
    let sl = Number(val || 0);

    if (originTon > 0 && sl > originTon) {
      messageApi.open({
        type: 'warning',
        content: `⚠️ Đã nhập quá tồn kho! Mặt hàng "${item.product_name || 'này'}" chỉ còn tồn tối đa ${originTon} ${item.dvt || 'Thùng'}.`,
        duration: 3,
      });
      sl = originTon;
    }

    const tongNet = Math.round(net * sl * 100) / 100;
    items[fieldIndex] = {
      ...item,
      so_luong: sl,
      tong_net: tongNet
    };
    form.setFieldsValue({ items: [...items] });
  };

  // 6. LƯU PHIẾU XUẤT VÀO SUPABASE
  const handleSave = async (values) => {
    if (!values.items || values.items.length === 0) {
      messageApi.warning('Vui lòng chọn ít nhất 1 mặt hàng để xuất!');
      return;
    }

    for (let i = 0; i < values.items.length; i++) {
      const it = values.items[i];
      const origin = Number(it.origin_ton || 0);
      const qty = Number(it.so_luong || 0);

      if (qty <= 0) {
        messageApi.error(`Dòng #${i + 1} (${it.product_name}): Số lượng xuất phải lớn hơn 0!`);
        return;
      }

      if (origin > 0 && qty > origin) {
        messageApi.error(`Dòng #${i + 1} (${it.product_name}): Xuất ${qty} vượt tồn khả dụng (${origin})!`);
        return;
      }
    }

    setLoading(true);
    const dateFormatted = values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
    const exportBatchUuid = `PX_${crypto.randomUUID()}`;

    const soPhieu = values.so_phieu || '';
    const address = values.address || 'null';
    const sdt = values.phone || 'null';
    const soXe = values.so_xe || 'null';
    const nguoiGiamSat = values.giam_sat || 'null';
    const userNote = values.note || 'null';

    const fullExportNote = `PX: ${soPhieu} |address: ${address} |phone: ${sdt} |Xe: ${soXe} |GS: ${nguoiGiamSat} |Note: ${userNote}`;

    const insertPayload = values.items.map((item) => {
      const lineUuid = `TX_${crypto.randomUUID()}`;

      return {
        user_id: selectedUser,
        type: 'OUT',
        date: dateFormatted,
        so_phieu: values.so_phieu,
        ref_so_phieu: values.so_phieu,
        receiver_name: values.receiver_name || '',
        receiver_code: values.receiver_code || 'R2',
        customer_name: item.customer_name || '',
        customer_code: item.customer_code || 'CUS0',
        position_name: item.position_name || '',
        position_code: item.position_code || 'POS0',
        lot_no: item.lot_no || '',
        product_name: item.product_name,
        product_code: item.product_code || 'PRO0',
        dvt: item.dvt || 'Thùng',
        so_luong: Number(item.so_luong || 0),
        net: Number(item.net || 0),
        tong_net: Number(item.tong_net || 0),
        price: Number(item.price || 0),
        mfg: item.mfg ? (dayjs.isDayjs(item.mfg) ? item.mfg.format('YYYY-MM-DD') : item.mfg) : '',
        exp: item.exp ? (dayjs.isDayjs(item.exp) ? item.exp.format('YYYY-MM-DD') : item.exp) : '',
        note: fullExportNote,
        uuid: lineUuid,
        ref_uuid: exportBatchUuid,
        stock_uuid: item.stock_uuid,
        created_at: new Date().toISOString()
      };
    });

    const { error } = await supabase.from('stock_transaction').insert(insertPayload);

    if (error) {
      messageApi.error('Lỗi xuất kho: ' + error.message);
    } else {
      messageApi.success(`Đã xuất thành công ${insertPayload.length} dòng hàng!`);
      
      setSavedData({
        soPhieu: values.so_phieu,
        giamSat: values.giam_sat || '',
        soXe: values.so_xe || '',
        ngayGiaoDich: dateFormatted,
        nguoiNhan: values.receiver_name || '',
        items: values.items
      });
    }
    setLoading(false);
  };

  const handleClearForm = () => {
    form.resetFields();
    setSavedData(null);
    initFormData();
  };

  const existingStockUuids = formItems.map((it) => it?.stock_uuid).filter(Boolean);
  const totalQty = formItems.reduce((sum, item) => sum + Number(item?.so_luong || 0), 0);
  const totalNet = formItems.reduce((sum, item) => sum + Number(item?.tong_net || 0), 0);

  const stockColumns = [
    { title: 'Tên Sản Phẩm', dataIndex: 'product_name', key: 'product_name', render: (t) => <b>{t}</b> },
    { title: 'Chủ Hàng (NCC)', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'Vị Trí', dataIndex: 'position_name', key: 'position_name' },
    { title: 'ĐVT', dataIndex: 'dvt', key: 'dvt', width: 80, align: 'center' },
    { title: 'Net', dataIndex: 'net', key: 'net', width: 80, align: 'right' },
    { 
      title: 'Tồn Khả Dụng', 
      dataIndex: 'ton_sl', 
      key: 'ton_sl', 
      align: 'right', 
      render: (sl, r) => (
        <Tag color={existingStockUuids.includes(r.stock_uuid) ? 'default' : 'green'} style={{ fontWeight: 'bold' }}>
          {sl} {r.dvt} ({r.ton_net} kg)
        </Tag>
      )
    },
    {
      title: 'Trạng thái',
      key: 'status',
      align: 'center',
      render: (_, r) => existingStockUuids.includes(r.stock_uuid) ? <Tag color="orange">Đã chọn</Tag> : <Tag color="blue">Sẵn sàng</Tag>
    }
  ];

  const filteredAvailableStock = availableStock.filter((s) => {
    const term = stockSearchText.toLowerCase().trim();
    return !term || 
      s.product_name?.toLowerCase().includes(term) || 
      s.customer_name?.toLowerCase().includes(term) || 
      s.position_name?.toLowerCase().includes(term);
  });
    // Gom nhóm tổng số lượng & Kgs theo từng Tên Sản Phẩm (kèm Net)
    const groupedSummary = useMemo(() => {
      const map = new Map();

      formItems.forEach((item) => {
        if (!item?.product_name) return;
        const name = item.product_name.trim();
        const net = Number(item.net || 0);
        const key = `${name}___${net}`; // Phân biệt theo Tên + Net
        const sl = Number(item.so_luong || 0);
        const kgs = Number(item.tong_net || Math.round(sl * net * 100) / 100);

        if (!map.has(key)) {
          map.set(key, {
            product_name: name,
            dvt: item.dvt || 'Thùng',
            net: net,
            total_sl: 0,
            total_kgs: 0,
          });
        }

        const current = map.get(key);
        current.total_sl += sl;
        current.total_kgs += kgs;
      });

      return Array.from(map.values());
    }, [formItems]);
  return (
    <Card 
      title="PHIẾU XUẤT KHO" 
      extra={<Button icon={<LeftOutlined />} onClick={onBack}>Quay lại</Button>}
      style={{ maxWidth: 1150, margin: '0 auto', background: '#ffffff', borderRadius: '12px' }}
    >
      {contextHolder}

      <Form 
        form={form} 
        layout="vertical" 
        onFinish={handleSave}
        initialValues={{
          date: dayjs(),
          items: []
        }}
      >
        <Form.Item name="receiver_code" hidden><Input /></Form.Item>

        {/* HEADER PHIẾU XUẤT */}
        <Card size="small" title="Thông tin phiếu xuất & Người nhận" style={{ background: '#f5faff', borderColor: '#91caff', marginBottom: 16 }}>
          <Row gutter={12}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="date" label="Ngày xuất" rules={[{ required: true, message: 'Chọn ngày' }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="so_phieu" label="Số Phiếu Xuất" rules={[{ required: true, message: 'Nhập số phiếu' }]}>
                <Input placeholder="VD: PX001" style={{ fontWeight: 'bold' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="giam_sat" label="Giám sát / Thủ kho">
                <AutoComplete
                  options={giamSatOptions}
                  placeholder="Chọn / Gõ tên giám sát"
                  filterOption={(input, option) => option.value.toUpperCase().includes(input.toUpperCase())}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="receiver_name" label="Khách hàng / Người nhận" rules={[{ required: true, message: 'Nhập người nhận' }]}>
                <AutoComplete
                  options={receiverList}
                  onSelect={handleSelectReceiver}
                  placeholder="Chọn để tự điền địa chỉ, SĐT"
                  filterOption={(input, option) => option.value.toUpperCase().includes(input.toUpperCase())}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="address" label="Địa chỉ giao hàng">
                <Input placeholder="Quảng Ngãi, TP.HCM..." />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="phone" label="Số điện thoại">
                <Input placeholder="0909..." />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="so_xe" label="Số xe tải">
                <AutoComplete
                  options={vehicleOptions}
                  placeholder="51C-79632"
                  filterOption={(input, option) => option.value.toUpperCase().includes(input.toUpperCase())}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="note" label="Ghi chú phiếu xuất" style={{ marginBottom: 0 }}>
                <Input placeholder="VD: xuất chiều, kiểm đếm kỹ..." />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* NÚT THÊM TỒN KHO */}
        <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>Danh Sách Hàng Xuất</Title>
          <Button 
            type="primary" 
            icon={<PlusCircleOutlined />} 
            onClick={handleOpenStockModal}
            style={{ background: '#1890ff', fontWeight: 'bold' }}
          >
            + Chọn THÊM Xuất (Từ Tồn Kho)
          </Button>
        </Flex>

        {/* DANH SÁCH CÁC DÒNG HÀNG XUẤT */}
        <Form.List name="items">
          {(fields, { remove }) => (
            <Flex vertical gap="middle" style={{ width: '100%' }}>
              {fields.length === 0 && (
                <Card style={{ textAlign: 'center', background: '#fafafa', borderStyle: 'dashed' }}>
                  <Text type="secondary">Chưa có dòng hàng nào. Bấm nút <b>"+ Chọn THÊM Xuất"</b> ở trên để chọn hàng từ kho.</Text>
                </Card>
              )}

              {fields.map(({ key, name, ...restField }, index) => {
                const itemData = formItems[name] || {};
                const originTon = Number(itemData.origin_ton || 0);
                const currentSl = Number(itemData.so_luong || 0);
                const remainingTon = originTon - currentSl;

                return (
                  <Card 
                    key={key} 
                    size="small" 
                    title={
                      <Space wrap>
                        <Text strong>#{index + 1}. {itemData.product_name}</Text>
                        <Tag color="blue">Chủ: {itemData.customer_name || 'N/A'}</Tag>
                        <Tag color="cyan">Vị trí: {itemData.position_name || 'N/A'}</Tag>
                        <Tag color={remainingTon < 0 ? 'red' : 'orange'} style={{ fontWeight: 'bold' }}>
                          Tồn còn lại: {remainingTon} / {originTon} {itemData.dvt}
                        </Tag>
                      </Space>
                    }
                    extra={
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)}>
                        Xóa
                      </Button>
                    }
                    style={{ background: '#fcfcfc', border: '1px solid #d9d9d9' }}
                  >
                    <Form.Item {...restField} name={[name, 'product_name']} hidden><Input /></Form.Item>
                    <Form.Item {...restField} name={[name, 'product_code']} hidden><Input /></Form.Item>
                    <Form.Item {...restField} name={[name, 'customer_name']} hidden><Input /></Form.Item>
                    <Form.Item {...restField} name={[name, 'customer_code']} hidden><Input /></Form.Item>
                    <Form.Item {...restField} name={[name, 'position_name']} hidden><Input /></Form.Item>
                    <Form.Item {...restField} name={[name, 'position_code']} hidden><Input /></Form.Item>
                    <Form.Item {...restField} name={[name, 'lot_no']} hidden><Input /></Form.Item>
                    <Form.Item {...restField} name={[name, 'origin_ton']} hidden><InputNumber /></Form.Item>
                    <Form.Item {...restField} name={[name, 'stock_uuid']} hidden><Input /></Form.Item>
                    <Form.Item {...restField} name={[name, 'import_date']} hidden><Input /></Form.Item>

                    <Row gutter={10}>
                      <Col xs={12} md={4}>
                        <Form.Item {...restField} name={[name, 'dvt']} label="ĐVT">
                          <Input disabled />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={4}>
                        <Form.Item {...restField} name={[name, 'net']} label="Net">
                          <InputNumber disabled style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={5}>
                        <Form.Item
                          {...restField}
                          name={[name, 'so_luong']}
                          label={`SL Xuất (Gốc: ${originTon})`}
                          rules={[{ required: true, message: 'Nhập SL' }]}
                        >
                          <InputNumber 
                            min={1} 
                            style={{ width: '100%', fontWeight: 'bold' }} 
                            onChange={(val) => handleQuantityChange(val, name)} 
                            onBlur={(e) => handleQuantityChange(e.target.value, name)}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={5}>
                        <Form.Item {...restField} name={[name, 'tong_net']} label="Tổng Net Xuất (Kg)">
                          <InputNumber disabled style={{ width: '100%', fontWeight: 'bold', color: '#cf1322' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={6}>
                        <Form.Item {...restField} name={[name, 'price']} label="Đơn giá xuất">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                );
              })}
            </Flex>
          )}
        </Form.List>

       {/* TỔNG KẾT VÀ NÚT LƯU */}
<Card 
  style={{ 
    marginTop: 20, 
    background: '#c9e8ae', 
    borderColor: '#91caff', 
    borderRadius: 8 
  }}
>
  <Flex vertical gap="middle">
    {/* Danh sách gom nhóm từng sản phẩm */}
    {groupedSummary.length > 0 && (
      <Flex vertical gap="small" style={{ width: '100%' }}>
        <Text strong style={{ color: '#0958d9', fontSize: 16 }}>
          📋 Chi tiết hàng xuất theo phân loại:
        </Text>
        <Flex wrap="wrap" gap="small">
          {groupedSummary.map((g, idx) => (
            <Tag 
              key={idx} 
              color="blue" 
              style={{ 
                fontSize: 15, 
                padding: '4px 10px', 
                borderRadius: 4 
              }}
            >
              <b>{g.product_name}</b> {g.net > 0 ? `(Net ${g.net})` : ''}:{' '}
              <span style={{ color: '#cf1322', fontWeight: 'bold' }}>
                {g.total_sl.toLocaleString()} {g.dvt}
              </span>{' '}
              ({Math.round(g.total_kgs * 100) / 100} kg)
            </Tag>
          ))}
        </Flex>
      </Flex>
    )}

    {/* Dòng tổng cộng chung */}
    <div style={{ textAlign: 'center', borderTop: '1px dashed #adc6ff', paddingTop: 10 }}>
      <Title level={4} style={{ margin: 0, color: '#096dd9' }}>
        Tổng xuất: {totalQty.toLocaleString()} Thùng / Kiện | {Math.round(totalNet * 100) / 100} Kgs
      </Title>
    </div>

    {/* Nút lưu */}
    <Button 
      type="primary" 
      htmlType="submit" 
      icon={<SaveOutlined />} 
      loading={loading} 
      block 
      style={{ 
        height: 48, 
        fontSize: 16, 
        fontWeight: 'bold', 
        background: '#388E3C' 
      }}
    >
      LƯU PHIẾU XUẤT KHO
    </Button>
  </Flex>
</Card>
      </Form>

      {/* MODAL CHỌN TỒN KHO */}
      <Modal
        title="CHỌN HÀNG TỪ TỒN KHO KHẢ DỤNG (> 0)"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleAddSelectedStockToForm}
        okText={`Thêm (${selectedRowKeys.length}) dòng vào phiếu`}
        cancelText="Đóng"
        width={950}
      >
        <Flex vertical gap="middle" style={{ marginTop: 10 }}>
          <Input 
            placeholder="Tìm theo tên sản phẩm, chủ hàng (NCC), vị trí..." 
            prefix={<SearchOutlined />} 
            value={stockSearchText}
            onChange={(e) => setStockSearchText(e.target.value)}
            allowClear
          />

          <Table 
            rowKey="stock_uuid"
            loading={loadingStock}
            dataSource={filteredAvailableStock}
            columns={stockColumns}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedRowKeys,
              onChange: (keys, rows) => {
                setSelectedRowKeys(keys);
                setSelectedStockRows(rows);
              },
              getCheckboxProps: (record) => ({
                disabled: existingStockUuids.includes(record.stock_uuid),
              }),
            }}
            pagination={{ pageSize: 6 }}
            size="small"
          />
        </Flex>
      </Modal>

      {/* KẾT QUẢ VỪA XUẤT & BỘ NÚT IN/XUẤT FILE */}
      {savedData && (
        <Card style={{ marginTop: 20, background: '#f6ffed', borderColor: '#b7eb8f', borderRadius: 8 }}>
          <Flex vertical gap="middle">
            <Alert
              message={`✅ Đã xuất kho thành công phiếu #${savedData.soPhieu} (${savedData.items.length} dòng hàng)`}
              type="success"
              showIcon
            />
            
            <Card size="small" title="Tùy chọn in & Xuất file phiếu xuất vừa tạo" style={{ background: '#fff' }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={8}>
                  <Button 
                    type="primary" 
                    danger 
                    icon={<FilePdfOutlined />} 
                    block 
                    onClick={() => exportPdfPhieuXuat({ ...savedData, isSave: true })}
                  >
                    Xuất PDF Phiếu Xuất
                  </Button>
                </Col>
                <Col xs={24} sm={8}>
                  <Button 
                    style={{ background: '#388E3C', color: '#fff' }} 
                    icon={<FileExcelOutlined />} 
                    block 
                    onClick={() => exportExcelPhieuXuat(savedData)}
                  >
                    Xuất Excel (.xlsx)
                  </Button>
                </Col>
                <Col xs={24} sm={8}>
                  <Button 
                    icon={<PrinterOutlined />} 
                    block 
                    onClick={() => exportPdfPhieuXuat({ ...savedData, isSave: false })}
                  >
                    In Phiếu Tạm (Review)
                  </Button>
                </Col>
              </Row>
            </Card>

            <Row gutter={12}>
              <Col span={12}>
                <Button icon={<RedoOutlined />} onClick={handleClearForm} block>
                  Tạo Phiếu Xuất Mới
                </Button>
              </Col>
              <Col span={12}>
                <Button type="primary" icon={<HistoryOutlined />} onClick={onBack} block style={{ background: '#1890ff' }}>
                  📊 Xem Lịch Sử
                </Button>
              </Col>
            </Row>
          </Flex>
        </Card>
      )}
    </Card>
  );
}