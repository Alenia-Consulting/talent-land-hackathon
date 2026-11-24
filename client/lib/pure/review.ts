// What a step still needs before the venue can approve it.
//
// The API reports this in two places that do not agree in shape: `StepOut.missing_fields` lists
// the fields Gemini left blank, while the guide-wide `pending.missing_data` ALSO counts a step
// whose easy-read text is empty, without ever naming that field (see api/db/guides.py,
// `_data_is_missing`). Taking only `missing_fields` makes the panel warn "2 datos en blanco"
// above a list of steps that all look finished, with nothing to click.
//
// This mirrors the backend's rule in one place so both numbers come from the same definition.

type ReviewableStep = {
  easy_read_text?: string | null;
  missing_fields: string[];
};

export function missingFieldsOf(step: ReviewableStep): string[] {
  const missing = [...step.missing_fields];
  if (!step.easy_read_text?.trim() && !missing.includes("easy_read_text")) {
    missing.unshift("easy_read_text");
  }
  return missing;
}

/** How many fields, across every step, are still empty. Fields, not steps. */
export function countMissing(steps: ReviewableStep[]): number {
  return steps.reduce((total, step) => total + missingFieldsOf(step).length, 0);
}
