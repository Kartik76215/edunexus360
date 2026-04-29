import Login from "./Login";
import Dashboard from "./Dashboard";
import FacultyDashboard from "./FacultyDashboard";
import StudentDashboard from "./StudentDashboard";
import "./App.css";

function App() {
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  if (!user) return <Login />;
  if (user.role === "admin") return <Dashboard />;
  if (user.role === "faculty") return <FacultyDashboard />;
  if (user.role === "student") return <StudentDashboard />;

  return <Login />;
}

export default App;
