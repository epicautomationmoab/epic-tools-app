import InviteTeamPanel from "./InviteTeamPanel";

export default function EmployeeAuthSetupPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f5f7",
        padding: 32,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <InviteTeamPanel />
    </main>
  );
}
