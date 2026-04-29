import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { ArrowLeft, AlertTriangle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TestPage = () => {
  const navigate = useNavigate();
  const [kmzTest, setKmzTest] = useState<string>("Loading...");
  const [geojsonTest, setGeojsonTest] = useState<string>("Loading...");

  useEffect(() => {
    const testKMZAccess = async () => {
      try {
        // Test 1: Check if KMZ file is accessible
        const response = await fetch("/data/ramanna.kmz");
        if (response.ok) {
          const size = response.headers.get('content-length');
          setKmzTest(`✅ KMZ accessible (${size} bytes)`);
        } else {
          setKmzTest(`❌ KMZ not accessible: ${response.status}`);
        }

        // Test 2: Test basic React rendering
        setGeojsonTest("✅ React rendering working");
        
      } catch (error) {
        setKmzTest(`❌ Error: ${error.message}`);
        setGeojsonTest(`❌ Error: ${error.message}`);
      }
    };

    testKMZAccess();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              onClick={() => navigate("/analysis")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Analysis
            </Button>
            <h1 className="text-4xl font-bold text-gray-900">Frontend Diagnostics</h1>
          </div>
          <p className="text-gray-600">
            Testing basic functionality to identify the blank page issue
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                KMZ File Test
              </CardTitle>
              <CardDescription>
                Testing access to Ramanna KMZ file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-mono">{kmzTest}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                React Rendering Test
              </CardTitle>
              <CardDescription>
                Testing basic React component rendering
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-mono">{geojsonTest}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Navigation Test</CardTitle>
            <CardDescription>
              Test navigation to different pages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={() => navigate("/mock-analysis")}
                className="w-full"
              >
                Go to Mock Analysis
              </Button>
              <Button 
                onClick={() => navigate("/ramanna-dual-map")}
                className="w-full"
                variant="outline"
              >
                Go to Ramanna Dual Map
              </Button>
              <Button 
                onClick={() => navigate("/analysis")}
                className="w-full"
                variant="secondary"
              >
                Go to Analysis
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Console Check</CardTitle>
            <CardDescription>
              Open browser console (F12) to check for JavaScript errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Instructions:</strong><br/>
                1. Press F12 to open developer tools<br/>
                2. Go to Console tab<br/>
                3. Look for any red error messages<br/>
                4. Try navigating to different pages<br/>
                5. Report any errors found
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestPage;
