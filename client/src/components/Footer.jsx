import { Link } from 'react-router-dom';
import {
  Mail, Phone, MapPin, Facebook, Instagram, Twitter,
  ShieldCheck, Truck, Clock3, Zap,
} from 'lucide-react';
import BrandLogo from './BrandLogo';

const TRUST_ITEMS = [
  { icon: ShieldCheck, text: 'Licensed pharmacy partners' },
  { icon: Truck,       text: 'Fast, tracked delivery' },
  { icon: Clock3,      text: 'Support 7 days a week' },
  { icon: Zap,         text: 'Instant GST invoices' },
];

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      {/* Trust strip */}
      <div className="footer-trust-strip">
        {TRUST_ITEMS.map(({ icon: Icon, text }) => (
          <div className="footer-trust-item" key={text}>
            <Icon size={18} strokeWidth={2} />
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* Main columns */}
      <div className="footer-main">
        {/* Brand column */}
        <div className="footer-col footer-brand-col">
          <Link to="/" className="footer-brand">
            <BrandLogo />
          </Link>
          <p className="footer-tagline">
            Genuine medicines, clear pricing, and a pharmacist-verified prescription
            flow — delivered to your door or ready at the counter.
          </p>
          <div className="footer-social">
            <a href="https://www.facebook.com/pharmasync" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <Facebook size={16} strokeWidth={2} />
            </a>
            <a href="https://www.instagram.com/pharmasync" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Instagram size={16} strokeWidth={2} />
            </a>
            <a href="https://twitter.com/pharmasync" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
              <Twitter size={16} strokeWidth={2} />
            </a>
          </div>
        </div>

        {/* Shop */}
        <div className="footer-col">
          <h4 className="footer-col-title">Shop</h4>
          <Link to="/" className="footer-link">Browse Medicines</Link>
          <Link to="/cart" className="footer-link">My Cart</Link>
          <Link to="/orders" className="footer-link">Order History</Link>
          <Link to="/profile" className="footer-link">My Profile</Link>
          <Link to="/wishlist" className="footer-link">Wishlist</Link>
        </div>

        {/* Support */}
        <div className="footer-col">
          <h4 className="footer-col-title">Support</h4>
          <Link to="/support" className="footer-link">Help Center</Link>
          <Link to="/faqs" className="footer-link">FAQs</Link>
          <Link to="/shipping-policy" className="footer-link">Shipping Policy</Link>
          <Link to="/returns-policy" className="footer-link">Returns &amp; Refunds</Link>
          <Link to="/prescriptions" className="footer-link">Upload Prescription</Link>
        </div>

        {/* Legal */}
        <div className="footer-col">
          <h4 className="footer-col-title">Legal</h4>
          <Link to="/privacy-policy" className="footer-link">Privacy Policy</Link>
          <Link to="/terms" className="footer-link">Terms of Service</Link>
          <Link to="/admin/login" className="footer-link">Pharmacy Staff Login</Link>
        </div>

        {/* Contact */}
        <div className="footer-col">
          <h4 className="footer-col-title">Get in Touch</h4>
          <p className="footer-contact-line">
            <MapPin size={14} strokeWidth={2} />
            12 MG Road, Ahmedabad, Gujarat
          </p>
          <a className="footer-contact-line footer-link" href="tel:+917940001234">
            <Phone size={14} strokeWidth={2} /> +91 79 4000 1234
          </a>
          <a className="footer-contact-line footer-link" href="mailto:support@pharmasync.app">
            <Mail size={14} strokeWidth={2} /> support@pharmasync.app
          </a>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <p>© {year} PharmaSync. All rights reserved.</p>
        <p className="muted-text" style={{ color: '#9fb2aa' }}>
          Prices and offers are subject to prescription verification and stock availability.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
