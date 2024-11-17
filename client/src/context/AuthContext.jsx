// client/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import supabase from '../supabaseClient';


const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [name, setName] = useState(null);
  const [role, setRole] = useState(null);
  const [branch, setBranch] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserDetails = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('role, name,branch')
        .eq('auth_user_id', userId)
        .single();

      if (error) {
        console.error("Error fetching role:", error);
        return { role: null, name: null, branch:null };
      }

      return { role: data.role || null, name: data.name || null, branch: data.branch || null };
    } catch (err) {
      console.error("Unexpected error fetching role:", err);
      return { role: null, name: null, branch:null };
    }
  };

  const loadUserSession = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const userId = session.user.id;
      setUser(session.user);
      const userDetails = await fetchUserDetails(userId);
      setRole(userDetails.role);
      setName(userDetails.name);
      setBranch(userDetails.branch);
      // console.log("User role set to:", userDetails.role);
      // console.log("User name set to:", userDetails.name);
      // console.log("User name set to:", userDetails.branch);
    }
    setLoading(false);
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        loadUserSession();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
        setName(null);
        setBranch(null);
      }
    });

    loadUserSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);


  const login = (session) => {
    setUser(session.user);
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error during logout:", error);
    }
    setUser(null);
    setRole(null);
    setName(null);
    setBranch(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, name,branch, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
