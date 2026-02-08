import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BottomNavigation } from './BottomNavigation';
import { UpdateAvailableBanner } from './UpdateAvailableBanner';
import { NetworkStatus } from './NetworkStatus';
import { useAuth } from '../hooks/useAuth';
import './Layout.css';

export function Layout() {
  const { isAuthenticated } = useAuth();

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
            Game data synced from{' '}
            <a href="https://thegamesdb.net" target="_blank" rel="noopener noreferrer">TheGamesDB.net</a>
          </p>
          {import.meta.env.VITE_APP_VERSION && (
            <p className="footer-version">
              Version {import.meta.env.VITE_APP_VERSION}
            </p>
          )}
        </div>
      </footer>
      <UpdateAvailableBanner />
      {isAuthenticated && <BottomNavigation />}
    </div>
  );
}
