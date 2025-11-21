import React from "react";
import { useAuth } from "../firebase/AuthProvider";
import { useNavigate } from "react-router-dom";

export default function Login(){
  const { user, login } = useAuth();
  const nav = useNavigate();
  const handle = async ()=> {
    await login();
    nav("/");
  };
  return (
    <div className="container">
      <div className="card" style={{maxWidth:480, margin:'40px auto', textAlign:'center'}}>
        <h2>Instructor Login</h2>
        <p className="small">Sign in with Google to manage sessions & polls</p>
        <button className="btn" onClick={handle}>Sign in with Google</button>
      </div>
    </div>
  );
}
