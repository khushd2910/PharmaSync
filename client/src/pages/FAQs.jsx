import { Link } from 'react-router-dom';

const faqs = [
  {
    question: 'How can I track my order?',
    answer: 'Visit your Order History and click an order to see the latest delivery status and timeline.',
  },
  {
    question: 'What happens after I upload a prescription?',
    answer: 'Our pharmacy team reviews the prescription and confirms your order within a few hours. You’ll get an email once it is approved.',
  },
  {
    question: 'How do I request a refund?',
    answer: 'Refunds aren\u2019t self-service yet. Contact support with your order number and we\u2019ll review it — once approved, the refund status will show on that order\u2019s Payment details.',
  },
];

const FAQs = () => (
  <div className="support-page">
    <div className="dashboard-header">
      <h1 className="page-title">FAQs</h1>
      <p className="muted-text">Common questions and fast answers for pharmacy orders.</p>
    </div>
    <div className="checkout-section">
      {faqs.map((faq) => (
        <div key={faq.question} className="faq-item">
          <h3>{faq.question}</h3>
          <p>{faq.answer}</p>
        </div>
      ))}
      <p className="muted-text">Still have questions? <Link to="/support">Contact support</Link>.</p>
    </div>
  </div>
);

export default FAQs;
