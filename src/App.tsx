import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Auth } from './pages/Auth';
import { Library } from './pages/Library';
import { Search } from './pages/Search';
import { GameDetails } from './pages/GameDetails';
import { NotFound } from './pages/NotFound';

// Get base path from Vite config
const basePath = import.meta.env.BASE_URL || '/';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={basePath}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="auth" element={<Auth />} />
            <Route path="search" element={<Search />} />
            <Route
              path="library"
              element={
                <ProtectedRoute>
                  <Library />
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
    </AuthProvider>
  );
}

export default App;
