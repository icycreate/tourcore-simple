import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "10000000-0000-4000-8000-000000000001",
  guide = "10000000-0000-4000-8000-000000000002",
  other = "10000000-0000-4000-8000-000000000003",
  account = "10000000-0000-4000-8000-000000000004",
  admin = "10000000-0000-4000-8000-000000000005";
test("Real PostgreSQL migration, constraints, RLS and audit boundaries", async (t) => {
  const db = new PGlite();
  try {
    // Emulate only Supabase's provided Auth/Storage schemas; application SQL runs unchanged.
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 grant usage on schema auth,storage,public to anon,authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610120001_tourcore.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610120002_company_settings.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users(id,email) values('${owner}','owner@example.com'),('${guide}','guide@example.com'),('${other}','other@example.com'),('${account}','account@example.com'),('${admin}','admin@example.com');update public.profiles set role='Owner' where id='${owner}';update public.profiles set role='Accounting' where id='${account}';update public.profiles set role='Admin' where id='${admin}';`,
    );
    await db.exec(
      await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
    );
    const tour = "00000000-0000-4000-8000-000000000010";
    async function as(id, sql) {
      await db.exec("begin");
      try {
        await db.exec(
          `set local role authenticated;set local "request.jwt.claim.sub"='${id}';`,
        );
        const result = await db.query(sql);
        await db.exec("commit");
        return result.rows;
      } catch (e) {
        await db.exec("rollback");
        throw e;
      }
    }
    await t.test(
      "Company creation, branding and singleton workspace are enforced",
      async () => {
        const cid = "30000000-0000-4000-8000-000000000001";
        await assert.rejects(
          as(
            guide,
            `insert into public.companies(name,created_by) values('Unauthorized','${guide}')`,
          ),
          /row-level security/,
        );
        await assert.rejects(
          as(
            owner,
            `insert into public.companies(name,created_by) values('','${owner}')`,
          ),
          /check constraint/,
        );
        await as(
          owner,
          `insert into storage.objects(bucket_id,name) values('company-logos','${cid}/30000000-0000-4000-8000-000000000002.png')`,
        );
        await as(
          owner,
          `insert into public.companies(id,name,business_type,created_by,logo_path) values('${cid}','TourCore Travels','Tour Agency','${owner}','${cid}/30000000-0000-4000-8000-000000000002.png')`,
        );
        assert.equal(
          (await as(guide, "select * from public.companies")).length,
          1,
        );
        assert.equal(
          (
            await as(
              guide,
              "select * from storage.objects where bucket_id='company-logos'",
            )
          ).length,
          1,
        );
        assert.equal(
          (
            await as(
              account,
              "update public.companies set name='Forbidden' returning id",
            )
          ).length,
          0,
        );
        await assert.rejects(
          as(
            owner,
            `insert into public.companies(name,created_by) values('Second agency','${owner}')`,
          ),
          /unique constraint/,
        );
        await assert.rejects(
          as(
            guide,
            `insert into storage.objects(bucket_id,name) values('company-logos','${cid}/30000000-0000-4000-8000-000000000003.png')`,
          ),
          /row-level security/,
        );
        await assert.rejects(
          as(
            owner,
            `update public.companies set logo_path='${cid}/missing.png'`,
          ),
          /logo upload not found/,
        );
        await assert.rejects(
          as(owner, `update public.companies set created_by='${guide}'`),
          /immutable/,
        );
        await as(admin, "update public.companies set city='San Ignacio'");
      },
    );
    await t.test(
      "Language, theme and onboarding persist privately per user",
      async () => {
        await as(
          guide,
          `insert into public.user_preferences(id,language,appearance,onboarding_completed) values('${guide}','zh-Hant','dark',true)`,
        );
        const rows = await as(guide, "select * from public.user_preferences");
        assert.equal(rows[0].language, "zh-Hant");
        assert.equal(rows[0].appearance, "dark");
        assert.equal(rows[0].onboarding_completed, true);
        assert.equal(
          (await as(owner, "select * from public.user_preferences")).length,
          0,
        );
        assert.equal(
          (await as(other, "select * from public.user_preferences")).length,
          0,
        );
        await assert.rejects(
          as(
            other,
            `insert into public.user_preferences(id) values('${account}')`,
          ),
          /row-level security/,
        );
        assert.equal(
          (
            await as(
              owner,
              `update public.user_preferences set language='es' where id='${guide}' returning id`,
            )
          ).length,
          0,
        );
        await assert.rejects(
          as(guide, `update public.user_preferences set language='xx'`),
          /check constraint/,
        );
        await assert.rejects(
          as(guide, `update public.user_preferences set appearance='invalid'`),
          /check constraint/,
        );
        await as(
          guide,
          "update public.user_preferences set language='zh-Hans',appearance='light'",
        );
        assert.equal(
          (await as(guide, "select * from public.user_preferences"))[0]
            .language,
          "zh-Hans",
        );
      },
    );
    await t.test("Anonymous cannot access data", async () => {
      await db.exec("begin;set local role anon");
      await assert.rejects(
        db.query("select * from public.tours"),
        /permission denied/,
      );
      await db.exec("rollback");
    });
    await t.test("Guide cannot promote self", async () => {
      assert.equal(
        (
          await as(
            guide,
            `update public.profiles set role='Owner' where id='${guide}' returning *`,
          )
        ).length,
        0,
      );
      await assert.rejects(
        as(
          guide,
          `select public.manage_member('${guide}','Guide','Owner',true)`,
        ),
        /Administrator access required/,
      );
    });
    await t.test("Tour constraints and lifecycle enforced", async () => {
      await assert.rejects(
        as(
          owner,
          `update public.tours set status='Planned' where id='${tour}'`,
        ),
        /Assign a guide/,
      );
      await as(
        owner,
        `update public.tours set guide_id='${guide}',vehicle_id='00000000-0000-4000-8000-000000000020',status='Planned' where id='${tour}'`,
      );
      await assert.rejects(
        as(owner, `update public.tours set guests=16 where id='${tour}'`),
        /capacity/,
      );
      await assert.rejects(
        as(
          owner,
          `update public.tours set status='Completed' where id='${tour}'`,
        ),
        /lifecycle/,
      );
    });
    await t.test("Only assigned guide reads tour and resources", async () => {
      assert.equal((await as(guide, "select * from public.tours")).length, 1);
      assert.equal((await as(other, "select * from public.tours")).length, 0);
      assert.equal(
        (await as(guide, "select * from public.resources")).length,
        0,
      );
      await as(
        owner,
        `insert into public.stops(tour_id,resource_id,date,time,title) values('${tour}','00000000-0000-4000-8000-000000000030',current_date,'08:00','Hotel departure')`,
      );
      assert.equal(
        (await as(guide, "select * from public.resources")).length,
        1,
      );
      await assert.rejects(
        as(
          owner,
          `insert into public.stops(tour_id,date,time,title) values('${tour}',current_date+10,'08:00','Invalid date')`,
        ),
        /Stop date/,
      );
    });
    await t.test(
      "Guide cannot mutate tour and cannot create cross-tour expenses",
      async () => {
        assert.equal(
          (
            await as(
              guide,
              `update public.tours set name='Hacked' where id='${tour}' returning *`,
            )
          ).length,
          0,
        );
        await assert.rejects(
          as(
            other,
            `insert into public.expenses(tour_id,created_by,date,category,description,amount) values('${tour}','${other}',current_date,'Meals','Invalid',10)`,
          ),
          /row-level security/,
        );
        await assert.rejects(
          as(
            guide,
            `insert into public.expenses(created_by,date,category,description,amount) values('${guide}',current_date,'Meals','General',10)`,
          ),
          /row-level security/,
        );
      },
    );
    await t.test(
      "Private receipts, accounting edit and immutable creator",
      async () => {
        await as(
          guide,
          `insert into storage.objects(bucket_id,name) values('receipts','${guide}/receipt.pdf')`,
        );
        await as(
          guide,
          `insert into public.expenses(id,tour_id,created_by,date,category,description,amount,receipt_path) values('20000000-0000-4000-8000-000000000001','${tour}','${guide}',current_date,'Meals','Lunch',10,'${guide}/receipt.pdf')`,
        );
        assert.equal(
          (await as(other, "select * from storage.objects where bucket_id='receipts'")).length,
          0,
        );
        assert.equal(
          (await as(account, "select * from storage.objects where bucket_id='receipts'")).length,
          1,
        );
        await as(account, `update public.expenses set amount=20`);
        await assert.rejects(
          as(account, `update public.expenses set created_by='${account}'`),
          /creator is immutable/,
        );
        await assert.rejects(
          as(
            guide,
            `insert into storage.objects(bucket_id,name) values('receipts','${other}/fake.pdf')`,
          ),
          /row-level security/,
        );
      },
    );
    await t.test("Admin cannot manage Owner or self-lock out", async () => {
      await assert.rejects(
        as(
          admin,
          `select public.manage_member('${owner}','Owner','Guide',true)`,
        ),
        /Only Owners/,
      );
      await assert.rejects(
        as(
          owner,
          `select public.manage_member('${owner}','Owner','Guide',true)`,
        ),
        /Cannot disable/,
      );
    });
    await t.test(
      "Disabled users lose all existing-session data access",
      async () => {
        await as(
          owner,
          `select public.manage_member('${guide}','Guide','Guide',false)`,
        );
        assert.equal((await as(guide, "select * from public.tours")).length, 0);
        assert.equal(
          (await as(guide, "select * from public.expenses")).length,
          0,
        );
        assert.equal(
          (await as(guide, "select * from public.companies")).length,
          0,
        );
        assert.equal(
          (await as(guide, "select * from public.user_preferences")).length,
          0,
        );
        assert.equal(
          (await as(guide, "select * from storage.objects")).length,
          0,
        );
        await assert.rejects(
          as(
            guide,
            `insert into storage.objects(bucket_id,name) values('receipts','${guide}/disabled.pdf')`,
          ),
          /row-level security/,
        );
        await as(
          owner,
          `select public.manage_member('${guide}','Guide','Guide',true)`,
        );
      },
    );
    await t.test("Audit append-only and hidden from Guide", async () => {
      assert.equal(
        (await as(guide, "select * from public.audit_logs")).length,
        0,
      );
      assert.ok(
        (await as(owner, "select * from public.audit_logs")).length > 5,
      );
      await assert.rejects(
        as(owner, "delete from public.audit_logs"),
        /permission denied/,
      );
    });
    await t.test("Completed lifecycle is terminal", async () => {
      await as(
        owner,
        `update public.tours set status='Ongoing' where id='${tour}'`,
      );
      await as(
        owner,
        `update public.tours set status='Completed' where id='${tour}'`,
      );
      await assert.rejects(
        as(owner, `update public.tours set status='Draft' where id='${tour}'`),
        /lifecycle/,
      );
    });
  } finally {
    await db.close();
  }
});
