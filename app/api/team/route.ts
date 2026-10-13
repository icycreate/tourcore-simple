import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secret)
    return NextResponse.json(
      { error: "Server account management is not configured." },
      { status: 503 },
    );
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const caller = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const {
      data: { user },
      error,
    } = await caller.auth.getUser(token);
    if (error || !user)
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const { data: actor } = await caller
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (!actor?.active || !["Owner", "Admin"].includes(actor.role))
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 },
      );
    const b = await req.json();
    if (!["invite", "create", "update"].includes(b.action))
      throw Error("Unknown action.");
    if (
      typeof b.name !== "string" ||
      !b.name.trim() ||
      typeof b.email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(b.email) ||
      !["Owner", "Admin", "Operations", "Accounting", "Guide"].includes(b.role)
    )
      throw Error("Provide a name, valid email and role.");
    const { data: target } = b.id
      ? await admin.from("profiles").select("*").eq("id", b.id).single()
      : { data: null };
    if (
      actor.role !== "Owner" &&
      (b.role === "Owner" || target?.role === "Owner")
    )
      return NextResponse.json(
        { error: "Only an Owner may manage Owner accounts." },
        { status: 403 },
      );
    if (b.action === "update") {
      if (!target) throw Error("Member not found.");
      // Protect the caller from accidental lockout, and serialize last-owner checks in the DB RPC.
      if (target.id === actor.id && (!b.active || b.role !== actor.role))
        throw Error("You cannot disable or change your own role.");
      if (b.email !== target.email)
        throw Error(
          "Email addresses are immutable here. Invite a new account to change email.",
        );
      const r = await caller.rpc("manage_member", {
        member_id: b.id,
        member_name: b.name.trim(),
        member_role: b.role,
        member_active: !!b.active,
      });
      if (r.error) throw r.error;
    } else {
      if (
        b.action === "create" &&
        (typeof b.password !== "string" || b.password.length < 12)
      )
        throw Error("Temporary password requires at least 12 characters.");
      const redirect = process.env.NEXT_PUBLIC_APP_URL;
      if (!redirect)
        throw Error(
          "NEXT_PUBLIC_APP_URL must be configured for account creation.",
        );
      const r =
        b.action === "invite"
          ? await admin.auth.admin.inviteUserByEmail(b.email, {
              data: { name: b.name.trim() },
              redirectTo: redirect,
            })
          : await admin.auth.admin.createUser({
              email: b.email,
              password: b.password,
              email_confirm: true,
              user_metadata: { name: b.name.trim() },
            });
      if (r.error) throw r.error;
      const update = await caller.rpc("manage_member", {
        member_id: r.data.user.id,
        member_name: b.name.trim(),
        member_role: b.role,
        member_active: true,
      });
      if (update.error) {
        await admin.auth.admin.deleteUser(r.data.user.id);
        throw update.error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Unable to manage member." },
      { status: 400 },
    );
  }
}
