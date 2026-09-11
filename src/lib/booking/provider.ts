import { bookingConfig, bookingServices, type ServiceId } from './config.ts';
import { addDays, clinicClock, dateObject, getHours, getSlots, type Appointment, type Schedule } from './scheduling.ts';

export interface BookingRequest {
  date: string;
  start: number;
  serviceId: ServiceId;
  patient: { name: string; email: string; phone: string; firstVisit: boolean };
  consent: boolean;
}
export interface BookingConfirmation extends Appointment { reference: string; serviceId: ServiceId }

/** Implement these asynchronous methods with HTTP calls to connect a live backend. */
export interface BookingProvider {
  getSchedule(): Promise<Schedule>;
  createBooking(request: BookingRequest): Promise<BookingConfirmation>;
  setBuffer(minutes: number): Promise<Schedule>;
}

export class BookingError extends Error {
  code: 'CONFLICT' | 'VALIDATION' | 'STORAGE';
  constructor(code: 'CONFLICT' | 'VALIDATION' | 'STORAGE', message: string) { super(message); this.code = code; }
}

export const DEMO_STORAGE_KEY = 'dentara.booking-demo.v1';
interface DemoStore { version: 1; appointments: Appointment[]; bufferMinutes: number }

function readStore(): DemoStore {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return { version: 1, appointments: [], bufferMinutes: bookingConfig.bufferMinutes };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.appointments) || !bookingConfig.bufferOptions.includes(data.bufferMinutes)) throw new Error('Invalid data');
    const today = clinicClock().date;
    const appointments = data.appointments.filter((a: Appointment) =>
      typeof a.id === 'string' && typeof a.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.date) &&
      !Number.isNaN(dateObject(a.date).getTime()) && a.date >= today &&
      Number.isInteger(a.start) && a.start >= 0 && a.start < 1440 && Number.isInteger(a.duration) && a.duration > 0 && a.duration <= 180,
    ).map((a: Appointment) => ({ id: a.id, date: a.date, start: a.start, duration: a.duration }));
    return { version: 1, appointments, bufferMinutes: data.bufferMinutes };
  } catch {
    throw new BookingError('STORAGE', 'The demo schedule could not be read. Allow browser storage or try a different browser.');
  }
}

function writeStore(store: DemoStore) {
  try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store)); }
  catch { throw new BookingError('STORAGE', 'Your demo booking could not be saved. Allow browser storage and try again.'); }
}

function sampleAppointments(): Appointment[] {
  const today = clinicClock().date;
  const appointments: Appointment[] = [];
  for (let offset = 0; offset <= bookingConfig.bookingWindowDays; offset++) {
    const date = addDays(today, offset);
    if (!getHours(date)) continue;
    // Deterministic fixtures; no patient information is exposed in availability.
    const samples = [{ start: 540, duration: 45 }, { start: 660, duration: 30 }, { start: 840, duration: 60 }];
    if (dateObject(date).getUTCDay() !== 6) samples.push({ start: 990, duration: 30 });
    for (const sample of samples) appointments.push({ id: `sample-${date}-${sample.start}`, date, ...sample });
  }
  return appointments;
}

function scheduleFrom(store: DemoStore): Schedule {
  return { appointments: [...sampleAppointments(), ...store.appointments], bufferMinutes: store.bufferMinutes };
}

async function withDemoLock<T>(operation: () => T): Promise<T> {
  // Serializes same-origin demo tabs where Web Locks is available. A backend must
  // enforce conflicts transactionally across all users, independently of this lock.
  if (navigator.locks) return navigator.locks.request(DEMO_STORAGE_KEY, operation);
  return operation();
}

export const demoBookingProvider: BookingProvider = {
  async getSchedule() { return scheduleFrom(readStore()); },
  async createBooking(request) {
    return withDemoLock(() => {
      const service = bookingServices.find((item) => item.id === request.serviceId);
      if (!service || !request.consent || !request.patient.name.trim() || request.patient.name.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.patient.email) || request.patient.email.length > 254 ||
        !/^[+\d\s().-]{7,25}$/.test(request.patient.phone) || request.patient.phone.replace(/\D/g, '').length < 7) {
        throw new BookingError('VALIDATION', 'Please check your contact details and consent before booking.');
      }
      const store = readStore();
      const schedule = scheduleFrom(store);
      if (!getSlots(request.date, service.duration, schedule).some((slot) => slot.start === request.start && slot.status === 'available')) {
        throw new BookingError('CONFLICT', 'That time is no longer available. Please choose another time.');
      }
      const id = crypto.randomUUID();
      const appointment = { id, date: request.date, start: request.start, duration: service.duration };
      // Persist only anonymous occupancy. Contact details never leave the form.
      writeStore({ ...store, appointments: [...store.appointments, appointment] });
      return { ...appointment, reference: `DEMO-${id.slice(0, 8).toUpperCase()}`, serviceId: service.id };
    });
  },
  async setBuffer(minutes) {
    return withDemoLock(() => {
      if (!bookingConfig.bufferOptions.includes(minutes)) throw new BookingError('VALIDATION', 'Choose a buffer from the available options.');
      const store = { ...readStore(), bufferMinutes: minutes };
      writeStore(store);
      return scheduleFrom(store);
    });
  },
};

// The UI depends only on BookingProvider. Swap this export for an HTTP implementation.
export const bookingProvider: BookingProvider = demoBookingProvider;
