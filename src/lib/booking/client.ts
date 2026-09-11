import { bookingConfig, bookingServices, type ServiceId } from './config';
import { BookingError, bookingProvider, DEMO_STORAGE_KEY, type BookingConfirmation } from './provider';
import { addDays, clinicClock, dateKey, dateObject, formatDate, formatTime, getHours, getSlots, type Schedule, type SlotStatus } from './scheduling';

type Period = 'morning' | 'afternoon' | 'evening';
type Step = 'time' | 'details' | 'confirmation';
const periodFor = (minute: number): Period => minute < 720 ? 'morning' : minute < 960 ? 'afternoon' : 'evening';
const statusLabels: Record<SlotStatus, string> = { available: 'Available', booked: 'Booked', buffer: 'Buffer', 'too-short': 'Too short', past: 'Passed / too soon' };

export function initializeBooking() {
  const root = document.getElementById('booking-app');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const write = (id: string, value: string) => { element(id).textContent = value; };
  const form = element<HTMLFormElement>('booking-form');
  const serviceSelect = element<HTMLSelectElement>('booking-service');
  const bufferSelect = element<HTMLSelectElement>('booking-buffer');
  const queryService = new URLSearchParams(location.search).get('service');
  if (bookingServices.some((service) => service.id === queryService)) serviceSelect.value = queryService!;

  let schedule: Schedule = { appointments: [], bufferMinutes: bookingConfig.bufferMinutes };
  let selectedDate = clinicClock().date;
  let month = selectedDate.slice(0, 7);
  let selectedTime: number | null = null;
  let period: Period = 'morning';
  let step: Step = 'time';
  let busy = true;
  let loaded = false;
  const service = () => bookingServices.find((item) => item.id === serviceSelect.value)!;
  const slotsFor = (date: string) => getSlots(date, service().duration, schedule);
  const availableFor = (date: string) => slotsFor(date).filter((slot) => slot.status === 'available');
  const announce = (message: string) => write('booking-status', message);

  function showError(error: unknown) {
    write('booking-error-text', error instanceof BookingError ? error.message : 'Availability could not be updated. Please reload and try again.');
    element('booking-error').hidden = false;
  }
  function clearError() { element('booking-error').hidden = true; }

  function setBusy(value: boolean) {
    busy = value;
    element('booking-workspace').setAttribute('aria-busy', String(value));
    serviceSelect.disabled = value || !loaded;
    bufferSelect.disabled = value || !loaded || step === 'confirmation';
    element<HTMLButtonElement>('booking-submit').disabled = value;
    element<HTMLButtonElement>('booking-continue').disabled = value || !loaded || selectedTime === null;
    element<HTMLButtonElement>('booking-next-available').disabled = value || !loaded;
    if (value) {
      element<HTMLButtonElement>('booking-prev-month').disabled = true;
      element<HTMLButtonElement>('booking-next-month').disabled = true;
    }
  }

  function setStep(nextStep: Step) {
    step = nextStep;
    element('booking-time-step').hidden = step !== 'time';
    element('booking-details-step').hidden = step !== 'details';
    element('booking-workspace').hidden = step === 'confirmation';
    element('booking-confirmation').hidden = step !== 'confirmation';
    element('booking-continue').hidden = step !== 'time';
    element('booking-summary-hint').hidden = step !== 'time';
    element('booking-settings').hidden = step === 'confirmation';
    const order: Step[] = ['time', 'details', 'confirmation'];
    root!.querySelectorAll<HTMLElement>('[data-step]').forEach((item) => {
      const itemStep = item.dataset.step as Step;
      if (itemStep === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      item.classList.toggle('is-complete', order.indexOf(itemStep) < order.indexOf(step));
    });
  }

  function updateSummary() {
    write('summary-service', service().name);
    write('summary-duration', `${service().duration} minutes`);
    write('summary-date', formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' }));
    write('summary-time', selectedTime === null ? 'Choose a time' : `${formatTime(selectedTime)} – ${formatTime(selectedTime + service().duration)}`);
    element('summary-time').classList.toggle('is-placeholder', selectedTime === null);
    write('summary-buffer', schedule.bufferMinutes ? `${schedule.bufferMinutes}-minute buffer after each visit` : 'No buffer between visits');
    write('summary-buffer-description', schedule.bufferMinutes ? 'Time for our team to get ready for the next patient. It’s automatically kept free.' : 'Visits can be scheduled back to back. Adjust the demo settings to add preparation time.');
    write('booking-summary-hint', selectedTime === null ? 'Select an available time to continue.' : `All times in ${bookingConfig.timeZoneLabel}.`);
    write('booking-settings-value', `${schedule.bufferMinutes} min buffer`);
    bufferSelect.value = String(schedule.bufferMinutes);
    write('booking-service-description', service().description);
    element<HTMLButtonElement>('booking-continue').disabled = busy || selectedTime === null;
  }

  function renderCalendar() {
    const today = clinicClock().date;
    const lastDate = addDays(today, bookingConfig.bookingWindowDays);
    const first = dateObject(`${month}-01`);
    write('booking-month', formatDate(`${month}-01`, { month: 'long', year: 'numeric' }));
    element<HTMLButtonElement>('booking-prev-month').disabled = busy || month <= today.slice(0, 7);
    element<HTMLButtonElement>('booking-next-month').disabled = busy || month >= lastDate.slice(0, 7);
    const days = element('booking-days');
    days.replaceChildren();
    for (let blank = 0; blank < first.getUTCDay(); blank++) days.append(document.createElement('span'));
    const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    for (let day = 1; day <= count; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const available = availableFor(date).length;
      const label = date < today ? 'Past date' : date > lastDate ? 'Outside booking window' : !getHours(date) ? 'Closed' : available ? `${available} available start times` : 'No available times';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `booking-day${date === today ? ' is-today' : ''}`;
      button.dataset.date = date;
      button.textContent = String(day);
      button.disabled = !available;
      button.setAttribute('aria-label', `${formatDate(date)}${date === today ? ', today' : ''}: ${label}`);
      button.setAttribute('aria-pressed', String(date === selectedDate));
      if (date === today) button.setAttribute('aria-current', 'date');
      button.title = label;
      days.append(button);
    }
  }

  function renderTimes() {
    const daySlots = slotsFor(selectedDate);
    const available = daySlots.filter((slot) => slot.status === 'available').length;
    write('booking-day-heading', formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' }));
    write('booking-day-description', `${available} available start times · ${service().duration}-minute visit`);
    root!.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.period === period)));
    const slots = element('booking-slots');
    slots.replaceChildren();
    const periodSlots = daySlots.filter((slot) => periodFor(slot.start) === period);
    if (!periodSlots.length) {
      const message = document.createElement('p');
      message.className = 'booking-empty';
      message.textContent = 'No appointment times in this part of the day. Try another time of day or choose a different date.';
      slots.append(message);
    }
    for (const slot of periodSlots) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'booking-slot';
      button.dataset.start = String(slot.start);
      button.dataset.status = slot.status;
      button.disabled = slot.status !== 'available';
      const selected = selectedTime === slot.start;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${formatTime(slot.start)}, ${selected ? 'selected' : statusLabels[slot.status]}`);
      button.title = slot.status === 'too-short' ? 'The full visit and buffer must fit before the next booking and closing.' : slot.status === 'buffer' ? `${schedule.bufferMinutes}-minute buffer after an appointment` : slot.status === 'past' ? `At least ${bookingConfig.minimumNoticeMinutes} minutes’ notice is required.` : statusLabels[slot.status];
      const time = document.createElement('strong');
      time.textContent = formatTime(slot.start);
      const label = document.createElement('small');
      label.textContent = selected ? 'Selected' : slot.status === 'past' ? 'Unavailable' : statusLabels[slot.status];
      button.append(time, label);
      slots.append(button);
    }
  }

  function validateSelection() {
    if (selectedTime !== null && !availableFor(selectedDate).some((slot) => slot.start === selectedTime)) {
      selectedTime = null;
      if (step === 'details') setStep('time');
      announce('Availability has changed. Please select an available time again.');
    }
  }
  function render() {
    // Passive refreshes replace buttons; preserve the keyboard user's position.
    const active = document.activeElement as HTMLElement | null;
    const focusedDate = active?.dataset.date;
    const focusedTime = active?.dataset.start;
    renderCalendar();
    renderTimes();
    updateSummary();
    if (focusedDate || focusedTime) {
      const selector = focusedDate ? `[data-date="${focusedDate}"]` : `[data-start="${focusedTime}"]`;
      const replacement = root!.querySelector<HTMLButtonElement>(selector);
      if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
      else {
        const heading = element('booking-day-heading');
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }

  function chooseDate(date: string, focus = false) {
    selectedDate = date;
    month = date.slice(0, 7);
    selectedTime = null;
    const first = availableFor(date)[0];
    if (first) period = periodFor(first.start);
    render();
    announce(`${formatDate(date)}. ${availableFor(date).length} start times available.`);
    if (focus) root!.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus({ preventScroll: true });
  }

  function findNextDate(startDate: string) {
    const lastDate = addDays(clinicClock().date, bookingConfig.bookingWindowDays);
    for (let date = startDate; date <= lastDate; date = addDays(date, 1)) {
      if (availableFor(date).length) return date;
    }
    return null;
  }

  async function reload(initial = false) {
    if (busy && !initial) return;
    clearError();
    setBusy(true);
    try {
      schedule = await bookingProvider.getSchedule();
      loaded = true;
      if (initial) {
        const next = findNextDate(clinicClock().date);
        if (next) {
          selectedDate = next;
          month = next.slice(0, 7);
          period = periodFor(availableFor(next)[0].start);
        }
      }
      validateSelection();
    } catch (error) { loaded = false; showError(error); }
    finally { setBusy(false); if (loaded) render(); }
  }

  element('booking-days').addEventListener('click', (event) => {
    if (busy || !loaded) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-date]');
    if (button && !button.disabled) chooseDate(button.dataset.date!, true);
  });
  element('booking-days').addEventListener('keydown', (event) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in deltas) || busy) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-date]');
    if (!button) return;
    event.preventDefault();
    let date = addDays(button.dataset.date!, deltas[event.key]);
    const today = clinicClock().date;
    const last = addDays(today, bookingConfig.bookingWindowDays);
    while (date >= today && date <= last && !availableFor(date).length) date = addDays(date, Math.sign(deltas[event.key]));
    if (date >= today && date <= last) chooseDate(date, true);
  });
  for (const [id, delta] of [['booking-prev-month', -1], ['booking-next-month', 1]] as const) {
    element(id).addEventListener('click', () => {
      if (busy || !loaded) return;
      const date = dateObject(`${month}-01`);
      date.setUTCMonth(date.getUTCMonth() + delta);
      month = dateKey(date).slice(0, 7);
      renderCalendar();
      announce(formatDate(`${month}-01`, { month: 'long', year: 'numeric' }));
    });
  }
  element('booking-next-available').addEventListener('click', () => {
    if (busy || !loaded) return;
    const next = findNextDate(addDays(selectedDate, 1));
    if (next) chooseDate(next);
    else announce('No later appointments are available in the next 90 days. Try another service or contact the clinic.');
  });
  root.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((button) => button.addEventListener('click', () => {
    if (busy || !loaded) return;
    period = button.dataset.period as Period;
    renderTimes();
    announce(`Showing ${period} appointment times.`);
  }));
  element('booking-slots').addEventListener('click', (event) => {
    if (busy || !loaded) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-start]');
    if (!button || button.disabled) return;
    const start = Number(button.dataset.start);
    if (!availableFor(selectedDate).some((slot) => slot.start === start)) { renderTimes(); return; }
    selectedTime = start;
    clearError();
    renderTimes();
    updateSummary();
    root!.querySelector<HTMLButtonElement>(`[data-start="${start}"]`)?.focus({ preventScroll: true });
    announce(`${formatTime(start)} selected. Your visit ends at ${formatTime(start + service().duration)}. Continue to your details.`);
  });
  serviceSelect.addEventListener('change', () => {
    selectedTime = null;
    render();
    announce(`${service().name}, ${service().duration} minutes. Please choose a time.`);
  });
  bufferSelect.addEventListener('change', async () => {
    const minutes = Number(bufferSelect.value);
    if (busy) return;
    setBusy(true);
    clearError();
    try {
      schedule = await bookingProvider.setBuffer(minutes);
      validateSelection();
      announce(`Buffer updated to ${minutes} minutes. Availability refreshed.`);
    } catch (error) { showError(error); }
    finally { setBusy(false); render(); }
  });
  element('booking-continue').addEventListener('click', () => {
    if (busy || !loaded) return;
    validateSelection();
    if (selectedTime === null) { render(); return; }
    setStep('details');
    element('booking-details-heading').focus();
  });
  element('booking-back').addEventListener('click', () => {
    if (busy) return;
    setStep('time');
    render();
    root!.querySelector<HTMLButtonElement>(`[data-start="${selectedTime}"]`)?.focus();
  });

  function showConfirmation(confirmation: BookingConfirmation, name: string) {
    write('confirmation-greeting', `Thanks, ${name}. Here are the details of your sample visit.`);
    const rows = [
      ['Service', service().name],
      ['Date', formatDate(confirmation.date, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })],
      ['Time', `${formatTime(confirmation.start)} – ${formatTime(confirmation.start + confirmation.duration)}`],
      ['Time zone', bookingConfig.timeZoneLabel],
      ['Buffer after visit', `${schedule.bufferMinutes} minutes`],
      ['Demo reference', confirmation.reference],
    ];
    const details = element('confirmation-details');
    details.replaceChildren();
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      details.append(row);
    }
    setStep('confirmation');
    element('booking-confirmation-heading').focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || selectedTime === null || !form.reportValidity()) return;
    clearError();
    setBusy(true);
    write('booking-submit', 'Saving your demo booking…');
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    try {
      const confirmation = await bookingProvider.createBooking({
        date: selectedDate, start: selectedTime, serviceId: service().id as ServiceId,
        patient: { name, email: String(data.get('email')).trim(), phone: String(data.get('phone')).trim(), firstVisit: data.get('firstVisit') === 'yes' },
        consent: data.get('consent') === 'on',
      });
      // Confirmation has already succeeded: don't turn a later refresh failure into a failed booking.
      schedule = { ...schedule, appointments: [...schedule.appointments, confirmation] };
      showConfirmation(confirmation, name);
      form.reset();
      selectedTime = null;
    } catch (error) {
      if (error instanceof BookingError && error.code === 'CONFLICT') {
        selectedTime = null;
        setStep('time');
        try { schedule = await bookingProvider.getSchedule(); } catch { loaded = false; }
      }
      showError(error);
      element('booking-error').scrollIntoView({ block: 'center', behavior: 'instant' });
    } finally {
      setBusy(false);
      write('booking-submit', 'Confirm demo booking');
      if (loaded) render();
    }
  });
  element('booking-another').addEventListener('click', () => {
    setStep('time');
    clearError();
    setBusy(false);
    render();
    element('calendar-heading').setAttribute('tabindex', '-1');
    element('calendar-heading').focus();
    void reload();
  });
  element('booking-retry').addEventListener('click', () => { void reload(); });
  window.addEventListener('storage', (event) => {
    if ((event.key === DEMO_STORAGE_KEY || event.key === null) && step !== 'confirmation') void reload();
  });
  // Re-evaluate notice periods after a visitor leaves the page open or returns to the tab.
  window.setInterval(() => { if (!document.hidden && !busy && loaded && step !== 'confirmation') { validateSelection(); render(); } }, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && step !== 'confirmation') void reload(); });
  void reload(true);
}
