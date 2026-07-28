import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from './ChatWidget';
import BackButton from './BackButton';

const PublicLayout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
      <ChatWidget />
      <BackButton />
    </>
  );
};

export default PublicLayout;
