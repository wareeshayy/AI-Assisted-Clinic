type User = { id:number; name:string; email:string; role:'front_desk'|'doctor'; specialty?:string };
type Patient = { id:number; first_name:string; last_name:string; email?:string; phone:string; date_of_birth?:string; allergies?:string; medical_history?:string };
type Appointment = { id:number; patient_name:string; doctor_name:string; starts_at:string; ends_at:string; service:string; status:string; reason?:string; notes?:string; summary?:string };

const root = document.querySelector<HTMLElement>('#staff-app')!;
const apiBase = root.dataset.api!;
let token = sessionStorage.getItem('dentara_token') || '';
let user: User | null = JSON.parse(sessionStorage.getItem('dentara_user') || 'null');
let patients: Patient[] = [];
let doctors: User[] = [];
const el = <T extends HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
const els = <T extends HTMLElement>(selector:string) => [...document.querySelectorAll<T>(selector)];

async function api(path:string, options:RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)) headers.set('Content-Type','application/json');
  const response = await fetch(`${apiBase}${path}`, {...options, headers});
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) { signOut(); throw new Error('Your session expired. Please sign in again.'); }
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : body.detail?.message || 'Something went wrong.');
  return body;
}
function showNotice(message:string) { const node=el<HTMLElement>('#notice'); node.textContent=message; node.hidden=false; setTimeout(()=>node.hidden=true,4000); }
function initials(name:string) { return name.split(' ').filter(x=>!x.includes('.')).map(x=>x[0]).slice(0,2).join('').toUpperCase(); }
function localInput(value:Date) { const adjusted=new Date(value.getTime()-value.getTimezoneOffset()*60000); return adjusted.toISOString().slice(0,16); }
function statusLabel(status:string) { return status.replace('_',' '); }
function appointmentMarkup(a:Appointment) {
  const when=new Date(a.starts_at); const end=new Date(a.ends_at);
  return `<article class="appointment-row"><div class="time-block"><strong>${when.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</strong><small>${end.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</small></div><span class="avatar">${initials(a.patient_name)}</span><div class="appointment-person"><strong>${a.patient_name}</strong><small>${a.service} · ${a.doctor_name}</small>${a.reason?`<p>${a.reason}</p>`:''}</div><span class="status status--${a.status}">${statusLabel(a.status)}</span>${user?.role==='doctor'?`<button class="icon-button" data-notes="${a.id}" data-existing="${encodeURIComponent(a.notes||'')}" title="Clinical notes">✦</button>`:''}</article>`;
}
function emptyMarkup(message:string) { return `<div class="empty-state"><span>◌</span><strong>Nothing here yet</strong><p>${message}</p></div>`; }
function setView(view:string) {
  els<HTMLElement>('[data-section]').forEach(x=>x.hidden=x.dataset.section!==view);
  els<HTMLButtonElement>('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  el('#view-title').textContent=view==='dashboard' ? `Good ${new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}` : view[0].toUpperCase()+view.slice(1);
  document.querySelector('.staff-sidebar')?.classList.remove('open');
  if(view==='patients') void loadPatients(); if(view==='appointments') void loadAppointments();
}
function signOut(){ token=''; user=null; sessionStorage.removeItem('dentara_token');sessionStorage.removeItem('dentara_user');el('#workspace').hidden=true;el('#login-view').hidden=false; }
async function boot(){
  if(!token||!user){signOut();return;} el('#login-view').hidden=true;el('#workspace').hidden=false;
  el('#user-name').textContent=user.name;el('#user-role').textContent=user.role==='front_desk'?'Front desk':'Doctor';el('#user-avatar').textContent=initials(user.name);
  els<HTMLElement>('.front-only').forEach(x=>x.hidden=user?.role!=='front_desk');
  el('#today-label').textContent=new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric'}).format(new Date());
  await Promise.all([loadDashboard(),loadPatients(),loadDoctors()]);
}
async function loadDashboard(){ try { const data=await api('/dashboard'); el('#metric-today').textContent=data.appointments_today;el('#metric-waiting').textContent=data.waiting;el('#metric-completed').textContent=data.completed_today;el('#metric-patients').textContent=data.total_patients;el('#today-appointments').innerHTML=data.appointments.length?data.appointments.map(appointmentMarkup).join(''):emptyMarkup('No visits are scheduled for today.'); bindNoteButtons(); } catch(e){showNotice((e as Error).message);} }
async function loadPatients(query=''){ try{patients=await api(`/patients?q=${encodeURIComponent(query)}`);el('#patient-count').textContent=`${patients.length} patient${patients.length===1?'':'s'}`;el('#patient-list').innerHTML=patients.length?patients.map(p=>`<article class="patient-card"><span class="avatar">${initials(`${p.first_name} ${p.last_name}`)}</span><div><strong>${p.first_name} ${p.last_name}</strong><a href="tel:${p.phone}">${p.phone}</a><small>${p.email||'No email on file'}</small></div><dl><div><dt>Allergies</dt><dd>${p.allergies||'None recorded'}</dd></div><div><dt>History</dt><dd>${p.medical_history||'None recorded'}</dd></div></dl></article>`).join(''):emptyMarkup('Try a different search or add the first patient.'); const select=el<HTMLSelectElement>('#appointment-form select[name="patient_id"]');select.innerHTML=patients.map(p=>`<option value="${p.id}">${p.first_name} ${p.last_name}</option>`).join('');}catch(e){showNotice((e as Error).message);} }
async function loadDoctors(){ doctors=await api('/staff/doctors');const select=el<HTMLSelectElement>('#appointment-form select[name="doctor_id"]');select.innerHTML=doctors.map(d=>`<option value="${d.id}">${d.name} · ${d.specialty||'Dentist'}</option>`).join('');if(user?.role==='doctor'){select.value=String(user.id);select.disabled=true;} }
async function loadAppointments(){try{const selected=el<HTMLInputElement>('#appointment-date').value;let path='/appointments';if(selected){const start=new Date(`${selected}T00:00:00`);const end=new Date(start);end.setDate(end.getDate()+1);path+=`?start=${start.toISOString()}&end=${end.toISOString()}`;}const items:Appointment[]=await api(path);el('#all-appointments').innerHTML=items.length?items.map(appointmentMarkup).join(''):emptyMarkup('No appointments match this date.');bindNoteButtons();}catch(e){showNotice((e as Error).message);}}
function bindNoteButtons(){els<HTMLButtonElement>('[data-notes]').forEach(button=>button.onclick=()=>{const form=el<HTMLFormElement>('#notes-form');(form.elements.namedItem('appointment_id') as HTMLInputElement).value=button.dataset.notes!;(form.elements.namedItem('notes') as HTMLTextAreaElement).value=decodeURIComponent(button.dataset.existing||'');el('#ai-output').hidden=true;el<HTMLDialogElement>('#notes-dialog').showModal();});}

el<HTMLFormElement>('#login-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button[type="submit"]') as HTMLButtonElement;button.disabled=true;el('#login-error').hidden=true;try{const data=new FormData(form);const params=new URLSearchParams({username:String(data.get('username')),password:String(data.get('password'))});const result=await api('/auth/login',{method:'POST',body:params});token=result.access_token;user=result.user;sessionStorage.setItem('dentara_token',token);sessionStorage.setItem('dentara_user',JSON.stringify(user));await boot();}catch(e){el('#login-error').textContent=(e as Error).message;el('#login-error').hidden=false;}finally{button.disabled=false;}});
els<HTMLButtonElement>('[data-demo]').forEach(button=>button.onclick=()=>{el<HTMLInputElement>('#login-form input[name="username"]').value=button.dataset.demo!;el<HTMLInputElement>('#login-form input[name="password"]').focus();});
els<HTMLButtonElement>('.nav-item').forEach(x=>x.onclick=()=>setView(x.dataset.view!));els<HTMLButtonElement>('[data-view-link]').forEach(x=>x.onclick=()=>setView(x.dataset.viewLink!));
el('#logout').onclick=signOut;el('#mobile-nav').onclick=()=>document.querySelector('.staff-sidebar')?.classList.toggle('open');
els<HTMLButtonElement>('[data-open]').forEach(button=>button.onclick=()=>{const dialog=el<HTMLDialogElement>(`#${button.dataset.open}-dialog`);if(button.dataset.open==='appointment'){const start=new Date();start.setMinutes(Math.ceil(start.getMinutes()/15)*15,0,0);const end=new Date(start.getTime()+45*60000);el<HTMLInputElement>('#appointment-form input[name="starts_at"]').value=localInput(start);el<HTMLInputElement>('#appointment-form input[name="ends_at"]').value=localInput(end);}dialog.showModal();});
el<HTMLInputElement>('#patient-search').oninput=event=>void loadPatients((event.target as HTMLInputElement).value);el<HTMLInputElement>('#appointment-date').onchange=()=>void loadAppointments();el('#refresh-appointments').onclick=()=>void loadAppointments();
el<HTMLFormElement>('#patient-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const data=Object.fromEntries(new FormData(form));for(const key of Object.keys(data))if(data[key]==='')delete data[key];try{await api('/patients',{method:'POST',body:JSON.stringify(data)});form.reset();el<HTMLDialogElement>('#patient-dialog').close();showNotice('Patient record added.');await Promise.all([loadPatients(),loadDashboard()]);}catch(e){form.querySelector<HTMLElement>('[data-form-error]')!.textContent=(e as Error).message;}});
el<HTMLFormElement>('#appointment-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const data=Object.fromEntries(new FormData(form));data.patient_id=Number(data.patient_id);data.doctor_id=user?.role==='doctor'?user.id:Number(data.doctor_id);data.starts_at=new Date(String(data.starts_at)).toISOString();data.ends_at=new Date(String(data.ends_at)).toISOString();try{await api('/appointments',{method:'POST',body:JSON.stringify(data)});form.reset();el<HTMLDialogElement>('#appointment-dialog').close();showNotice('Appointment booked successfully.');await Promise.all([loadAppointments(),loadDashboard()]);}catch(e){form.querySelector<HTMLElement>('[data-form-error]')!.textContent=(e as Error).message;}});
el<HTMLFormElement>('#notes-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const data=new FormData(form);try{const result=await api(`/appointments/${data.get('appointment_id')}/summarize`,{method:'POST',body:JSON.stringify({notes:data.get('notes')})});el('#ai-output').hidden=false;el('#ai-output p')!.textContent=result.summary;showNotice('Summary generated and saved.');await loadDashboard();}catch(e){form.querySelector<HTMLElement>('[data-form-error]')!.textContent=(e as Error).message;}});
void boot();
