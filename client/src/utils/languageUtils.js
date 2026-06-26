export const LANGUAGE_KEY = "iars_language";

export const SUPPORTED_LANGUAGES = ["en", "ur", "ar"];

export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "ur", label: "اردو" },
  { code: "ar", label: "العربية" },
];

export const getDirection = (language) => {
  if (language === "ur" || language === "ar") {
    return "rtl";
  }

  return "ltr";
};

export const getLanguageClass = (language) => {
  switch (language) {
    case "ur":
      return "lang-ur";
    case "ar":
      return "lang-ar";
    default:
      return "lang-en";
  }
};

export const getStoredLanguage = () => {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  return SUPPORTED_LANGUAGES.includes(stored) ? stored : "en";
};

export const applyLanguageToDocument = (language) => {
  const lang = SUPPORTED_LANGUAGES.includes(language) ? language : "en";
  const dir = getDirection(lang);
  const languageClass = getLanguageClass(lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = dir;

  document.body.classList.remove("lang-en", "lang-ur", "lang-ar");
  document.body.classList.add(languageClass);
};

export const saveLanguage = (language) => {
  localStorage.setItem(LANGUAGE_KEY, language);
  applyLanguageToDocument(language);
};
