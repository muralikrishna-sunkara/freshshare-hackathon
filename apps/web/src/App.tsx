import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { AdminPage } from "./pages/Admin";
import { ClaimPage } from "./pages/ClaimPage";
import { FridgePage, FridgesPage, SuggestFridgePage } from "./pages/Fridges";
import { BulkClaimPage, NewBulkClaimPage, OrgDashboardPage, OrganizationPage, OrganizationsPage, RegisterOrganizationPage } from "./pages/Organizations";
import { NotificationsPage } from "./pages/Notifications";
import { ContactPage, CreditsPage, ImprintPage, NotFoundPage, PrivacyPage, TermsPage } from "./pages/InfoPages";
import { Landing } from "./pages/Landing";
import { ListingPage } from "./pages/ListingPage";
import { MapHome } from "./pages/MapHome";
import { Pickups } from "./pages/Pickups";
import { Profile } from "./pages/Profile";
import { PublicProfile } from "./pages/PublicProfile";
import { ShareFood } from "./pages/ShareFood";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";
import { RecurringPage } from "./pages/Recurring";

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
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/users/:id" element={<PublicProfile />} />
        <Route path="/listings/:id" element={<ListingPage />} />
        <Route path="/fridges" element={<FridgesPage />} />
        <Route path="/fridges/new" element={<RequireAuth><SuggestFridgePage /></RequireAuth>} />
        <Route path="/fridges/:id" element={<FridgePage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/organizations/new" element={<RequireAuth><RegisterOrganizationPage /></RequireAuth>} />
        <Route path="/organizations/:id" element={<OrganizationPage />} />
        <Route path="/organizations/:id/dashboard" element={<RequireAuth><OrgDashboardPage /></RequireAuth>} />
        <Route path="/organizations/:id/bulk-claims/new" element={<RequireAuth><NewBulkClaimPage /></RequireAuth>} />
        <Route path="/bulk-claims/:id" element={<RequireAuth><BulkClaimPage /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
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
        <Route path="/me/recurring" element={<RequireAuth><RecurringPage /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
