import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getDashboardPath,
  getMeRequest,
  loginRequest,
  registerRequest,
} from "@/services/authService";

const AuthContext = createContext(null);

const TOKEN_KEY = "token";
const USER_KEY = "user";

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const persistAuth = useCallback((nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const loadUser = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await getMeRequest();
      persistAuth(storedToken, response.data.user);
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [clearAuth, persistAuth]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const handleForcedLogout = () => clearAuth();
    window.addEventListener("auth:logout", handleForcedLogout);
    return () => window.removeEventListener("auth:logout", handleForcedLogout);
  }, [clearAuth]);

  const login = useCallback(
    async (credentials) => {
      const response = await loginRequest(credentials);
      const { token: nextToken, user: nextUser } = response.data;
      persistAuth(nextToken, nextUser);
      return nextUser;
    },
    [persistAuth],
  );

  const register = useCallback(
    async (userData) => {
      const response = await registerRequest(userData);
      const { token: nextToken, user: nextUser } = response.data;
      persistAuth(nextToken, nextUser);
      return nextUser;
    },
    [persistAuth],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      isAuthenticated: Boolean(user && token),
      getDashboardPath,
    }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
