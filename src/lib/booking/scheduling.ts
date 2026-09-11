import { bookingConfig } from './config.ts';

export interface Appointment { id: string; date: string; start: number; duration: number }
export interface Schedule { appointments: Appointment[]; bufferMinutes: number }
export type SlotStatus = 'available' | 'booked' | 'buffer' | 'too-short' | 'past';
export interface TimeSlot { start: number; end: number; status: SlotStatus }

export function clinicClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: bookingConfig.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function dateObject(date: string) { return new Date(`${date}T12:00:00Z`); }
export function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
export function addDays(date: string, days: number) {
  const value = dateObject(date);
  value.setUTCDate(value.getUTCDate() + days);
  return dateKey(value);
}
export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(dateObject(date));
}
export function formatTime(minute: number) {
  const hour = Math.floor(minute / 60);
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}
export function getHours(date: string) { return bookingConfig.hours[dateObject(date).getUTCDay()]; }
const overlaps = (start: number, end: number, otherStart: number, otherEnd: number) => start < otherEnd && end > otherStart;

/** Single-chair demo. Check the whole appointment AND its trailing buffer, not just its start. */
export function getSlots(date: string, duration: number, schedule: Schedule, now = new Date()): TimeSlot[] {
  const hours = getHours(date);
  const clock = clinicClock(now);
  if (!hours || date < clock.date || date > addDays(clock.date, bookingConfig.bookingWindowDays)) return [];
  const appointments = schedule.appointments.filter((appointment) => appointment.date === date);
  const slots: TimeSlot[] = [];
  for (let start = hours[0]; start < hours[1]; start += bookingConfig.slotIntervalMinutes) {
    const end = start + duration;
    let status: SlotStatus = 'available';
    if (date === clock.date && start < clock.minute + bookingConfig.minimumNoticeMinutes) status = 'past';
    else if (appointments.some((a) => start >= a.start && start < a.start + a.duration)) status = 'booked';
    else if (appointments.some((a) => start >= a.start + a.duration && start < a.start + a.duration + schedule.bufferMinutes)) status = 'buffer';
    else if (end + schedule.bufferMinutes > hours[1] || appointments.some((a) => overlaps(start, end + schedule.bufferMinutes, a.start, a.start + a.duration + schedule.bufferMinutes))) status = 'too-short';
    slots.push({ start, end, status });
  }
  return slots;
}
