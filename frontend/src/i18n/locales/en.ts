export const en = {
  common: {
    language: "Language",
    loading: "Loading...",
  },
  settings: {
    title: "Settings",
    subtitle:
      "Step 1: connect your PostgreSQL database. After successful validation the configuration will be saved.",
    preferencesTitle: "Preferences",
    languageTitle: "Language",
    languageHelp: "Changes are applied immediately and saved for the next session.",
    languageOptionEnglish: "English",
    languageOptionRussian: "Russian",
    connectionWizardTitle: "Database Connection Wizard",
    fieldConnectionName: "Connection name",
    fieldDbType: "Database type",
    fieldPort: "Port",
    fieldHost: "Host",
    fieldDatabaseName: "Database name",
    fieldUsername: "Username",
    fieldPassword: "Password",
    submitIdle: "Validate and save",
    submitLoading: "Validating...",
    connectionSaved:
      "Connection validated and saved. You can now create backups from dashboard.",
    connectionTestError: "Failed to validate connection",
    connectionErrorGeneric: "Connection error",
  },
} as const;

export type LocaleDictionary = typeof en;
