import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";

export default function Home(){
  const { user, logout } = useAuth();
  return (
    <div className="container">
      {/* Hero Section */}
      <div className="card" style={{textAlign:'center', padding:'48px 24px', background:'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color:'white', border:'none'}}>
        <h1 style={{fontSize:32, fontWeight:700, marginBottom:8}}>Welcome to ClassEngage</h1>
        <p style={{opacity:0.9, fontSize:16, marginBottom:24}}>
          Live polls & real-time leaderboards for Google Meet
        </p>
        {!user ? (
          <Link to="/login">
            <button className="btn" style={{background:'white', color:'#6366f1', padding:'12px 32px', fontSize:16}}>
              Get Started
            </button>
          </Link>
        ) : (
          <div style={{display:'flex', gap:12, justifyContent:'center'}}>
            <Link to="/sessions">
              <button className="btn" style={{background:'white', color:'#6366f1', padding:'12px 24px'}}>
                My Sessions
              </button>
            </Link>
            <button className="btn outline" onClick={logout} style={{borderColor:'white', color:'white'}}>
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Features Grid */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:20, marginTop:24}}>
        <div className="card">
          <div style={{width:48, height:48, background:'#e0e7ff', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16}}>
            <span style={{fontSize:24}}>1</span>
          </div>
          <h4 style={{marginBottom:8}}>Create a Session</h4>
          <p className="small">Start a new session from the dashboard and get a unique session ID to share with students.</p>
        </div>

        <div className="card">
          <div style={{width:48, height:48, background:'#dbeafe', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16}}>
            <span style={{fontSize:24}}>2</span>
          </div>
          <h4 style={{marginBottom:8}}>Students Join via Extension</h4>
          <p className="small">Students install the Chrome extension and enter the session ID to join from Google Meet.</p>
        </div>

        <div className="card">
          <div style={{width:48, height:48, background:'#dcfce7', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16}}>
            <span style={{fontSize:24}}>3</span>
          </div>
          <h4 style={{marginBottom:8}}>Launch Polls & See Results</h4>
          <p className="small">Create MCQ polls, students answer in real-time, and leaderboard updates instantly.</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="card" style={{marginTop:24, display:'flex', gap:24, alignItems:'center', flexWrap:'wrap'}}>
        <div style={{flex:1, minWidth:250}}>
          <h4 style={{marginBottom:8}}>Built for Interactive Learning</h4>
          <p className="small">
            ClassEngage makes online classes more engaging with live polls during Google Meet sessions.
            Track student participation, see center-wise scores, and make learning fun!
          </p>
        </div>
        <div>
          <Link to="/sessions" className="btn">
            Start Teaching
          </Link>
        </div>
      </div>
    </div>
  );
}
