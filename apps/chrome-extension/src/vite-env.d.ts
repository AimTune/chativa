/// <reference types="vite/client" />

// Declare Vite-specific imports used by workspace packages
declare module "*.css?inline" {
  const content: string;
  export default content;
}

declare module "*?inline" {
  const content: string;
  export default content;
}
