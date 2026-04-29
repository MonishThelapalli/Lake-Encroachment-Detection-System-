import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { ArrowLeft, MapPin, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RamannaDualMapSimple = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
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
            <h1 className="text-4xl font-bold text-gray-900">Ramanna Dual Map (Simple)</h1>
            <div className="ml-auto">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <MapPin className="h-3 w-3 mr-1" />
                Simple Test Version
              </Badge>
            </div>
          </div>
          <p className="text-gray-600">
            Simplified version to test basic rendering without KMZ parsing
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                React Components
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">✅ Working</p>
                <p className="text-sm text-gray-600">All UI components loading</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                Routing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">✅ Working</p>
                <p className="text-sm text-gray-600">Navigation functional</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                Styling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">✅ Working</p>
                <p className="text-sm text-gray-600">Tailwind CSS applied</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Map Area */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Map Test Area</CardTitle>
            <CardDescription>
              Placeholder for dual map component (testing layout)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
              {/* Left Map Placeholder */}
              <div className="relative border border-gray-200 rounded-xl overflow-hidden shadow-lg flex flex-col bg-white">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center py-3 font-semibold shadow-sm">
                  January 2018 (Start)
                </div>
                <div className="flex-grow relative min-h-[450px] bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                    <p className="text-gray-600 font-medium">Map 1 Placeholder</p>
                    <p className="text-sm text-gray-500">T1 Water Layer</p>
                  </div>
                </div>
              </div>

              {/* Right Map Placeholder */}
              <div className="relative border border-gray-200 rounded-xl overflow-hidden shadow-lg flex flex-col bg-white">
                <div className="bg-gradient-to-r from-green-600 to-green-700 text-white text-center py-3 font-semibold shadow-sm">
                  January 2024 (End)
                </div>
                <div className="flex-grow relative min-h-[450px] bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-600 font-medium">Map 2 Placeholder</p>
                    <p className="text-sm text-gray-500">T2 Water + Encroachment</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle>Test Navigation</CardTitle>
            <CardDescription>
              Test different pages to isolate the issue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button 
                onClick={() => navigate("/")}
                className="w-full"
              >
                Home
              </Button>
              <Button 
                onClick={() => navigate("/test")}
                className="w-full"
                variant="outline"
              >
                Test Page
              </Button>
              <Button 
                onClick={() => navigate("/mock-analysis")}
                className="w-full"
                variant="secondary"
              >
                Mock Analysis
              </Button>
              <Button 
                onClick={() => navigate("/ramanna-dual-map")}
                className="w-full"
                variant="destructive"
              >
                Full Ramanna Map
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RamannaDualMapSimple;
