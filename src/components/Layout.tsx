import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ApiAllowanceIndicator } from './ApiAllowanceFooter';
import './Layout.css';

export function Layout() {
  return (
    <div className="layout">
      <Header />
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <p>
          &copy; {new Date().getFullYear()} My Switch Library. 
          Built with ❤️ for Nintendo fans.
        </p>
        <ApiAllowanceIndicator />
      </footer>
    </div>
  );
}
