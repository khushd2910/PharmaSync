import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import ChatWidget from './ChatWidget';

const PublicLayout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
      <ChatWidget />
    </>
  );
};

export default PublicLayout;
