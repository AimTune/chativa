/**
 * GenUI translation resources — EN / TR.
 *
 * Registered lazily so this module can be imported before i18next.init()
 * runs (e.g. in the sandbox where @chativa/genui loads before @chativa/ui).
 */
import { i18next } from "@chativa/core";

const EN: Record<string, string> = {
  "genui.form.processing":     "Processing…",
  "genui.form.submit":         "Submit",
  "genui.form.successTitle":   "Success",
  "genui.form.successDefault": "Done!",
  "genui.form.errorDefault":   "Something went wrong.",

  "genui.appointment.title":          "Book an Appointment",
  "genui.appointment.submit":         "Book Now",
  "genui.appointment.successDefault": "Appointment successfully booked.",
  "genui.appointment.codeHint":       "Please save this code for your reference.",
  "genui.appointment.copy":           "Copy",
  "genui.appointment.copied":         "Copied!",

  "genui.rating.ariaLabel": "Star rating",
  "genui.rating.starLabel": "{{count}} star",
  "genui.rating.submit":    "Submit",
  "genui.rating.thankYou":  "Thank you for your feedback!",

  "genui.datePicker.label": "Select date",
};

const TR: Record<string, string> = {
  "genui.form.processing":     "İşleniyor…",
  "genui.form.submit":         "Gönder",
  "genui.form.successTitle":   "Başarılı",
  "genui.form.successDefault": "Tamamlandı!",
  "genui.form.errorDefault":   "Bir şeyler ters gitti.",

  "genui.appointment.title":          "Randevu Al",
  "genui.appointment.submit":         "Şimdi Randevu Al",
  "genui.appointment.successDefault": "Randevunuz başarıyla alındı.",
  "genui.appointment.codeHint":       "Bu kodu referans olarak saklayın.",
  "genui.appointment.copy":           "Kopyala",
  "genui.appointment.copied":         "Kopyalandı!",

  "genui.rating.ariaLabel": "Yıldız puanı",
  "genui.rating.starLabel": "{{count}} yıldız",
  "genui.rating.submit":    "Gönder",
  "genui.rating.thankYou":  "Geri bildiriminiz için teşekkür ederiz!",

  "genui.datePicker.label": "Tarih seçin",
};

function _register(): void {
  i18next.addResources("en", "translation", EN);
  i18next.addResources("tr", "translation", TR);
}

// Register immediately if i18next is already initialized,
// otherwise wait for the "initialized" event.
if (i18next.isInitialized) {
  _register();
} else {
  i18next.on("initialized", _register);
}
