import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  FileImage, 
  FileText, 
  FileSpreadsheet,
  Map,
  Image
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";

const Downloads = () => {
  const { toast } = useToast();

  const handleDownload = (fileType: string) => {
    toast({
      title: "Download Started",
      description: `Preparing ${fileType} file for download...`,
    });
    // Placeholder for actual download logic
  };

  const downloadOptions = [
    {
      category: "Spatial Data",
      items: [
        {
          title: "GeoTIFF Export",
          description: "High-resolution raster data with all analysis layers",
          icon: FileImage,
          fileType: "GeoTIFF",
          size: "~150 MB",
          formats: ["tif", "tiff"]
        },
        {
          title: "Shapefile Export",
          description: "Vector boundaries for AOI, buffers, and encroachment zones",
          icon: Map,
          fileType: "Shapefile",
          size: "~5 MB",
          formats: ["zip (shp, dbf, shx)"]
        },
      ]
    },
    {
      category: "Imagery",
      items: [
        {
          title: "Map Snapshot",
          description: "Current map view with all visible layers",
          icon: Image,
          fileType: "PNG",
          size: "~2 MB",
          formats: ["png", "jpeg"]
        },
      ]
    },
    {
      category: "Data Tables",
      items: [
        {
          title: "Time-Series CSV",
          description: "NBR, SAVI, NDVI values for all time periods",
          icon: FileSpreadsheet,
          fileType: "CSV",
          size: "~500 KB",
          formats: ["csv", "xlsx"]
        },
        {
          title: "Change Statistics",
          description: "Pixel counts, area calculations, and change metrics",
          icon: FileSpreadsheet,
          fileType: "CSV",
          size: "~100 KB",
          formats: ["csv", "xlsx"]
        },
      ]
    },
    {
      category: "Reports",
      items: [
        {
          title: "Comprehensive PDF Report",
          description: "Complete analysis report with maps, charts, and statistics",
          icon: FileText,
          fileType: "PDF",
          size: "~8 MB",
          formats: ["pdf"]
        },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Download Center</h1>
            <p className="text-muted-foreground">
              Export your analysis results in various formats
            </p>
          </div>

          {/* Quick Actions */}
          <Card className="bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold mb-1">Download All Files</h3>
                  <p className="text-sm text-muted-foreground">
                    Get a complete package with all available exports (~165 MB)
                  </p>
                </div>
                <Button size="lg" className="gap-2" onClick={() => handleDownload("complete package")}>
                  <Download className="h-5 w-5" />
                  Download All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Download Options */}
          {downloadOptions.map((category, index) => (
            <div key={index} className="space-y-4">
              <h2 className="text-xl font-semibold">{category.category}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {category.items.map((item, itemIndex) => (
                  <Card key={itemIndex} className="border-border/50 hover:border-primary/50 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center flex-shrink-0">
                            <item.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{item.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {item.description}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="space-y-1">
                          <div className="text-muted-foreground">
                            <span className="font-medium text-foreground">File Type:</span> {item.fileType}
                          </div>
                          <div className="text-muted-foreground">
                            <span className="font-medium text-foreground">Size:</span> {item.size}
                          </div>
                          <div className="text-muted-foreground">
                            <span className="font-medium text-foreground">Formats:</span> {item.formats.join(", ")}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {item.formats.map((format, formatIndex) => (
                          <Button
                            key={formatIndex}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleDownload(`${item.title} (${format})`)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            .{format.split(" ")[0]}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {/* Info Card */}
          <Card className="bg-muted/50">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Download Information
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• All downloads are generated from your latest analysis run</li>
                <li>• GeoTIFF files include projection and metadata information</li>
                <li>• Shapefiles are packaged with all necessary component files</li>
                <li>• CSV files use UTF-8 encoding and include headers</li>
                <li>• PDF reports contain embedded high-resolution images</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Downloads;
