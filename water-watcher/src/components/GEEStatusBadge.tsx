import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface GEEStatus {
  authenticated: boolean;
  loading: boolean;
  error?: string;
}

export const GEEStatusBadge = () => {
  const [status, setStatus] = useState<GEEStatus>({
    authenticated: false,
    loading: true,
    error: undefined
  });

  useEffect(() => {
    const checkGEEStatus = async () => {
      try {
        const response = await fetch("http://localhost:8000/health");
        if (response.ok) {
          const data = await response.json();
          const connected = data.status === "ok" && data.gee_authenticated === true;
          setStatus({
            authenticated: connected,
            loading: false,
            error: undefined
          });
        } else {
          setStatus({
            authenticated: false,
            loading: false,
            error: "Health check failed"
          });
        }
      } catch (err) {
        setStatus({
          authenticated: false,
          loading: false,
          error: err instanceof Error ? err.message : "Connection error"
        });
      }
    };

    checkGEEStatus();
    // Recheck every 30 seconds
    const interval = setInterval(checkGEEStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (status.loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
        <span className="text-sm text-muted-foreground">Checking GEE status...</span>
      </div>
    );
  }

  if (status.authenticated) {
    return (
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-green-500" />
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
          Live Data Connected
        </Badge>
        <span className="text-xs text-green-700">Google Earth Engine authenticated</span>
      </div>
    );
  }

  return (
    <Alert className="border-red-200 bg-red-50">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800">
        <strong>⚠️ Live Data Not Connected</strong> - Google Earth Engine authentication failed.
        Analysis is disabled. Please ensure GEE credentials are configured.
        {status.error && <div className="text-xs mt-1">Error: {status.error}</div>}
      </AlertDescription>
    </Alert>
  );
};

export default GEEStatusBadge;
