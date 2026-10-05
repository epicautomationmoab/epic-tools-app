export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f5f7f9",
        color: "#202733",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          width: 360,
          maxWidth: "calc(100vw - 40px)",
          background: "#ffffff",
          border: "1px solid #e3e7eb",
          borderRadius: 18,
          padding: "34px 36px",
          boxShadow: "0 14px 38px rgba(0,0,0,.08)",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            margin: "0 auto 18px",
            borderRadius: "50%",
            border: "4px solid #e6eaee",
            borderTopColor: "#c93f24",
            animation: "readiness-spin .8s linear infinite",
          }}
        />
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
          Loading Guest Readiness
        </div>
        <div style={{ color: "#68717b", fontSize: 14, lineHeight: 1.45 }}>
          Pulling the latest reservation status…
        </div>
        <style>{`
          @keyframes readiness-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
