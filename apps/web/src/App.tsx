import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { ClaimPage } from "./pages/ClaimPage";
import { ContactPage, ImprintPage, NotFoundPage, PrivacyPage, TermsPage } from "./pages/InfoPages";
import { Landing } from "./pages/Landing";
import { ListingPage } from "./pages/ListingPage";
import { MapHome } from "./pages/MapHome";
import { Pickups } from "./pages/Pickups";
import { Profile } from "./pages/Profile";
import { PublicProfile } from "./pages/PublicProfile";
import { ShareFood } from "./pages/ShareFood";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing redirectSignedIn />} />
        <Route path="/about" element={<Landing />} />
        <Route path="/map" element={<MapHome />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/imprint" element={<ImprintPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/users/:id" element={<PublicProfile />} />
        <Route path="/listings/:id" element={<ListingPage />} />
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
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
