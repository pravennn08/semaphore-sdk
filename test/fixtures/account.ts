// Synthetic values; these first fixtures represent the documented fields.
export const account = {
  account_id: 42,
  account_name: "Example Account",
  status: "Active",
  credit_balance: "1234.50",
};

export const senderNames = [
  { name: "ExampleSMS", status: "Active", created_at: "2026-01-01 10:00:00" },
];

export const users = [
  { user_id: 7, email: "owner@example.com", role: "Owner", status: "Active" },
];

// Reconstructed from the user's redacted live response shapes. Values are fake.
// The extra sender key was masked by the diagnostic; its name is a placeholder,
// not a confirmed provider field or a timestamp alias.
export const observedSenderNames = [
  {
    name: "ExampleSMS",
    status: "Active",
    additional_provider_field: "placeholder",
  },
  {
    name: "ExampleAlerts",
    status: "Active",
    additional_provider_field: "placeholder",
  },
];

export const observedUsers = [
  { user_id: 7, email: "owner@example.com", role: "Owner" },
];

// Intentionally arbitrary fields: transaction record fields are undocumented.
export const transactions = [
  {
    example_provider_field: "preserved",
    details: { value: "10.50" },
    optional: null,
  },
];
