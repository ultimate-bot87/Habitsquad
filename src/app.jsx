import { useState, useEffect, useCallback } from "react";

// ─── PASTE YOUR APPS SCRIPT WEB APP URL HERE ───────────────
const API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
// ────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function api(params) {
  const url = API_URL + "?" + new URLSearchParams(params).toString();
  return fetch(url).then(r => r.json());
}

function getWeekDates() {
  const dates = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

// ─── COMPONENTS ─────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
      <div style={{
        width:32, height:32, border:"3px solid #222",
        borderTopColor:"#FF6B35", borderRadius:"50%",
        animation:"spin 0.7s linear infinite"
      }}/>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim() || !pin.trim()) return setError("Enter your name and PIN");
    setLoading(true); setError("");
    try {
      const res = await api({ action: "login", name: name.trim(), pin: pin.trim() });
      if (res.success) onLogin(res.user);
      else setError("Login failed. Try again.");
    } catch { setError("Could not connect. Check API URL."); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0C", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:340 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🔥</div>
          <div style={{ fontSize:28, fontWeight:800, letterSpacing:"-1px", color:"#F0EDE8", fontFamily:"'DM Mono',monospace" }}>
            HABIT<span style={{ color:"#FF6B35" }}>SQUAD</span>
          </div>
          <div style={{ fontSize:12, color:"#444", marginTop:8, letterSpacing:"0.15em" }}>TEAM HABIT TRACKER</div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="PIN (any number you choose)"
            value={pin}
            onChange={e => setPin(e.target.value)}
            type="password"
            onKeyDown={e => e.key === "Enter" && submit()}
            style={inputStyle}
          />
          {error && <div style={{ fontSize:12, color:"#FF6B35", textAlign:"center" }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={btnStyle}>
            {loading ? "Signing in…" : "SIGN IN / JOIN"}
          </button>
          <div style={{ fontSize:11, color:"#333", textAlign:"center", lineHeight:1.6 }}>
            New here? Just enter your name + a PIN you'll remember.<br/>Your account is created automatically.
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding:"14px 16px", background:"#141416", border:"1px solid #2A2A2C",
  borderRadius:12, color:"#F0EDE8", fontSize:14, outline:"none",
  fontFamily:"'DM Mono',monospace", width:"100%", boxSizing:"border-box",
};
const btnStyle = {
  padding:"14px", background:"#FF6B35", border:"none", borderRadius:12,
  color:"#fff", fontSize:13, fontWeight:700, letterSpacing:"0.1em",
  cursor:"pointer", fontFamily:"'DM Mono',monospace",
};

// ─── MAIN APP ────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hs_user")); } catch { return null; }
  });
  const [view, setView] = useState("today");
  const [habits, setHabits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [justChecked, setJustChecked] = useState(null);
  const [celebration, setCelebration] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const login = (u) => {
    localStorage.setItem("hs_user", JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem("hs_user");
    setUser(null);
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [habitsRes, logsRes, lbRes] = await Promise.all([
        api({ action: "getHabits" }),
        api({ action: "getLogs", userId: user.id }),
        api({ action: "getLeaderboard" }),
      ]);
      setHabits(Array.isArray(habitsRes) ? habitsRes : []);
      setLogs(Array.isArray(logsRes) ? logsRes : []);
      setLeaderboard(Array.isArray(lbRes) ? lbRes : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const isChecked = (habitId, date = TODAY) =>
    logs.some(l => l.habitId === habitId && l.date === date && (l.done === true || l.done === "TRUE"));

  const toggle = async (habitId) => {
    const done = !isChecked(habitId);
    // Optimistic update
    const existing = logs.findIndex(l => l.habitId === habitId && l.date === TODAY);
    if (existing >= 0) {
      setLogs(prev => prev.map((l, i) => i === existing ? { ...l, done } : l));
    } else {
      setLogs(prev => [...prev, { userId: user.id, habitId, date: TODAY, done: true }]);
    }
    if (done) {
      setJustChecked(habitId);
      setTimeout(() => setJustChecked(null), 600);
      const nowDone = habits.filter(h => h.id === habitId || isChecked(h.id)).length;
      if (nowDone === habits.length) {
        setCelebration(true);
        setTimeout(() => setCelebration(false), 2500);
      }
    }
    setSyncing(true);
    await api({ action: "logHabit", userId: user.id, habitId, date: TODAY, done: String(done) });
    setSyncing(false);
  };

  const todayDone = habits.filter(h => isChecked(h.id)).length;
  const pct = habits.length ? Math.round((todayDone / habits.length) * 100) : 0;

  const weekDates = getWeekDates();
  const weekData = weekDates.map(date => ({
    date, day: DAYS[new Date(date).getDay()],
    count: habits.filter(h => isChecked(h.id, date)).length,
    isToday: date === TODAY,
  }));

  const overallStreak = (() => {
    const doneDates = [...new Set(logs.filter(l => l.done === true || l.done === "TRUE").map(l => l.date))].sort().reverse();
    let s = 0;
    const cur = new Date(); cur.setHours(0,0,0,0);
    for (let i = 0; i < doneDates.length; i++) {
      const d = new Date(doneDates[i]); d.setHours(0,0,0,0);
      if (Math.round((cur - d) / 86400000) === i) s++;
      else break;
    }
    return s;
  })();

  if (!user) return <LoginScreen onLogin={login} />;

  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0C", color:"#F0EDE8", fontFamily:"'DM Mono','Courier New',monospace", position:"relative" }}>
      {/* Background */}
      <div style={{ position:"fixed", inset:0, zIndex:0, background:"radial-gradient(ellipse at 15% 50%, rgba(255,107,53,0.07) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(78,205,196,0.05) 0%, transparent 50%)", pointerEvents:"none" }}/>

      {/* Celebration */}
      {celebration && (
        <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(10,10,12,0.9)" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:64, marginBottom:12 }}>🔥</div>
            <div style={{ fontSize:28, fontWeight:800, letterSpacing:"-0.5px", color:"#FF6B35" }}>PERFECT DAY!</div>
            <div style={{ fontSize:12, color:"#666", marginTop:8 }}>All habits complete. Streak extended!</div>
          </div>
        </div>
      )}

      <div style={{ maxWidth:440, margin:"0 auto", padding:"24px 18px 100px", position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#444", textTransform:"uppercase", marginBottom:6 }}>
              {new Date().toLocaleDateString("en-US",{ weekday:"long", month:"short", day:"numeric" })}
              {syncing && <span style={{ color:"#FF6B35", marginLeft:8 }}>● syncing</span>}
            </div>
            <div style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.8px", lineHeight:1.1 }}>
              Hey, <span style={{ color:"#FF6B35" }}>{user.name}.</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ background:"#FF6B35", borderRadius:10, padding:"6px 12px", textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:800, lineHeight:1 }}>{overallStreak}</div>
              <div style={{ fontSize:9, letterSpacing:"0.15em", opacity:0.85, marginTop:1 }}>STREAK</div>
            </div>
            <button onClick={logout} style={{ background:"transparent", border:"1px solid #222", borderRadius:8, color:"#444", fontSize:10, padding:"6px 10px", cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.1em" }}>
              OUT
            </button>
          </div>
        </div>

        {/* Progress */}
        <div style={{ background:"#111113", border:"1px solid #1E1E20", borderRadius:16, padding:"18px 20px", marginBottom:18, display:"flex", alignItems:"center", gap:18 }}>
          <svg width={68} height={68} style={{ flexShrink:0 }}>
            <circle cx={34} cy={34} r={26} fill="none" stroke="#1E1E20" strokeWidth={5}/>
            <circle cx={34} cy={34} r={26} fill="none" stroke="#FF6B35" strokeWidth={5}
              strokeDasharray={`${2*Math.PI*26}`}
              strokeDashoffset={`${2*Math.PI*26*(1-pct/100)}`}
              strokeLinecap="round" transform="rotate(-90 34 34)"
              style={{ transition:"stroke-dashoffset 0.5s ease" }}
            />
            <text x={34} y={38} textAnchor="middle" fill="#F0EDE8" fontSize={14} fontWeight={700} fontFamily="DM Mono,monospace">{pct}%</text>
          </svg>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:"#555", marginBottom:6 }}>Today's Progress</div>
            <div style={{ fontSize:24, fontWeight:800, letterSpacing:"-1px" }}>
              {todayDone} <span style={{ color:"#2A2A2C", fontSize:16 }}>/ {habits.length}</span>
            </div>
            <div style={{ fontSize:11, color: pct===100 ? "#FF6B35" : "#444", marginTop:4 }}>
              {loading ? "Loading…" : pct===100 ? "Perfect day! 🔥" : `${habits.length - todayDone} left today`}
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display:"flex", gap:8, marginBottom:18 }}>
          {["today","week","team"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex:1, padding:"9px", borderRadius:10, border:"1px solid",
              borderColor: view===v ? "#FF6B35" : "#1E1E20",
              background: view===v ? "rgba(255,107,53,0.1)" : "transparent",
              color: view===v ? "#FF6B35" : "#444",
              fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
              cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
            }}>{v}</button>
          ))}
        </div>

        {/* TODAY */}
        {view === "today" && (
          loading ? <Spinner /> :
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {habits.map(h => {
              const done = isChecked(h.id);
              const pop = justChecked === h.id;
              return (
                <button key={h.id} onClick={() => toggle(h.id)} style={{
                  display:"flex", alignItems:"center", gap:14,
                  padding:"15px 16px",
                  background: done ? `${h.color}10` : "#111113",
                  border:`1px solid ${done ? h.color+"44" : "#1E1E20"}`,
                  borderRadius:14, cursor:"pointer", textAlign:"left",
                  width:"100%", fontFamily:"inherit",
                  transition:"all 0.2s",
                  transform: pop ? "scale(1.02)" : "scale(1)",
                }}>
                  <div style={{
                    width:40, height:40, borderRadius:10,
                    background: done ? h.color : "#1A1A1C",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:done ? 16 : 20, flexShrink:0, transition:"background 0.2s",
                    color: done ? "#fff" : "inherit",
                  }}>
                    {done ? "✓" : h.icon}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color: done ? "#F0EDE8" : "#666", letterSpacing:"-0.3px" }}>
                      {h.name}
                    </div>
                    <div style={{ fontSize:10, color: done ? h.color : "#333", marginTop:3, letterSpacing:"0.1em" }}>
                      {done ? "DONE TODAY" : "PENDING"}
                    </div>
                  </div>
                  <div style={{
                    width:20, height:20, borderRadius:"50%",
                    border:`2px solid ${done ? h.color : "#2A2A2C"}`,
                    background: done ? h.color : "transparent",
                    flexShrink:0, transition:"all 0.2s",
                  }}/>
                </button>
              );
            })}
          </div>
        )}

        {/* WEEK */}
        {view === "week" && (
          loading ? <Spinner /> :
          <div>
            <div style={{ background:"#111113", border:"1px solid #1E1E20", borderRadius:16, padding:"20px", marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#444", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:16 }}>Last 7 Days</div>
              <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:90 }}>
                {weekData.map((d, i) => (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                    <div style={{ position:"relative", width:"100%", display:"flex", justifyContent:"center" }}>
                      {d.count === habits.length && habits.length > 0 && (
                        <div style={{ position:"absolute", top:-18, fontSize:11 }}>🔥</div>
                      )}
                      <div style={{
                        width:"100%", minHeight:6,
                        height: `${habits.length ? (d.count / habits.length) * 70 : 6}px`,
                        background: d.isToday ? "#FF6B35" : d.count === habits.length && habits.length > 0 ? "#FF6B3588" : "#1E1E20",
                        borderRadius:4, transition:"height 0.5s ease",
                        border: d.isToday ? "none" : "none",
                      }}/>
                    </div>
                    <div style={{ fontSize:9, color: d.isToday ? "#FF6B35" : "#333" }}>{d.day}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label:"This Week", value:`${weekData.reduce((a,d) => a+d.count,0)} logs`, sub:"habits completed" },
                { label:"Perfect Days", value:`${weekData.filter(d => d.count === habits.length && habits.length > 0).length}`, sub:"out of 7 days" },
                { label:"Best Day", value: (() => { const best = weekData.reduce((a,b) => b.count>a.count?b:a, weekData[0]); return best?.day || "-"; })(), sub:"most habits done" },
                { label:"Streak", value:`${overallStreak}d`, sub:"consecutive days" },
              ].map((s,i) => (
                <div key={i} style={{ background:"#111113", border:"1px solid #1E1E20", borderRadius:14, padding:"16px" }}>
                  <div style={{ fontSize:10, color:"#444", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>{s.label}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:"#FF6B35", letterSpacing:"-0.5px" }}>{s.value}</div>
                  <div style={{ fontSize:10, color:"#333", marginTop:4 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEAM */}
        {view === "team" && (
          loading ? <Spinner /> :
          <div>
            <div style={{ fontSize:10, color:"#444", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:14 }}>
              Team Leaderboard · This Week
            </div>
            {leaderboard.length === 0 && (
              <div style={{ textAlign:"center", color:"#333", fontSize:13, padding:40 }}>No team data yet</div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {leaderboard.map((member, i) => {
                const isMe = member.id === user.id;
                return (
                  <div key={i} style={{
                    display:"flex", alignItems:"center", gap:14,
                    padding:"14px 16px",
                    background: isMe ? "rgba(255,107,53,0.07)" : "#111113",
                    border:`1px solid ${isMe ? "#FF6B3544" : "#1E1E20"}`,
                    borderRadius:14,
                  }}>
                    <div style={{
                      fontSize:13, fontWeight:800, width:18, textAlign:"center",
                      color: i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"#333",
                    }}>{i+1}</div>
                    <div style={{
                      width:36, height:36, borderRadius:"50%",
                      background: isMe ? "#FF6B35" : "#1A1A1C",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:11, fontWeight:700, color: isMe?"#fff":"#444", flexShrink:0,
                    }}>
                      {member.name.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color: isMe?"#F0EDE8":"#666" }}>
                        {member.name} {isMe && <span style={{ color:"#FF6B35", fontSize:10 }}>· you</span>}
                      </div>
                      <div style={{ marginTop:6, background:"#1A1A1C", borderRadius:3, height:4, overflow:"hidden" }}>
                        <div style={{
                          height:"100%", width:`${member.score}%`,
                          background: isMe ? "#FF6B35" : "#2A2A2C",
                          borderRadius:3, transition:"width 0.6s ease",
                        }}/>
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:16, fontWeight:800, color: isMe?"#FF6B35":"#555" }}>{member.score}%</div>
                      <div style={{ fontSize:10, color:"#333" }}>🔥 {member.streak}d</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:16, padding:"14px 16px", background:"#111113", border:"1px solid #1E1E20", borderRadius:14, fontSize:11, color:"#444", lineHeight:1.7 }}>
              Share your app URL with teammates.<br/>
              They sign in with their name + a PIN to join the leaderboard.
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"linear-gradient(transparent, #0A0A0C)", padding:"28px 20px 16px", textAlign:"center", zIndex:2 }}>
        <div style={{ fontSize:9, color:"#222", letterSpacing:"0.15em" }}>HABITsquad · POWERED BY GOOGLE SHEETS</div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        button:active { opacity: 0.8; }
        input:focus { border-color: #FF6B35 !important; }
        ::placeholder { color: #333; }
        scrollbar-width: none;
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
