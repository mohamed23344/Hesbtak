import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "no-restricted-imports": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",

      // Disable React Hooks rules
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },

  // Remove recommended configs
  // js.configs.recommended,
  // ...tseslint.configs.recommended,
  // eslintPluginPrettier,
);
