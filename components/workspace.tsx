"use client";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Wallet,
  Map,
  Users,
  Compass,
  Building2,
  ArrowUpRight,
  Plus,
  LogOut,
  Menu,
  Search,
  Check,
  ChevronRight,
  MapPin,
  Clock,
  Receipt,
  Bus,
  Settings as SettingsIcon,
} from "lucide-react";
import Settings, { Onboarding } from "./settings";
import { translate, formatDate, formatMoney, localeFor } from "@/lib/i18n.mjs";
import { supabase, demoEnabled, passwordLink } from "@/lib/supabase";
import { demoData } from "@/lib/demo";
import {
  canManage,
  canAccount,
  canTeam,
  nextStatuses,
  inPeriod,
} from "@/lib/rules.mjs";
import type {
  Data,
  Profile,
  Tour,
  Expense,
  Resource,
  Stop,
  Vehicle,
  Company,
  Language,
  Appearance,
} from "@/lib/types";
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Belize" });
const empty: Data = {
  companies: [],
  user_preferences: [],
  profiles: [],
  tours: [],
  resources: [],
  vehicles: [],
  stops: [],
  expenses: [],
  audit: [],
};
type Table = keyof Data;
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Expenses", Wallet],
  ["Tour Management", Map],
  ["Team Members", Users],
  ["Tour Resources", Building2],
  ["Field Mode", Compass],
  ["Settings / Company Profile", SettingsIcon],
] as const;
export default function Workspace() {
  const [data, setData] = useState<Data>(empty),
    [me, setMe] = useState<Profile | null>(null),
    [page, setPage] = useState("Dashboard"),
    [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState<string | null>(null),
    [edit, setEdit] = useState<any>(null),
    [pendingStop, setPendingStop] = useState<any>(null),
    [receiptPreview, setReceiptPreview] = useState<{
      url: string;
      pdf: boolean;
      title: string;
    } | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [period, setPeriod] = useState("Monthly"),
    [tourFilter, setTourFilter] = useState(""),
    [menu, setMenu] = useState(false),
    [recovery, setRecovery] = useState(false),
    [language, setLanguage] = useState<Language>("en"),
    [appearance, setAppearance] = useState<Appearance>("light"),
    [logoUrl, setLogoUrl] = useState<string | null>(null),
    [replayOnboarding, setReplayOnboarding] = useState(false);
  const tr = (key: string, params: Record<string, string | number> = {}) =>
    translate(language, key, params);
  const money = (amount: number) => formatMoney(amount, language);
  const date = (value: string) => formatDate(value, language);
  const preferences = data.user_preferences.find((p) => p.id === me?.id);
  const company = data.companies[0] || null;
  useEffect(() => {
    setLanguage(preferences?.language || "en");
    setAppearance(preferences?.appearance || "light");
  }, [me?.id, preferences?.language, preferences?.appearance]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = appearance;
    document.documentElement.style.colorScheme = appearance;
  }, [language, appearance]);
  useEffect(() => {
    setLogoUrl(null);
    if (!company?.logo_path || !me) return;
    if (!supabase) {
      setLogoUrl(company.logo_path);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      const result = await supabase!.storage
        .from("company-logos")
        .createSignedUrl(company.logo_path!, 300);
      if (!cancelled) {
        if (result.error) setError("Unable to load company logo.");
        else setLogoUrl(result.data.signedUrl);
      }
    };
    refresh();
    const interval = setInterval(refresh, 240000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [company?.logo_path, me?.id]);
  async function load() {
    if (!supabase) return;
    setLoading(true);
    try {
      const {
        data: { user },
        error: e,
      } = await supabase.auth.getUser();
      if (e || !user) {
        setMe(null);
        return;
      }
      const p = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (p.error) throw p.error;
      if (!p.data.active) {
        await supabase.auth.signOut();
        throw Error("Your account is disabled. Contact an administrator.");
      }
      setMe(p.data);
      const result = await Promise.all(
        Object.keys(empty).map(async (k) => {
          const r = await supabase!
            .from(k === "audit" ? "audit_logs" : k)
            .select("*");
          if (r.error) throw r.error;
          return [k, r.data];
        }),
      );
      setData(Object.fromEntries(result) as Data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (demoEnabled) {
      try {
        setData({
          ...empty,
          ...(JSON.parse(localStorage.getItem("tourcore-demo") || "null") ||
            demoData()),
        });
      } catch {
        setData(demoData());
      }
      setMe(demoData().profiles[0]);
      setLoading(false);
      return;
    }
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (
      passwordLink ||
      location.hash.includes("type=invite") ||
      location.hash.includes("type=recovery")
    )
      setRecovery(true);
    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        setMe(null);
        setData(empty);
      } else setTimeout(() => load(), 0);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (demoEnabled && data.profiles.length) {
      try {
        localStorage.setItem("tourcore-demo", JSON.stringify(data));
      } catch {
        setError(
          "Demo storage is full. Use a smaller receipt. Current changes remain available in this session but cannot persist.",
        );
      }
    }
  }, [data]);
  const role = me?.role || "Guide",
    manage = canManage(role),
    account = canAccount(role),
    team = canTeam(role);
  const tours = data.tours.filter(
    (t) => role !== "Guide" || t.guide_id === me?.id,
  );
  const tour = tours.find((t) => t.id === selected);
  const expenses = data.expenses.filter(
    (e) =>
      role !== "Guide" ||
      e.created_by === me?.id ||
      tours.some((t) => t.id === e.tour_id),
  );
  async function save(table: Table, row: any) {
    setBusy(true);
    setError("");
    try {
      if (table === "tours") {
        const before = data.tours.find((t) => t.id === row.id);
        if (row.end_date < row.start_date)
          throw Error("End date must follow start date.");
        if (
          before &&
          before.status !== row.status &&
          !nextStatuses(before.status).includes(row.status)
        )
          throw Error("Invalid lifecycle transition.");
        if (
          ["Planned", "Ongoing"].includes(row.status) &&
          (!row.guide_id || !row.vehicle_id)
        )
          throw Error("Assign a guide and vehicle before planning.");
        const vehicle = data.vehicles.find((v) => v.id === row.vehicle_id);
        if (vehicle && vehicle.capacity < row.guests)
          throw Error("Vehicle capacity must cover all guests.");
        if (data.tours.some((t) => t.id !== row.id && t.code === row.code))
          throw Error("Tour code is already in use.");
        if (
          data.stops.some(
            (s) =>
              s.tour_id === row.id &&
              (s.date < row.start_date || s.date > row.end_date),
          )
        )
          throw Error("Tour dates must include every itinerary stop.");
      }
      if (table === "stops") {
        const parent = data.tours.find((t) => t.id === row.tour_id);
        if (
          !parent ||
          row.date < parent.start_date ||
          row.date > parent.end_date
        )
          throw Error("Stop date must fall within tour dates.");
      }
      if (
        table === "vehicles" &&
        row.source === "Supplier" &&
        !row.supplier_name.trim()
      )
        throw Error("Enter the supplier name.");
      if (supabase) {
        const client = supabase.from(table === "audit" ? "audit_logs" : table);
        // Explicit UPDATE avoids applying INSERT policy to an accountant editing another creator's expense.
        const r = data[table].some((x: any) => x.id === row.id)
          ? await client.update(row).eq("id", row.id).select("id")
          : await client.insert(row).select("id");
        if (r.error) throw r.error;
        if (!r.data?.length)
          throw Error(
            "This record is no longer available or you do not have permission to change it.",
          );
        await load();
      } else {
        setData((d) => ({
          ...d,
          [table]: [...d[table].filter((x: any) => x.id !== row.id), row],
          audit: [
            {
              id: crypto.randomUUID(),
              actor_id: me?.id || null,
              action: "Saved",
              entity: table,
              created_at: new Date().toISOString(),
            },
            ...d.audit,
          ],
        }));
      }
      if (table === "resources" && pendingStop) {
        setEdit({ ...pendingStop, resource_id: row.id });
        setPendingStop(null);
        setModal("Stop");
      } else {
        setModal(null);
        setEdit(null);
      }
      setNotice("Changes saved.");
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveCompany(row: Company, file: File | null) {
    if (!team) {
      setError("Only Owners and Admins can edit company details.");
      return false;
    }
    setError("");
    setBusy(true);
    try {
      if (!row.name.trim()) throw Error("Company name is required.");
      if (file) {
        if (
          file.size > 2 * 1024 * 1024 ||
          !["image/png", "image/jpeg", "image/webp"].includes(file.type)
        )
          throw Error("Logo must be a PNG, JPEG or WebP under 2 MB.");
        if (supabase) {
          const extension = (
            {
              "image/png": "png",
              "image/jpeg": "jpg",
              "image/webp": "webp",
            } as Record<string, string>
          )[file.type];
          const path = `${row.id}/${crypto.randomUUID()}.${extension}`;
          const result = await supabase.storage
            .from("company-logos")
            .upload(path, file);
          if (result.error) throw result.error;
          row = { ...row, logo_path: path };
        } else
          row = {
            ...row,
            logo_path: await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(file);
            }),
          };
      }
      const ok = await save("companies", row);
      if (ok) setNotice("Company profile saved.");
      return ok;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function savePreferences(complete: boolean) {
    if (!me) return false;
    const ok = await save("user_preferences", {
      id: me.id,
      language,
      appearance,
      onboarding_completed:
        complete || preferences?.onboarding_completed || false,
    });
    if (ok) setNotice("Preferences saved.");
    return ok;
  }
  async function remove(table: Table, id: string) {
    setBusy(true);
    try {
      if (supabase) {
        const r = await supabase.from(table).delete().eq("id", id);
        if (r.error) throw r.error;
        await load();
      } else
        setData((d) => ({
          ...d,
          [table]: d[table].filter((x: any) => x.id !== id),
        }));
      setNotice("Removed.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function open(kind: string, value: any = null) {
    setEdit(value);
    setModal(kind);
    setError("");
  }
  function closeModal() {
    if (modal === "Resource" && pendingStop) {
      setEdit(pendingStop);
      setPendingStop(null);
      setModal("Stop");
    } else {
      setModal(null);
      setRecovery(false);
      setEdit(null);
      setPendingStop(null);
    }
  }
  async function auth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const r = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    if (r.error) setError(r.error.message);
    else await load();
    setBusy(false);
  }
  async function reset(email: string) {
    if (!supabase) {
      setNotice(
        "Demo: no email is sent. Connect Supabase to send password links.",
      );
      return;
    }
    const r = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.NEXT_PUBLIC_APP_URL || location.origin,
    });
    if (r.error) setError(r.error.message);
    else setNotice("Password email requested. Check your inbox.");
  }
  async function admin(action: string, user: any) {
    setBusy(true);
    try {
      if (!supabase) {
        const target = data.profiles.find((p) => p.id === user.id);
        if (
          role !== "Owner" &&
          (user.role === "Owner" || target?.role === "Owner")
        )
          throw Error("Only Owners can manage Owner accounts.");
        if (target?.id === me?.id && (!user.active || user.role !== me?.role))
          throw Error("You cannot disable or change your own role.");
        if (action === "create" && user.password.length < 12)
          throw Error("Temporary password requires at least 12 characters.");
        if (action === "invite" || action === "create")
          await save("profiles", {
            id: crypto.randomUUID(),
            name: user.name,
            email: user.email,
            role: user.role,
            active: true,
          });
        else await save("profiles", user);
        setNotice("Demo team change saved; no account or email was created.");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const r = await fetch("/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action, ...user }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      await load();
      setModal(null);
      setNotice("Team change saved.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) || "");
    const id = edit?.id || crypto.randomUUID();
    if (modal === "Tour") {
      if (v("end_date") < v("start_date")) {
        setError("End date must be on or after the start date.");
        return;
      }
      await save("tours", {
        id,
        name: v("name"),
        code: v("code"),
        start_date: v("start_date"),
        end_date: v("end_date"),
        status: edit?.status || "Draft",
        guide_id: v("guide_id") || null,
        vehicle_id: v("vehicle_id") || null,
        guests: Number(v("guests")),
        notes: v("notes"),
      });
    }
    if (modal === "Resource")
      await save("resources", {
        id,
        name: v("name"),
        kind: v("kind"),
        location: v("location"),
        contact: v("contact"),
        notes: v("notes"),
      });
    if (modal === "Vehicle")
      await save("vehicles", {
        id,
        name: v("name"),
        source: v("source"),
        supplier_name: v("supplier_name"),
        registration: v("registration"),
        capacity: Number(v("capacity")),
      });
    if (modal === "Stop") {
      const resource = data.resources.find((r) => r.id === v("resource_id"));
      await save("stops", {
        id,
        tour_id: tour!.id,
        resource_id: resource?.id || null,
        title: v("title"),
        date: v("date"),
        time: v("time"),
        location: v("location") || resource?.location || "",
        contact: v("contact") || resource?.contact || "",
        reference: v("reference"),
        cost: Number(v("cost")),
        notes: v("notes"),
        status: v("status"),
      });
    }
    if (modal === "Expense") {
      setBusy(true);
      let path = edit?.receipt_path || null;
      try {
        const file = f.get("receipt") as File;
        if (file?.size) {
          if (file.size > 10 * 1024 * 1024)
            throw Error("Receipt must be under 10 MB.");
          if (
            ![
              "image/jpeg",
              "image/png",
              "image/webp",
              "application/pdf",
            ].includes(file.type)
          )
            throw Error("Use a JPEG, PNG, WebP or PDF receipt.");
          if (supabase) {
            path = `${me!.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
            const r = await supabase.storage
              .from("receipts")
              .upload(path, file);
            if (r.error) throw r.error;
          } else
            path = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(String(r.result));
              r.onerror = reject;
              r.readAsDataURL(file);
            });
        }
        await save("expenses", {
          id,
          tour_id: v("tour_id") || null,
          created_by: edit?.created_by || me!.id,
          date: v("date"),
          category: v("category"),
          description: v("description"),
          amount: Number(v("amount")),
          receipt_path: path,
        });
      } catch (e: any) {
        setError(e.message);
        setBusy(false);
      }
    }
    if (modal === "Member")
      await admin(edit ? "update" : v("method"), {
        id: edit?.id,
        name: v("name"),
        email: v("email"),
        role: v("role"),
        active: edit?.active ?? true,
        password: v("password"),
      });
  }
  async function receipt(e: Expense) {
    try {
      if (!e.receipt_path) return;
      if (supabase) {
        const r = await supabase.storage
          .from("receipts")
          .createSignedUrl(e.receipt_path, 60);
        if (r.error) throw r.error;
        setReceiptPreview({
          url: r.data.signedUrl,
          pdf: e.receipt_path.toLowerCase().endsWith(".pdf"),
          title: e.description,
        });
      } else {
        setReceiptPreview({
          url: e.receipt_path,
          pdf: e.receipt_path.startsWith("data:application/pdf"),
          title: e.description,
        });
      }
      open("Receipt");
    } catch (e: any) {
      setError(e.message);
    }
  }
  const field = (
    label: string,
    name: string,
    type = "text",
    value: any = "",
    required = false,
  ) => (
    <label>
      {tr(label)}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        minLength={
          type === "password" && modal !== "Member" && me ? 12 : undefined
        }
        min={
          type === "number"
            ? name === "amount"
              ? 0.01
              : ["guests", "capacity"].includes(name)
                ? 1
                : 0
            : undefined
        }
        step={
          type === "number"
            ? ["guests", "capacity"].includes(name)
              ? "1"
              : "0.01"
            : undefined
        }
        readOnly={modal === "Member" && !!edit && name === "email"}
      />
    </label>
  );
  const sel = (
    label: string,
    name: string,
    options: { value: string; label: string }[],
    value = "",
    required = false,
  ) => (
    <label>
      {tr(label)}
      <select name={name} defaultValue={value} required={required}>
        <option value="">{tr("Select…")}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const badge = (s: string) => (
    <span className={`badge ${s.toLowerCase()}`}>{tr(s)}</span>
  );
  const expenseTable = (list: Expense[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{tr("Expense")}</th>
            <th>{tr("Tour")}</th>
            <th>{tr("Date")}</th>
            <th>{tr("Amount · BZD")}</th>
            <th>{tr("Receipt")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => (
              <tr key={e.id}>
                <td>
                  <b>{e.description}</b>
                  <small>{tr(e.category)}</small>
                </td>
                <td>
                  {data.tours.find((t) => t.id === e.tour_id)?.name ||
                    tr("General operations")}
                </td>
                <td>{date(e.date)}</td>
                <td className="amount">{money(e.amount)}</td>
                <td>
                  {e.receipt_path ? (
                    <button className="link" onClick={() => receipt(e)}>
                      <Receipt size={15} /> {tr("View")}{" "}
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {(account || e.created_by === me?.id) && (
                    <button className="link" onClick={() => open("Expense", e)}>
                      {tr("Edit")}{" "}
                    </button>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {!list.length && (
        <div className="empty">{tr("No expenses in this view.")}</div>
      )}
    </div>
  );
  if (loading && (!me || !data.profiles.length))
    return (
      <div className="login">
        <div className="brand">◈ TourCore</div>
        <p>{tr("Opening your workspace…")}</p>
      </div>
    );
  if (!me)
    return (
      <div className="login">
        <div className="login-card">
          <div className="brand">◈ TourCore</div>
          <h1>{tr("Welcome back.")}</h1>
          <p>{tr("A calmer way to run every journey.")}</p>
          {error && (
            <div role="alert" className="alert">
              {tr(error)}
            </div>
          )}
          {notice && <p role="status">{tr(notice)}</p>}
          {supabase ? (
            <form onSubmit={auth}>
              {field("Email", "email", "email", "", true)}
              {field("Password", "password", "password", "", true)}
              <button disabled={busy}>
                {tr("Sign in")} <ArrowUpRight size={16} />
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => open("Reset")}
              >
                {tr("Forgot password?")}{" "}
              </button>
            </form>
          ) : demoEnabled ? (
            <button
              onClick={() =>
                setMe(
                  data.profiles.find((p) => p.active && p.role === "Owner") ||
                    data.profiles[0],
                )
              }
            >
              {tr("Open demo workspace")}{" "}
            </button>
          ) : (
            <p>
              {tr(
                "Configure Supabase in .env.local, or set NEXT_PUBLIC_DEMO_MODE=true to explore the demo.",
              )}{" "}
            </p>
          )}
          {modal === "Reset" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                reset(String(new FormData(e.currentTarget).get("email")));
              }}
            >
              {field("Email", "email", "email", "", true)}
              <button>{tr("Send reset link")}</button>
            </form>
          )}
        </div>
      </div>
    );
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const changePage = (p: string) => {
    setPage(p);
    setSelected(null);
    setQuery("");
    setMenu(false);
  };
  const settingsProps = {
    company,
    logoUrl,
    me,
    language,
    appearance,
    onLanguage: setLanguage,
    onAppearance: setAppearance,
    busy,
    canEdit: team,
    onSaveCompany: saveCompany,
    onSavePreferences: savePreferences,
    onReplay: () => setReplayOnboarding(true),
  };
  if ((!preferences?.onboarding_completed || replayOnboarding) && !recovery)
    return (
      <Onboarding
        {...settingsProps}
        error={error}
        onFinish={async () => {
          if (team && !company) {
            setError("Company name is required.");
            return;
          }
          if (await savePreferences(true)) {
            setReplayOnboarding(false);
            setNotice("Setup complete. Welcome aboard!");
          }
        }}
      />
    );
  return (
    <div className="shell">
      <aside className={menu ? "sidebar expanded" : "sidebar"}>
        <a className="brand" onClick={() => changePage("Dashboard")}>
          {logoUrl ? (
            <img
              className="brand-logo"
              src={logoUrl}
              alt={tr("Company logo")}
            />
          ) : (
            <span className="brand-mark">◈</span>
          )}
          <span className="brand-name" title={company?.name || "TourCore"}>
            {company?.name || "TourCore"}
            <small>TourCore Simple</small>
          </span>
        </a>
        <div className="workspace-label">{tr("YOUR WORKSPACE")}</div>
        <nav>
          {nav
            .filter(([p]) => p !== "Team Members" || team)
            .map(([p, Icon]) => (
              <button
                key={p}
                className={page === p ? "nav-item active" : "nav-item"}
                onClick={() => changePage(p)}
              >
                <Icon size={19} />
                {tr(p)}
                {page === p && <span className="nav-dot" />}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mode-card">
            <Compass size={22} />
            <b>{tr("Made for the journey")}</b>
            <p>
              {tr("Everything your team needs.")} <br />
              {tr("Wherever the day takes you.")}{" "}
            </p>
          </div>
          <div className="profile">
            <span className="avatar">{me.name.slice(0, 1)}</span>
            <div>
              <b>{me.name}</b>
              <small>{tr(role)}</small>
            </div>
            <button
              aria-label={tr("Sign out")}
              className="icon-btn"
              onClick={() => (supabase ? supabase.auth.signOut() : setMe(null))}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            aria-label={tr("Toggle navigation")}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <span>
            {tr("Workspace")} <ChevronRight size={14} /> <b>{tr(page)}</b>
          </span>
          {company && (
            <div className="header-company">
              {logoUrl && <img src={logoUrl} alt={tr("Company logo")} />}
              <span title={company.name}>{company.name}</span>
            </div>
          )}
          <div className="top-right">
            {demoEnabled ? (
              <>
                <span className="demo-label">{tr("LOCAL DEMO")}</span>
                <select
                  aria-label={tr("Demo role")}
                  value={me.id}
                  onChange={(e) => {
                    setMe(data.profiles.find((p) => p.id === e.target.value)!);
                    changePage("Dashboard");
                  }}
                >
                  {data.profiles
                    .filter((p) => p.active)
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name} · {tr(p.role)}
                      </option>
                    ))}
                </select>
              </>
            ) : (
              <span className="live-dot">{tr("Connected")}</span>
            )}
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="alert" role="alert">
              {tr(error)}
              <button className="link" onClick={() => setError("")}>
                {tr("Dismiss")}{" "}
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {tr(notice)}
              <button className="link" onClick={() => setNotice("")}>
                {tr("Dismiss")}{" "}
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "Field Mode"
                  ? tr("YOUR DAY, IN FOCUS")
                  : tr("TOURCORE / OPERATIONS")}
              </span>
              <h1>
                {tour
                  ? tour.name
                  : page === "Dashboard"
                    ? tr("Every journey, in view.")
                    : tr(page)}
              </h1>
              <p>
                {page === "Dashboard"
                  ? tr("A clear picture of your tours, team and spending.")
                  : page === "Field Mode"
                    ? tr("Your itinerary and expenses, ready for the road.")
                    : tr("Keep the details together. Keep the journey moving.")}
              </p>
            </div>
            <div className="heading-actions">
              {tour && (
                <button className="secondary" onClick={() => setSelected(null)}>
                  {tr("Back to tours")}{" "}
                </button>
              )}
              {manage &&
                (page === "Dashboard" || page === "Tour Management") &&
                !tour && (
                  <button onClick={() => open("Tour")}>
                    <Plus size={17} /> {tr("Create tour")}{" "}
                  </button>
                )}
              {(account || role === "Guide" || manage) &&
                (page === "Expenses" || page === "Field Mode") && (
                  <button onClick={() => open("Expense")}>
                    <Plus size={17} /> {tr("Add expense")}{" "}
                  </button>
                )}
              {page === "Team Members" && team && (
                <button onClick={() => open("Member")}>
                  <Plus size={17} /> {tr("Add / invite member")}{" "}
                </button>
              )}
              {page === "Tour Resources" && manage && (
                <button onClick={() => open("Resource")}>
                  <Plus size={17} /> {tr("Add resource")}{" "}
                </button>
              )}
            </div>
          </div>
          {page === "Settings / Company Profile" && (
            <Settings {...settingsProps} />
          )}
          {page === "Dashboard" && (
            <>
              <div className="stats">
                {[
                  [
                    "Overall expenses",
                    money(total),
                    "All recorded spending",
                    Wallet,
                  ],
                  [
                    "Tour expenses",
                    money(
                      expenses
                        .filter((e) => e.tour_id)
                        .reduce((s, e) => s + Number(e.amount), 0),
                    ),
                    "Across your journeys",
                    Receipt,
                  ],
                  [
                    "Ongoing tours",
                    String(tours.filter((t) => t.status === "Ongoing").length),
                    "Out exploring today",
                    Compass,
                  ],
                  [
                    "Completed tours",
                    String(
                      tours.filter((t) => t.status === "Completed").length,
                    ),
                    "Journeys delivered",
                    Check,
                  ],
                ].map(([title, value, caption, Icon]: any) => (
                  <div className="stat" key={title}>
                    <div className="stat-label">
                      {tr(title)}
                      <Icon size={18} />
                    </div>
                    <strong>{value}</strong>
                    <small>{tr(caption)}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="section-title">
                    <div>
                      <h2>{tr("On the horizon")}</h2>
                      <p>{tr("Your active and upcoming journeys")}</p>
                    </div>
                    <button
                      className="link"
                      onClick={() => changePage("Tour Management")}
                    >
                      {tr("All tours")} <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {tours
                    .filter((t) =>
                      ["Ongoing", "Planned", "Draft"].includes(t.status),
                    )
                    .map((t) => (
                      <button
                        className="tour-row"
                        key={t.id}
                        onClick={() => {
                          setPage("Tour Management");
                          setSelected(t.id);
                        }}
                      >
                        <span className="tour-icon">
                          <Map size={22} />
                        </span>
                        <span className="grow">
                          <b>{t.name}</b>
                          <small>
                            {t.code} · {t.guests} {tr("guests")}{" "}
                          </small>
                        </span>
                        {badge(t.status)}
                        <ChevronRight size={18} />
                      </button>
                    ))}
                  {!tours.length && (
                    <div className="empty">
                      {tr("Create your first tour to get started.")}{" "}
                    </div>
                  )}
                </section>
                <section className="journey-panel">
                  <span className="eyebrow">{tr("THE FIELD COMPANION")}</span>
                  <Compass size={48} strokeWidth={1} />
                  <h2>
                    {tr("Less admin.")} <br />
                    {tr("More adventure.")}{" "}
                  </h2>
                  <p>
                    {tr(
                      "Today’s plans, tour details and expenses — right in your pocket.",
                    )}{" "}
                  </p>
                  <button onClick={() => changePage("Field Mode")}>
                    {tr("Open Field Mode")} <ArrowUpRight size={17} />
                  </button>
                </section>
              </div>
              <section className="panel">
                <div className="section-title">
                  <div>
                    <h2>{tr("Recent expenses")}</h2>
                    <p>{tr("The latest spending across your workspace")}</p>
                  </div>
                  <button
                    className="link"
                    onClick={() => changePage("Expenses")}
                  >
                    {tr("View expenses")} <ArrowUpRight size={16} />
                  </button>
                </div>
                {expenseTable(
                  [...expenses]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 5),
                )}
              </section>
            </>
          )}
          {page === "Expenses" && (
            <>
              <div className="toolbar">
                <div className="tabs">
                  {["Daily", "Weekly", "Monthly", "Yearly", "By Tour"].map(
                    (p) => (
                      <button
                        key={p}
                        className={period === p ? "selected" : ""}
                        onClick={() => setPeriod(p)}
                      >
                        {tr(p)}
                      </button>
                    ),
                  )}
                </div>
                {period === "By Tour" && (
                  <select
                    aria-label={tr("Filter tour")}
                    value={tourFilter}
                    onChange={(e) => setTourFilter(e.target.value)}
                  >
                    <option value="">{tr("All tours")}</option>
                    {tours.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="stat total-strip">
                <span>
                  {tr(period)} {tr("spending ·")} {date(today())}
                </span>
                <strong>
                  {money(
                    expenses
                      .filter(
                        (e) =>
                          inPeriod(e.date, period, today()) &&
                          (period !== "By Tour" ||
                            (e.tour_id !== null &&
                              (!tourFilter || e.tour_id === tourFilter))),
                      )
                      .reduce((s, e) => s + Number(e.amount), 0),
                  )}
                </strong>
              </div>
              <section className="panel">
                {expenseTable(
                  expenses.filter(
                    (e) =>
                      inPeriod(e.date, period, today()) &&
                      (period !== "By Tour" ||
                        (e.tour_id !== null &&
                          (!tourFilter || e.tour_id === tourFilter))),
                  ),
                )}
              </section>
            </>
          )}
          {(page === "Tour Management" || page === "Field Mode") && !tour && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder={tr("Search tours…")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="tour-grid">
                {tours
                  .filter((t) =>
                    t.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((t) => (
                    <button
                      className="tour-card"
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                    >
                      <div className="tour-card-top">
                        <span className="tour-icon">
                          <Map size={25} />
                        </span>
                        {badge(t.status)}
                      </div>
                      <small>{t.code}</small>
                      <h2>{t.name}</h2>
                      <p>
                        {date(t.start_date)} → {date(t.end_date)}
                      </p>
                      <div className="card-bottom">
                        <span>
                          {t.guests} {tr("guests ·")}{" "}
                          {data.profiles.find((p) => p.id === t.guide_id)
                            ?.name || tr("Unassigned")}
                        </span>
                        <ArrowUpRight size={20} />
                      </div>
                    </button>
                  ))}
              </div>
              {!tours.length && (
                <div className="empty">{tr("No assigned tours yet.")}</div>
              )}
            </>
          )}
          {tour && (
            <>
              <div className="tour-summary">
                <div>
                  {badge(tour.status)}
                  <span>
                    {tour.code} · {date(tour.start_date)} →{" "}
                    {date(tour.end_date)} · {tour.guests} {tr("guests")}{" "}
                  </span>
                </div>
                {manage && (
                  <div className="heading-actions">
                    <button
                      className="secondary"
                      onClick={() => open("Tour", tour)}
                    >
                      {tr("Edit tour")}{" "}
                    </button>
                    {nextStatuses(tour.status).map((s: string) => (
                      <button
                        className="secondary"
                        key={s}
                        disabled={busy}
                        onClick={() => save("tours", { ...tour, status: s })}
                      >
                        {s === "Cancelled"
                          ? tr("Cancel tour")
                          : tr("Move to {status}", { status: tr(s) })}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="assignment-grid">
                <div className="panel compact">
                  <Users size={21} />
                  <small>{tr("ASSIGNED GUIDE")}</small>
                  <b>
                    {data.profiles.find((p) => p.id === tour.guide_id)?.name ||
                      "Unassigned"}
                  </b>
                </div>
                <div className="panel compact">
                  <Bus size={21} />
                  <small>{tr("VEHICLE")}</small>
                  <b>
                    {data.vehicles.find((v) => v.id === tour.vehicle_id)
                      ?.name || tr("Unassigned")}
                  </b>
                  <small>
                    {tr(
                      data.vehicles.find((v) => v.id === tour.vehicle_id)
                        ?.source || "",
                    )}
                  </small>
                </div>
                <div className="panel compact">
                  <Wallet size={21} />
                  <small>{tr("ACTUAL TOUR EXPENSES")}</small>
                  <b>
                    {money(
                      expenses
                        .filter((e) => e.tour_id === tour.id)
                        .reduce((s, e) => s + Number(e.amount), 0),
                    )}
                  </b>
                </div>
              </div>
              <section className="panel">
                <div className="section-title">
                  <div>
                    <h2>
                      {page === "Field Mode"
                        ? tr("Today’s itinerary")
                        : tr("Itinerary & resource assignments")}
                    </h2>
                    <p>
                      {page === "Field Mode"
                        ? date(today())
                        : tr(
                            "Hotels, attractions, restaurants and custom stops in one timeline.",
                          )}
                    </p>
                  </div>
                  {manage && (
                    <button onClick={() => open("Stop")}>
                      <Plus size={16} /> {tr("Add stop / assignment")}{" "}
                    </button>
                  )}
                </div>
                <div className="timeline">
                  {data.stops
                    .filter(
                      (s) =>
                        s.tour_id === tour.id &&
                        (page !== "Field Mode" || s.date === today()),
                    )
                    .sort((a, b) =>
                      (a.date + a.time).localeCompare(b.date + b.time),
                    )
                    .map((s) => (
                      <div className="stop" key={s.id}>
                        <div className="stop-time">
                          <b>{s.time.slice(0, 5)}</b>
                          <small>{date(s.date)}</small>
                        </div>
                        <div className="stop-content">
                          <span className="eyebrow">
                            {tr(
                              data.resources.find((r) => r.id === s.resource_id)
                                ?.kind || "ITINERARY",
                            )}
                          </span>
                          <h3>{s.title}</h3>
                          <p>
                            {
                              data.resources.find((r) => r.id === s.resource_id)
                                ?.name
                            }
                          </p>
                          <small>
                            <MapPin size={13} />
                            {s.location} · {s.contact}
                          </small>
                          <p>{s.notes}</p>
                          <small>
                            {tr("Ref:")} {s.reference || "—"}{" "}
                            {tr("· Estimated")} {money(s.cost)}
                          </small>
                        </div>
                        <div>
                          {badge(s.status)}
                          {manage && (
                            <div className="stop-actions">
                              <button
                                className="link"
                                onClick={() => open("Stop", s)}
                              >
                                {tr("Edit")}{" "}
                              </button>
                              <button
                                className="link"
                                disabled={busy}
                                onClick={() => remove("stops", s.id)}
                              >
                                {tr("Remove")}{" "}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  {!data.stops.some(
                    (s) =>
                      s.tour_id === tour.id &&
                      (page !== "Field Mode" || s.date === today()),
                  ) && (
                    <div className="empty">
                      {tr("No itinerary stops for this view.")}{" "}
                    </div>
                  )}
                </div>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h2>{tr("Tour information")}</h2>
                </div>
                <p className="pad">
                  {tour.notes || tr("No additional notes.")}
                </p>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h2>{tr("Tour expenses")}</h2>
                  <button onClick={() => open("Expense")}>
                    <Plus size={16} /> {tr("Add expense")}{" "}
                  </button>
                </div>
                {expenseTable(expenses.filter((e) => e.tour_id === tour.id))}
              </section>
            </>
          )}
          {page === "Tour Resources" && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder={tr("Search resources…")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="tour-grid">
                {data.resources
                  .filter((r) =>
                    (r.name + tr(r.kind) + r.location)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((r) => (
                    <div className="panel resource-card" key={r.id}>
                      <span className="eyebrow">{tr(r.kind)}</span>
                      <h2>{r.name}</h2>
                      <p>
                        <MapPin size={14} />
                        {r.location}
                      </p>
                      <p>{r.contact}</p>
                      <p>{r.notes}</p>
                      {manage && (
                        <button
                          className="secondary"
                          onClick={() => open("Resource", r)}
                        >
                          {tr("Edit resource")}{" "}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
              <section className="panel">
                <div className="section-title">
                  <h2>{tr("Vehicles")}</h2>
                  {manage && (
                    <button onClick={() => open("Vehicle")}>
                      <Plus size={16} /> {tr("Add vehicle")}{" "}
                    </button>
                  )}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr("Vehicle")}</th>
                        <th>{tr("Source")}</th>
                        <th>{tr("Registration")}</th>
                        <th>{tr("Seats")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.vehicles.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <b>{v.name}</b>
                          </td>
                          <td>
                            {tr(v.source)}
                            {v.supplier_name && (
                              <small>{v.supplier_name}</small>
                            )}
                          </td>
                          <td>{v.registration}</td>
                          <td>{v.capacity}</td>
                          <td>
                            {manage && (
                              <button
                                className="link"
                                onClick={() => open("Vehicle", v)}
                              >
                                {tr("Edit")}{" "}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {page === "Team Members" && team && (
            <>
              <section className="panel">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr("Member")}</th>
                        <th>{tr("Role")}</th>
                        <th>{tr("Status")}</th>
                        <th>{tr("Manage")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.profiles.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <b>{p.name}</b>
                            <small>{p.email}</small>
                          </td>
                          <td>{tr(p.role)}</td>
                          <td>
                            {badge(p.active ? tr("Active") : tr("Disabled"))}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="link"
                                onClick={() => open("Member", p)}
                              >
                                {tr("Edit")}{" "}
                              </button>
                              <button
                                className="link"
                                disabled={busy || p.id === me.id}
                                onClick={() =>
                                  admin("update", { ...p, active: !p.active })
                                }
                              >
                                {p.active ? tr("Disable") : tr("Reactivate")}
                              </button>
                              <button
                                className="link"
                                onClick={() => reset(p.email)}
                              >
                                {tr("Reset password")}{" "}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h2>{tr("Audit trail")}</h2>
                  <p>{tr("Latest workspace activity")}</p>
                </div>
                <div className="audit-list">
                  {[...data.audit]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(0, 40)
                    .map((a) => (
                      <div key={a.id}>
                        <b>
                          {tr(a.action)} · {tr(a.entity)}
                        </b>
                        <small>
                          {data.profiles.find((p) => p.id === a.actor_id)
                            ?.name || tr("System")}{" "}
                          ·{" "}
                          {new Date(a.created_at).toLocaleString(
                            localeFor(language),
                          )}
                        </small>
                      </div>
                    ))}
                  {!data.audit.length && (
                    <p>{tr("No activity recorded yet.")}</p>
                  )}
                </div>
              </section>
            </>
          )}
          <footer>
            TourCore Simple{" "}
            <span>{tr("Thoughtfully built for the way you travel.")}</span>
            <button className="link" onClick={() => open("Password")}>
              {tr("Change my password")}{" "}
            </button>
          </footer>
        </div>
      </main>
      {(modal || recovery) && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <div className="section-title">
              <h2 id="dialog-title">
                {recovery
                  ? tr("Set your password")
                  : modal === "Receipt"
                    ? tr("Receipt preview")
                    : edit?.id
                      ? tr("Edit {item}", { item: tr(modal || "Resource") })
                      : `${modal === "Member" ? tr("Add / invite member") : modal === "Stop" ? tr("Itinerary stop / resource assignment") : modal === "Password" ? tr("Change password") : tr("Add {item}", { item: tr(modal || "Resource") })}`}
              </h2>
              <button
                className="icon-btn"
                aria-label={tr("Close dialog")}
                onClick={closeModal}
              >
                ✕
              </button>
            </div>
            {error && (
              <div className="alert" role="alert">
                {tr(error)}
              </div>
            )}
            {modal === "Receipt" && receiptPreview ? (
              <div className="receipt-preview">
                <p>{receiptPreview.title}</p>
                {receiptPreview.pdf ? (
                  <iframe src={receiptPreview.url} title={tr("PDF receipt")} />
                ) : (
                  <img
                    src={receiptPreview.url}
                    alt={tr("Receipt for {description}", {
                      description: receiptPreview.title,
                    })}
                  />
                )}
              </div>
            ) : modal === "Password" || recovery ? (
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const password = String(
                    new FormData(e.currentTarget).get("password"),
                  );
                  if (!supabase) {
                    setNotice("Demo: password changes require Supabase.");
                    setModal(null);
                    return;
                  }
                  setBusy(true);
                  const r = await supabase.auth.updateUser({ password });
                  setBusy(false);
                  if (r.error) setError(r.error.message);
                  else {
                    setModal(null);
                    setRecovery(false);
                    setNotice("Password updated.");
                  }
                }}
              >
                {field(
                  "New password (12 characters minimum)",
                  "password",
                  "password",
                  "",
                  true,
                )}
                <button disabled={busy}>{tr("Save password")}</button>
              </form>
            ) : (
              <form className="form" onSubmit={submit}>
                {modal === "Tour" && (
                  <>
                    <div className="form-grid">
                      {field("Tour name", "name", "text", edit?.name, true)}
                      {field(
                        "Tour code",
                        "code",
                        "text",
                        edit?.code ||
                          `TC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
                        true,
                      )}
                      {field(
                        "Start date",
                        "start_date",
                        "date",
                        edit?.start_date || today(),
                        true,
                      )}
                      {field(
                        "End date",
                        "end_date",
                        "date",
                        edit?.end_date || today(),
                        true,
                      )}
                      {field(
                        "Guests",
                        "guests",
                        "number",
                        edit?.guests || 1,
                        true,
                      )}
                      {sel(
                        "Guide",
                        "guide_id",
                        data.profiles
                          .filter((p) => p.role === "Guide" && p.active)
                          .map((p) => ({ value: p.id, label: p.name })),
                        edit?.guide_id || "",
                      )}
                      {sel(
                        "Vehicle",
                        "vehicle_id",
                        data.vehicles.map((v) => ({
                          value: v.id,
                          label: `${v.name} · ${tr(v.source)}`,
                        })),
                        edit?.vehicle_id || "",
                      )}
                    </div>
                    <label>
                      {tr("Tour information")}{" "}
                      <textarea name="notes" defaultValue={edit?.notes} />
                    </label>
                  </>
                )}
                {modal === "Expense" && (
                  <>
                    <div className="form-grid">
                      {field(
                        "Description",
                        "description",
                        "text",
                        edit?.description,
                        true,
                      )}
                      {field(
                        "Amount (BZD)",
                        "amount",
                        "number",
                        edit?.amount,
                        true,
                      )}
                      {field(
                        "Date",
                        "date",
                        "date",
                        edit?.date || today(),
                        true,
                      )}
                      {sel(
                        "Tour (blank = general operations)",
                        "tour_id",
                        tours.map((t) => ({ value: t.id, label: t.name })),
                        edit?.tour_id || tour?.id || "",
                        role === "Guide",
                      )}
                      {sel(
                        "Category",
                        "category",
                        [
                          "Accommodation",
                          "Meals",
                          "Transport",
                          "Attractions",
                          "Office",
                          "Other",
                        ].map((s) => ({ value: s, label: tr(s) })),
                        edit?.category || "Other",
                        true,
                      )}
                    </div>
                    <label>
                      {tr("Receipt · JPEG, PNG, WebP or PDF · max 10 MB")}{" "}
                      <input
                        name="receipt"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                      />
                    </label>
                    <small>
                      {tr(
                        "Amounts use BZD. Estimated itinerary costs are separate from actual expenses.",
                      )}{" "}
                    </small>
                  </>
                )}
                {modal === "Resource" && (
                  <>
                    <div className="form-grid">
                      {field("Name", "name", "text", edit?.name, true)}
                      {sel(
                        "Type",
                        "kind",
                        ["Hotel", "Attraction", "Restaurant"].map((s) => ({
                          value: s,
                          label: tr(s),
                        })),
                        edit?.kind || "Hotel",
                        true,
                      )}
                      {field("Location", "location", "text", edit?.location)}
                      {field("Contact", "contact", "text", edit?.contact)}
                    </div>
                    <label>
                      {tr("Notes")}{" "}
                      <textarea name="notes" defaultValue={edit?.notes} />
                    </label>
                  </>
                )}
                {modal === "Vehicle" && (
                  <div className="form-grid">
                    {field("Vehicle name", "name", "text", edit?.name, true)}
                    {sel(
                      "Source",
                      "source",
                      ["Company", "Supplier"].map((s) => ({
                        value: s,
                        label: tr(s),
                      })),
                      edit?.source || "Company",
                      true,
                    )}
                    {field(
                      "Supplier name (for Supplier source)",
                      "supplier_name",
                      "text",
                      edit?.supplier_name,
                    )}
                    {field(
                      "Registration",
                      "registration",
                      "text",
                      edit?.registration,
                      true,
                    )}
                    {field(
                      "Capacity",
                      "capacity",
                      "number",
                      edit?.capacity || 1,
                      true,
                    )}
                  </div>
                )}
                {modal === "Stop" && (
                  <>
                    <div className="inline-resource">
                      {sel(
                        "Reusable resource (optional)",
                        "resource_id",
                        data.resources.map((r) => ({
                          value: r.id,
                          label: `${tr(r.kind)} · ${r.name}`,
                        })),
                        edit?.resource_id || "",
                      )}
                      <button
                        type="button"
                        className="secondary"
                        onClick={(e) => {
                          const form = e.currentTarget.closest("form");
                          const values = Object.fromEntries(
                            new FormData(form!),
                          );
                          setPendingStop({
                            ...values,
                            id: edit?.id,
                            tour_id: tour!.id,
                            cost: Number(values.cost),
                          });
                          open("Resource");
                        }}
                      >
                        {tr("+ Add new resource")}{" "}
                      </button>
                    </div>
                    <small>
                      {tr(
                        "Add a new place here, then continue this assignment with it selected.",
                      )}{" "}
                    </small>
                    <div className="form-grid">
                      {field(
                        "Stop / assignment title",
                        "title",
                        "text",
                        edit?.title,
                        true,
                      )}
                      {field(
                        "Date",
                        "date",
                        "date",
                        edit?.date || tour?.start_date,
                        true,
                      )}
                      {field(
                        "Time",
                        "time",
                        "time",
                        edit?.time || "09:00",
                        true,
                      )}
                      {field(
                        "Location (blank uses resource)",
                        "location",
                        "text",
                        edit?.location,
                      )}
                      {field(
                        "Contact (blank uses resource)",
                        "contact",
                        "text",
                        edit?.contact,
                      )}
                      {field(
                        "Confirmation / reference",
                        "reference",
                        "text",
                        edit?.reference,
                      )}
                      {field(
                        "Estimated cost (BZD)",
                        "cost",
                        "number",
                        edit?.cost || 0,
                      )}
                      {sel(
                        "Status",
                        "status",
                        ["Pending", "Confirmed", "Cancelled"].map((s) => ({
                          value: s,
                          label: tr(s),
                        })),
                        edit?.status || "Pending",
                        true,
                      )}
                    </div>
                    <label>
                      {tr("Notes")}{" "}
                      <textarea name="notes" defaultValue={edit?.notes} />
                    </label>
                  </>
                )}
                {modal === "Member" && (
                  <>
                    <div className="form-grid">
                      {field("Full name", "name", "text", edit?.name, true)}
                      {field("Email", "email", "email", edit?.email, true)}
                      {sel(
                        "Role",
                        "role",
                        [
                          "Owner",
                          "Admin",
                          "Operations",
                          "Accounting",
                          "Guide",
                        ].map((s) => ({ value: s, label: tr(s) })),
                        edit?.role || "Guide",
                        true,
                      )}
                      {!edit &&
                        sel(
                          "Account creation",
                          "method",
                          [
                            {
                              value: "invite",
                              label: tr("Send email invitation"),
                            },
                            {
                              value: "create",
                              label: tr("Create with temporary password"),
                            },
                          ],
                          "invite",
                          true,
                        )}
                      {!edit &&
                        field(
                          "Temporary password (if creating directly)",
                          "password",
                          "password",
                          "",
                        )}
                    </div>
                    <small>
                      {tr(
                        "Only Owners can assign or edit Owner accounts. Users can change their own password.",
                      )}{" "}
                    </small>
                  </>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={closeModal}
                  >
                    {tr("Cancel")}{" "}
                  </button>
                  <button disabled={busy}>
                    {busy ? tr("Saving…") : tr("Save changes")}
                    <Check size={16} />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
