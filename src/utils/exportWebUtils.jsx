import dayjs from 'dayjs';

// =========================================================================
// 1. HÀM IN BÁO CÁO TỔNG HỢP / LỊCH SỬ / TỒN KHO
// =========================================================================
export const printReportHistory = ({ filterType, dateRange, transactions, filteredData }) => {
  if (!filteredData || filteredData.length === 0) {
    alert('Không có dữ liệu để in báo cáo!');
    return;
  }

  let totalQty = 0;
  let totalPrice = 0;

  const rowsHtml = filteredData.map((item, index) => {
    const t = (item.type || '').toUpperCase();
    const qty = Number(item.so_luong) || 0;
    const price = Number(item.price) || 0;

    let displayQty = qty;
    if (t === 'ADJUST_OUT') {
      displayQty = -qty;
      totalQty -= qty;
      totalPrice -= (qty * price);
    } else {
      totalQty += qty;
      totalPrice += (qty * price);
    }

    let typeLabel = item.type;
    let typeColor = '#000';
    if (t === 'IN' || t === 'NHẬP') { typeLabel = 'Nhập'; typeColor = '#389e0d'; }
    else if (t === 'OUT' || t === 'XUẤT') { typeLabel = 'Xuất'; typeColor = '#096dd9'; }
    else if (t === 'ADJUST_IN') { typeLabel = 'Đ/C Tăng'; typeColor = '#08979c'; }
    else if (t === 'ADJUST_OUT') { typeLabel = 'Đ/C Giảm'; typeColor = '#d4380d'; }
    else if (t === 'STOCK') { typeLabel = 'Tồn Kho'; typeColor = '#d46b08'; }

    return `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td style="text-align: center;">${item.date || ''}</td>
        <td>${item.so_phieu || ''}</td>
        <td style="text-align: center; color: ${typeColor}; font-weight: bold;">${typeLabel}</td>
        <td><b>${item.product_name || ''}</b></td>
        <td>${item.position_name || item.customer_name || item.receiver_name || '-'}</td>
        <td style="text-align: right; font-weight: bold; ${t === 'ADJUST_OUT' ? 'color: #d4380d;' : ''}">
          ${displayQty > 0 && t === 'ADJUST_IN' ? '+' : ''}${displayQty.toLocaleString()} ${item.dvt ? `(${item.dvt})` : ''}
        </td>
        <td style="text-align: right;">${price > 0 ? price.toLocaleString() + ' đ' : '-'}</td>
        <td style="text-align: right; font-weight: bold;">${price > 0 ? (displayQty * price).toLocaleString() + ' đ' : '-'}</td>
        <td>${item.note || ''}</td>
      </tr>
    `;
  }).join('');

  let reportTitle = 'BÁO CÁO GIAO DỊCH KHO';
  if (filterType === 'IN') reportTitle = 'BÁO CÁO NHẬP KHO & ĐIỀU CHỈNH';
  else if (filterType === 'OUT') reportTitle = 'BÁO CÁO XUẤT KHO';
  else if (filterType === 'STOCK') reportTitle = 'BÁO CÁO TỒN KHO THỰC TẾ';

  const dateRangeStr = dateRange && dateRange[0] && dateRange[1] 
    ? `Từ ngày: ${dayjs(dateRange[0]).format('YYYY-MM-DD')} - Đến ngày: ${dayjs(dateRange[1]).format('YYYY-MM-DD')}`
    : `Thời gian in: ${new Date().toLocaleDateString('vi-VN')}`;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>${reportTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 13px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { margin: 0 0 5px 0; text-transform: uppercase; color: #1f1f1f; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
          th { background-color: #f2f2f2; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${reportTitle}</h2>
          <div>${dateRangeStr}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">TT</th>
              <th style="width: 80px;">Ngày</th>
              <th style="width: 80px;">Số Phiếu</th>
              <th style="width: 75px;">Loại</th>
              <th>Tên Sản Phẩm</th>
              <th>Đối tác / Vị trí</th>
              <th style="width: 95px;">Số Lượng</th>
              <th style="width: 80px;">Đơn Giá</th>
              <th style="width: 100px;">Thành Tiền</th>
              <th>Ghi Chú</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background-color: #fafafa; font-weight: bold;">
              <td colspan="6" style="text-align: right; padding-right: 15px;">TỔNG CỘNG THỰC TẾ:</td>
              <td style="text-align: right; color: #d4380d; font-size: 13px;">${totalQty.toLocaleString()}</td>
              <td></td>
              <td style="text-align: right; color: #d4380d; font-size: 13px;">${totalPrice.toLocaleString()} đ</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div style="display: flex; justify-content: space-between; margin-top: 40px; text-align: center;">
          <div style="width: 200px;"><b>Người Lập Biểu</b><br><br><br><br>...........................</div>
          <div style="width: 200px;"><b>Thủ Kho</b><br><br><br><br>...........................</div>
          <div style="width: 200px;"><b>Kế Toán Trưởng</b><br><br><br><br>...........................</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// =========================================================================
// 2. HÀM XUẤT EXCEL TỔNG HỢP / LỊCH SỬ / TỒN KHO
// =========================================================================
export const exportExcelReportHistory = ({ filterType, filteredData }) => {
  if (!filteredData || filteredData.length === 0) {
    alert('Không có dữ liệu để xuất Excel!');
    return;
  }

  let csvContent = '\uFEFF';
  csvContent += 'STT,Ngày,Số Phiếu,Loại,Tên Sản Phẩm,Đối Tác / Vị Trí,Số Lượng,ĐVT,Đơn Giá,Thành Tiền,Ghi Chú\n';

  filteredData.forEach((item, index) => {
    const t = (item.type || '').toUpperCase();
    const qty = Number(item.so_luong) || 0;
    const price = Number(item.price) || 0;
    const finalQty = t === 'ADJUST_OUT' ? -qty : qty;
    const totalAmount = finalQty * price;

    const row = [
      index + 1,
      `"${item.date || ''}"`,
      `"${item.so_phieu || ''}"`,
      `"${item.type || ''}"`,
      `"${(item.product_name || '').replace(/"/g, '""')}"`,
      `"${(item.position_name || item.customer_name || item.receiver_name || '').replace(/"/g, '""')}"`,
      finalQty,
      `"${item.dvt || ''}"`,
      price,
      totalAmount,
      `"${(item.note || '').replace(/"/g, '""')}"`,
    ];
    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Bao_Cao_Kho_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// =========================================================================
// 3. HÀM IN PHIẾU NHẬP KHO CHI TIẾT
// =========================================================================
export const printPhieuNhap = (ticketInfo, items) => {
  if (!items || items.length === 0) {
    alert('Không có dữ liệu hàng hóa để in phiếu nhập!');
    return;
  }

  let totalQty = 0;
  let totalPrice = 0;

  const rowsHtml = items.map((item, index) => {
    const qty = Number(item.so_luong) || 0;
    const price = Number(item.price) || 0;
    const amount = qty * price;
    totalQty += qty;
    totalPrice += amount;

    return `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td><b>${item.product_name || ''}</b></td>
        <td style="text-align: center;">${item.dvt || ''}</td>
        <td style="text-align: center;">${item.position_name || item.pos || '-'}</td>
        <td style="text-align: right; font-weight: bold;">${qty.toLocaleString()}</td>
        <td style="text-align: right;">${price > 0 ? price.toLocaleString() + ' đ' : '-'}</td>
        <td style="text-align: right; font-weight: bold;">${amount > 0 ? amount.toLocaleString() + ' đ' : '-'}</td>
        <td>${item.note || ''}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>PHIẾU NHẬP KHO - ${ticketInfo?.so_phieu || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #333; font-size: 13px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { margin: 0 0 5px 0; text-transform: uppercase; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 7px 8px; font-size: 12px; }
          th { background-color: #f2f2f2; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>PHIẾU NHẬP KHO</h2>
          <div>Số phiếu: <b>${ticketInfo?.so_phieu || ''}</b> | Ngày: ${ticketInfo?.date || dayjs().format('YYYY-MM-DD')}</div>
        </div>
        <div class="meta">
          <div>Nhà cung cấp / Đối tác: <b>${ticketInfo?.customer_name || 'Khách lẻ'}</b></div>
          <div>Biển số xe: <b>${ticketInfo?.vehicle || '-'}</b></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">STT</th>
              <th>Tên Hàng Hóa / Sản Phẩm</th>
              <th style="width: 60px;">ĐVT</th>
              <th style="width: 90px;">Vị Trí</th>
              <th style="width: 90px;">Số Lượng</th>
              <th style="width: 90px;">Đơn Giá</th>
              <th style="width: 110px;">Thành Tiền</th>
              <th>Ghi Chú</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="font-weight: bold; background-color: #fafafa;">
              <td colspan="4" style="text-align: right;">TỔNG CỘNG:</td>
              <td style="text-align: right; color: #389e0d;">${totalQty.toLocaleString()}</td>
              <td></td>
              <td style="text-align: right; color: #d4380d;">${totalPrice.toLocaleString()} đ</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div style="display: flex; justify-content: space-between; margin-top: 40px; text-align: center;">
          <div style="width: 200px;"><b>Người Giao Hàng</b><br><br><br><br>...........................</div>
          <div style="width: 200px;"><b>Thủ Kho</b><br><br><br><br>...........................</div>
          <div style="width: 200px;"><b>Kế Toán</b><br><br><br><br>...........................</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// =========================================================================
// 4. HÀM XUẤT EXCEL PHIẾU NHẬP KHO
// =========================================================================
export const exportExcelPhieuNhap = (ticketInfo, items) => {
  if (!items || items.length === 0) {
    alert('Không có dữ liệu hàng hóa để xuất Excel!');
    return;
  }

  let csvContent = '\uFEFF';
  csvContent += `PHIẾU NHẬP KHO: ${ticketInfo?.so_phieu || ''}\n`;
  csvContent += `Ngày: ${ticketInfo?.date || ''} - Đối tác: ${ticketInfo?.customer_name || ''}\n\n`;
  csvContent += 'STT,Tên Sản Phẩm,ĐVT,Vị Trí,Số Lượng,Đơn Giá,Thành Tiền,Ghi Chú\n';

  items.forEach((item, index) => {
    const qty = Number(item.so_luong) || 0;
    const price = Number(item.price) || 0;
    const row = [
      index + 1,
      `"${(item.product_name || '').replace(/"/g, '""')}"`,
      `"${item.dvt || ''}"`,
      `"${(item.position_name || item.pos || '').replace(/"/g, '""')}"`,
      qty,
      price,
      qty * price,
      `"${(item.note || '').replace(/"/g, '""')}"`,
    ];
    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Phieu_Nhap_${ticketInfo?.so_phieu || dayjs().format('YYYYMMDD')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// =========================================================================
// 5. HÀM IN PHIẾU XUẤT KHO CHI TIẾT
// =========================================================================
export const printPhieuXuat = (ticketInfo, items) => {
  if (!items || items.length === 0) {
    alert('Không có dữ liệu hàng hóa để in phiếu xuất!');
    return;
  }

  let totalQty = 0;
  let totalPrice = 0;

  const rowsHtml = items.map((item, index) => {
    const qty = Number(item.so_luong) || 0;
    const price = Number(item.price) || 0;
    const amount = qty * price;
    totalQty += qty;
    totalPrice += amount;

    return `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td><b>${item.product_name || ''}</b></td>
        <td style="text-align: center;">${item.dvt || ''}</td>
        <td style="text-align: center;">${item.position_name || item.pos || '-'}</td>
        <td style="text-align: right; font-weight: bold;">${qty.toLocaleString()}</td>
        <td style="text-align: right;">${price > 0 ? price.toLocaleString() + ' đ' : '-'}</td>
        <td style="text-align: right; font-weight: bold;">${amount > 0 ? amount.toLocaleString() + ' đ' : '-'}</td>
        <td>${item.note || ''}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>PHIẾU XUẤT KHO - ${ticketInfo?.so_phieu || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #333; font-size: 13px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { margin: 0 0 5px 0; text-transform: uppercase; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 7px 8px; font-size: 12px; }
          th { background-color: #f2f2f2; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>PHIẾU XUẤT KHO</h2>
          <div>Số phiếu: <b>${ticketInfo?.so_phieu || ''}</b> | Ngày: ${ticketInfo?.date || dayjs().format('YYYY-MM-DD')}</div>
        </div>
        <div class="meta">
          <div>Người / Đơn vị nhận: <b>${ticketInfo?.receiver_name || ticketInfo?.customer_name || 'Khách lẻ'}</b></div>
          <div>Biển số xe: <b>${ticketInfo?.vehicle || '-'}</b></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">STT</th>
              <th>Tên Hàng Hóa / Sản Phẩm</th>
              <th style="width: 60px;">ĐVT</th>
              <th style="width: 90px;">Vị Trí</th>
              <th style="width: 90px;">Số Lượng</th>
              <th style="width: 90px;">Đơn Giá</th>
              <th style="width: 110px;">Thành Tiền</th>
              <th>Ghi Chú</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="font-weight: bold; background-color: #fafafa;">
              <td colspan="4" style="text-align: right;">TỔNG CỘNG:</td>
              <td style="text-align: right; color: #096dd9;">${totalQty.toLocaleString()}</td>
              <td></td>
              <td style="text-align: right; color: #d4380d;">${totalPrice.toLocaleString()} đ</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div style="display: flex; justify-content: space-between; margin-top: 40px; text-align: center;">
          <div style="width: 200px;"><b>Người Nhận Hàng</b><br><br><br><br>...........................</div>
          <div style="width: 200px;"><b>Thủ Kho</b><br><br><br><br>...........................</div>
          <div style="width: 200px;"><b>Kế Toán</b><br><br><br><br>...........................</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// =========================================================================
// 6. HÀM XUẤT EXCEL PHIẾU XUẤT KHO
// =========================================================================
export const exportExcelPhieuXuat = (ticketInfo, items) => {
  if (!items || items.length === 0) {
    alert('Không có dữ liệu hàng hóa để xuất Excel!');
    return;
  }

  let csvContent = '\uFEFF';
  csvContent += `PHIẾU XUẤT KHO: ${ticketInfo?.so_phieu || ''}\n`;
  csvContent += `Ngày: ${ticketInfo?.date || ''} - Người nhận: ${ticketInfo?.receiver_name || ticketInfo?.customer_name || ''}\n\n`;
  csvContent += 'STT,Tên Sản Phẩm,ĐVT,Vị Trí,Số Lượng,Đơn Giá,Thành Tiền,Ghi Chú\n';

  items.forEach((item, index) => {
    const qty = Number(item.so_luong) || 0;
    const price = Number(item.price) || 0;
    const row = [
      index + 1,
      `"${(item.product_name || '').replace(/"/g, '""')}"`,
      `"${item.dvt || ''}"`,
      `"${(item.position_name || item.pos || '').replace(/"/g, '""')}"`,
      qty,
      price,
      qty * price,
      `"${(item.note || '').replace(/"/g, '""')}"`,
    ];
    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Phieu_Xuat_${ticketInfo?.so_phieu || dayjs().format('YYYYMMDD')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// =========================================================================
// ALIAS EXPORTS TƯƠNG THÍCH
// =========================================================================
export const exportPdfPhieuNhap = printPhieuNhap;
export const exportPdfPhieuXuat = printPhieuXuat;