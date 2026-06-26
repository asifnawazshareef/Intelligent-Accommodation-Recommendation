import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ur from "./ur.json";
import ar from "./ar.json";
import {
  applyLanguageToDocument,
  getStoredLanguage,
  saveLanguage,
} from "../utils/languageUtils.js";

const storedLanguage = getStoredLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
    ar: { translation: ar },
  },
  lng: storedLanguage,
  fallbackLng: "en",
  supportedLngs: ["en", "ur", "ar"],
  load: "languageOnly",
  interpolation: {
    escapeValue: false,
  },
});

applyLanguageToDocument(storedLanguage);

i18n.on("languageChanged", (language) => {
  saveLanguage(language.split("-")[0]);
});

export default i18n;
