/**
 * GenUI translation resources — one block per bundled language.
 *
 * Registered lazily so this module can be imported before i18next.init()
 * runs (e.g. in the sandbox where @chativa/genui loads before @chativa/ui).
 *
 * Every block must mirror `EN` exactly. Plural keys (`_one`, `_other`, …)
 * follow each language's CLDR plural categories rather than English's.
 * Keep each block a flat `"key": "value"` object literal with double-quoted
 * strings and register it in `GENUI_LOCALES` — `scripts/i18n-check.mjs`
 * parses this file to verify key parity in CI.
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

  "genui.rating.ariaLabel":       "Star rating",
  "genui.rating.starLabel_one":   "{{count}} star",
  "genui.rating.starLabel_other": "{{count}} stars",
  "genui.rating.submit":          "Submit",
  "genui.rating.thankYou":        "Thank you for your feedback!",

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

  "genui.rating.ariaLabel":       "Yıldız puanı",
  "genui.rating.starLabel_one":   "{{count}} yıldız",
  "genui.rating.starLabel_other": "{{count}} yıldız",
  "genui.rating.submit":          "Gönder",
  "genui.rating.thankYou":        "Geri bildiriminiz için teşekkür ederiz!",

  "genui.datePicker.label": "Tarih seçin",
};

const ES: Record<string, string> = {
  "genui.form.processing":     "Procesando…",
  "genui.form.submit":         "Enviar",
  "genui.form.successTitle":   "Listo",
  "genui.form.successDefault": "¡Hecho!",
  "genui.form.errorDefault":   "Algo salió mal.",

  "genui.appointment.title":          "Reservar una cita",
  "genui.appointment.submit":         "Reservar ahora",
  "genui.appointment.successDefault": "La cita se ha reservado correctamente.",
  "genui.appointment.codeHint":       "Guarda este código como referencia.",
  "genui.appointment.copy":           "Copiar",
  "genui.appointment.copied":         "¡Copiado!",

  "genui.rating.ariaLabel":       "Valoración con estrellas",
  "genui.rating.starLabel_one":   "{{count}} estrella",
  "genui.rating.starLabel_many":  "{{count}} de estrellas",
  "genui.rating.starLabel_other": "{{count}} estrellas",
  "genui.rating.submit":          "Enviar",
  "genui.rating.thankYou":        "¡Gracias por tu opinión!",

  "genui.datePicker.label": "Seleccionar fecha",
};

const FR: Record<string, string> = {
  "genui.form.processing":     "Traitement en cours…",
  "genui.form.submit":         "Envoyer",
  "genui.form.successTitle":   "Succès",
  "genui.form.successDefault": "Terminé !",
  "genui.form.errorDefault":   "Une erreur s'est produite.",

  "genui.appointment.title":          "Prendre rendez-vous",
  "genui.appointment.submit":         "Réserver",
  "genui.appointment.successDefault": "Votre rendez-vous a bien été réservé.",
  "genui.appointment.codeHint":       "Veuillez conserver ce code pour référence.",
  "genui.appointment.copy":           "Copier",
  "genui.appointment.copied":         "Copié !",

  "genui.rating.ariaLabel":       "Note en étoiles",
  "genui.rating.starLabel_one":   "{{count}} étoile",
  "genui.rating.starLabel_many":  "{{count}} d'étoiles",
  "genui.rating.starLabel_other": "{{count}} étoiles",
  "genui.rating.submit":          "Envoyer",
  "genui.rating.thankYou":        "Merci pour votre avis !",

  "genui.datePicker.label": "Sélectionner une date",
};

const DE: Record<string, string> = {
  "genui.form.processing":     "Wird verarbeitet…",
  "genui.form.submit":         "Absenden",
  "genui.form.successTitle":   "Erfolgreich",
  "genui.form.successDefault": "Fertig!",
  "genui.form.errorDefault":   "Etwas ist schiefgelaufen.",

  "genui.appointment.title":          "Termin buchen",
  "genui.appointment.submit":         "Jetzt buchen",
  "genui.appointment.successDefault": "Termin erfolgreich gebucht.",
  "genui.appointment.codeHint":       "Bitte bewahren Sie diesen Code für Rückfragen auf.",
  "genui.appointment.copy":           "Kopieren",
  "genui.appointment.copied":         "Kopiert!",

  "genui.rating.ariaLabel":       "Sternebewertung",
  "genui.rating.starLabel_one":   "{{count}} Stern",
  "genui.rating.starLabel_other": "{{count}} Sterne",
  "genui.rating.submit":          "Absenden",
  "genui.rating.thankYou":        "Vielen Dank für Ihr Feedback!",

  "genui.datePicker.label": "Datum auswählen",
};

const IT: Record<string, string> = {
  "genui.form.processing":     "Elaborazione in corso…",
  "genui.form.submit":         "Invia",
  "genui.form.successTitle":   "Operazione riuscita",
  "genui.form.successDefault": "Fatto!",
  "genui.form.errorDefault":   "Si è verificato un errore.",

  "genui.appointment.title":          "Prenota un appuntamento",
  "genui.appointment.submit":         "Prenota ora",
  "genui.appointment.successDefault": "Appuntamento prenotato correttamente.",
  "genui.appointment.codeHint":       "Conserva questo codice come riferimento.",
  "genui.appointment.copy":           "Copia",
  "genui.appointment.copied":         "Copiato!",

  "genui.rating.ariaLabel":       "Valutazione a stelle",
  "genui.rating.starLabel_one":   "{{count}} stella",
  "genui.rating.starLabel_many":  "{{count}} di stelle",
  "genui.rating.starLabel_other": "{{count}} stelle",
  "genui.rating.submit":          "Invia",
  "genui.rating.thankYou":        "Grazie per il tuo feedback!",

  "genui.datePicker.label": "Seleziona una data",
};

const PT_BR: Record<string, string> = {
  "genui.form.processing":     "Processando…",
  "genui.form.submit":         "Enviar",
  "genui.form.successTitle":   "Sucesso",
  "genui.form.successDefault": "Pronto!",
  "genui.form.errorDefault":   "Algo deu errado.",

  "genui.appointment.title":          "Agendar horário",
  "genui.appointment.submit":         "Agendar agora",
  "genui.appointment.successDefault": "Agendamento realizado com sucesso.",
  "genui.appointment.codeHint":       "Guarde este código para referência.",
  "genui.appointment.copy":           "Copiar",
  "genui.appointment.copied":         "Copiado!",

  "genui.rating.ariaLabel":       "Avaliação por estrelas",
  "genui.rating.starLabel_one":   "{{count}} estrela",
  "genui.rating.starLabel_many":  "{{count}} de estrelas",
  "genui.rating.starLabel_other": "{{count}} estrelas",
  "genui.rating.submit":          "Enviar",
  "genui.rating.thankYou":        "Obrigado pelo seu feedback!",

  "genui.datePicker.label": "Selecionar data",
};

const PL: Record<string, string> = {
  "genui.form.processing":     "Przetwarzanie…",
  "genui.form.submit":         "Wyślij",
  "genui.form.successTitle":   "Sukces",
  "genui.form.successDefault": "Gotowe!",
  "genui.form.errorDefault":   "Coś poszło nie tak.",

  "genui.appointment.title":          "Umów wizytę",
  "genui.appointment.submit":         "Zarezerwuj teraz",
  "genui.appointment.successDefault": "Wizyta została zarezerwowana.",
  "genui.appointment.codeHint":       "Zachowaj ten kod na przyszłość.",
  "genui.appointment.copy":           "Kopiuj",
  "genui.appointment.copied":         "Skopiowano!",

  "genui.rating.ariaLabel":       "Ocena w gwiazdkach",
  "genui.rating.starLabel_one":   "{{count}} gwiazdka",
  "genui.rating.starLabel_few":   "{{count}} gwiazdki",
  "genui.rating.starLabel_many":  "{{count}} gwiazdek",
  "genui.rating.starLabel_other": "{{count}} gwiazdki",
  "genui.rating.submit":          "Wyślij",
  "genui.rating.thankYou":        "Dziękujemy za opinię!",

  "genui.datePicker.label": "Wybierz datę",
};

const NL: Record<string, string> = {
  "genui.form.processing":     "Bezig met verwerken…",
  "genui.form.submit":         "Verzenden",
  "genui.form.successTitle":   "Gelukt",
  "genui.form.successDefault": "Klaar!",
  "genui.form.errorDefault":   "Er is iets misgegaan.",

  "genui.appointment.title":          "Afspraak maken",
  "genui.appointment.submit":         "Nu boeken",
  "genui.appointment.successDefault": "Afspraak is geboekt.",
  "genui.appointment.codeHint":       "Bewaar deze code voor later.",
  "genui.appointment.copy":           "Kopiëren",
  "genui.appointment.copied":         "Gekopieerd!",

  "genui.rating.ariaLabel":       "Sterrenbeoordeling",
  "genui.rating.starLabel_one":   "{{count}} ster",
  "genui.rating.starLabel_other": "{{count}} sterren",
  "genui.rating.submit":          "Verzenden",
  "genui.rating.thankYou":        "Bedankt voor je feedback!",

  "genui.datePicker.label": "Datum selecteren",
};

const ID: Record<string, string> = {
  "genui.form.processing":     "Memproses…",
  "genui.form.submit":         "Kirim",
  "genui.form.successTitle":   "Berhasil",
  "genui.form.successDefault": "Selesai!",
  "genui.form.errorDefault":   "Terjadi kesalahan.",

  "genui.appointment.title":          "Buat Janji Temu",
  "genui.appointment.submit":         "Pesan Sekarang",
  "genui.appointment.successDefault": "Janji temu berhasil dibuat.",
  "genui.appointment.codeHint":       "Simpan kode ini sebagai referensi.",
  "genui.appointment.copy":           "Salin",
  "genui.appointment.copied":         "Disalin!",

  "genui.rating.ariaLabel":       "Penilaian bintang",
  "genui.rating.starLabel_other": "{{count}} bintang",
  "genui.rating.submit":          "Kirim",
  "genui.rating.thankYou":        "Terima kasih atas masukan Anda!",

  "genui.datePicker.label": "Pilih tanggal",
};

const VI: Record<string, string> = {
  "genui.form.processing":     "Đang xử lý…",
  "genui.form.submit":         "Gửi",
  "genui.form.successTitle":   "Thành công",
  "genui.form.successDefault": "Xong!",
  "genui.form.errorDefault":   "Đã xảy ra lỗi.",

  "genui.appointment.title":          "Đặt lịch hẹn",
  "genui.appointment.submit":         "Đặt ngay",
  "genui.appointment.successDefault": "Đã đặt lịch hẹn thành công.",
  "genui.appointment.codeHint":       "Vui lòng lưu mã này để tham khảo.",
  "genui.appointment.copy":           "Sao chép",
  "genui.appointment.copied":         "Đã sao chép!",

  "genui.rating.ariaLabel":       "Đánh giá sao",
  "genui.rating.starLabel_other": "{{count}} sao",
  "genui.rating.submit":          "Gửi",
  "genui.rating.thankYou":        "Cảm ơn phản hồi của bạn!",

  "genui.datePicker.label": "Chọn ngày",
};

const RU: Record<string, string> = {
  "genui.form.processing":     "Обработка…",
  "genui.form.submit":         "Отправить",
  "genui.form.successTitle":   "Успешно",
  "genui.form.successDefault": "Готово!",
  "genui.form.errorDefault":   "Что-то пошло не так.",

  "genui.appointment.title":          "Записаться на приём",
  "genui.appointment.submit":         "Записаться",
  "genui.appointment.successDefault": "Вы успешно записаны.",
  "genui.appointment.codeHint":       "Сохраните этот код для справки.",
  "genui.appointment.copy":           "Копировать",
  "genui.appointment.copied":         "Скопировано!",

  "genui.rating.ariaLabel":       "Оценка в звёздах",
  "genui.rating.starLabel_one":   "{{count}} звезда",
  "genui.rating.starLabel_few":   "{{count}} звезды",
  "genui.rating.starLabel_many":  "{{count}} звёзд",
  "genui.rating.starLabel_other": "{{count}} звезды",
  "genui.rating.submit":          "Отправить",
  "genui.rating.thankYou":        "Спасибо за отзыв!",

  "genui.datePicker.label": "Выберите дату",
};

const UK: Record<string, string> = {
  "genui.form.processing":     "Обробка…",
  "genui.form.submit":         "Надіслати",
  "genui.form.successTitle":   "Успішно",
  "genui.form.successDefault": "Готово!",
  "genui.form.errorDefault":   "Щось пішло не так.",

  "genui.appointment.title":          "Записатися на прийом",
  "genui.appointment.submit":         "Записатися",
  "genui.appointment.successDefault": "Ви успішно записані.",
  "genui.appointment.codeHint":       "Збережіть цей код для довідки.",
  "genui.appointment.copy":           "Копіювати",
  "genui.appointment.copied":         "Скопійовано!",

  "genui.rating.ariaLabel":       "Оцінка в зірках",
  "genui.rating.starLabel_one":   "{{count}} зірка",
  "genui.rating.starLabel_few":   "{{count}} зірки",
  "genui.rating.starLabel_many":  "{{count}} зірок",
  "genui.rating.starLabel_other": "{{count}} зірки",
  "genui.rating.submit":          "Надіслати",
  "genui.rating.thankYou":        "Дякуємо за відгук!",

  "genui.datePicker.label": "Виберіть дату",
};

const JA: Record<string, string> = {
  "genui.form.processing":     "処理中…",
  "genui.form.submit":         "送信",
  "genui.form.successTitle":   "完了",
  "genui.form.successDefault": "完了しました！",
  "genui.form.errorDefault":   "問題が発生しました。",

  "genui.appointment.title":          "予約する",
  "genui.appointment.submit":         "今すぐ予約",
  "genui.appointment.successDefault": "予約が完了しました。",
  "genui.appointment.codeHint":       "このコードは控えとして保存してください。",
  "genui.appointment.copy":           "コピー",
  "genui.appointment.copied":         "コピーしました！",

  "genui.rating.ariaLabel":       "星評価",
  "genui.rating.starLabel_other": "星 {{count}} つ",
  "genui.rating.submit":          "送信",
  "genui.rating.thankYou":        "フィードバックをありがとうございます！",

  "genui.datePicker.label": "日付を選択",
};

const KO: Record<string, string> = {
  "genui.form.processing":     "처리 중…",
  "genui.form.submit":         "제출",
  "genui.form.successTitle":   "성공",
  "genui.form.successDefault": "완료되었습니다!",
  "genui.form.errorDefault":   "문제가 발생했습니다.",

  "genui.appointment.title":          "예약하기",
  "genui.appointment.submit":         "지금 예약",
  "genui.appointment.successDefault": "예약이 완료되었습니다.",
  "genui.appointment.codeHint":       "나중에 참고할 수 있도록 이 코드를 저장해 주세요.",
  "genui.appointment.copy":           "복사",
  "genui.appointment.copied":         "복사되었습니다!",

  "genui.rating.ariaLabel":       "별점",
  "genui.rating.starLabel_other": "별 {{count}}개",
  "genui.rating.submit":          "제출",
  "genui.rating.thankYou":        "피드백을 보내 주셔서 감사합니다!",

  "genui.datePicker.label": "날짜 선택",
};

const ZH_CN: Record<string, string> = {
  "genui.form.processing":     "处理中…",
  "genui.form.submit":         "提交",
  "genui.form.successTitle":   "成功",
  "genui.form.successDefault": "已完成！",
  "genui.form.errorDefault":   "出了点问题。",

  "genui.appointment.title":          "预约",
  "genui.appointment.submit":         "立即预约",
  "genui.appointment.successDefault": "预约成功。",
  "genui.appointment.codeHint":       "请保存此代码以备查询。",
  "genui.appointment.copy":           "复制",
  "genui.appointment.copied":         "已复制！",

  "genui.rating.ariaLabel":       "星级评分",
  "genui.rating.starLabel_other": "{{count}} 星",
  "genui.rating.submit":          "提交",
  "genui.rating.thankYou":        "感谢您的反馈！",

  "genui.datePicker.label": "选择日期",
};

const ZH_TW: Record<string, string> = {
  "genui.form.processing":     "處理中…",
  "genui.form.submit":         "送出",
  "genui.form.successTitle":   "成功",
  "genui.form.successDefault": "已完成！",
  "genui.form.errorDefault":   "發生錯誤。",

  "genui.appointment.title":          "預約",
  "genui.appointment.submit":         "立即預約",
  "genui.appointment.successDefault": "預約成功。",
  "genui.appointment.codeHint":       "請保存此代碼以供日後查詢。",
  "genui.appointment.copy":           "複製",
  "genui.appointment.copied":         "已複製！",

  "genui.rating.ariaLabel":       "星級評分",
  "genui.rating.starLabel_other": "{{count}} 顆星",
  "genui.rating.submit":          "送出",
  "genui.rating.thankYou":        "感謝您的意見回饋！",

  "genui.datePicker.label": "選擇日期",
};

const HI: Record<string, string> = {
  "genui.form.processing":     "प्रोसेस हो रहा है…",
  "genui.form.submit":         "सबमिट करें",
  "genui.form.successTitle":   "सफल",
  "genui.form.successDefault": "हो गया!",
  "genui.form.errorDefault":   "कुछ गलत हो गया।",

  "genui.appointment.title":          "अपॉइंटमेंट बुक करें",
  "genui.appointment.submit":         "अभी बुक करें",
  "genui.appointment.successDefault": "अपॉइंटमेंट सफलतापूर्वक बुक हो गया।",
  "genui.appointment.codeHint":       "कृपया संदर्भ के लिए यह कोड सहेज लें।",
  "genui.appointment.copy":           "कॉपी करें",
  "genui.appointment.copied":         "कॉपी हो गया!",

  "genui.rating.ariaLabel":       "स्टार रेटिंग",
  "genui.rating.starLabel_one":   "{{count}} स्टार",
  "genui.rating.starLabel_other": "{{count}} स्टार",
  "genui.rating.submit":          "सबमिट करें",
  "genui.rating.thankYou":        "आपकी प्रतिक्रिया के लिए धन्यवाद!",

  "genui.datePicker.label": "तारीख चुनें",
};

const AR: Record<string, string> = {
  "genui.form.processing":     "جارٍ المعالجة…",
  "genui.form.submit":         "إرسال",
  "genui.form.successTitle":   "تم بنجاح",
  "genui.form.successDefault": "تم!",
  "genui.form.errorDefault":   "حدث خطأ ما.",

  "genui.appointment.title":          "حجز موعد",
  "genui.appointment.submit":         "احجز الآن",
  "genui.appointment.successDefault": "تم حجز الموعد بنجاح.",
  "genui.appointment.codeHint":       "يُرجى حفظ هذا الرمز للرجوع إليه.",
  "genui.appointment.copy":           "نسخ",
  "genui.appointment.copied":         "تم النسخ!",

  "genui.rating.ariaLabel":       "تقييم بالنجوم",
  "genui.rating.starLabel_zero":  "{{count}} نجمة",
  "genui.rating.starLabel_one":   "{{count}} نجمة",
  "genui.rating.starLabel_two":   "{{count}} نجمتان",
  "genui.rating.starLabel_few":   "{{count}} نجوم",
  "genui.rating.starLabel_many":  "{{count}} نجمة",
  "genui.rating.starLabel_other": "{{count}} نجمة",
  "genui.rating.submit":          "إرسال",
  "genui.rating.thankYou":        "شكرًا لك على ملاحظاتك!",

  "genui.datePicker.label": "اختر التاريخ",
};

const HE: Record<string, string> = {
  "genui.form.processing":     "מעבד…",
  "genui.form.submit":         "שליחה",
  "genui.form.successTitle":   "הצלחה",
  "genui.form.successDefault": "בוצע!",
  "genui.form.errorDefault":   "משהו השתבש.",

  "genui.appointment.title":          "קביעת תור",
  "genui.appointment.submit":         "לקביעת תור",
  "genui.appointment.successDefault": "התור נקבע בהצלחה.",
  "genui.appointment.codeHint":       "שמרו את הקוד הזה לעיון בהמשך.",
  "genui.appointment.copy":           "העתקה",
  "genui.appointment.copied":         "הועתק!",

  "genui.rating.ariaLabel":       "דירוג כוכבים",
  "genui.rating.starLabel_one":   "כוכב {{count}}",
  "genui.rating.starLabel_two":   "{{count}} כוכבים",
  "genui.rating.starLabel_other": "{{count}} כוכבים",
  "genui.rating.submit":          "שליחה",
  "genui.rating.thankYou":        "תודה על המשוב!",

  "genui.datePicker.label": "בחירת תאריך",
};

/** Every GenUI translation block, keyed by the i18next language code. */
export const GENUI_LOCALES: Record<string, Record<string, string>> = {
  "en": EN,
  "tr": TR,
  "es": ES,
  "fr": FR,
  "de": DE,
  "it": IT,
  "pt-BR": PT_BR,
  "pl": PL,
  "nl": NL,
  "id": ID,
  "vi": VI,
  "ru": RU,
  "uk": UK,
  "ja": JA,
  "ko": KO,
  "zh-CN": ZH_CN,
  "zh-TW": ZH_TW,
  "hi": HI,
  "ar": AR,
  "he": HE,
};

function _register(): void {
  for (const [lng, resources] of Object.entries(GENUI_LOCALES)) {
    i18next.addResources(lng, "translation", resources);
  }
}

// Register immediately if i18next is already initialized,
// otherwise wait for the "initialized" event.
if (i18next.isInitialized) {
  _register();
} else {
  i18next.on("initialized", _register);
}
