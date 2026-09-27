// Global type definitions for the application
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare global {
  interface Window {
    __VITE_ENV__?: Record<string, any>;
    desktop?: {
      platform: string;
      isDesktop: boolean;
      setDevToolsMode?: (mode: "off" | "detach" | "right") => Promise<void>;
      selectDirectory?: () => Promise<string | null>;
    };
  }
}

export {};
