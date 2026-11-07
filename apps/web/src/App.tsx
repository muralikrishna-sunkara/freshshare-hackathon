import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { ClaimPage } from "./pages/ClaimPage";
import { MapHome } from "./pages/MapHome";
import { Pickups } from "./pages/Pickups";
import { ShareFood } from "./pages/ShareFood";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapHome />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/share"
          element={
            <RequireAuth>
              <ShareFood />
            </RequireAuth>
          }
        />
        <Route path="/pickups" element={<RequireAuth><Pickups /></RequireAuth>} />
        <Route path="/pickups/:id" element={<RequireAuth><ClaimPage /></RequireAuth>} />
        <Route path="*" element={<MapHome />} />
      </Routes>
    </BrowserRouter>
  );
}
