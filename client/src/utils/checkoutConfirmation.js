const ORDER_TIMELINE_STEPS = [
  { label: 'Order placed', description: 'Your order is confirmed and being prepared.' },
  { label: 'Packed', description: 'Your medicines are being packed.' },
  { label: 'Out for delivery', description: 'A delivery partner is on the way.' },
  { label: 'Delivered', description: 'Your order has been delivered.' },
];

export const getOrderTimelinePreview = (order) => {
  const status = order?.orderStatus || 'Pending';
  const currentIndex = ORDER_TIMELINE_STEPS.findIndex((step) => step.label === status || step.label === 'Order placed' && status === 'Pending');
  const baseIndex = currentIndex >= 0 ? currentIndex : 0;

  return ORDER_TIMELINE_STEPS.map((step, index) => ({
    ...step,
    current: index === baseIndex,
    completed: index < baseIndex,
  }));
};

export const buildInvoiceMailto = (order, baseUrl = '') => {
  const invoiceNumber = order?.invoiceNumber || 'your order';
  const invoiceUrl = `${baseUrl}/orders/${order?._id || 'order'}/invoice`;
  const subject = encodeURIComponent(`Invoice for ${invoiceNumber}`);
  const body = encodeURIComponent(`Hi there!\n\nYour invoice for ${invoiceNumber} is ready to download:\n${invoiceUrl}`);
  return `mailto:?subject=${subject}&body=${body}`;
};

export const buildOrderShareLinks = (order, orderUrl) => {
  const invoiceNumber = order?.invoiceNumber || 'your order';
  const message = `Hi! I’ve placed an order for ${invoiceNumber}. Track your Pharmasync order here: ${orderUrl}`;
  const smsUrl = `sms:?&body=${encodeURIComponent(message)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Track your Pharmasync order: ${orderUrl}`)}`;
  return { sms: smsUrl, whatsapp: whatsappUrl };
};
