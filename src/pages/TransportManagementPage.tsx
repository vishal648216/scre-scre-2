import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  MapPin,
  IdCard,
  Users,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  Printer,
  ShieldCheck,
  Calendar,
  Navigation,
  Send,
  Loader2,
  HelpCircle,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, flattenBson } from "@/lib/api";

interface Vehicle {
  id: string;
  vehicle_no: string;
  vehicle_type: string;
  capacity: number;
  driver_name: string;
  driver_phone: string;
  route_assigned: string;
  center_id?: string;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
}

interface RouteItem {
  id: string;
  route_name: string;
  start_point: string;
  destination: string;
  stops_count: number;
  monthly_fee: number;
  assigned_vehicle: string;
  center_id?: string;
  status: "OPERATIONAL" | "SUSPENDED";
}

interface TransportPass {
  id: string;
  student_name: string;
  enrollment_no: string;
  route_name: string;
  stop_name: string;
  pass_number: string;
  valid_till: string;
  center_id?: string;
  student_id?: string;
  status: "VALID" | "EXPIRED" | "CANCELLED";
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  license_no: string;
  assigned_vehicle: string;
  center_id?: string;
  experience_years: number;
  status: "ON_DUTY" | "OFF_DUTY";
}

const DEFAULT_VEHICLES: Vehicle[] = [
  {
    id: "v1",
    vehicle_no: "UP-70-AB-1234",
    vehicle_type: "32-Seater Bus",
    capacity: 32,
    driver_name: "Ramesh Singh",
    driver_phone: "+91 9876543210",
    route_assigned: "Route 1 - City Center to Campus",
    center_id: "center1",
    status: "ACTIVE",
  },
  {
    id: "v2",
    vehicle_no: "UP-70-CD-5678",
    vehicle_type: "14-Seater Traveler",
    capacity: 14,
    driver_name: "Vikram Sharma",
    driver_phone: "+91 9812345678",
    route_assigned: "Route 2 - Suburb Link",
    center_id: "center1",
    status: "ACTIVE",
  },
];

const DEFAULT_ROUTES: RouteItem[] = [
  {
    id: "r1",
    route_name: "Route 1 - Main City Loop",
    start_point: "Railway Station",
    destination: "Main College Campus",
    stops_count: 8,
    monthly_fee: 1500,
    assigned_vehicle: "UP-70-AB-1234",
    center_id: "center1",
    status: "OPERATIONAL",
  },
  {
    id: "r2",
    route_name: "Route 2 - Suburb Link",
    start_point: "Civil Lines",
    destination: "Main College Campus",
    stops_count: 5,
    monthly_fee: 1200,
    assigned_vehicle: "UP-70-CD-5678",
    center_id: "center1",
    status: "OPERATIONAL",
  },
];

const DEFAULT_PASSES: TransportPass[] = [
  {
    id: "p1",
    student_name: "Amit Kumar",
    enrollment_no: "STU-2026-001",
    route_name: "Route 1 - Main City Loop",
    stop_name: "Civil Lines Crossing",
    pass_number: "TPASS-8812",
    valid_till: "2026-12-31",
    center_id: "center1",
    status: "VALID",
  },
];

const DEFAULT_DRIVERS: Driver[] = [
  {
    id: "d1",
    name: "Ramesh Singh",
    phone: "+91 9876543210",
    license_no: "DL-04201800123",
    assigned_vehicle: "UP-70-AB-1234",
    center_id: "center1",
    experience_years: 12,
    status: "ON_DUTY",
  },
];

export default function TransportManagementPage() {
  const [userRole, setUserRole] = useState<string>("student");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("vehicles");
  const [vehicles, setVehicles] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [routes, setRoutes] = useState<RouteItem[]>(DEFAULT_ROUTES);
  const [passes, setPasses] = useState<TransportPass[]>(DEFAULT_PASSES);
  const [drivers, setDrivers] = useState<Driver[]>(DEFAULT_DRIVERS);

  const [search, setSearch] = useState("");
  const [selectedCenterId, setSelectedCenterId] = useState("all");

  // Modals
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    vehicle_no: "",
    vehicle_type: "32-Seater Bus",
    capacity: "32",
    driver_name: "",
    driver_phone: "",
    route_assigned: "",
  });

  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
  const [routeForm, setRouteForm] = useState({
    route_name: "",
    start_point: "",
    destination: "",
    stops_count: "5",
    monthly_fee: "1500",
    assigned_vehicle: "",
  });

  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<TransportPass | null>(null);

  // Master Transport Facility Switch State (Center / SuperAdmin toggle)
  const [isTransportEnabled, setIsTransportEnabled] = useState<boolean>(() => {
    return localStorage.getItem("transport_facility_enabled") !== "false";
  });

  const handleToggleFacility = async (enabled: boolean) => {
    setIsTransportEnabled(enabled);
    localStorage.setItem("transport_facility_enabled", enabled ? "true" : "false");
    
    // Sync with backend API
    try {
      await apiFetch("/api/center/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transport_facility_enabled: enabled }),
      });
    } catch {}

    if (enabled) {
      toast.success("Center Transport Facility has been ENABLED (ON)!");
    } else {
      toast.warning("Center Transport Facility has been DISABLED (OFF)!");
    }
  };

  // Student Transport Request Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestRouteId, setRequestRouteId] = useState("");
  const [requestStopName, setRequestStopName] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Fetch logged-in user details & transport data from backend API
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const userRes = await apiFetch("/api/users/me");
        if (userRes.ok) {
          const user = await userRes.json();
          setUserProfile(user);
          setUserRole(user.role || "student");
        } else {
          const storedRole = sessionStorage.getItem("role") || "student";
          setUserRole(storedRole);
        }

        // Fetch Transport Vehicles from Backend API
        const busRes = await apiFetch("/api/transport/buses");
        if (busRes.ok) {
          const busData = await busRes.json();
          if (busData.buses && busData.buses.length > 0) {
            setVehicles(busData.buses);
          }
        }

        // Fetch Transport Routes from Backend API
        const routeRes = await apiFetch("/api/transport/routes");
        if (routeRes.ok) {
          const routeData = await routeRes.json();
          if (routeData.routes && routeData.routes.length > 0) {
            setRoutes(routeData.routes);
          }
        }
      } catch {
        const storedRole = sessionStorage.getItem("role") || "student";
        setUserRole(storedRole);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const handleAddVehicle = async () => {
    if (!vehicleForm.vehicle_no.trim()) {
      return toast.error("Please enter vehicle registration number");
    }
    const newV: Vehicle = {
      id: `v_${Date.now()}`,
      vehicle_no: vehicleForm.vehicle_no,
      vehicle_type: vehicleForm.vehicle_type,
      capacity: parseInt(vehicleForm.capacity) || 32,
      driver_name: vehicleForm.driver_name || "Unassigned",
      driver_phone: vehicleForm.driver_phone || "N/A",
      route_assigned: vehicleForm.route_assigned || "Unassigned",
      center_id: selectedCenterId !== "all" ? selectedCenterId : "center1",
      status: "ACTIVE",
    };

    try {
      await apiFetch("/api/transport/buses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newV),
      });
    } catch {}

    setVehicles([newV, ...vehicles]);
    setIsAddVehicleOpen(false);
    toast.success("New vehicle added to transport fleet!");
    setVehicleForm({
      vehicle_no: "",
      vehicle_type: "32-Seater Bus",
      capacity: "32",
      driver_name: "",
      driver_phone: "",
      route_assigned: "",
    });
  };

  const handleAddRoute = async () => {
    if (!routeForm.route_name.trim()) {
      return toast.error("Please enter route name");
    }
    const newR: RouteItem = {
      id: `r_${Date.now()}`,
      route_name: routeForm.route_name,
      start_point: routeForm.start_point || "City Center",
      destination: routeForm.destination || "Campus",
      stops_count: parseInt(routeForm.stops_count) || 5,
      monthly_fee: parseInt(routeForm.monthly_fee) || 1500,
      assigned_vehicle: routeForm.assigned_vehicle || "UP-70-AB-1234",
      center_id: selectedCenterId !== "all" ? selectedCenterId : "center1",
      status: "OPERATIONAL",
    };

    try {
      await apiFetch("/api/transport/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newR),
      });
    } catch {}

    setRoutes([newR, ...routes]);
    setIsAddRouteOpen(false);
    toast.success("New transport route added!");
    setRouteForm({
      route_name: "",
      start_point: "",
      destination: "",
      stops_count: "5",
      monthly_fee: "1500",
      assigned_vehicle: "",
    });
  };

  const handlePrintPass = (pass: TransportPass) => {
    setSelectedPass(pass);
    setIsPassModalOpen(true);
  };

  const handleSendTransportRequest = async () => {
    if (!requestRouteId || !requestStopName) {
      return toast.error("Please select a route and stop name");
    }
    setSubmittingRequest(true);
    try {
      await apiFetch("/api/transport/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_id: requestRouteId,
          stop_name: requestStopName,
          reason: requestReason,
        }),
      });
      toast.success("Transport facility allotment request submitted to your center administrator!");
      setIsRequestModalOpen(false);
      setRequestReason("");
      setRequestStopName("");
    } catch {
      toast.error("Failed to send request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Student specific check
  const studentPass = passes.find(
    (p) =>
      p.student_id === userProfile?.id ||
      p.student_name.toLowerCase() === userProfile?.full_name?.toLowerCase() ||
      userProfile?.requires_transport === true
  );

  const isStudentOptedTransport = !!studentPass || userProfile?.requires_transport === true || userProfile?.requires_transport === "yes";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // --- RENDER STUDENT VIEW ---
  if (userRole === "student") {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 text-white rounded-none border border-border shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className="bg-amber-500 text-slate-950 rounded-none font-bold uppercase text-[10px] tracking-wider">
                  Campus Student Transport
                </Badge>
                {userProfile?.center_name && (
                  <Badge className="bg-indigo-600 text-white rounded-none font-bold uppercase text-[10px] tracking-wider">
                    📍 Center: {userProfile.center_name}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-heading font-black tracking-tight uppercase flex items-center gap-3">
                <Truck className="w-8 h-8 text-amber-400" />
                My Bus Pass & Transport Facility
              </h1>
              <p className="text-xs md:text-sm text-slate-300 mt-1">
                View your allocated bus pass, pickup schedule, stop details, and driver contact info.
              </p>
            </div>

            <Button
              onClick={() => setIsRequestModalOpen(true)}
              variant="outline"
              className="rounded-none text-white border-white/20 hover:bg-white/10 text-xs font-bold gap-2 shrink-0"
            >
              <Send className="w-4 h-4 text-amber-400" /> Request Transport Allotment
            </Button>
          </div>

          {!isTransportEnabled ? (
            /* Transport Disabled by Center */
            <Card className="rounded-none border-red-500/40 bg-red-500/5 shadow-md">
              <CardContent className="py-16 text-center space-y-4">
                <div className="w-16 h-16 bg-red-600/10 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-2 max-w-lg mx-auto">
                  <Badge className="bg-red-600 text-white rounded-none uppercase font-bold text-[10px]">
                    Center Facility Offline
                  </Badge>
                  <h2 className="text-xl font-heading font-black uppercase text-foreground">
                    Transport Facility Disabled for Your Center
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    Your center administrator has currently turned off campus transport / bus service. Bus passes and route allotments are inactive until enabled by center management.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : !isStudentOptedTransport ? (
            /* Student NOT Opted Transport Card */
            <Card className="rounded-none border-border shadow-md">
              <CardContent className="py-16 text-center space-y-4">
                <div className="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-2 max-w-lg mx-auto">
                  <h2 className="text-xl font-heading font-black uppercase text-foreground">
                    Transport Facility Not Opted / Not Allocated
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    You have not opted for campus transport service during your admission, or your center does not provide bus service. If you require bus service for daily commuting, you can submit an allotment request to your center administrator.
                  </p>
                </div>

                <div className="pt-2 flex justify-center gap-3">
                  <Button
                    onClick={() => setIsRequestModalOpen(true)}
                    className="rounded-none bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2 text-xs h-10 px-5"
                  >
                    <Send className="w-4 h-4" /> Apply For Bus Pass Allotment
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Student OPTED Transport Pass & Vehicle Info */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Official Student Pass Card */}
                <Card className="rounded-none border-amber-500/40 bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl overflow-hidden">
                  <CardHeader className="border-b border-white/10 pb-3 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-xs uppercase tracking-wider">Official Student Bus Pass</span>
                    </div>
                    <Badge className="bg-amber-400 text-slate-950 font-mono text-[10px]">
                      {studentPass?.pass_number || "TPASS-8812"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1">
                      <p className="text-slate-400 uppercase text-[10px]">Student Name</p>
                      <p className="font-black text-lg uppercase text-white">{userProfile?.full_name || studentPass?.student_name || "Amit Kumar"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-400 uppercase text-[10px]">Enrollment No</p>
                        <p className="font-mono font-bold">{userProfile?.enrollment_no || studentPass?.enrollment_no || "STU-2026-001"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 uppercase text-[10px]">Pass Validity</p>
                        <p className="font-mono font-bold text-emerald-400">{studentPass?.valid_till || "2026-12-31"}</p>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-3 space-y-1 text-xs">
                      <p className="text-slate-400 uppercase text-[10px]">Assigned Bus Route & Pickup Stop</p>
                      <p className="font-bold text-amber-300 text-sm">{studentPass?.route_name || "Route 1 - Main City Loop"}</p>
                      <p className="text-slate-200 flex items-center gap-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" /> Stop: {studentPass?.stop_name || "Civil Lines Crossing"}
                      </p>
                    </div>

                    <Button
                      onClick={() => handlePrintPass(studentPass || DEFAULT_PASSES[0])}
                      className="w-full rounded-none bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2 text-xs h-9 mt-2"
                    >
                      <Printer className="w-4 h-4" /> Download / Print Bus Pass
                    </Button>
                  </CardContent>
                </Card>

                {/* Assigned Vehicle & Driver Details */}
                <Card className="rounded-none border-border shadow-md">
                  <CardHeader className="bg-muted/40 border-b border-border py-3 px-4">
                    <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      Assigned Bus & Driver Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Bus Registration No</p>
                        <p className="font-mono font-black text-base text-primary">UP-70-AB-1234</p>
                      </div>
                      <Badge className="bg-emerald-600 text-white rounded-none text-[10px]">ACTIVE BUS</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Vehicle Type</p>
                        <p className="font-bold">32-Seater AC Bus</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Pickup Time</p>
                        <p className="font-bold text-amber-600 dark:text-amber-400">07:45 AM (Morning)</p>
                      </div>
                    </div>

                    <div className="border-t border-border pt-3 space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Driver Name & Contact</p>
                      <p className="font-bold text-foreground">Ramesh Singh (Senior Driver)</p>
                      <p className="text-xs text-primary font-mono flex items-center gap-1.5 pt-0.5">
                        <Phone className="w-3.5 h-3.5" /> +91 9876543210
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Student Request Allotment Dialog */}
          <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
            <DialogContent className="rounded-none max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading uppercase font-bold text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-500" /> Request Transport Allotment
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-xs">
                <div className="space-y-1">
                  <Label>Preferred Bus Route *</Label>
                  <Select value={requestRouteId} onValueChange={setRequestRouteId}>
                    <SelectTrigger className="rounded-none">
                      <SelectValue placeholder="Select Route" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.route_name} (₹{r.monthly_fee}/mo)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Pickup Stop Name *</Label>
                  <Input
                    value={requestStopName}
                    onChange={(e) => setRequestStopName(e.target.value)}
                    placeholder="e.g. Civil Lines Crossing / Station Road"
                    className="rounded-none"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Additional Request Note</Label>
                  <Input
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder="Optional details for center admin..."
                    className="rounded-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRequestModalOpen(false)} className="rounded-none text-xs">
                  Cancel
                </Button>
                <Button onClick={handleSendTransportRequest} disabled={submittingRequest} className="rounded-none bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2 text-xs">
                  {submittingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* PRINT PASS CARD MODAL */}
          <Dialog open={isPassModalOpen} onOpenChange={setIsPassModalOpen}>
            <DialogContent className="rounded-none max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-heading uppercase font-bold text-center">Student Transport Pass</DialogTitle>
              </DialogHeader>
              {selectedPass && (
                <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-none border border-amber-400/40 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-xs uppercase tracking-wider">Official Bus Pass</span>
                    </div>
                    <Badge className="bg-amber-400 text-slate-950 font-mono text-[10px]">{selectedPass.pass_number}</Badge>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p className="text-slate-400 uppercase text-[10px]">Student Name</p>
                    <p className="font-extrabold text-sm uppercase">{selectedPass.student_name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400 uppercase text-[10px]">Enrollment No</p>
                      <p className="font-mono font-bold">{selectedPass.enrollment_no}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase text-[10px]">Valid Till</p>
                      <p className="font-mono font-bold text-emerald-400">{selectedPass.valid_till}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-2 space-y-1 text-xs">
                    <p className="text-slate-400 uppercase text-[10px]">Allocated Route & Stop</p>
                    <p className="font-bold text-amber-300">{selectedPass.route_name}</p>
                    <p className="text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-400" /> {selectedPass.stop_name}
                    </p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => window.print()} className="rounded-none w-full gap-2">
                  <Printer className="w-4 h-4" /> Print Bus Pass Card
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // --- RENDER ADMIN / SUPERADMIN / CENTER VIEW ---
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-none text-white border border-border shadow-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-amber-500 text-slate-950 rounded-none font-bold uppercase text-[10px] tracking-wider">
                Fleet & Logistics Management
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-black tracking-tight uppercase flex items-center gap-3">
              <Truck className="w-8 h-8 text-amber-400" />
              Transport Management System
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mt-1">
              Manage center fleet vehicles, student transport passes, bus routes, driver assignments & maintenance.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Master Switch Button */}
            <div className="flex items-center gap-2 bg-slate-950 p-2 border border-white/20">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Facility Status:</span>
              <Button
                onClick={() => handleToggleFacility(!isTransportEnabled)}
                size="sm"
                className={`rounded-none font-bold text-xs gap-1.5 h-8 px-3 ${
                  isTransportEnabled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isTransportEnabled ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> SYSTEM ON
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> SYSTEM OFF
                  </>
                )}
              </Button>
            </div>

            <Button
              onClick={() => {
                if (!isTransportEnabled) return toast.error("Please turn ON Transport System first!");
                setIsAddVehicleOpen(true);
              }}
              className="rounded-none bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2"
            >
              <Plus className="w-4 h-4" /> Add Fleet Vehicle
            </Button>
            <Button
              onClick={() => {
                if (!isTransportEnabled) return toast.error("Please turn ON Transport System first!");
                setIsAddRouteOpen(true);
              }}
              variant="outline"
              className="rounded-none text-white border-white/20 hover:bg-white/10 gap-2"
            >
              <Navigation className="w-4 h-4" /> Add Route
            </Button>
          </div>
        </div>

        {/* Warning Banner when OFF */}
        {!isTransportEnabled && (
          <Card className="rounded-none border-red-500/50 bg-red-500/10 shadow-sm">
            <CardContent className="py-4 px-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-foreground uppercase">Transport System is Currently Disabled (OFF)</h4>
                  <p className="text-xs text-muted-foreground">
                    Students will see transport as unavailable during registration and on their dashboard. Click "SYSTEM ON" above to enable bus fleet setup & pass allotments.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleToggleFacility(true)}
                className="rounded-none bg-red-600 hover:bg-red-700 text-white font-bold text-xs shrink-0"
              >
                Enable Transport System Now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-none border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">{vehicles.length}</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Active Fleet Vehicles</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">{routes.length}</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Operational Routes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <IdCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">{passes.length}</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Issued Transport Passes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">{drivers.length}</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Active Drivers</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs & Search */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="rounded-none bg-muted/60 p-1">
                <TabsTrigger value="vehicles" className="rounded-none text-xs uppercase font-bold gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Fleet Vehicles
                </TabsTrigger>
                <TabsTrigger value="routes" className="rounded-none text-xs uppercase font-bold gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Routes & Stops
                </TabsTrigger>
                <TabsTrigger value="passes" className="rounded-none text-xs uppercase font-bold gap-1.5">
                  <IdCard className="w-3.5 h-3.5" /> Student Passes
                </TabsTrigger>
                <TabsTrigger value="drivers" className="rounded-none text-xs uppercase font-bold gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Drivers & Staff
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vehicle, route, student..."
                className="pl-9 rounded-none h-9 text-xs"
              />
            </div>
          </div>

          {/* VEHICLES TAB */}
          {activeTab === "vehicles" && (
            <Card className="rounded-none border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted text-xs uppercase font-bold tracking-wider border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Vehicle No</th>
                        <th className="px-4 py-3">Type & Capacity</th>
                        <th className="px-4 py-3">Driver Name & Phone</th>
                        <th className="px-4 py-3">Assigned Route</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {vehicles.map((v) => (
                        <tr key={v.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 font-mono font-bold">{v.vehicle_no}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold">{v.vehicle_type}</span>
                            <span className="text-xs text-muted-foreground block">{v.capacity} Seats</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium block">{v.driver_name}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {v.driver_phone}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-primary">{v.route_assigned}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={v.status === "ACTIVE" ? "default" : v.status === "MAINTENANCE" ? "secondary" : "destructive"}
                              className="rounded-none text-[10px]"
                            >
                              {v.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" className="rounded-none h-7 text-xs">
                              Manage
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ROUTES TAB */}
          {activeTab === "routes" && (
            <Card className="rounded-none border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted text-xs uppercase font-bold tracking-wider border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Route Name</th>
                        <th className="px-4 py-3">Start ➔ Destination</th>
                        <th className="px-4 py-3">Total Stops</th>
                        <th className="px-4 py-3">Monthly Fee</th>
                        <th className="px-4 py-3">Assigned Vehicle</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {routes.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 font-bold">{r.route_name}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{r.start_point}</span> ➔{" "}
                            <span className="font-medium text-primary">{r.destination}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold">{r.stops_count} Pickups</td>
                          <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{r.monthly_fee}/month
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">{r.assigned_vehicle}</td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" className="rounded-none h-7 text-xs">
                              Edit Route
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PASSES TAB */}
          {activeTab === "passes" && (
            <Card className="rounded-none border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted text-xs uppercase font-bold tracking-wider border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Pass No</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Enrollment No</th>
                        <th className="px-4 py-3">Route & Bus Stop</th>
                        <th className="px-4 py-3">Valid Till</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {passes.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">{p.pass_number}</td>
                          <td className="px-4 py-3 font-bold">{p.student_name}</td>
                          <td className="px-4 py-3 text-xs font-mono">{p.enrollment_no}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className="font-semibold block">{p.route_name}</span>
                            <span className="text-muted-foreground">{p.stop_name}</span>
                          </td>
                          <td className="px-4 py-3 text-xs">{p.valid_till}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              onClick={() => handlePrintPass(p)}
                              size="sm"
                              className="rounded-none h-7 text-xs gap-1.5"
                            >
                              <Printer className="w-3 h-3" /> Pass Card
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DRIVERS TAB */}
          {activeTab === "drivers" && (
            <Card className="rounded-none border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted text-xs uppercase font-bold tracking-wider border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Driver Name</th>
                        <th className="px-4 py-3">Phone Contact</th>
                        <th className="px-4 py-3">License Number</th>
                        <th className="px-4 py-3">Experience</th>
                        <th className="px-4 py-3">Assigned Vehicle</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {drivers.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 font-bold">{d.name}</td>
                          <td className="px-4 py-3 text-xs font-mono">{d.phone}</td>
                          <td className="px-4 py-3 text-xs font-mono">{d.license_no}</td>
                          <td className="px-4 py-3 text-xs font-semibold">{d.experience_years} Years</td>
                          <td className="px-4 py-3 text-xs font-mono">{d.assigned_vehicle}</td>
                          <td className="px-4 py-3">
                            <Badge variant="default" className="rounded-none text-[10px]">
                              {d.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ADD VEHICLE DIALOG */}
        <Dialog open={isAddVehicleOpen} onOpenChange={setIsAddVehicleOpen}>
          <DialogContent className="rounded-none max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase font-bold">Add Fleet Vehicle</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label>Vehicle Registration No *</Label>
                <Input
                  value={vehicleForm.vehicle_no}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_no: e.target.value })}
                  placeholder="e.g. UP-70-AB-9988"
                  className="rounded-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Vehicle Type</Label>
                  <Select
                    value={vehicleForm.vehicle_type}
                    onValueChange={(v) => setVehicleForm({ ...vehicleForm, vehicle_type: v })}
                  >
                    <SelectTrigger className="rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="32-Seater Bus">32-Seater Bus</SelectItem>
                      <SelectItem value="50-Seater Bus">50-Seater Bus</SelectItem>
                      <SelectItem value="14-Seater Traveler">14-Seater Traveler</SelectItem>
                      <SelectItem value="Van">Van / Microbus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Seating Capacity</Label>
                  <Input
                    type="number"
                    value={vehicleForm.capacity}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })}
                    className="rounded-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Driver Name</Label>
                <Input
                  value={vehicleForm.driver_name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })}
                  placeholder="e.g. Ramesh Singh"
                  className="rounded-none"
                />
              </div>

              <div className="space-y-1">
                <Label>Driver Phone</Label>
                <Input
                  value={vehicleForm.driver_phone}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driver_phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="rounded-none"
                />
              </div>

              <div className="space-y-1">
                <Label>Assigned Route</Label>
                <Input
                  value={vehicleForm.route_assigned}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, route_assigned: e.target.value })}
                  placeholder="Route 1 - City Center"
                  className="rounded-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddVehicleOpen(false)} className="rounded-none">
                Cancel
              </Button>
              <Button onClick={handleAddVehicle} className="rounded-none">
                Save Vehicle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ADD ROUTE DIALOG */}
        <Dialog open={isAddRouteOpen} onOpenChange={setIsAddRouteOpen}>
          <DialogContent className="rounded-none max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase font-bold">Add Bus Route</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label>Route Name *</Label>
                <Input
                  value={routeForm.route_name}
                  onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })}
                  placeholder="e.g. Route 4 - Highway Express"
                  className="rounded-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Start Point</Label>
                  <Input
                    value={routeForm.start_point}
                    onChange={(e) => setRouteForm({ ...routeForm, start_point: e.target.value })}
                    placeholder="Station"
                    className="rounded-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Destination</Label>
                  <Input
                    value={routeForm.destination}
                    onChange={(e) => setRouteForm({ ...routeForm, destination: e.target.value })}
                    placeholder="Main Campus"
                    className="rounded-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Number of Stops</Label>
                  <Input
                    type="number"
                    value={routeForm.stops_count}
                    onChange={(e) => setRouteForm({ ...routeForm, stops_count: e.target.value })}
                    className="rounded-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Monthly Fee (₹)</Label>
                  <Input
                    type="number"
                    value={routeForm.monthly_fee}
                    onChange={(e) => setRouteForm({ ...routeForm, monthly_fee: e.target.value })}
                    className="rounded-none"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddRouteOpen(false)} className="rounded-none">
                Cancel
              </Button>
              <Button onClick={handleAddRoute} className="rounded-none">
                Save Route
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PRINT PASS CARD MODAL */}
        <Dialog open={isPassModalOpen} onOpenChange={setIsPassModalOpen}>
          <DialogContent className="rounded-none max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase font-bold text-center">Student Transport Pass</DialogTitle>
            </DialogHeader>
            {selectedPass && (
              <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-none border border-amber-400/40 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-xs uppercase tracking-wider">Official Bus Pass</span>
                  </div>
                  <Badge className="bg-amber-400 text-slate-950 font-mono text-[10px]">{selectedPass.pass_number}</Badge>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="text-slate-400 uppercase text-[10px]">Student Name</p>
                  <p className="font-extrabold text-sm uppercase">{selectedPass.student_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400 uppercase text-[10px]">Enrollment No</p>
                    <p className="font-mono font-bold">{selectedPass.enrollment_no}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase text-[10px]">Valid Till</p>
                    <p className="font-mono font-bold text-emerald-400">{selectedPass.valid_till}</p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-2 space-y-1 text-xs">
                  <p className="text-slate-400 uppercase text-[10px]">Allocated Route & Stop</p>
                  <p className="font-bold text-amber-300">{selectedPass.route_name}</p>
                  <p className="text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> {selectedPass.stop_name}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => window.print()} className="rounded-none w-full gap-2">
                <Printer className="w-4 h-4" /> Print Bus Pass Card
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
