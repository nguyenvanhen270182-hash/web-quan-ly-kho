import React, { useEffect, useState } from 'react';
import { 
  Card, Form, Input, InputNumber, DatePicker, Button, 
  AutoComplete, Row, Col, message, Alert, Divider, Typography, Flex 
} from 'antd';
import { 
  LeftOutlined, PlusOutlined, DeleteOutlined, 
  SaveOutlined, RedoOutlined, HistoryOutlined,
  FilePdfOutlined, FileExcelOutlined, PrinterOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';
import { exportPdfPhieuNhap, exportExcelPhieuNhap } from '../utils/exportWebUtils';

const { Text } = Typography;

export default function ImportStock({ selectedUser, onBack }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  // State lưu dữ liệu phiếu vừa lưu để xuất PDF & Excel
  const [savedData, setSavedData] = useState(null);

  // Bộ nhớ đệm danh mục để Auto-fill mã & thông số
  const [customerList, setCustomerList] = useState([]);
  const [positionList, setPositionList] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [productList, setProductList] = useState([]);

  // 1. TẢI DỮ LIỆU GỢI Ý & TÍNH SỐ PHIẾU TIẾP THEO (PN049 -> PN050)
  const initFormData = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_transaction')
        .select('*')
        .eq('user_id', selectedUser)
        .order('id', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // TÍNH SỐ PHIẾU TIẾP THEO
        const inTickets = data
          .filter((t) => t.type === 'IN' && t.so_phieu && t.so_phieu.toUpperCase().startsWith('PN'))
          .map((t) => {
            const numPart = t.so_phieu.replace(/\D/g, '');
            return numPart ? parseInt(numPart, 10) : 0;
          });

        const maxNum = inTickets.length > 0 ? Math.max(...inTickets) : 0;
        const nextTicketNo = `PN${String(maxNum + 1).padStart(3, '0')}`;
        form.setFieldsValue({ so_phieu: nextTicketNo });

        // KHÁCH HÀNG / NCC
        const cusMap = new Map();
        data.forEach((d) => {
          if (d.customer_name && !cusMap.has(d.customer_name.trim().toLowerCase())) {
            cusMap.set(d.customer_name.trim().toLowerCase(), {
              value: d.customer_name,
              code: d.customer_code || ''
            });
          }
        });
        setCustomerList(Array.from(cusMap.values()));

        // VỊ TRÍ
        const posMap = new Map();
        data.forEach((d) => {
          if (d.position_name && !posMap.has(d.position_name.trim().toLowerCase())) {
            posMap.set(d.position_name.trim().toLowerCase(), {
              value: d.position_name,
              code: d.position_code || ''
            });
          }
        });
        setPositionList(Array.from(posMap.values()));

        // SỐ XE
        const uniqueVehicles = [...new Set(data.map((d) => {
          if (!d.note) return null;
          const match = d.note.match(/\|Xe:\s*([^|]+)/);
          const val = match ? match[1].trim() : null;
          return val && val !== 'nulll' && val !== 'null' ? val : null;
        }).filter(Boolean))];
        setVehicleOptions(uniqueVehicles.map((v) => ({ value: v })));

        // SẢN PHẨM
        const prodMap = new Map();
        data.forEach((d) => {
          if (d.product_name && !prodMap.has(d.product_name.trim().toLowerCase())) {
            prodMap.set(d.product_name.trim().toLowerCase(), {
              value: d.product_name,
              code: d.product_code || '',
              dvt: d.dvt || 'Thùng',
              net: d.net || 0,
            });
          }
        });
        setProductList(Array.from(prodMap.values()));
      } else {
        form.setFieldsValue({ so_phieu: 'PN001' });
      }
    } catch (err) {
      console.error('Lỗi khởi tạo:', err.message);
    }
  };

  useEffect(() => {
    initFormData();
  }, [selectedUser]);

  // Chọn Khách hàng -> Lưu customer_code ngầm
  const handleSelectCustomer = (val) => {
    const found = customerList.find((c) => c.value.toLowerCase() === val.toLowerCase());
    if (found) form.setFieldsValue({ customer_code: found.code });
  };

  // Chọn Vị trí -> Lưu position_code ngầm
  const handleSelectPosition = (val) => {
    const found = positionList.find((p) => p.value.toLowerCase() === val.toLowerCase());
    if (found) form.setFieldsValue({ position_code: found.code });
  };

  // Chọn Sản Phẩm -> Tự điền thông số
  const handleSelectProduct = (val, fieldIndex) => {
    const found = productList.find((p) => p.value.toLowerCase() === val.toLowerCase());
    if (found) {
      const items = form.getFieldValue('items') || [];
      const current = items[fieldIndex] || {};
      const net = found.net || 0;
      const sl = current.so_luong || 1;

      items[fieldIndex] = {
        ...current,
        product_name: found.value,
        product_code: found.code,
        dvt: found.dvt || 'Thùng',
        net: net,
        tong_net: Math.round(net * sl * 100) / 100
      };
      form.setFieldsValue({ items: [...items] });
    }
  };

  // Tính lại Tổng Net = Net * SL
  const handleItemChange = (fieldIndex) => {
    const items = form.getFieldValue('items') || [];
    const item = items[fieldIndex];
    if (item) {
      const net = Number(item.net || 0);
      const sl = Number(item.so_luong || 0);
      const tongNet = Math.round(net * sl * 100) / 100;
      form.setFieldsValue({
        items: items.map((row, idx) => (idx === fieldIndex ? { ...row, tong_net: tongNet } : row))
      });
    }
  };

  // 2. LƯU BẢN GHI VÀ GÁN DỮ LIỆU XUẤT FILE
  const handleSave = async (values) => {
    if (!values.items || values.items.length === 0) {
      message.warning('Vui lòng thêm ít nhất 1 dòng hàng!');
      return;
    }

    setLoading(true);
    const dateFormatted = values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

    const insertPayload = values.items.map((item) => {
      const lineNote = item.note ? item.note.trim() : '';
      const vehiclePart = values.so_xe ? `|Xe: ${values.so_xe.trim()}` : '';
      const finalNote = ` Note: ${lineNote} ${vehiclePart}`.trim();

      const lineUuid = `TX_${crypto.randomUUID()}`;
      const stockUuid = `PN_${crypto.randomUUID()}`;

      return {
        user_id: selectedUser,
        type: 'IN',
        date: dateFormatted,
        so_phieu: values.so_phieu,
        
        customer_name: values.customer_name || null,
        customer_code: values.customer_code || '',
        
        position_name: values.position_name || null,
        position_code: values.position_code || '',
        
        lot_no: values.lot_no || '',
        
        product_name: item.product_name,
        product_code: item.product_code || '',
        dvt: item.dvt || 'Thùng',
        so_luong: Number(item.so_luong || 0),
        net: Number(item.net || 0),
        tong_net: Number(item.tong_net || 0),
        price: Number(item.price || 0),
        mfg: item.mfg ? item.mfg.format('YYYY-MM-DD') : '',
        exp: item.exp ? item.exp.format('YYYY-MM-DD') : '',
        note: finalNote,
        
        uuid: lineUuid,
        ref_uuid: stockUuid,
        stock_uuid: stockUuid,
        receiver_code: '',
        receiver_name: '',
        ref_so_phieu: null,
        created_at: new Date().toISOString()
      };
    });

    const { error } = await supabase.from('stock_transaction').insert(insertPayload);

    if (error) {
      message.error('Lỗi khi lưu: ' + error.message);
    } else {
      message.success(`Đã lưu thành công ${insertPayload.length} dòng hàng!`);
      
      // Lưu toàn bộ dữ liệu phiếu vừa nhập vào state để phục vụ xuất PDF/Excel
      setSavedData({
        soPhieu: values.so_phieu,
        customerName: values.customer_name || 'All',
        soXe: values.so_xe || '',
        date: dateFormatted,
        items: values.items.map((it) => ({
          ...it,
          position_name: values.position_name,
          customer_name: values.customer_name
        }))
      });
    }
    setLoading(false);
  };

  const handleClearForm = () => {
    form.resetFields();
    setSavedData(null);
    initFormData();
  };

  return (
    <Card 
      title="PHIẾU NHẬP HÀNG CHI TIẾT" 
      extra={<Button icon={<LeftOutlined />} onClick={onBack}>Quay lại</Button>}
      style={{ maxWidth: 1150, margin: '0 auto', background: '#ffffff', borderRadius: '12px' }}
    >
      <Form 
        form={form} 
        layout="vertical" 
        onFinish={handleSave}
        initialValues={{
          date: dayjs(),
          items: [{ net: 8.8, so_luong: 1, tong_net: 8.8, price: 0, dvt: 'Thùng' }]
        }}
      >
        {/* Hidden inputs lưu Code */}
        <Form.Item name="customer_code" hidden><Input /></Form.Item>
        <Form.Item name="position_code" hidden><Input /></Form.Item>

        {/* THÔNG TIN CHUNG */}
        <Card size="small" title="Thông tin chung" style={{ background: '#fafafa', marginBottom: 16 }}>
          <Row gutter={12}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="date" label="Ngày giao dịch" rules={[{ required: true, message: 'Chọn ngày' }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="so_phieu" label="Số Phiếu" rules={[{ required: true, message: 'Nhập số phiếu' }]}>
                <Input placeholder="VD: PN049" style={{ fontWeight: 'bold' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="customer_name" label="Khách / Nhà Cung Cấp">
                <AutoComplete
                  options={customerList}
                  onSelect={handleSelectCustomer}
                  placeholder="Chọn / Nhập tên Khách"
                  filterOption={(input, option) => option.value.toUpperCase().includes(input.toUpperCase())}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={8} md={8}>
              <Form.Item name="position_name" label="Place / Vị trí">
                <AutoComplete
                  options={positionList}
                  onSelect={handleSelectPosition}
                  placeholder="Vị trí kho"
                  filterOption={(input, option) => option.value.toUpperCase().includes(input.toUpperCase())}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} md={8}>
              <Form.Item name="lot_no" label="Lot No">
                <Input placeholder="Lot No (nếu có)" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} md={8}>
              <Form.Item name="so_xe" label="Số Xe">
                <AutoComplete
                  options={vehicleOptions}
                  placeholder="Số xe tải"
                  filterOption={(input, option) => option.value.toUpperCase().includes(input.toUpperCase())}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* DANH SÁCH DÒNG HÀNG */}
        <Divider orientation="left">Danh Sách Dòng Hàng</Divider>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <Flex vertical gap="middle" style={{ width: '100%' }}>
              {fields.map(({ key, name, ...restField }, index) => (
                <Card 
                  key={key} 
                  size="small" 
                  title={<Text type="secondary">Dòng hàng #{index + 1}</Text>}
                  extra={
                    fields.length > 1 && (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)}>
                        Xóa dòng
                      </Button>
                    )
                  }
                  style={{ background: '#fcfcfc', border: '1px solid #e8e8e8' }}
                >
                  <Form.Item {...restField} name={[name, 'product_code']} hidden><Input /></Form.Item>

                  <Row gutter={10}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'product_name']}
                        label="Tên Sản Phẩm"
                        rules={[{ required: true, message: 'Nhập tên SP' }]}
                      >
                        <AutoComplete
                          options={productList}
                          placeholder="Chọn SP để tự điền ĐVT, Net"
                          onSelect={(val) => handleSelectProduct(val, name)}
                          filterOption={(input, option) => option.value.toUpperCase().includes(input.toUpperCase())}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item {...restField} name={[name, 'dvt']} label="ĐVT">
                        <Input placeholder="Thùng" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item {...restField} name={[name, 'net']} label="Net">
                        <InputNumber min={0} style={{ width: '100%' }} onChange={() => handleItemChange(name)} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item
                        {...restField}
                        name={[name, 'so_luong']}
                        label="Số lượng"
                        rules={[{ required: true, message: 'Nhập SL' }]}
                      >
                        <InputNumber min={1} style={{ width: '100%' }} onChange={() => handleItemChange(name)} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item {...restField} name={[name, 'tong_net']} label="Tổng Net">
                        <InputNumber disabled style={{ width: '100%', fontWeight: 'bold' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={10}>
                    <Col xs={12} md={4}>
                      <Form.Item {...restField} name={[name, 'price']} label="Đơn Giá">
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Item {...restField} name={[name, 'mfg']} label="Ngày SX">
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="NSX" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Item {...restField} name={[name, 'exp']} label="HSD">
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="HSD" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={10}>
                      <Form.Item {...restField} name={[name, 'note']} label="Ghi chú dòng hàng">
                        <Input placeholder="VD: đẹp 10, dẽo bạc..." />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ))}

              <Button 
                type="dashed" 
                onClick={() => add({ net: 8.8, so_luong: 1, tong_net: 8.8, price: 0, dvt: 'Thùng' })} 
                block 
                icon={<PlusOutlined />}
                style={{ height: 45 }}
              >
                Thêm nhiều hàng (Thêm dòng mới)
              </Button>
            </Flex>
          )}
        </Form.List>

        <Button 
          type="primary" 
          htmlType="submit" 
          icon={<SaveOutlined />} 
          loading={loading} 
          block 
          style={{ height: 50, marginTop: 24, fontSize: 16, fontWeight: 'bold', background: '#52c41a' }}
        >
          LƯU PHIẾU NHẬP
        </Button>
      </Form>

      {/* THẺ KẾT QUẢ VỪA LƯU & TÙY CHỌN XUẤT FILE */}
      {savedData && (
        <Card style={{ marginTop: 20, background: '#f6ffed', borderColor: '#b7eb8f', borderRadius: 8 }}>
          <Flex vertical gap="middle">
            <Alert
              message={`✅ Đã nhập kho thành công phiếu #${savedData.soPhieu} (${savedData.items.length} dòng hàng)`}
              type="success"
              showIcon
            />
            
            {/* KHUNG TÙY CHỌN XUẤT FILE PHIẾU NHẬP */}
            <Card size="small" title="Tùy chọn in & Xuất file phiếu nhập vừa tạo" style={{ background: '#fff' }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12}>
                  <Button 
                    type="primary" 
                    danger 
                    icon={<FilePdfOutlined />} 
                    block 
                    onClick={() => exportPdfPhieuNhap(savedData)}
                  >
                    Xuất PDF Phiếu Nhập
                  </Button>
                </Col>
                <Col xs={24} sm={12}>
                  <Button 
                    style={{ background: '#388E3C', color: '#fff' }} 
                    icon={<FileExcelOutlined />} 
                    block 
                    onClick={() => exportExcelPhieuNhap(savedData)}
                  >
                    Xuất Excel (.xlsx)
                  </Button>
                </Col>
              </Row>
            </Card>

            <Row gutter={12}>
              <Col span={12}>
                <Button icon={<RedoOutlined />} onClick={handleClearForm} block>
                  Tạo Phiếu Nhập Mới
                </Button>
              </Col>
              <Col span={12}>
                <Button 
                  type="primary" 
                  icon={<HistoryOutlined />} 
                  onClick={onBack} 
                  block 
                  style={{ background: '#1890ff' }}
                >
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