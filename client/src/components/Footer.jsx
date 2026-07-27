import { Link } from 'react-router-dom';
import {
  Pill, Mail, Phone, MapPin, Facebook, Instagram, Twitter,
  ShieldCheck, Truck, Clock3,
} from 'lucide-react';

// Non-functional placeholder links (Support/Legal columns, social icons) —
// there's no backing page for these yet, so clicks are inert rather than
// jumping the scroll position to the top via a bare `#` href.
const preventDefault = (e) => e.preventDefault();

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-trust-strip">
        <div className="footer-trust-item">
          <ShieldCheck size={18} strokeWidth={2} />
          <span>Licensed pharmacy partners</span>
        </div>
        <div className="footer-trust-item">
          <Truck size={18} strokeWidth={2} />
          <span>Fast, tracked delivery</span>
        </div>
        <div className="footer-trust-item">
          <Clock3 size={18} strokeWidth={2} />
          <span>Support 7 days a week</span>
        </div>
      </div>

      <div className="footer-main">
        <div className="footer-col footer-brand-col">
          <Link to="/" className="footer-brand">
            <span className="footer-brand-icon"><Pill size={18} strokeWidth={2.3} /></span>
            <span className="footer-brand-name">Pharma<span className="accent">Sync</span></span>
          </Link>
          <p className="footer-tagline">
            Genuine medicines, clear pricing, and a pharmacist-verified prescription flow —
            delivered to your door or ready at the counter.
          </p>
          <div className="footer-social">
            <a href="#" onClick={preventDefault} aria-label="Facebook"><Facebook size={16} strokeWidth={2} /></a>
            <a href="#" onClick={preventDefault} aria-label="Instagram"><Instagram size={16} strokeWidth={2} /></a>
            <a href="#" onClick={preventDefault} aria-label="Twitter"><Twitter size={16} strokeWidth={2} /></a>
          </div>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Shop</h4>
          <Link to="/" className="footer-link">Browse Medicines</Link>
          <Link to="/cart" className="footer-link">My Cart</Link>
          <Link to="/orders" className="footer-link">Order History</Link>
          <Link to="/profile" className="footer-link">My Profile</Link>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Support</h4>
          <a href="#" className="footer-link" onClick={preventDefault}>Contact Us</a>
          <a href="#" className="footer-link" onClick={preventDefault}>FAQs</a>
          <a href="#" className="footer-link" onClick={preventDefault}>Shipping Policy</a>
          <a href="#" className="footer-link" onClick={preventDefault}>Returns &amp; Refunds</a>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Legal</h4>
          <a href="#" className="footer-link" onClick={preventDefault}>Privacy Policy</a>
          <a href="#" className="footer-link" onClick={preventDefault}>Terms of Service</a>
          <Link to="/admin/login" className="footer-link">Pharmacy Staff Login</Link>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Get in Touch</h4>
          <p className="footer-contact-line"><MapPin size={14} strokeWidth={2} /> 12 MG Road, Ahmedabad, Gujarat</p>
          <p className="footer-contact-line"><Phone size={14} strokeWidth={2} /> +91 79 4000 1234</p>
          <p className="footer-contact-line"><Mail size={14} strokeWidth={2} /> support@pharmasync.app</p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {year} PharmaSync. All rights reserved.</p>
        <p className="muted-text">Prices and offers are subject to prescription verification and stock availability.</p>
      </div>
    </footer>
  );
};

export default Footer;
