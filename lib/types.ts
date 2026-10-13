export type Role = "Owner" | "Admin" | "Operations" | "Accounting" | "Guide";
export type Language = "en" | "es" | "zh-Hant" | "zh-Hans";
export type Appearance = "light" | "dark";
export type UserPreferences = {
  id: string;
  language: Language;
  appearance: Appearance;
  onboarding_completed: boolean;
};
export type Company = {
  id: string;
  name: string;
  legal_name: string;
  business_type: "Company" | "Tour Agency";
  registration_number: string;
  tax_id: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  country: string;
  description: string;
  logo_path: string | null;
  created_by: string;
};
export type Status =
  "Draft" | "Planned" | "Ongoing" | "Completed" | "Cancelled";
export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};
export type Tour = {
  id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  status: Status;
  guide_id: string | null;
  vehicle_id: string | null;
  guests: number;
  notes: string;
};
export type Resource = {
  id: string;
  name: string;
  kind: "Hotel" | "Attraction" | "Restaurant";
  location: string;
  contact: string;
  notes: string;
};
export type Vehicle = {
  id: string;
  name: string;
  source: "Company" | "Supplier";
  supplier_name: string;
  registration: string;
  capacity: number;
};
export type Stop = {
  id: string;
  tour_id: string;
  resource_id: string | null;
  date: string;
  time: string;
  title: string;
  location: string;
  reference: string;
  contact: string;
  cost: number;
  notes: string;
  status: "Pending" | "Confirmed" | "Cancelled";
};
export type Expense = {
  id: string;
  tour_id: string | null;
  created_by: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  receipt_path: string | null;
};
export type Audit = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  created_at: string;
};
export type Data = {
  companies: Company[];
  user_preferences: UserPreferences[];
  profiles: Profile[];
  tours: Tour[];
  resources: Resource[];
  vehicles: Vehicle[];
  stops: Stop[];
  expenses: Expense[];
  audit: Audit[];
};
