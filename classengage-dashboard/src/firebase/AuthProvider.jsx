import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "./init";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const AuthContext = createContext();

export function useAuth(){ return useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  useEffect(()=> {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  },[]);
  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };
  const logout = async () => signOut(auth);
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}
