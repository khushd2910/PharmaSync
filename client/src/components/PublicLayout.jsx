import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from './ChatWidget';
import BackButton from './BackButton';

// Pages where the customer-support chatbot has no business showing up:
// the whole admin section (including /admin/login), and the storefront's
// own login/signup screens.
const CHAT_HIDDEN_PATHS = ['/admin', '/login', '/register'];

const PublicLayout = () => {
  const location = useLocation();
  const hideChat = CHAT_HIDDEN_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
  );

  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
      {!hideChat && <ChatWidget />}
      <BackButton />
    </>
  );
};

export default PublicLayout;
