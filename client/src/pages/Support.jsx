import { Link, useSearchParams } from 'react-router-dom';
import { LifeBuoy, Mail, Phone, FileText } from 'lucide-react';

const Support = () => {
  const [searchParams] = useSearchParams();
  const order = searchParams.get('order');

  return (
    <div className="support-page">
      <div className="dashboard-header">
        <h1 className="page-title">Help Center</h1>
        <p className="muted-text">Find quick answers, submit a support request, or get help with your order.</p>
      </div>

      <div className="support-grid">
        <section className="checkout-section">
          <h2 className="checkout-section-title"><LifeBuoy size={16} strokeWidth={2} /> Recommended help topics</h2>
          <ul className="support-topic-list">
            <li><Link to="/faqs">Track my order</Link></li>
            <li><Link to="/faqs">Prescription verification</Link></li>
            <li><Link to="/faqs">Payment & refunds</Link></li>
          </ul>
        </section>

        <section className="checkout-section">
          <h2 className="checkout-section-title">Contact support</h2>
          <p>Need a pharmacist or customer support agent to review your order?</p>
          <div className="support-card">
            <p><strong>Phone support</strong></p>
            <a href="tel:+917940001234" className="link-btn"><Phone size={14} strokeWidth={2} /> Call +91 79 4000 1234</a>
          </div>
          <div className="support-card">
            <p><strong>Email support</strong></p>
            <a href={`mailto:support@pharmasync.app?subject=${encodeURIComponent(order ? `Help with order ${order}` : 'Help with my order')}`} className="link-btn"><Mail size={14} strokeWidth={2} /> Email support</a>
          </div>
        </section>
      </div>

      <section className="checkout-section">
        <h2 className="checkout-section-title"><FileText size={16} strokeWidth={2} /> How to get support faster</h2>
        <ol className="support-steps-list">
          <li>Include your order number and preferred contact details.</li>
          <li>Mention whether this is a delivery, dosage, or refund request.</li>
          <li>We aim to respond within 2 business hours for urgent pharmacy support.</li>
        </ol>
      </section>
    </div>
  );
};

export default Support;
