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
 * Streams a GST-style tax invoice PDF for the given order directly to the
 * provided writable stream (typically an Express `res`).
 */
const generateInvoicePdf = (order, res) => {
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
    .text('Pharmacy Management System — Demo Storefront', leftX, 74)
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
    .text(`Invoice No: ${order.invoiceNumber}`, leftX, 135, { width: pageWidth, align: 'right' })
    .text(`Date: ${formatDate(order.createdAt)}`, leftX, 148, { width: pageWidth, align: 'right' });

  doc.moveTo(leftX, 170).lineTo(leftX + pageWidth, 170).strokeColor('#dddddd').stroke();

  // --- Bill To --------------------------------------------------------
  let y = 185;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Bill To', leftX, y);
  y += 14;
  doc.font('Helvetica').fontSize(9.5).fillColor('#333333');
  doc.text(order.user?.name || 'Customer', leftX, y);
  y += 13;
  if (order.user?.phone) {
    doc.text(order.user.phone, leftX, y);
    y += 13;
  }
  doc.text(`${order.address.line1}`, leftX, y);
  y += 13;
  doc.text([order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(', '), leftX, y);
  y += 26;

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

  order.items.forEach((item, i) => {
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
  const taxableValue = order.totalAmount / (1 + DEMO_GST_RATE);
  const gstAmount = order.totalAmount - taxableValue;
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
  totalsRow('Grand Total', formatCurrency(order.totalAmount), true);

  // --- Payment info -------------------------------------------------
  totalsY += 14;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Payment', leftX, totalsY);
  totalsY += 14;
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#333333')
    .text(`Method: ${order.paymentMethod === 'UPI' ? 'UPI (Demo)' : 'Cash on Delivery'}`, leftX, totalsY);
  totalsY += 13;
  doc.text(`Status: ${order.paymentStatus}`, leftX, totalsY);

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

module.exports = generateInvoicePdf;
