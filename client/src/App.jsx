/**
 * Composición raíz de la aplicación.
 * Orden de los providers (importa):
 *   BrowserRouter -> AuthProvider (sesión) -> SocketProvider (usa el token)
 *   -> Rutas.
 */

import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { AppRoutes } from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
