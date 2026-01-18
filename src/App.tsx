import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Auth } from './pages/Auth';
import { Library } from './pages/Library';
import { Search } from './pages/Search';
import { Friends } from './pages/Friends';
import { GameDetails } from './pages/GameDetails';
import { SharedLibrary } from './pages/SharedLibrary';
import { Compare } from './pages/Compare';
import { Settings } from './pages/Settings';
import { Achievements } from './pages/Achievements';
import { NotFound } from './pages/NotFound';
import { usePreferences } from './hooks/usePreferences';

// Get base path from Vite config
const basePath = import.meta.env.BASE_URL || '/';

function AppContent() {
  const { preferences } = usePreferences();
  
  // Determine if dark mode is active
  const isDarkMode = preferences.theme === 'dark' || 
    (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <>
      <BrowserRouter basename={basePath}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="auth" element={<Auth />} />
            <Route
              path="search"
              element={
                <ProtectedRoute>
                  <Search />
                </ProtectedRoute>
              }
            />
            <Route path="shared/:shareId" element={<SharedLibrary />} />
            <Route path="compare/:shareId1/:shareId2" element={<Compare />} />
            <Route
              path="library"
              element={
                <ProtectedRoute>
                  <Library />
                </ProtectedRoute>
              }
            />
            <Route
              path="friends"
              element={
                <ProtectedRoute>
                  <Friends />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="achievements"
              element={
                <ProtectedRoute>
                  <Achievements />
                </ProtectedRoute>
              }
            />
            <Route
              path="game/:id"
              element={
                <ProtectedRoute>
                  <GameDetails />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          // Default options
          duration: 4000,
          // Dark mode styling
          style: {
            background: isDarkMode ? '#2a2a2a' : '#ffffff',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.87)' : '#213547',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '14px',
            maxWidth: '400px',
          },
          // Success
          success: {
            iconTheme: {
              primary: isDarkMode ? '#81c784' : '#4caf50',
              secondary: isDarkMode ? '#2a2a2a' : '#ffffff',
            },
          },
          // Error
          error: {
            iconTheme: {
              primary: isDarkMode ? '#ff6b6b' : '#e60012',
              secondary: isDarkMode ? '#2a2a2a' : '#ffffff',
            },
          },
        }}
      />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
