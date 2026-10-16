import { LocationProvider, Route, Router, useRoute } from "preact-iso";
import { setShareToken } from "./api";
import { Shell } from "./components/Shell";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Realtime } from "./pages/Realtime";
import { NewSite, Settings } from "./pages/Settings";
import { Sites } from "./pages/Sites";

const SiteOverview = () => <Overview id={useRoute().params.id!} />;
const SiteLive = () => <Realtime id={useRoute().params.id!} />;
const SiteSettings = () => <Settings id={useRoute().params.id!} />;

function Shared() {
  const token = useRoute().params.token ?? "";
  setShareToken(token);
  return <Overview id={token.split(".")[0] ?? ""} shareMode />;
}

function NotFound() {
  return (
    <Shell>
      <div class="head grid">
        <div class="span-7">
          <h1>Not found</h1>
          <p class="sub">
            There's nothing at this address. <a href="/">Back to your sites</a>
          </p>
        </div>
      </div>
    </Shell>
  );
}

export function App() {
  return (
    <LocationProvider>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/" component={Sites} />
        <Route path="/new" component={NewSite} />
        <Route path="/s/:id" component={SiteOverview} />
        <Route path="/s/:id/live" component={SiteLive} />
        <Route path="/s/:id/settings" component={SiteSettings} />
        <Route path="/share/:token" component={Shared} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  );
}
