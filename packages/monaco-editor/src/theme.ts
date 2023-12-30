import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

/**
 * The default light theme with customized background
 */
export const LightThemeName = "nteract-light";

/**
 * Default monaco theme for light theme
 */
export const customMonacoLightTheme: monaco.editor.IStandaloneThemeData = {
  base: "vs", // Derive from default light theme of Monaco
  inherit: true,
  rules: [],
  colors: {
    // Ensure that editor background is set to white
    // Without this, the Monaco light theme has a yellowish tone.
    "editor.background": "#FFFFFF"
  }
};

monaco.editor.defineTheme(LightThemeName, customMonacoLightTheme);

/**
 * The default dark theme with customized background
 */
export const DarkThemeName = "nteract-dark";

/**
 * Default monaco theme for dark theme
 */
export const customMonacoDarkTheme: monaco.editor.IStandaloneThemeData = {
  base: "vs-dark", // Derive from default dark theme of Monaco
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#111111"
  }
};

monaco.editor.defineTheme(DarkThemeName, customMonacoDarkTheme);
/**
 * The custom high contrast light theme with customized background
 */
export const HCLightThemeName = "nteract-hc-light";

/**
 * Default monaco theme for light high contrast mode
 */
export const customMonacoHCLightTheme: monaco.editor.IStandaloneThemeData = {
  base: "vs", // Derive from default light theme of Monaco; change all grey colors to black to comply with highcontrast rules
  inherit: true,
  rules: [
    { token: "annotation", foreground: "000000" },
    { token: "delimiter.html", foreground: "000000" },
    { token: "operator.scss", foreground: "000000" },
    { token: "operator.sql", foreground: "000000" },
    { token: "operator.swift", foreground: "000000" },
    { token: "predefined.sql", foreground: "000000" }
  ],
  colors: {
    // Ensure that editor background is set to white
    // Without this, the Monaco light theme has a yellowish tone.
    "editor.background": "#FFFFFF"
  }
};

monaco.editor.defineTheme(HCLightThemeName, customMonacoHCLightTheme);
