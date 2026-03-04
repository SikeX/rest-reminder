import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MainWindow } from "./components/MainWindow";
import { ReminderWindow } from "./components/ReminderWindow";

function App() {
  const window = getCurrentWebviewWindow();
  const windowLabel = window ? window.label : "main";

  if (windowLabel === "reminder") {
    return <ReminderWindow />;
  }

  return <MainWindow />;
}

export default App;
