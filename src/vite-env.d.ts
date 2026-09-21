/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EXAM_V2?: string;
  /** e.g. `https://api.example.com` or `http://127.0.0.1:3008` if the site is served without reverse-proxying `/api` */
  readonly VITE_API_BASE_URL?: string;
}
