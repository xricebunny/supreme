"use client";

const navItems = [
  { icon: "📈", label: "Trade", active: true },
  { icon: "🏆", label: "Leaderboard", active: false },
  { icon: "👤", label: "Profile", active: false },
];

export default function Sidebar() {
  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-30 flex flex-col"
      style={{
        width: 200,
        background: "#0a0f0d",
        borderRight: "1px solid #1e3329",
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-8">
        <h1
          className="text-xl font-bold tracking-tight"
          style={{
            color: "#00ff88",
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "-0.5px",
          }}
        >
          SUPREME
        </h1>
        <div className="text-xs mt-1" style={{ color: "#4a7a66" }}>
          FLOW Predictions
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <button
            key={item.label}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-colors"
            style={{
              background: item.active ? "#111a16" : "transparent",
              color: item.active ? "#ffffff" : "#4a7a66",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: item.active ? 600 : 400,
            }}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom icons */}
      <div className="flex items-center gap-2 px-5 pb-6">
        <button
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{
            width: 40,
            height: 40,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            color: "#4a7a66",
          }}
        >
          ⚙️
        </button>
        <button
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{
            width: 40,
            height: 40,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            color: "#4a7a66",
          }}
        >
          🎵
        </button>
      </div>
    </aside>
  );
}
