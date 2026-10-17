import { Grid } from "@mui/material";
import { Column, DateField, Field, Section, SwitchField } from "./components.js";
import { SelectField } from "./SelectField.js";
import { EMAIL_PATTERN, type FormDraft } from "./form-model.js";
import type { StepProps } from "./MovingSteps.js";

export function Contact({ draft, setDraft }: StepProps) {
  const customer = (patch: Partial<FormDraft["customer"]>) =>
    setDraft((current) => ({ ...current, customer: { ...current.customer, ...patch } }));
  const update = (patch: Partial<FormDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  return (
    <Section>
      <Column>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <SelectField required={false} label="Anrede" value={draft.customer.salutation || "-"} options={["-", "Frau", "Herr"]}
              onChange={(value) => customer({ salutation: value === "Frau" || value === "Herr" ? value : "" })} />
          </Grid>
        </Grid>
        <Grid container spacing={2}>
          {(["firstName", "lastName", "email", "phone"] as const).map((key, index) => (
            <Grid key={key} size={{ xs: 12, sm: 6 }}>
              <Field
                required
                label={["Vorname", "Nachname", "E-Mail", "Telefon"][index]}
                value={draft.customer[key]}
                type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                autoComplete={{ firstName: "given-name", lastName: "family-name", email: "email", phone: "tel" }[key]}
                {...(key === "email" ? { slotProps: { htmlInput: {
                  maxLength: 254, pattern: EMAIL_PATTERN, title: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
                } } } : {})}
                onChange={(event) => customer({ [key]: event.target.value })}
              />
            </Grid>
          ))}
        </Grid>
      </Column>
      <SwitchField label="Kostenübernahme durch Arbeitsamt, ARGE etc?" value={draft.costsAssumption} onChange={(costsAssumption) => update({ costsAssumption })} />
      <SwitchField label="Steht der Umzugstermin fest?" value={draft.dateFixed} onChange={(dateFixed) => update({ dateFixed })} />
      <Grid container spacing={2} sx={{ justifyContent: draft.dateFixed ? "center" : "start" }}>
        {draft.dateFixed ? (
          <Grid size={{ xs: 12, sm: 6 }}>
            <DateField label="Umzugstermin" value={draft.movingDate} onChange={(movingDate) => update({ movingDate })} />
          </Grid>
        ) : (
          <>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DateField label="frühester Umzugstermin" value={draft.dateFrom} onChange={(dateFrom) => update({ dateFrom })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DateField label="spätester Umzugstermin" value={draft.dateTo} min={draft.dateFrom} onChange={(dateTo) => update({ dateTo })} />
            </Grid>
          </>
        )}
      </Grid>
    </Section>
  );
}
