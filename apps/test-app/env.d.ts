interface ImportMetaEnv {
    readonly PUBLIC_FIREBASE_API_KEY: string;
    readonly PUBLIC_FIREBASE_AUTH_DOMAIN: string;
    readonly PUBLIC_FIREBASE_PROJECT_ID: string;
    readonly FIREBASE_ADMIN_CLIENT_EMAIL: string;
    readonly FIREBASE_ADMIN_PRIVATE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
