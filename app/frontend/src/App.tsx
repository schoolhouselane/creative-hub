import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import BrandsPage from './pages/BrandsPage';
import BrandDetailPage from './pages/BrandDetailPage';
import WorkspacePage from './pages/WorkspacePage';
import BriefsPage from './pages/BriefsPage';
import NewBrief from './pages/NewBrief';
import BriefDetail from './pages/BriefDetail';
import SettingsPage from './pages/SettingsPage';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import PromptLibraryPage from './pages/PromptLibraryPage';
import AIWorkspacePage from './pages/AIWorkspacePage';
import DashboardPage from './pages/DashboardPage';
import AssetGalleryPage from './pages/AssetGalleryPage';
import BrandCreateWizard from './pages/BrandCreateWizard';
import WebsiteBriefWizard from './pages/WebsiteBriefWizard';
import LoginPage from './pages/LoginPage';
import ClientLoginPage from './pages/ClientLoginPage';
import ClientPortal from './pages/ClientBriefsPage';

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/brands" element={<BrandsPage />} />
    <Route path="/brands/new" element={<BrandCreateWizard />} />
    <Route path="/brands/:id" element={<BrandDetailPage />} />
    <Route path="/workspace" element={<WorkspacePage />} />
    <Route path="/chat" element={<AIWorkspacePage />} />
    <Route path="/gallery" element={<AssetGalleryPage />} />
    <Route path="/templates" element={<WorkspacePage />} />
    <Route path="/prompts" element={<PromptLibraryPage />} />
    <Route path="/briefs" element={<BriefsPage />} />
    <Route path="/briefs/new" element={<NewBrief />} />
    <Route path="/briefs/new/website" element={<WebsiteBriefWizard />} />
    <Route path="/briefs/:id" element={<BriefDetail />} />
    <Route path="/new-brief" element={<NewBrief />} />
    <Route path="/brief/:id" element={<BriefDetail />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/signin" element={<LoginPage />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
    {/* Client portal — separate from staff app */}
    <Route path="/client-login" element={<LoginPage />} />
    <Route path="/client" element={<ClientPortal view="dashboard" />} />
    <Route path="/client/briefs" element={<ClientPortal view="list" />} />
    <Route path="/client/briefs/new/nexus"    element={<ClientPortal view="nexus" />} />
    <Route path="/client/briefs/new/genesis"  element={<ClientPortal view="genesis" />} />
    <Route path="/client/briefs/new/evolution" element={<ClientPortal view="evolution" />} />
    <Route path="/client/briefs/new/website"  element={<ClientPortal view="website" />} />
    <Route path="/client/briefs/new/velocity" element={<ClientPortal view="velocity" />} />
    <Route path="/client/briefs/new" element={<ClientPortal view="new" />} />
    <Route path="/client/briefs/:id" element={<ClientPortal view="detail" />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };