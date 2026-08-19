import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

// Tiện ích bóc tách số xe từ chuỗi Note
const extractVehicle = (note) => {
  if (!note) return '';
  const m = note.match(/\|Xe:\s*([^|]+)/);
  const val = m ? m[1].trim() : '';
  return val && val !== 'null' && val !== 'nulll' ? val : '';
};

// Tính số ngày lưu kho giữa Ngày Nhập và Ngày Xuất
export const tinhSoNgayLuuKho = (ngayNhap, ngayXuat) => {
  if (!ngayNhap || !ngayXuat) return 0;
  const dNhap = dayjs(ngayNhap);
  const dXuat = dayjs(ngayXuat);
  const diff = dXuat.diff(dNhap, 'day');
  return diff > 0 ? diff : 0;
};

// =========================================================================
// 1. IN & XUẤT PDF PHIẾU XUẤT KHO (CHUẨN A4)
// =========================================================================
export const exportPdfPhieuXuat = ({
  soPhieu,
  giamSat,
  soXe,
  ngayGiaoDich,
  nguoiNhan,
  items,
  donGiaLuuKho = 0,
  soNgayMienPhi = 0,
  isSave = true
}) => {
  let tongSL = 0;
  let tongKgs = 0;
  let tongNgayLuuKho = 0;
  let tongTienLuuKho = 0;

  const rowsHtml = items.map((item, idx) => {
    const sl = Number(item.so_luong || 0);
    const net = Number(item.net || 0);
    const kgs = Math.round(sl * net * 100) / 100;
    tongSL += sl;
    tongKgs += kgs;

    const ngayNhapStr = item.import_date || item.date || item.mfg || '';
    const ngayNhapHienThi = ngayNhapStr ? dayjs(ngayNhapStr).format('DD/MM/YYYY') : '';

    const soNgayLuu = tinhSoNgayLuuKho(ngayNhapStr, ngayGiaoDich);
    tongNgayLuuKho += soNgayLuu;

    const soNgayTinhTien = Math.max(0, soNgayLuu - soNgayMienPhi);
    const tienLuu = kgs * soNgayTinhTien * donGiaLuuKho;
    tongTienLuuKho += tienLuu;

    const hienThiNgay = soNgayMienPhi > 0 ? `${soNgayTinhTien} (${soNgayLuu})` : `${soNgayLuu}`;

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="text-align: center;">${ngayNhapHienThi}</td>
        <td>${item.customer_name || ''}</td>
        <td style="text-align: center;">${item.position_name || ''}</td>
        <td style="font-weight: bold;">${item.product_name || ''}</td>
        <td style="text-align: center;">${item.dvt || 'Thùng'}</td>
        <td style="text-align: right;">${net > 0 ? net.toFixed(1) : ''}</td>
        <td style="text-align: right; font-weight: bold;">${sl.toLocaleString()}</td>
        <td style="text-align: right; font-weight: bold;">${kgs.toLocaleString()}</td>
        <td style="text-align: center;">${hienThiNgay}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>PhieuXuat_${soPhieu}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Times New Roman', 'Arial', sans-serif; font-size: 15px; line-height: 1.5; color: #000; margin: 0; padding: 10px; }
          .title { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; }
          .sub-warning { text-align: center; font-size: 12px; font-style: italic; color: #dc3545; margin-bottom: 15px; }
          .info-table { width: 100%; margin-bottom: 16px; border-collapse: collapse; }
          .info-table td { padding: 5px 0; font-size: 15px; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
          .data-table th, .data-table td { border: 1px solid #222; padding: 9px 6px; font-size: 14px; }
          .data-table th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
          .total-row td { font-weight: bold; background-color: #fbfbfb; font-size: 15px; }
          .fee-box { margin: 12px 0 20px 0; font-size: 14px; }
          .sign-table { width: 100%; margin-top: 35px; border-collapse: collapse; text-align: center; }
          .sign-table td { width: 25%; vertical-align: top; font-size: 14px; }
          .sign-title { font-weight: bold; margin-bottom: 4px; }
          .sign-sub { font-style: italic; font-size: 12px; }
          .sign-space { height: 80px; }
        </style>
      </head>
      <body>
        <div class="title">${isSave ? 'PHIẾU XUẤT KHO' : 'REVIEW PHIẾU XUẤT TẠM'}</div>
        ${!isSave ? '<div class="sub-warning">(* Phiếu này dùng để kiểm hàng, chưa có giá trị xuất kho chính thức)</div>' : ''}
        
        <table class="info-table">
          <tr>
            <td style="width: 55%;"><b>Số phiếu:</b> ${soPhieu}</td>
            <td style="text-align: right;"><b>Ngày lập:</b> ${ngayGiaoDich || dayjs().format('DD/MM/YYYY')}</td>
          </tr>
          <tr>
            <td><b>Giám sát:</b> ${giamSat || ''}</td>
            <td style="text-align: right;"><b>Số xe:</b> ${soXe || ''}</td>
          </tr>
          <tr>
            <td colspan="2"><b>Người nhận:</b> ${nguoiNhan || ''}</td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35px;">STT</th>
              <th style="width: 90px;">Ngày nhập</th>
              <th>NCC</th>
              <th style="width: 90px;">Vị trí</th>
              <th>Tên Sản Phẩm</th>
              <th style="width: 55px;">ĐVT</th>
              <th style="width: 45px;">Net</th>
              <th style="width: 55px;">SLX</th>
              <th style="width: 75px;">Kgs</th>
              <th style="width: 65px;">∑ Ngày</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="7" style="text-align: right; padding-right: 10px;">TỔNG CỘNG</td>
              <td style="text-align: right;">${tongSL.toLocaleString()}</td>
              <td style="text-align: right;">${tongKgs.toLocaleString()}</td>
              <td style="text-align: center;">${tongNgayLuuKho}</td>
            </tr>
          </tbody>
        </table>

        ${donGiaLuuKho > 0 ? `
          <div class="fee-box">
            <div>• <i>Đơn giá lưu kho:</i> <b>${donGiaLuuKho.toLocaleString()} VNĐ/kg/ngày</b> ${soNgayMienPhi > 0 ? `<i>(Miễn phí ${soNgayMienPhi} ngày đầu)</i>` : ''}</div>
            <div style="color: #dc3545; font-weight: bold; margin-top: 4px;">• TỔNG PHÍ LƯU KHO XUẤT ĐỢT NÀY: ${tongTienLuuKho.toLocaleString()} VNĐ</div>
          </div>
        ` : ''}

        <table class="sign-table">
          <tr>
            <td>
              <div class="sign-title">Người lập phiếu</div>
              <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
              <div class="sign-space"></div>
            </td>
            <td>
              <div class="sign-title">Người giao hàng</div>
              <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
              <div class="sign-space"></div>
            </td>
            <td>
              <div class="sign-title">Thủ kho</div>
              <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
              <div class="sign-space"></div>
            </td>
            <td>
              <div class="sign-title">Kế toán trưởng</div>
              <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
              <div class="sign-space"></div>
            </td>
          </tr>
        </table>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// =========================================================================
// 2. IN & XUẤT PDF PHIẾU NHẬP KHO (CHUẨN A4)
// =========================================================================
export const exportPdfPhieuNhap = ({ soPhieu, customerName, soXe, date, items }) => {
  let tongSL = 0;
  let tongKgs = 0;
  let tongTien = 0;

  const rowsHtml = items.map((item, idx) => {
    const sl = Number(item.so_luong || 0);
    const net = Number(item.net || 0);
    const kgs = Math.round(sl * net * 100) / 100;
    const gia = Number(item.price || 0);
    const thanhTien = sl * gia;

    tongSL += sl;
    tongKgs += kgs;
    tongTien += thanhTien;

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="text-align: center;">${item.position_name || ''}</td>
        <td>${item.customer_name || ''}</td>
        <td style="font-weight: bold;">${item.product_name || ''}</td>
        <td style="text-align: center;">${item.dvt || 'Thùng'}</td>
        <td style="text-align: right;">${net > 0 ? net.toFixed(1) : ''}</td>
        <td style="text-align: right; font-weight: bold;">${sl.toLocaleString()}</td>
        <td style="text-align: right; font-weight: bold;">${kgs.toLocaleString()}</td>
        <td style="text-align: right;">${gia > 0 ? gia.toLocaleString() : ''}</td>
        <td style="text-align: right; font-weight: bold;">${thanhTien > 0 ? thanhTien.toLocaleString() : ''}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>PhieuNhap_${soPhieu}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Times New Roman', 'Arial', sans-serif; font-size: 15px; line-height: 1.5; color: #000; margin: 0; padding: 10px; }
          .title { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 12px; text-transform: uppercase; }
          .info-table { width: 100%; margin-bottom: 16px; border-collapse: collapse; }
          .info-table td { padding: 5px 0; font-size: 15px; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
          .data-table th, .data-table td { border: 1px solid #222; padding: 9px 6px; font-size: 14px; }
          .data-table th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
          .total-row td { font-weight: bold; background-color: #fbfbfb; font-size: 15px; }
          .sign-table { width: 100%; margin-top: 35px; border-collapse: collapse; text-align: center; }
          .sign-table td { width: 25%; vertical-align: top; font-size: 14px; }
          .sign-title { font-weight: bold; margin-bottom: 4px; }
          .sign-sub { font-style: italic; font-size: 12px; }
          .sign-space { height: 80px; }
        </style>
      </head>
      <body>
        <div class="title">PHIẾU NHẬP KHO</div>
        
        <table class="info-table">
          <tr>
            <td style="width: 55%;"><b>Số phiếu:</b> ${soPhieu}</td>
            <td style="text-align: right;"><b>Ngày lập:</b> ${date || dayjs().format('DD/MM/YYYY')}</td>
          </tr>
          <tr>
            <td><b>Khách / NCC:</b> ${customerName || 'All'}</td>
            <td style="text-align: right;"><b>Số xe:</b> ${soXe || ''}</td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35px;">TT</th>
              <th style="width: 80px;">Vị trí</th>
              <th>NCC</th>
              <th>Tên Sản Phẩm</th>
              <th style="width: 55px;">ĐVT</th>
              <th style="width: 45px;">Net</th>
              <th style="width: 55px;">SL</th>
              <th style="width: 75px;">Kgs</th>
              <th style="width: 80px;">Đơn giá</th>
              <th style="width: 95px;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="6" style="text-align: right; padding-right: 10px;">TỔNG CỘNG</td>
              <td style="text-align: right;">${tongSL.toLocaleString()}</td>
              <td style="text-align: right;">${tongKgs.toLocaleString()}</td>
              <td></td>
              <td style="text-align: right;">${tongTien > 0 ? tongTien.toLocaleString() + ' đ' : ''}</td>
            </tr>
          </tbody>
        </table>

        <table class="sign-table">
          <tr>
            <td>
              <div class="sign-title">Người lập phiếu</div>
              <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
              <div class="sign-space"></div>
            </td>
            <td>
              <div class="sign-title">Người giao hàng</div>
              <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
              <div class="sign-space"></div>
            </td>
            <td>
              <div class="sign-title">Thủ kho</div>
              <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
              <div class="sign-space"></div>
            </td>
            <td>
              <div class="sign-title">Kế toán trưởng</div>
              <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
              <div class="sign-space"></div>
            </td>
          </tr>
        </table>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// =========================================================================
// 3. IN & XUẤT PDF BÁO CÁO LỊCH SỬ / XUẤT NHẬP TỒN (LANDSCAPE)
// =========================================================================
// =========================================================================
// IN & XUẤT PDF BÁO CÁO LỊCH SỬ / XUẤT NHẬP TỒN (PHÂN BẢNG CHUYÊN NGHIỆP)
// =========================================================================
export const printReportHistory = ({ filterType, dateRange, transactions, filteredData }) => {
  const currentDate = dayjs().format('DD/MM/YYYY');
  const dateFromStr = dateRange && dateRange[0] ? dateRange[0].format('DD/MM/YYYY') : '';
  const dateToStr = dateRange && dateRange[1] ? dateRange[1].format('DD/MM/YYYY') : '';
  const timeSub = dateFromStr && dateToStr ? `Từ: ${dateFromStr} --> ${dateToStr}` : `Ngày in: ${currentDate}`;

  let title = 'BÁO CÁO TỔNG HỢP';
  if (filterType === 'ALL') title = 'BC XUẤT NHẬP TỒN';
  else if (filterType === 'STOCK') title = 'BÁO CÁO TỒN';
  else if (filterType === 'OUT') title = 'BÁO CÁO XUẤT';
  else if (filterType === 'IN') title = 'BÁO CÁO NHẬP';

  // =========================================================================
  // 1. TÍNH BẢNG TỔNG HỢP THEO TÊN HÀNG + NET
  // =========================================================================
  const summaryMap = new Map();
  transactions.forEach((r) => {
    const key = `${(r.product_name || '').trim()}___${Number(r.net || 0)}`;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        product_name: r.product_name || '',
        net: Number(r.net || 0),
        sl_in: 0,
        sl_out: 0,
        sl_stock: 0,
      });
    }
    const item = summaryMap.get(key);
    const qty = Number(r.so_luong || 0);
    if (r.type === 'IN') {
      item.sl_in += qty;
      item.sl_stock += qty;
    } else if (r.type === 'OUT') {
      item.sl_out += qty;
      item.sl_stock -= qty;
    }
  });

  const summaryList = Array.from(summaryMap.values());
  let sumN_SL = 0, sumN_Net = 0, sumX_SL = 0, sumX_Net = 0, sumT_SL = 0, sumT_Net = 0;

  // Lọc bỏ các dòng không phát sinh theo từng loại báo cáo
  const validSummaryList = summaryList.filter(it => {
    if (filterType === 'IN') return it.sl_in > 0;
    if (filterType === 'OUT') return it.sl_out > 0;
    if (filterType === 'STOCK') return it.sl_stock > 0;
    return (it.sl_in > 0 || it.sl_out > 0 || it.sl_stock > 0);
  });

  const summaryRowsHtml = validSummaryList.map((it, idx) => {
    const netN = Math.round(it.sl_in * it.net * 100) / 100;
    const netX = Math.round(it.sl_out * it.net * 100) / 100;
    const tonQty = Math.max(0, it.sl_stock);
    const netT = Math.round(tonQty * it.net * 100) / 100;

    sumN_SL += it.sl_in; sumN_Net += netN;
    sumX_SL += it.sl_out; sumX_Net += netX;
    sumT_SL += tonQty; sumT_Net += netT;

    if (filterType === 'ALL') {
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><b>${it.product_name}</b></td>
          <td style="text-align:right;">${it.net > 0 ? it.net : ''}</td>
          <td style="text-align:right;">${it.sl_in.toLocaleString()}</td>
          <td style="text-align:right;">${netN.toLocaleString()}</td>
          <td style="text-align:right;">${it.sl_out.toLocaleString()}</td>
          <td style="text-align:right;">${netX.toLocaleString()}</td>
          <td style="text-align:right; font-weight:bold;">${tonQty.toLocaleString()}</td>
          <td style="text-align:right; font-weight:bold;">${netT.toLocaleString()}</td>
        </tr>
      `;
    } else if (filterType === 'IN') {
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><b>${it.product_name}</b></td>
          <td style="text-align:right;">${it.net > 0 ? it.net : ''}</td>
          <td style="text-align:right; font-weight:bold;">${it.sl_in.toLocaleString()}</td>
          <td style="text-align:right; font-weight:bold;">${netN.toLocaleString()}</td>
        </tr>
      `;
    } else if (filterType === 'OUT') {
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><b>${it.product_name}</b></td>
          <td style="text-align:right;">${it.net > 0 ? it.net : ''}</td>
          <td style="text-align:right; font-weight:bold;">${it.sl_out.toLocaleString()}</td>
          <td style="text-align:right; font-weight:bold;">${netX.toLocaleString()}</td>
        </tr>
      `;
    } else {
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><b>${it.product_name}</b></td>
          <td style="text-align:right;">${it.net > 0 ? it.net : ''}</td>
          <td style="text-align:right; font-weight:bold;">${tonQty.toLocaleString()}</td>
          <td style="text-align:right; font-weight:bold;">${netT.toLocaleString()}</td>
        </tr>
      `;
    }
  }).join('');

  let summaryHeader = '';
  let summaryFooter = '';

  if (filterType === 'ALL') {
    summaryHeader = `
      <tr>
        <th style="width:32px;">TT</th>
        <th>Tên hàng</th>
        <th style="width:45px;">Net</th>
        <th style="width:55px;">SLN</th>
        <th style="width:75px;">TNet N</th>
        <th style="width:55px;">SLX</th>
        <th style="width:75px;">TNet X</th>
        <th style="width:55px;">SLT</th>
        <th style="width:75px;">TNet T</th>
      </tr>
    `;
    summaryFooter = `
      <tr class="total-row">
        <td colspan="3" style="text-align:right;">TỔNG CỘNG</td>
        <td style="text-align:right;">${sumN_SL.toLocaleString()}</td>
        <td style="text-align:right;">${sumN_Net.toLocaleString()}</td>
        <td style="text-align:right;">${sumX_SL.toLocaleString()}</td>
        <td style="text-align:right;">${sumX_Net.toLocaleString()}</td>
        <td style="text-align:right;">${sumT_SL.toLocaleString()}</td>
        <td style="text-align:right;">${sumT_Net.toLocaleString()}</td>
      </tr>
    `;
  } else if (filterType === 'IN') {
    summaryHeader = `
      <tr>
        <th style="width:35px;">TT</th>
        <th>Tên hàng</th>
        <th style="width:50px;">Net</th>
        <th style="width:70px;">SLN</th>
        <th style="width:90px;">TNet N</th>
      </tr>
    `;
    summaryFooter = `
      <tr class="total-row">
        <td colspan="3" style="text-align:right;">TỔNG CỘNG</td>
        <td style="text-align:right;">${sumN_SL.toLocaleString()}</td>
        <td style="text-align:right;">${sumN_Net.toLocaleString()}</td>
      </tr>
    `;
  } else if (filterType === 'OUT') {
    summaryHeader = `
      <tr>
        <th style="width:35px;">TT</th>
        <th>Tên hàng</th>
        <th style="width:50px;">Net</th>
        <th style="width:70px;">SLX</th>
        <th style="width:90px;">TNet X</th>
      </tr>
    `;
    summaryFooter = `
      <tr class="total-row">
        <td colspan="3" style="text-align:right;">TỔNG CỘNG</td>
        <td style="text-align:right;">${sumX_SL.toLocaleString()}</td>
        <td style="text-align:right;">${sumX_Net.toLocaleString()}</td>
      </tr>
    `;
  } else {
    summaryHeader = `
      <tr>
        <th style="width:35px;">TT</th>
        <th>Tên hàng</th>
        <th style="width:50px;">Net</th>
        <th style="width:70px;">SLT</th>
        <th style="width:90px;">TNet T</th>
      </tr>
    `;
    summaryFooter = `
      <tr class="total-row">
        <td colspan="3" style="text-align:right;">TỔNG CỘNG</td>
        <td style="text-align:right;">${sumT_SL.toLocaleString()}</td>
        <td style="text-align:right;">${sumT_Net.toLocaleString()}</td>
      </tr>
    `;
  }

  // =========================================================================
  // 2. CHUẨN BỊ DỮ LIỆU CÁC BẢNG CHI TIẾT
  // =========================================================================
  let detailStockHtml = '';
  let detailOutHtml = '';
  let detailGeneralHtml = '';

  // Hàm sinh HTML từng dòng chi tiết
  const renderDetailRow = (row, idx, isOut = false) => {
    const sl = Number(row.so_luong || 0);
    const net = Number(row.net || 0);
    const kgs = Math.round(sl * net * 100) / 100;
    const dateStr = row.date ? dayjs(row.date).format('DD/MM/YYYY') : '';
    const vehicle = extractVehicle(row.note);
    const partner = row.customer_name || row.receiver_name || row.pos || '';

    return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="text-align:center;">${dateStr}</td>
        <td>${partner}</td>
        <td style="text-align:center;">${row.position_name || ''}</td>
        <td><b>${row.product_name || ''}</b></td>
        <td style="text-align:center;">${row.dvt || 'Thùng'}</td>
        <td style="text-align:right;">${net > 0 ? net : ''}</td>
        <td style="text-align:right; font-weight:bold;">${sl.toLocaleString()}</td>
        <td style="text-align:right; font-weight:bold;">${kgs.toLocaleString()}</td>
        <td style="text-align:center;">${vehicle}</td>
        <td>${row.note || ''}</td>
      </tr>
    `;
  };

  // NẾU LÀ "TẤT CẢ GIAO DỊCH" (ALL) -> TÁCH LÀM 2 BẢNG CHI TIẾT: TỒN KHO & XUẤT KHO
  if (filterType === 'ALL') {
    // 2.1 Tính danh sách Tồn kho (> 0)
    const stockMap = new Map();
    transactions.forEach((row) => {
      const lotKey = row.type === 'IN' ? (row.ref_uuid || row.stock_uuid || row.uuid) : row.stock_uuid;
      if (!lotKey) return;
      if (!stockMap.has(lotKey)) {
        stockMap.set(lotKey, { ...row, in_qty: 0, out_qty: 0 });
      }
      const item = stockMap.get(lotKey);
      if (row.type === 'IN') {
        item.in_qty += Number(row.so_luong || 0);
        item.customer_name = row.customer_name || item.customer_name;
        item.position_name = row.position_name || item.position_name;
        item.product_name = row.product_name || item.product_name;
        item.dvt = row.dvt || item.dvt;
        item.net = Number(row.net || item.net || 0);
        item.date = row.date || item.date;
        item.note = row.note || item.note;
      } else if (row.type === 'OUT') {
        item.out_qty += Number(row.so_luong || 0);
      }
    });

    let tonList = [];
    stockMap.forEach((val) => {
      const tonQty = val.in_qty - val.out_qty;
      if (tonQty > 0) {
        tonList.push({ ...val, so_luong: tonQty });
      }
    });

    let totalTonSL = 0, totalTonKg = 0;
    const tonRows = tonList.map((r, i) => {
      totalTonSL += r.so_luong;
      totalTonKg += Math.round(r.so_luong * (r.net || 0) * 100) / 100;
      return renderDetailRow(r, i);
    }).join('');

    detailStockHtml = `
      <div class="section-title">II. TỒN KHO CHI TIẾT</div>
      <table>
        <thead>
          <tr>
            <th style="width:32px;">TT</th>
            <th style="width:80px;">Date</th>
            <th>Khách hàng / Đối tác</th>
            <th style="width:80px;">Vị trí</th>
            <th>Tên SP</th>
            <th style="width:50px;">ĐVT</th>
            <th style="width:45px;">Net(kg)</th>
            <th style="width:60px;">SLT</th>
            <th style="width:75px;">Tổng(kg)</th>
            <th style="width:80px;">Số xe</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${tonRows}
          <tr class="total-row">
            <td colspan="7" style="text-align:right;">TỔNG CỘNG:</td>
            <td style="text-align:right;">${totalTonSL.toLocaleString()}</td>
            <td style="text-align:right;">${totalTonKg.toLocaleString()}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    `;

    // 2.2 Lấy danh sách Xuất kho
    const outList = transactions.filter(t => t.type === 'OUT');
    let totalOutSL = 0, totalOutKg = 0;
    const outRows = outList.map((r, i) => {
      totalOutSL += Number(r.so_luong || 0);
      totalOutKg += Math.round(Number(r.so_luong || 0) * Number(r.net || 0) * 100) / 100;
      return renderDetailRow(r, i, true);
    }).join('');

    detailOutHtml = `
      <div class="section-title">III. XUẤT KHO CHI TIẾT</div>
      <table>
        <thead>
          <tr>
            <th style="width:32px;">TT</th>
            <th style="width:80px;">Date</th>
            <th>Khách hàng / Đối tác</th>
            <th style="width:80px;">Vị trí</th>
            <th>Tên SP</th>
            <th style="width:50px;">ĐVT</th>
            <th style="width:45px;">Net(kg)</th>
            <th style="width:60px;">SLX</th>
            <th style="width:75px;">Tổng(kg)</th>
            <th style="width:80px;">Số xe</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${outRows}
          <tr class="total-row">
            <td colspan="7" style="text-align:right;">TỔNG CỘNG:</td>
            <td style="text-align:right;">${totalOutSL.toLocaleString()}</td>
            <td style="text-align:right;">${totalOutKg.toLocaleString()}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    `;
  } else {
    // CÁC TRƯỜNG HỢP IN ĐƠN LẺ: IN, OUT, HOẶC STOCK
    let detailTotalSL = 0, detailTotalNet = 0;
    const detailRows = filteredData.map((row, idx) => {
      const sl = Number(row.so_luong || 0);
      detailTotalSL += sl;
      detailTotalNet += Math.round(sl * Number(row.net || 0) * 100) / 100;
      return renderDetailRow(row, idx);
    }).join('');

    let detailLabel = 'II. CHI TIẾT GIAO DỊCH';
    let qtyColName = 'SL';
    if (filterType === 'IN') { detailLabel = 'II. CHI TIẾT NHẬP KHO'; qtyColName = 'SLN'; }
    else if (filterType === 'OUT') { detailLabel = 'II. CHI TIẾT XUẤT KHO'; qtyColName = 'SLX'; }
    else if (filterType === 'STOCK') { detailLabel = 'II. CHI TIẾT TỒN KHO'; qtyColName = 'SLT'; }

    detailGeneralHtml = `
      <div class="section-title">${detailLabel}</div>
      <table>
        <thead>
          <tr>
            <th style="width:32px;">TT</th>
            <th style="width:80px;">Date</th>
            <th>Khách hàng / Đối tác</th>
            <th style="width:80px;">Vị trí</th>
            <th>Tên SP</th>
            <th style="width:50px;">ĐVT</th>
            <th style="width:45px;">Net(kg)</th>
            <th style="width:60px;">${qtyColName}</th>
            <th style="width:75px;">Tổng(kg)</th>
            <th style="width:80px;">Số xe</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows}
          <tr class="total-row">
            <td colspan="7" style="text-align:right;">TỔNG CỘNG:</td>
            <td style="text-align:right;">${detailTotalSL.toLocaleString()}</td>
            <td style="text-align:right;">${detailTotalNet.toLocaleString()}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    `;
  }

  // =========================================================================
  // 3. MỞ CỬA SỔ IN KHỔ NGANG (A4 LANDSCAPE)
  // =========================================================================
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}_${dayjs().format('HHmmss_DDMM')}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Times New Roman', 'Arial', sans-serif; font-size: 13px; color: #000; margin: 0; padding: 5px; }
          .header-box { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px; border-bottom: 2px solid #222; padding-bottom: 5px; }
          .title { font-size: 20px; font-weight: bold; text-transform: uppercase; }
          .sub-time { font-size: 13px; font-style: italic; }
          .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 16px 0 6px 0; background: #e9ecef; padding: 5px 8px; border-left: 4px solid #1890ff; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
          th, td { border: 1px solid #333; padding: 6px 4px; font-size: 12px; }
          th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
          .total-row td { font-weight: bold; background-color: #f8f9fa; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="title">${title}</div>
          <div class="sub-time">${timeSub}</div>
        </div>

        <div class="section-title">I. TỔNG HỢP ${filterType === 'ALL' ? 'XUẤT NHẬP TỒN' : (filterType === 'IN' ? 'NHẬP KHO' : (filterType === 'OUT' ? 'XUẤT KHO' : 'TỒN KHO'))}</div>
        <table>
          <thead>${summaryHeader}</thead>
          <tbody>${summaryRowsHtml} ${summaryFooter}</tbody>
        </table>

        ${filterType === 'ALL' ? (detailStockHtml + detailOutHtml) : detailGeneralHtml}

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// =========================================================================
// 4. XUẤT EXCEL PHIẾU XUẤT KHO (.XLSX)
// =========================================================================
export const exportExcelPhieuXuat = ({ soPhieu, giamSat, soXe, ngayGiaoDich, nguoiNhan, items }) => {
  const excelData = [
    ['PHIẾU XUẤT KHO'],
    [`Số phiếu: ${soPhieu}`, '', '', `Ngày lập: ${ngayGiaoDich || dayjs().format('DD/MM/YYYY')}`],
    [`Giám sát: ${giamSat}`, '', '', `Số xe: ${soXe}`],
    [`Người nhận: ${nguoiNhan}`],
    [],
    ['STT', 'Ngày nhập', 'NCC', 'Vị trí', 'Sản phẩm', 'ĐVT', 'Net', 'SL Xuất', 'Tổng Kgs', 'Đơn giá']
  ];

  let tongSL = 0;
  let tongKgs = 0;

  items.forEach((item, idx) => {
    const sl = Number(item.so_luong || 0);
    const net = Number(item.net || 0);
    const kgs = Math.round(sl * net * 100) / 100;
    tongSL += sl;
    tongKgs += kgs;

    const ngayNhapStr = item.import_date || item.date || item.mfg || '';

    excelData.push([
      idx + 1,
      ngayNhapStr ? dayjs(ngayNhapStr).format('DD/MM/YYYY') : '',
      item.customer_name || '',
      item.position_name || '',
      item.product_name || '',
      item.dvt || 'Thùng',
      net,
      sl,
      kgs,
      item.price || 0
    ]);
  });

  excelData.push(['TỔNG CỘNG', '', '', '', '', '', '', tongSL, tongKgs, '']);

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PhieuXuat');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `PhieuXuat_${soPhieu}.xlsx`);
};

// =========================================================================
// 5. XUẤT EXCEL PHIẾU NHẬP KHO (.XLSX)
// =========================================================================
export const exportExcelPhieuNhap = ({ soPhieu, customerName, soXe, date, items }) => {
  const excelData = [
    ['PHIẾU NHẬP KHO'],
    [`Số phiếu: ${soPhieu}`, '', '', `Ngày lập: ${date || dayjs().format('DD/MM/YYYY')}`],
    [`Khách / NCC: ${customerName || 'All'}`, '', '', `Số xe: ${soXe || ''}`],
    [],
    ['STT', 'Vị trí', 'NCC', 'Sản phẩm', 'ĐVT', 'Net', 'Số lượng', 'Tổng Kgs', 'Đơn giá', 'Thành tiền']
  ];

  let tongSL = 0;
  let tongKgs = 0;
  let tongTien = 0;

  items.forEach((item, idx) => {
    const sl = Number(item.so_luong || 0);
    const net = Number(item.net || 0);
    const kgs = Math.round(sl * net * 100) / 100;
    const gia = Number(item.price || 0);
    const thanhTien = sl * gia;

    tongSL += sl;
    tongKgs += kgs;
    tongTien += thanhTien;

    excelData.push([
      idx + 1,
      item.position_name || '',
      item.customer_name || '',
      item.product_name || '',
      item.dvt || 'Thùng',
      net,
      sl,
      kgs,
      gia,
      thanhTien
    ]);
  });

  excelData.push(['TỔNG CỘNG', '', '', '', '', '', tongSL, tongKgs, '', tongTien]);

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PhieuNhap');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `PhieuNhap_${soPhieu}.xlsx`);
};

// =========================================================================
// 6. XUẤT EXCEL BÁO CÁO LỊCH SỬ / XUẤT NHẬP TỒN (.XLSX)
// =========================================================================
export const exportExcelReportHistory = ({ filterType, filteredData }) => {
  let title = 'BAO_CAO_LICH_SU';
  if (filterType === 'ALL') title = 'BC_XUAT_NHAP_TON';
  else if (filterType === 'STOCK') title = 'BC_TON_KHO';
  else if (filterType === 'OUT') title = 'BC_XUAT_KHO';
  else if (filterType === 'IN') title = 'BC_NHAP_KHO';

  const excelRows = [
    [title],
    [`Ngày in: ${dayjs().format('DD/MM/YYYY HH:mm')}`],
    [],
    ['STT', 'Ngày', 'Số Phiếu', 'Loại', 'Khách hàng / Đối tác', 'Vị trí', 'Tên Sản Phẩm', 'ĐVT', 'Net', 'Số Lượng', 'Tổng Net (Kg)', 'Đơn Giá', 'Ghi Chú']
  ];

  let totalSL = 0;
  let totalKg = 0;

  filteredData.forEach((r, idx) => {
    const sl = Number(r.so_luong || 0);
    const net = Number(r.net || 0);
    const kg = Math.round(sl * net * 100) / 100;
    totalSL += sl;
    totalKg += kg;

    excelRows.push([
      idx + 1,
      r.date || '',
      r.so_phieu || '',
      r.type || '',
      r.customer_name || r.receiver_name || r.pos || '',
      r.position_name || '',
      r.product_name || '',
      r.dvt || 'Thùng',
      net,
      sl,
      kg,
      r.price || 0,
      r.note || ''
    ]);
  });

  excelRows.push(['TỔNG CỘNG', '', '', '', '', '', '', '', '', totalSL, totalKg, '', '']);

  const ws = XLSX.utils.aoa_to_sheet(excelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BaoCao');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${title}_${dayjs().format('HHmmss_DDMM')}.xlsx`);
};