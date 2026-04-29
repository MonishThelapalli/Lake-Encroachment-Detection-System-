import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import Navbar from "@/components/Navbar";

const Charts = () => {
  // Sample data - replace with actual API data
  const nbrData = [
    { year: "2015", nbr: 0.65 },
    { year: "2016", nbr: 0.62 },
    { year: "2017", nbr: 0.58 },
    { year: "2018", nbr: 0.54 },
    { year: "2019", nbr: 0.49 },
    { year: "2020", nbr: 0.45 },
    { year: "2021", nbr: 0.42 },
    { year: "2022", nbr: 0.38 },
    { year: "2023", nbr: 0.35 },
    { year: "2024", nbr: 0.32 },
  ];

  const saviData = [
    { year: "2015", savi: 0.58, ndvi: 0.62 },
    { year: "2016", savi: 0.56, ndvi: 0.60 },
    { year: "2017", savi: 0.52, ndvi: 0.56 },
    { year: "2018", savi: 0.49, ndvi: 0.53 },
    { year: "2019", savi: 0.45, ndvi: 0.49 },
    { year: "2020", savi: 0.42, ndvi: 0.46 },
    { year: "2021", savi: 0.39, ndvi: 0.43 },
    { year: "2022", savi: 0.36, ndvi: 0.40 },
    { year: "2023", savi: 0.33, ndvi: 0.37 },
    { year: "2024", savi: 0.30, ndvi: 0.34 },
  ];

  const pixelChangeData = [
    { category: "Forest to Urban", pixels: 15420, area: 13.88 },
    { category: "Forest to Agriculture", pixels: 8750, area: 7.88 },
    { category: "Wetland Loss", pixels: 5230, area: 4.71 },
    { category: "Vegetation Decline", pixels: 3890, area: 3.50 },
    { category: "Water Body Reduction", pixels: 2140, area: 1.93 },
  ];

  const landCoverData = [
    { name: "Forest", value: 45, color: "hsl(var(--secondary))" },
    { name: "Urban", value: 25, color: "hsl(var(--destructive))" },
    { name: "Agriculture", value: 18, color: "hsl(var(--warning))" },
    { name: "Water", value: 8, color: "hsl(var(--primary))" },
    { name: "Other", value: 4, color: "hsl(var(--muted-foreground))" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Time-series analysis and change detection metrics
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Area Changed</CardDescription>
                <CardTitle className="text-3xl">31.90 km²</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <TrendingDown className="h-4 w-4" />
                  <span className="font-medium">↓ 23.4% from baseline</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Encroachment Events</CardDescription>
                <CardTitle className="text-3xl">127</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-warning">
                  <Activity className="h-4 w-4" />
                  <span className="font-medium">42 in last year</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Vegetation Index (Avg)</CardDescription>
                <CardTitle className="text-3xl">0.32</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <TrendingDown className="h-4 w-4" />
                  <span className="font-medium">↓ 45% decline (2015-2024)</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* NBR Time Series */}
            <Card>
              <CardHeader>
                <CardTitle>NBR Time-Series Trend</CardTitle>
                <CardDescription>
                  Normalized Burn Ratio showing vegetation loss over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={nbrData}>
                    <defs>
                      <linearGradient id="colorNbr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)"
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="nbr" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorNbr)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* SAVI/NDVI Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>SAVI vs NDVI Trends</CardTitle>
                <CardDescription>
                  Vegetation health indicators comparison
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={saviData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)"
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="savi" 
                      stroke="hsl(var(--secondary))" 
                      strokeWidth={2}
                      name="SAVI"
                      dot={{ fill: "hsl(var(--secondary))" }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ndvi" 
                      stroke="hsl(var(--accent))" 
                      strokeWidth={2}
                      name="NDVI"
                      dot={{ fill: "hsl(var(--accent))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pixel Change Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Land Use Change Analysis</CardTitle>
                <CardDescription>
                  Pixel count and area by change category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pixelChangeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="category" type="category" className="text-xs" width={150} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)"
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "area") return `${value.toFixed(2)} km²`;
                        return value.toLocaleString();
                      }}
                    />
                    <Bar dataKey="pixels" fill="hsl(var(--primary))" name="Pixels Changed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Land Cover Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Current Land Cover Distribution</CardTitle>
                <CardDescription>
                  Percentage breakdown by land cover type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={landCoverData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {landCoverData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)"
                      }}
                      formatter={(value: number) => `${value}%`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Charts;
