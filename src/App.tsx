import { useState } from "react";
import Studio from "./components/studio/Studio";
import Landing from "./components/studio/Landing";

export default function App() {
  const [view, setView] = useState<"landing" | "studio">("landing");
  return view === "landing" ? (
    <Landing onStart={() => setView("studio")} />
  ) : (
    <Studio onHome={() => setView("landing")} />
  );
}
