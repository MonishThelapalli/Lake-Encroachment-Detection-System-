import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Analysis from "./pages/Analysis";
import MockAnalysis from "./pages/MockAnalysis";
import RamannaDualMap from "./pages/RamannaDualMap";
import RamannaDualMapSimple from "./pages/RamannaDualMapSimple";
import RamannaClassifiedMap from "./pages/RamannaClassifiedMap";
import TestPage from "./pages/TestPage";
import MapViewer from "./pages/MapViewer";
import Charts from "./pages/Charts";
import Downloads from "./pages/Downloads";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/mock-analysis" element={<MockAnalysis />} />
          <Route path="/ramanna-dual-map" element={<RamannaDualMap />} />
          <Route path="/ramanna-simple" element={<RamannaDualMapSimple />} />
          <Route path="/ramanna-classified" element={<RamannaClassifiedMap />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/map" element={<MapViewer />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:reportId" element={<Reports />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
