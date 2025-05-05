import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, HashRouter, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/auth/AuthPage";
import Lobby from "./components/online/Lobby";
import OnlineGame from "./components/online/OnlineGame";

const queryClient = new QueryClient();

// Root component to handle initial authentication state
const AppRoutes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Log for debugging - Important to track user and loading states
  useEffect(() => {
    console.log("Auth state updated:", {
      user: user ? user.email : 'null',
      loading,
      path: location.pathname
    });

    // Handle redirection when authentication state changes and loading completes
    if (!loading) {
      if (user && location.pathname === '/login') {
        console.log("Loading complete, user authenticated - redirecting to home");
        // Use timeout to ensure this happens after render
        setTimeout(() => navigate('/', { replace: true }), 0);
      }
    }
  }, [user, loading, navigate, location.pathname]);

  // Loading state - show while authentication is being checked
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#312e2b] text-white">
        <div className="w-8 h-8 border-t-2 border-l-2 border-blue-500 rounded-full animate-spin mb-4"></div>
        <p>Đang tải ứng dụng...</p>
      </div>
    );
  }

  // Authentication check complete, render appropriate routes
  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <AuthPage />
      } />
      <Route path="/" element={
        user ? <Index /> : <Navigate to="/login" replace />
      } />
      <Route path="/lobby" element={
        user ? <Lobby /> : <Navigate to="/login" replace />
      } />
      <Route path="/game/:gameId" element={
        user ? <OnlineGame /> : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Use a wrapper component to ensure useAuth is only called after AuthProvider is mounted
const AppWithAuth = () => {
  useEffect(() => {
    // Debug log to confirm component mounted
    console.log("AppWithAuth mounted");
  }, []);

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppWithAuth />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
