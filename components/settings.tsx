"use client";
import { useState } from "react";
import {
  Building2,
  Languages,
  Sun,
  Moon,
  ArrowRight,
  Check,
  Compass,
  Wallet,
  Map,
} from "lucide-react";
import { languages, translate } from "@/lib/i18n.mjs";
import type { Appearance, Company, Language, Profile } from "@/lib/types";
type SharedProps = {
  language: Language;
  appearance: Appearance;
  onLanguage: (language: Language) => void;
  onAppearance: (appearance: Appearance) => void;
  busy: boolean;
};
type Props = SharedProps & {
  company: Company | null;
  logoUrl: string | null;
  me: Profile;
  canEdit: boolean;
  onSaveCompany: (company: Company, file: File | null) => Promise<boolean>;
  onSavePreferences: (complete: boolean) => Promise<boolean>;
  onReplay: () => void;
};
export function PreferenceFields({
  language,
  appearance,
  onLanguage,
  onAppearance,
  busy,
}: SharedProps) {
  const t = (key: string) => translate(language, key);
  return (
    <div className="preference-fields">
      <label>
        <Languages size={16} />
        {t("Language")}
        <select
          aria-label={t("Language")}
          value={language}
          onChange={(e) => onLanguage(e.target.value as Language)}
          disabled={busy}
        >
          {languages.map((l) => (
            <option value={l.value} key={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span>{t("Appearance")}</span>
        <div
          className="appearance-options"
          role="group"
          aria-label={t("Appearance")}
        >
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={appearance === value}
              className={
                appearance === value ? "secondary selected" : "secondary"
              }
              disabled={busy}
              onClick={() => onAppearance(value)}
            >
              {value === "light" ? <Sun size={17} /> : <Moon size={17} />}{" "}
              {t(value === "light" ? "Light" : "Dark")}
              {appearance === value && <Check size={15} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
export function CompanyForm({
  company,
  logoUrl,
  me,
  language,
  busy,
  onSaveCompany,
  onSaved,
}: {
  company: Company | null;
  logoUrl: string | null;
  me: Profile;
  language: Language;
  busy: boolean;
  onSaveCompany: Props["onSaveCompany"];
  onSaved?: () => void;
}) {
  const t = (key: string) => translate(language, key),
    [id] = useState(() => company?.id || crypto.randomUUID());
  const [removeLogo, setRemoveLogo] = useState(false),
    [fileName, setFileName] = useState("");
  const input = (
    label: string,
    name: keyof Company,
    type = "text",
    required = false,
  ) => (
    <label>
      {t(label)}
      <input
        name={name}
        type={type}
        defaultValue={String(company?.[name] || "")}
        required={required}
        maxLength={name === "name" ? 160 : 1000}
      />
    </label>
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form),
      v = (key: string) => String(f.get(key) || "").trim();
    const file = f.get("logo") as File;
    const row: Company = {
      id,
      name: v("name"),
      legal_name: v("legal_name"),
      business_type: v("business_type") as Company["business_type"],
      registration_number: v("registration_number"),
      tax_id: v("tax_id"),
      email: v("email"),
      phone: v("phone"),
      website: v("website"),
      address: v("address"),
      city: v("city"),
      country: v("country"),
      description: v("description"),
      logo_path: removeLogo ? null : company?.logo_path || null,
      created_by: company?.created_by || me.id,
    };
    if (await onSaveCompany(row, file?.size ? file : null)) {
      setRemoveLogo(false);
      setFileName("");
      const upload = form.elements.namedItem("logo") as HTMLInputElement | null;
      if (upload) upload.value = "";
      onSaved?.();
    }
  }
  return (
    <form className="company-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <div className="logo-editor">
          <div className="company-logo-large">
            {logoUrl && !removeLogo ? (
              <img src={logoUrl} alt={t("Company logo")} />
            ) : (
              <Building2 size={36} />
            )}
          </div>
          <div>
            <label>
              {t("Upload / change logo")}
              <input
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  setFileName(e.target.files?.[0]?.name || "");
                  if (e.target.files?.length) setRemoveLogo(false);
                }}
              />
            </label>
            <small>
              {t("PNG, JPEG or WebP · up to 2 MB")}
              {fileName && ` · ${fileName}`}
            </small>
            {company?.logo_path && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={removeLogo}
                  onChange={(e) => setRemoveLogo(e.target.checked)}
                />
                {t("Remove logo")}
              </label>
            )}
          </div>
        </div>
        <div className="form-grid">
          {input("Company name", "name", "text", true)}
          {input("Legal business name", "legal_name")}
          <label>
            {t("Business type")}
            <select
              name="business_type"
              defaultValue={company?.business_type || "Tour Agency"}
            >
              {["Company", "Tour Agency"].map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
          {input("Registration number", "registration_number")}
          {input("Tax ID", "tax_id")}
          {input("Business email", "email", "email")}
          {input("Phone", "phone", "tel")}
          {input("Website", "website", "url")}
          {input("Street address", "address")}
          {input("City", "city")}
          {input("Country", "country")}
        </div>
        <label>
          {t("About the company")}
          <textarea
            name="description"
            defaultValue={company?.description || ""}
            maxLength={2000}
          />
        </label>
        <div className="form-actions">
          <button disabled={busy}>
            {busy
              ? t("Saving…")
              : t(company ? "Save company profile" : "Create company / agency")}
            <Check size={16} />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export default function Settings(props: Props) {
  const t = (key: string) => translate(props.language, key);
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">{t("Company / Tour Agency")}</span>
            <h2>{t("Company Profile")}</h2>
          </div>
          <Building2 size={23} />
        </div>
        {props.canEdit ? (
          <CompanyForm key={props.company?.id || "new"} {...props} />
        ) : props.company ? (
          <div className="company-readonly">
            <div className="company-identity">
              {props.logoUrl && (
                <img src={props.logoUrl} alt={t("Company logo")} />
              )}
              <div>
                <h2>{props.company.name}</h2>
                <p>{t(props.company.business_type)}</p>
              </div>
            </div>
            <dl>
              {[
                ["Legal business name", "legal_name"],
                ["Registration number", "registration_number"],
                ["Tax ID", "tax_id"],
                ["Business email", "email"],
                ["Phone", "phone"],
                ["Website", "website"],
                ["Street address", "address"],
                ["City", "city"],
                ["Country", "country"],
                ["About the company", "description"],
              ].map(([label, key]) => (
                <div key={key}>
                  <dt>{t(label)}</dt>
                  <dd>
                    {String(props.company?.[key as keyof Company] || "—")}
                  </dd>
                </div>
              ))}
            </dl>
            <small>
              {t("Only Owners and Admins can edit company details.")}
            </small>
          </div>
        ) : (
          <p className="pad">
            {t("Your administrator will set up your company profile.")}
          </p>
        )}
      </section>
      <section className="panel preferences-panel">
        <div className="section-title">
          <h2>{t("Your preferences")}</h2>
          <Languages size={22} />
        </div>
        <div className="pad">
          <PreferenceFields {...props} />
          <p>{t("Saved for your account on every device.")}</p>
          <button
            disabled={props.busy}
            onClick={() => props.onSavePreferences(true)}
          >
            {props.busy ? t("Saving…") : t("Save preferences")}
            <Check size={16} />
          </button>
          <button className="link replay-link" onClick={props.onReplay}>
            {t("Review onboarding")}
          </button>
        </div>
      </section>
    </div>
  );
}
export function Onboarding(
  props: Props & { onFinish: () => Promise<void>; error: string },
) {
  const [step, setStep] = useState(0),
    t = (key: string, params = {}) => translate(props.language, key, params);
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-brand">
          <Compass size={29} />
          <b>TourCore</b>
          <span>{t("Step {step} of 3", { step: step + 1 })}</span>
        </div>
        <div className="onboarding-progress">
          {["Welcome", "Your company", "Ready to go"].map((title, i) => (
            <span key={title} className={i <= step ? "complete" : ""}>
              {i + 1}. {t(title)}
            </span>
          ))}
        </div>
        <span className="eyebrow">{t("Let’s make this workspace yours.")}</span>
        <h1>
          {t(
            step === 0
              ? "Welcome to TourCore"
              : step === 1
                ? "Your company"
                : "Ready to go",
          )}
        </h1>
        {props.error && (
          <div className="alert" role="alert">
            {t(props.error)}
          </div>
        )}
        {step === 0 ? (
          <>
            <p>
              {t(
                "Choose your language and appearance. You can change them later in Settings.",
              )}
            </p>
            <PreferenceFields {...props} />
          </>
        ) : step === 1 ? (
          <>
            <p>
              {t(
                props.canEdit
                  ? "Create your company profile to personalize the workspace for your team."
                  : "Your workspace brings tours, expenses and your team together.",
              )}
            </p>
            {props.canEdit ? (
              <CompanyForm
                key={props.company?.id || "new"}
                {...props}
                onSaved={() => setStep(2)}
              />
            ) : (
              <div className="onboarding-company">
                {props.logoUrl && (
                  <img src={props.logoUrl} alt={t("Company logo")} />
                )}
                <h2>
                  {props.company?.name ||
                    t("Your administrator will set up your company profile.")}
                </h2>
              </div>
            )}
          </>
        ) : (
          <>
            <p>
              {t(
                "Your workspace brings tours, expenses and your team together.",
              )}
            </p>
            <div className="onboarding-features">
              {[
                [
                  Map,
                  "Tour Management",
                  "Manage trips from planning to completion.",
                ],
                [
                  Wallet,
                  "Expenses",
                  "Track actual spending and keep receipts together.",
                ],
                [
                  Compass,
                  "Field Mode",
                  "Take your itinerary and expense tools on the road.",
                ],
              ].map(([Icon, title, caption]: any) => (
                <div key={title}>
                  <Icon size={25} />
                  <div>
                    <h3>{t(title)}</h3>
                    <p>{t(caption)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="onboarding-actions">
          {step > 0 && (
            <button
              className="secondary"
              disabled={props.busy}
              onClick={() => setStep(step - 1)}
            >
              {t("Back")}
            </button>
          )}
          {step === 0 && (
            <button onClick={() => setStep(1)}>
              {t("Continue")}
              <ArrowRight size={17} />
            </button>
          )}
          {step === 1 && (!props.canEdit || props.company) && (
            <button disabled={props.busy} onClick={() => setStep(2)}>
              {t("Continue")}
              <ArrowRight size={17} />
            </button>
          )}
          {step === 2 && (
            <button disabled={props.busy} onClick={props.onFinish}>
              {props.busy ? t("Saving…") : t("Finish setup")}
              <Check size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
