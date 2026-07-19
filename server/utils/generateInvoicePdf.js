const PDFDocument = require('pdfkit');

// Medicine MRPs in India are already GST-inclusive, so this invoice
// back-calculates the tax breakup from the charged total rather than
// adding tax on top of it (which would overcharge the customer). A flat
// 12% rate is used as a simplification since the dataset doesn't carry
// per-item HSN/GST-slab data — real slabs vary (0% / 5% / 12%) by drug
// category. Clearly labelled as a demo calculation on the PDF itself.
const DEMO_GST_RATE = 0.12;

const formatCurrency = (n) => `Rs. ${Number(n).toFixed(2)}`;
const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Renders a GST-style tax invoice PDF from a normalized, channel-agnostic
 * shape, streaming it directly to the provided writable stream (typically
 * an Express `res`). Both the online-order invoice and the POS receipt
 * build one of these and hand it here, so there's exactly one place that
 * knows how to lay out an invoice.
 *
 * invoiceData shape:
 * {
 *   invoiceNumber, createdAt, channelLabel: 'Online Storefront' | 'In-Store Sale',
 *   billTo: { name, phone, addressLines: [string] } | null (null = walk-in, no address to print),
 *   items: [{ name, price, quantity }],
 *   totalAmount,
 *   paymentMethod, paymentStatus,
 * }
 */
const renderInvoicePdf = (invoiceData, res) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftX = doc.page.margins.left;

  // --- Header -------------------------------------------------------
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#123B36').text('PharmaCare', leftX, 50);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#555555')
    .text(`Pharmacy Management System — ${invoiceData.channelLabel}`, leftX, 74)
    .text('GSTIN: 24DEMOGSTIN1Z5 (demo placeholder)', leftX, 87);

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#000000')
    .text('TAX INVOICE', leftX, 115, { width: pageWidth, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#555555')
    .text(`Invoice No: ${invoiceData.invoiceNumber}`, leftX, 135, { width: pageWidth, align: 'right' })
    .text(`Date: ${formatDate(invoiceData.createdAt)}`, leftX, 148, { width: pageWidth, align: 'right' });

  doc.moveTo(leftX, 170).lineTo(leftX + pageWidth, 170).strokeColor('#dddddd').stroke();

  // --- Bill To --------------------------------------------------------
  let y = 185;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Bill To', leftX, y);
  y += 14;
  doc.font('Helvetica').fontSize(9.5).fillColor('#333333');
  const billTo = invoiceData.billTo;
  doc.text(billTo?.name || 'Walk-in Customer', leftX, y);
  y += 13;
  if (billTo?.phone) {
    doc.text(billTo.phone, leftX, y);
    y += 13;
  }
  (billTo?.addressLines || []).forEach((line) => {
    if (!line) return;
    doc.text(line, leftX, y);
    y += 13;
  });
  y += 13;

  // --- Item table -------------------------------------------------
  const col = { name: leftX, qty: leftX + 300, price: leftX + 350, amount: leftX + 430 };
  const tableTop = y;

  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#ffffff');
  doc.rect(leftX, tableTop, pageWidth, 20).fill('#123B36');
  doc.fillColor('#ffffff');
  doc.text('Item', col.name + 6, tableTop + 6);
  doc.text('Qty', col.qty, tableTop + 6, { width: 40, align: 'right' });
  doc.text('Unit Price', col.price, tableTop + 6, { width: 70, align: 'right' });
  doc.text('Amount', col.amount, tableTop + 6, { width: 70, align: 'right' });

  let rowY = tableTop + 20;
  doc.font('Helvetica').fontSize(9.5).fillColor('#222222');

  invoiceData.items.forEach((item, i) => {
    const rowHeight = 20;
    if (i % 2 === 1) {
      doc.rect(leftX, rowY, pageWidth, rowHeight).fill('#f4f6f1');
      doc.fillColor('#222222');
    }
    doc.text(item.name, col.name + 6, rowY + 5, { width: 290 });
    doc.text(String(item.quantity), col.qty, rowY + 5, { width: 40, align: 'right' });
    doc.text(formatCurrency(item.price), col.price, rowY + 5, { width: 70, align: 'right' });
    doc.text(formatCurrency(item.price * item.quantity), col.amount, rowY + 5, { width: 70, align: 'right' });
    rowY += rowHeight;
  });

  doc.rect(leftX, tableTop, pageWidth, rowY - tableTop).strokeColor('#dddddd').stroke();

  // --- Totals / GST breakup -----------------------------------------
  const taxableValue = invoiceData.totalAmount / (1 + DEMO_GST_RATE);
  const gstAmount = invoiceData.totalAmount - taxableValue;
  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;

  let totalsY = rowY + 16;
  const totalsLabelX = col.price;
  const totalsValueWidth = 70;

  const totalsRow = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor('#222222');
    doc.text(label, totalsLabelX - 90, totalsY, { width: 160, align: 'right' });
    doc.text(value, col.amount, totalsY, { width: totalsValueWidth, align: 'right' });
    totalsY += 16;
  };

  totalsRow('Taxable Value', formatCurrency(taxableValue));
  totalsRow(`CGST @ ${(DEMO_GST_RATE / 2) * 100}%`, formatCurrency(cgst));
  totalsRow(`SGST @ ${(DEMO_GST_RATE / 2) * 100}%`, formatCurrency(sgst));
  doc.moveTo(totalsLabelX - 90, totalsY).lineTo(leftX + pageWidth, totalsY).strokeColor('#dddddd').stroke();
  totalsY += 6;
  totalsRow('Grand Total', formatCurrency(invoiceData.totalAmount), true);

  // --- Payment info -------------------------------------------------
  totalsY += 14;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Payment', leftX, totalsY);
  totalsY += 14;
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#333333')
    .text(`Method: ${invoiceData.paymentMethod}`, leftX, totalsY);
  totalsY += 13;
  doc.text(`Status: ${invoiceData.paymentStatus}`, leftX, totalsY);

  // --- Footer -------------------------------------------------------
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#999999')
    .text(
      'GST figures above are a simplified demo calculation (flat 12% back-calculated from the MRP-inclusive total) ' +
        'for project demonstration purposes only and do not reflect real per-medicine HSN/GST slabs.',
      leftX,
      doc.page.height - 70,
      { width: pageWidth, align: 'center' }
    );

  doc.end();
};

// --- Adapters: build the normalized invoiceData shape from each order type

/**
 * @route consumer: orderController.downloadInvoice (online storefront orders)
 */
const generateInvoicePdf = (order, res) => {
  const invoiceData = {
    invoiceNumber: order.invoiceNumber,
    createdAt: order.createdAt,
    channelLabel: 'Online Storefront',
    billTo: {
      name: order.user?.name,
      phone: order.user?.phone,
      addressLines: [
        order.address.line1,
        [order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(', '),
      ],
    },
    items: order.items,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod === 'UPI' ? 'UPI (Demo)' : 'Cash on Delivery',
    paymentStatus: order.paymentStatus,
  };
  renderInvoicePdf(invoiceData, res);
};

/**
 * @route consumer: posController.downloadReceipt (in-store counter sales)
 */
const generatePOSReceiptPdf = (sale, res) => {
  const invoiceData = {
    invoiceNumber: sale.invoiceNumber,
    createdAt: sale.createdAt,
    channelLabel: 'In-Store Sale',
    billTo: sale.customerName || sale.customerPhone
      ? { name: sale.customerName, phone: sale.customerPhone, addressLines: [] }
      : null, // walk-in, no name captured — prints "Walk-in Customer"
    items: sale.items,
    totalAmount: sale.totalAmount,
    paymentMethod: sale.paymentMethod,
    paymentStatus: 'Paid',
  };
  renderInvoicePdf(invoiceData, res);
};

module.exports = generateInvoicePdf;
module.exports.generateInvoicePdf = generateInvoicePdf;
module.exports.generatePOSReceiptPdf = generatePOSReceiptPdf;
