/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** VideoGenerationGateway 网关地址（docs/gateway-api-contract.md）；未配置时开发回退 http://localhost:8000，生产回退同源 */
  readonly VITE_VIDEO_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
