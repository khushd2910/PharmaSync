import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoiceMailto, buildOrderShareLinks, getOrderTimelinePreview } from './checkoutConfirmation.js';

test('buildOrderShareLinks creates SMS and WhatsApp intents', () => {
  const result = buildOrderShareLinks({ invoiceNumber: 'INV-20260731-ABC', _id: 'order-123' }, 'https://pharmasync.app/orders/order-123');

  assert.match(result.sms, /^sms:\?/);
  assert.match(result.whatsapp, /wa\.me\/\?/);
  assert.match(result.sms, /INV-20260731-ABC/);
  assert.match(result.whatsapp, /Track%20your%20Pharmasync%20order/);
});

test('getOrderTimelinePreview marks the current stage', () => {
  const timeline = getOrderTimelinePreview({ orderStatus: 'Pending' });

  assert.equal(timeline[0].current, true);
  assert.equal(timeline[1].current, false);
  assert.equal(timeline[0].label, 'Order placed');
});

test('buildInvoiceMailto includes a download link', () => {
  const mailto = buildInvoiceMailto({ invoiceNumber: 'INV-20260731-ABC', _id: 'order-123' }, 'http://localhost:5000/api');

  assert.match(mailto, /^mailto:/);
  assert.match(mailto, /INV-20260731-ABC/);
  assert.match(mailto, /http%3A%2F%2Flocalhost%3A5000%2Fapi%2Forders%2Forder-123%2Finvoice/);
});
