import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ApiAllowanceIndicator } from './ApiAllowanceFooter';
import { UpdateAvailableBanner } from './UpdateAvailableBanner';
import { NetworkStatus } from './NetworkStatus';
import './Layout.css';

export function Layout() {
  return (
    <div className="layout">
      <Header />
      <NetworkStatus />
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-content">
          <p>
            &copy; {new Date().getFullYear()} My Switch Library. Built with ❤️ for Nintendo fans.
          </p>
          <p className="footer-links">
            <a href="https://www.refractored.com/terms" target="_blank" rel="noopener noreferrer">Terms</a>
            {' · '}
            <a href="https://www.refractored.com/about#privacy-policy" target="_blank" rel="noopener noreferrer">Privacy</a>
          </p>
          <p className="footer-attribution">
            Game data provided by{' '}
            <a href="https://thegamesdb.net" target="_blank" rel="noopener noreferrer">TheGamesDB.net</a>
          </p>
          {import.meta.env.VITE_APP_VERSION && (
            <p className="footer-version">
              Version {import.meta.env.VITE_APP_VERSION}
            </p>
          )}
        </div>
        <ApiAllowanceIndicator />
      </footer>
      <UpdateAvailableBanner />
    </div>
  );
}
