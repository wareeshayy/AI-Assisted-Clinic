/** Illustrative clinic policy. Replace with backend-owned settings for live bookings. */
export const bookingConfig = {
  timeZone: 'Asia/Karachi',
  timeZoneLabel: 'Pakistan Standard Time (PKT)',
  bookingWindowDays: 90,
  minimumNoticeMinutes: 60,
  slotIntervalMinutes: 15,
  bufferMinutes: 15,
  bufferOptions: [0, 5, 10, 15, 20, 30],
  // Minutes from midnight; mirrors the website footer. Sunday is closed.
  hours: { 1: [480, 1140], 2: [480, 1140], 3: [480, 1140], 4: [480, 1140], 5: [480, 1140], 6: [540, 1020] } as Record<number, [number, number]>,
};

export const bookingServices = [
  { id: 'general-checkup', name: 'General checkup', duration: 30, description: 'A routine visit to look after your smile.' },
  { id: 'teeth-whitening', name: 'Teeth whitening', duration: 60, description: 'Time dedicated to a brighter smile.' },
  { id: 'cosmetic-dentistry', name: 'Cosmetic consultation', duration: 45, description: 'Talk through the possibilities for your smile.' },
  { id: 'orthodontics', name: 'Orthodontic consultation', duration: 45, description: 'Explore your teeth-straightening options.' },
  { id: 'pediatric-care', name: 'Children’s dental visit', duration: 30, description: 'A friendly dental visit for your little one.' },
] as const;

export type ServiceId = typeof bookingServices[number]['id'];
