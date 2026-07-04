import { Link } from 'react-router-dom';
import { Search, ShoppingCart, ClipboardList, ShieldCheck, Truck, FileText } from 'lucide-react';

const features = [
  { icon: Search, title: 'Search & compare', text: 'Find medicines fast with filters and sorting.' },
  { icon: ShoppingCart, title: 'Order online', text: 'Add to cart, checkout, and track delivery.' },
  { icon: ClipboardList, title: 'Order history', text: 'Revisit past orders and reorder in a click.' },
  { icon: FileText, title: 'GST invoices', text: 'Download clean, itemized invoices for every order.' },
  { icon: Truck, title: 'Doorstep delivery', text: 'Live address selection with map-based delivery.' },
  { icon: ShieldCheck, title: 'Verified accounts', text: 'Email verification keeps every account secure.' },
];

const Home = () => {
  return (
    <div className="home-page">
      <section className="hero">
        <p className="auth-eyebrow center">Pharmacy Management, Simplified</p>
        <h1 className="hero-title">Your neighborhood pharmacy, online.</h1>
        <p className="hero-subtitle">
          Order medicines, track deliveries, and manage prescriptions — or, if
          you run the pharmacy, handle inventory and billing from one place.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn-primary hero-btn">Get started as a patient</Link>
          <Link to="/admin/login" className="btn-secondary hero-btn">I'm pharmacy staff</Link>
        </div>
      </section>

      <section className="feature-grid">
        {features.map(({ icon: Icon, title, text }) => (
          <div className="feature-card" key={title}>
            <Icon size={22} strokeWidth={2} className="feature-icon" />
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Home;
