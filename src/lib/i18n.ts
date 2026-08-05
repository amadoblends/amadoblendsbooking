export type Language = "es" | "en";

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇺🇸" },
];

const dict = {
  // Navigation
  "nav.home": { es: "Inicio", en: "Home" },
  "nav.bookings": { es: "Reservas", en: "Bookings" },
  "nav.shop": { es: "Tienda", en: "Shop" },
  "nav.profile": { es: "Perfil", en: "Profile" },
  "nav.book": { es: "Reservar cita", en: "Book appointment" },
  "nav.myBookings": { es: "Mis reservas", en: "My bookings" },

  // Home
  "home.greeting": { es: "¡Hola", en: "Hi" },
  "home.subtitle": { es: "¿Listo para tu próximo corte?", en: "Ready for your next cut?" },
  "home.heroLine1": { es: "Tu mejor", en: "Your best" },
  "home.heroLine2": { es: "versión", en: "version" },
  "home.heroLine3": { es: "comienza aquí", en: "starts here" },
  "home.nextAppointment": { es: "Próxima cita", en: "Next appointment" },
  "home.popularServices": { es: "Servicios populares", en: "Popular services" },
  "home.seeAll": { es: "Ver todos", en: "See all" },
  "home.quickAddGuest": { es: "Agregar invitado", en: "Add guest" },
  "home.quickProducts": { es: "Productos", en: "Products" },
  "home.quickMyBookings": { es: "Mis citas", en: "My bookings" },
  "home.reorderHint": {
    es: "Mantén presionada una tarjeta para organizarlas",
    en: "Press and hold a card to rearrange",
  },
  "home.reorderActive": {
    es: "Arrastra las tarjetas para ordenarlas",
    en: "Drag the cards to reorder them",
  },
  "home.done": { es: "Listo", en: "Done" },

  // Booking
  "booking.title": { es: "Reservar cita", en: "Book appointment" },
  "booking.subtitle": { es: "Elige tu servicio y horario", en: "Choose your service and time" },
  "booking.services": { es: "Servicios", en: "Services" },
  "booking.combos": { es: "Combos", en: "Combos" },
  "booking.selectTime": { es: "Selecciona una hora", en: "Select a time" },
  "booking.continue": { es: "Continuar", en: "Continue" },
  "booking.skip": { es: "Continuar sin agregar", en: "Continue without adding" },
  "booking.confirm": { es: "Confirmar cita", en: "Confirm appointment" },
  "booking.confirmed": { es: "¡Reserva confirmada!", en: "Booking confirmed!" },
  "booking.summary": { es: "Revisa tu reserva", en: "Review your booking" },
  "booking.total": { es: "Total", en: "Total" },
  "booking.payAtShop": { es: "En el local", en: "At the shop" },
  "booking.payment": { es: "Método de pago", en: "Payment method" },
  "booking.minutes": { es: "minutos", en: "minutes" },
  "booking.duration": { es: "Duración", en: "Duration" },
  "booking.date": { es: "Fecha", en: "Date" },
  "booking.time": { es: "Hora", en: "Time" },
  "booking.service": { es: "Servicio", en: "Service" },
  "booking.discount": { es: "Descuento", en: "Discount" },
  "booking.forWho": { es: "¿Para quién es la cita?", en: "Who is this appointment for?" },
  "booking.forWhoHint": {
    es: "Puedes reservar para ti o para alguien más.",
    en: "You can book for yourself or for someone else.",
  },
  "booking.forWhom": { es: "Para", en: "For" },
  "booking.forMe": { es: "Para mí", en: "For me" },
  "booking.forGuest": { es: "Para un invitado", en: "For a guest" },
  "booking.forGuestHint": {
    es: "Amigo, familiar o pareja",
    en: "Friend, family or partner",
  },
  "booking.pickService": { es: "Elige tu servicio", en: "Choose your service" },
  "booking.extras": { es: "¿Quieres llevar algo?", en: "Want to take something home?" },
  "booking.extrasHint": {
    es: "Productos que puedes comprar en tu visita. Opcional.",
    en: "Products you can buy during your visit. Optional.",
  },
  "booking.pickDate": { es: "Elige el día", en: "Pick a day" },
  "booking.capacityHint": {
    es: "El número indica los cupos disponibles.",
    en: "The number shows the openings left.",
  },
  "booking.productsToUse": { es: "Productos a usar", en: "Products to use" },
  "booking.heldFor": { es: "Tu horario está reservado por", en: "Your slot is held for" },
  "booking.holdExpired": {
    es: "Tu reserva temporal expiró. Elige una hora de nuevo.",
    en: "Your temporary hold expired. Please pick a time again.",
  },
  "booking.slotTaken": {
    es: "Ese horario acaba de ocuparse. Elige otro.",
    en: "That slot was just taken. Please choose another.",
  },
  "booking.createFailed": {
    es: "No se pudo crear la cita. Intenta de nuevo.",
    en: "Could not create the appointment. Please try again.",
  },
  "booking.noSchedule": {
    es: "No hay horario para este día.",
    en: "No schedule for this day.",
  },
  "booking.noSlots": {
    es: "Sin horarios disponibles. Prueba otra fecha.",
    en: "No times available. Try another date.",
  },
  "booking.anotherBooking": { es: "Reservar otra cita", en: "Book another appointment" },
  "booking.confirmedHint": {
    es: "Te esperamos. Guarda tu código de confirmación.",
    en: "See you soon. Keep your confirmation code.",
  },
  "booking.barber": { es: "Tu barbero", en: "Your barber" },
  "booking.location": { es: "Ubicación", en: "Location" },
  "booking.backHome": { es: "Volver al inicio", en: "Back home" },

  // Breadcrumb
  "booking.crumbWho": { es: "Para quién", en: "For who" },
  "booking.crumbService": { es: "Servicio", en: "Service" },
  "booking.crumbExtras": { es: "Extras", en: "Extras" },
  "booking.crumbProducts": { es: "Productos", en: "Products" },
  "booking.crumbDate": { es: "Fecha", en: "Date" },
  "booking.crumbTime": { es: "Hora", en: "Time" },
  "booking.crumbConfirm": { es: "Confirmar", en: "Confirm" },

  // Products during service
  "products.question": {
    es: "¿Qué productos te gustaría que usáramos?",
    en: "Which products would you like us to use?",
  },
  "products.hint": {
    es: "Opcional. Elige los que prefieras para tu servicio.",
    en: "Optional. Pick the ones you prefer for your service.",
  },
  "products.dry": { es: "Secos", en: "Dry" },
  "products.wet": { es: "Húmedos", en: "Wet" },
  "products.other": { es: "Otros", en: "Other" },
  "products.none": {
    es: "Este servicio no tiene productos asociados.",
    en: "This service has no products linked.",
  },
  "products.skip": { es: "Continuar sin productos", en: "Continue without products" },

  // Appointments
  "appointments.title": { es: "Mis citas", en: "My appointments" },
  "appointments.upcoming": { es: "Próximas", en: "Upcoming" },
  "appointments.history": { es: "Historial", en: "History" },
  "appointments.none": { es: "No tienes citas próximas.", en: "You have no upcoming appointments." },
  "appointments.bookNow": { es: "Reservar ahora", en: "Book now" },
  "appointments.detail": { es: "Detalle de cita", en: "Appointment detail" },
  "appointments.reschedule": { es: "Reagendar cita", en: "Reschedule appointment" },
  "appointments.cancel": { es: "Cancelar cita", en: "Cancel appointment" },

  // Guests
  "guest.add": { es: "Agregar invitado", en: "Add guest" },
  "guest.forWho": { es: "¿La cita es para quién?", en: "Who is this appointment for?" },
  "guest.name": { es: "Nombre del invitado", en: "Guest name" },
  "guest.friend": { es: "Amigo", en: "Friend" },
  "guest.family": { es: "Familiar", en: "Family" },
  "guest.brother": { es: "Hermano", en: "Brother" },
  "guest.sister": { es: "Hermana", en: "Sister" },
  "guest.son": { es: "Hijo", en: "Son" },
  "guest.daughter": { es: "Hija", en: "Daughter" },
  "guest.parent": { es: "Padre/Madre", en: "Parent" },
  "guest.partner": { es: "Pareja", en: "Partner" },
  "guest.other": { es: "Otro", en: "Other" },

  // Profile
  "profile.title": { es: "Mi perfil", en: "My profile" },
  "profile.edit": { es: "Editar perfil", en: "Edit profile" },
  "profile.firstName": { es: "Nombre", en: "First name" },
  "profile.lastName": { es: "Apellido", en: "Last name" },
  "profile.phone": { es: "Teléfono", en: "Phone" },
  "profile.email": { es: "Correo electrónico", en: "Email" },
  "profile.photo": { es: "Foto de perfil", en: "Profile photo" },
  "profile.language": { es: "Idioma", en: "Language" },
  "profile.save": { es: "Guardar cambios", en: "Save changes" },
  "profile.signOut": { es: "Cerrar sesión", en: "Sign out" },
  "profile.appointmentsDone": { es: "Citas realizadas", en: "Appointments" },
  "profile.yourBarber": { es: "Tu barbero", en: "Your barber" },
  "profile.securityNote": {
    es: "Por seguridad, te enviaremos un código para confirmar los cambios.",
    en: "For your security, we'll send you a code to confirm the changes.",
  },

  // Shop
  "shop.title": { es: "Tienda", en: "Shop" },
  "shop.subtitle": {
    es: "Productos profesionales para tu mejor versión",
    en: "Professional products for your best look",
  },
  "shop.empty": { es: "Pronto tendremos productos disponibles.", en: "Products coming soon." },
  "shop.buyOnline": { es: "Comprar online", en: "Buy online" },

  // Common
  "common.back": { es: "Volver", en: "Back" },
  "common.cancel": { es: "Cancelar", en: "Cancel" },
  "common.saving": { es: "Guardando...", en: "Saving..." },
  "common.loading": { es: "Cargando...", en: "Loading..." },
  "common.notifications": { es: "Notificaciones", en: "Notifications" },
} as const;

export type TranslationKey = keyof typeof dict;

export function translate(key: TranslationKey, lang: Language): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] ?? entry.es;
}
