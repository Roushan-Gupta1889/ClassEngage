import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";

export default function Home(){
  const { user, logout } = useAuth();
  return (
    <div>
      <div className="card">
        <h2>Welcome to ClassEngage</h2>
        <p className="small">Live polls & session leaderboards for Google Meet — built for PW IOI</p>
        {!user ? <Link to="/login"><button className="btn">Sign in</button></Link> : <button className="btn" onClick={logout}>Sign out</button>}
      </div>
      <div className="grid">
        <div className="card">
          <h3>How it works</h3>
          <ol>
            <li>Create session → copy session id</li>
            <li>Open Google Meet → click extension popup → Start Session (it detects Meet ID)</li>
            <li>Launch poll from dashboard → students answer in overlay → leaderboard updates live</li>
          </ol>
        </div>
        <div className="card">
          <h4>Quick tips</h4>
          <p className="small">Use the “Create Session” button to create a session bound to a Meet link. You can copy the session ID and paste into the extension popup if needed.</p>
        </div>
      </div>
    </div>
  );
}
