import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Droplets, 
  Map, 
  LineChart, 
  Download, 
  Shield, 
  Zap,
  Satellite,
  Database,
  AlertCircle,
  FileText
} from "lucide-react";
import Navbar from "@/components/Navbar";

const Index = () => {
  const features = [
    {
      icon: Map,
      title: "Interactive Mapping",
      description: "Visualize water body boundaries, buffers, and encroachment zones with layer controls"
    },
    {
      icon: LineChart,
      title: "Time-Series Analysis",
      description: "Track NBR, SAVI, and NDVI changes over time with comprehensive charts"
    },
    {
      icon: Satellite,
      title: "Multi-Source Imagery",
      description: "Leverage Landsat and Sentinel-2 satellite data for accurate monitoring"
    },
    {
      icon: AlertCircle,
      title: "Change Detection",
      description: "Automated detection of deforestation and land cover changes"
    },
    {
      icon: Database,
      title: "Historical Data",
      description: "Access and analyze two decades of satellite imagery (2000-2025)"
    },
    {
      icon: FileText,
      title: "Report Generation",
      description: "Export comprehensive PDF reports with maps, charts, and statistics"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Shield className="h-4 w-4" />
              <span>Powered by Google Earth Engine</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Water Body{" "}
              <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                Encroachment Analysis
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Advanced satellite-based monitoring system for detecting and quantifying encroachment 
              around water bodies using historical imagery and machine learning
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/analysis">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity">
                  <Zap className="h-5 w-5" />
                  Start Analysis
                </Button>
              </Link>
              <Link to="/map">
                <Button size="lg" variant="outline" className="gap-2">
                  <Map className="h-5 w-5" />
                  Explore Map
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8">
              <div className="space-y-1">
                <div className="text-3xl font-bold text-primary">25+</div>
                <div className="text-sm text-muted-foreground">Years of Data</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-secondary">3</div>
                <div className="text-sm text-muted-foreground">Buffer Zones</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-accent">5+</div>
                <div className="text-sm text-muted-foreground">Metrics</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-success">100%</div>
                <div className="text-sm text-muted-foreground">Automated</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Comprehensive Monitoring Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to detect, analyze, and report on water body encroachment
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16">
          <Card className="bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 border-border/50">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                <Droplets className="h-8 w-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl md:text-3xl">Ready to Monitor Your Water Bodies?</CardTitle>
              <CardDescription className="text-base">
                Upload your AOI and start analyzing encroachment patterns with cutting-edge satellite technology
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-4">
              <Link to="/analysis">
                <Button size="lg" className="gap-2">
                  <Satellite className="h-5 w-5" />
                  Launch Analysis
                </Button>
              </Link>
              <Link to="/reports">
                <Button size="lg" variant="outline" className="gap-2">
                  <FileText className="h-5 w-5" />
                  View Documentation
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                © 2025 AquaGuard. Environmental Monitoring System.
              </span>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
              <a href="#" className="hover:text-primary transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
