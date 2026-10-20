const REPORT_DATE = "2026-09-29";
const REPORT_TARGET_DATE = "2026-10-06";
const STATUS_VALUE = { todo: 0, active: .5, done: 1 };
const STORAGE_KEY = "team1-weekly-progress-v4";
const LEGACY_STORAGE_KEY = "team1-weekly-progress-v3";
const LAST_UPDATE_KEY = "team1-weekly-progress-last-update";
const TARGET_NEXT_HIDDEN_KEY = "team1-target-next-hidden";
const DEFAULT_LAST_UPDATE = globalThis.TEAM1_PROJECT_DATA?.lastUpdate || "2026-10-19T17:20:17.747Z";
const AUTH_ENDPOINT = "/api/auth";
const CATEGORY_ALIASES = {
  "Web Platform": "Web Automation",
  "Web Automation": "Web Automation",
  Operasional: "Operational Support",
  "Dukungan Operasional": "Operational Support",
  "Operational Support": "Operational Support",
  "Digital Product": "Digital Product",
  Dokumentasi: "Others",
  Internal: "Others",
  Lainnya: "Others",
  Others: "Others"
};
const URGENCY_ALIASES = {"Very High":"Very High",High:"High",Medium:"Medium",Low:"Low",Tinggi:"High",Normal:"Medium"};
const URGENCY_CLASS = {"Very High":"urgency-very-high",High:"urgency-high",Medium:"urgency-medium",Low:"urgency-low"};
let currentFilter = "Semua";
let searchQuery = "";
let authUser = null;
let authChecked = false;
let pendingProtectedHash = "#project";
let draggedProjectId = null;
let draggedTask = null;

const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const task = (key, name, short, status, context, completedAt="", startedAt="", dueAt="") => ({ key, name, short, status, context, startedAt, dueAt, completedAt:status==="done"?completedAt:"" });
const weeklyProjects = globalThis.TEAM1_PROJECT_DATA?.projects || [
  {
    id: "project-1791880366318", name: "Dokumentasi TC", owner: "Dita", category: "Web Automation",
    start: "2026-10-13", end: "2026-10-18", urgency: "High", source: "Input dashboard",
    tasks: [
      task("planning", "Travel Safe", "794", "active", "Project baru"),
      task("design", "Life Guard", "705", "todo", "Project baru"),
      task("development", "Edu Protect", "705 AS", "todo", "Project baru"),
      task("testing", "Trip Guard", "728", "todo", "Project baru"),
      task("final", "Kebakaran", "201", "todo", "Project baru"),
      task("activity-1791880695045", "Property All Risks", "297", "todo", "Project baru"),
      task("activity-1791880727995", "Motor TLO", "605", "todo", "Project baru"),
      task("activity-1791880738585", "Mobil TLO", "601", "todo", "Project baru")
    ]
  },
  {
    id: "workstream-1791872633362", name: "Panduan Pembelian Polis melalui Jalur Internal", owner: "Dita", category: "Web Automation",
    start: "2026-10-02", end: "2026-11-06", urgency: "Medium", source: "Input dashboard",
    tasks: [
      task("planning", "Perencanaan", "Plan", "done", "Workstream baru"),
      task("design", "Draft #1", "Draft", "done", "Workstream baru"),
      task("development", "Review #1", "Review", "done", "Workstream baru"),
      task("testing", "Draft #2", "Draft", "done", "Workstream baru"),
      task("final", "Review #2", "Review", "todo", "Workstream baru"),
      task("activity-1791872724637", "Finalisasi", "Finalisasi", "todo", "Target 7 hari"),
      task("activity-1791872787848", "Submit ke MRK", "Submit", "todo", "Target 7 hari"),
      task("activity-1791872814823", "Review oleh MRK", "Review", "todo", "Target 7 hari")
    ]
  },
  {
    id: "workstream-1791872133823", name: "UAT #6 Web Asuransi Ritel", owner: "Restu", category: "Web Automation",
    start: "2026-10-05", end: "2026-10-12", urgency: "High", source: "Input dashboard",
    tasks: [
      task("planning", "Internal", "Internal", "done", "Workstream baru"),
      task("design", "Eksternal", "Eksternal", "done", "Workstream baru"),
      task("development", "Submit ke TIN", "Submit", "done", "Workstream baru")
    ]
  },
  {
    id: "workstream-1791872049323", name: "UAT #5 Web Asuransi Ritel", owner: "Restu", category: "Web Automation",
    start: "2026-09-27", end: "2026-10-05", urgency: "Medium", source: "Input dashboard",
    tasks: [
      task("planning", "Internal", "Internal", "done", "Workstream baru"),
      task("design", "Eksternal", "Eksternal", "done", "Workstream baru"),
      task("activity-1791872229703", "Submit ke TIN", "Submit", "done", "Target 7 hari")
    ]
  },
  {
    id: "workstream-1791867721702", name: "Perubahan Tarif Premi Travel Safe ESPPA", owner: "Dita", category: "Web Automation",
    start: "2026-09-08", end: "2026-10-23", urgency: "Medium", source: "Input dashboard",
    tasks: [
      task("planning", "Draft #1", "Draft", "done", "Workstream baru"),
      task("design", "Diskusi dengan Underwriter #1", "Diskusi", "done", "Workstream baru"),
      task("development", "Draft #2", "Draft", "done", "Workstream baru"),
      task("testing", "Diskusi dengan Underwriter #2", "Diskusi", "done", "Workstream baru"),
      task("final", "Perbaikan", "Revisi", "done", "Workstream baru"),
      task("activity-1791871281289", "Testing", "Testing", "done", "Target 7 hari"),
      task("activity-1791871298009", "Submit ke TIN", "Submit", "done", "Target 7 hari"),
      task("activity-1791871332423", "Pengerjaan oleh TIN", "Build", "active", "Target 7 hari"),
      task("activity-1791871350050", "Live di Web", "Live", "todo", "Target 7 hari")
    ]
  },
  {
    id: "team1-calculator", name: "Kalkulator Premi Jasindo Travel Insurance", owner: "Restu", category: "Digital Product",
    start: "2026-09-22", end: "2026-11-03", urgency: "High", source: "Weekly Report Team 1",
    tasks: [
      task("url", "Rekomendasi URL untuk web app kalkulator premi", "URL", "done", "Target minggu lalu"),
      task("uiux", "Referensi UI/UX lain yang lebih modern", "UI/UX", "done", "Target minggu lalu"),
      task("excel", "Excel kalkulator premi untuk penyesuaian tarif Travel Safe", "Testing", "done", "Tambahan di luar target"),
      task("landing", "Usulan landing page kalkulator premi", "Revisi", "done", "Target 7 hari"),
      task("deploy", "Finalisasi dan Diskusi dengan Underwriter", "Final", "active", "Tidak tercapai • Target 7 hari")
    ]
  },
  {
    id: "team1-book", name: "Buku Otomatisasi Underwriting Fase 3", owner: "Dita", category: "Operational Support",
    start: "2026-09-22", end: "2026-11-06", urgency: "Medium", source: "Weekly Report Team 1",
    tasks: [
      task("discussion", "Diskusi dengan GH", "Diskusi", "done", "Target minggu lalu • GH mereviu mandiri"),
      task("revision", "Perbaikan sebagai hasil diskusi dengan GH", "Perbaikan", "done", "Target 7 hari"),
      task("activity-1791870819122", "Review Sekper", "Review", "done", "Target 7 hari"),
      task("activity-1791870866921", "Diskusi Perbaikan dengan GH", "Diskusi", "todo", "Target 7 hari"),
      task("activity-1791871648689", "Perbaikan", "Revisi", "todo", "Target 7 hari")
    ]
  },
  {
    id: "team1-retail-web", name: "Web Flow Rekanan", owner: "Dita", category: "Web Automation",
    start: "2026-09-22", end: "2026-10-23", urgency: "High", source: "Weekly Report Team 1",
    tasks: [
      task("tripguard", "Planning", "Plan", "done", "Sedang dikerjakan"),
      task("travelsafe", "Inisiasi Pengembangan", "Build", "done", "Target 7 hari"),
      task("feedback", "Diskusi TC dengan TIN", "Diskusi", "done", "Target 7 hari"),
      task("testcase", "Pengembangan Lanjutan", "Build", "active", "Target 7 hari"),
      task("cob728", "Mapping Dummy Web Rekanan COB 728", "Mapping", "todo", "Target 7 hari")
    ]
  },
  {
    id: "team1-operations", name: "Monitoring Operasional", owner: "Dita & Restu", category: "Operational Support",
    start: "2026-09-29", end: "2026-10-18", urgency: "Medium", source: "Weekly Report Team 1",
    tasks: [
      task("asana", "Merapikan tasklist di Asana - September Week 1", "Recape Sep 1", "done", "Target 7 hari"),
      task("activity-1791870429038", "Merapikan tasklist di Asana - September Week 2", "Recape Sep 2", "done", "Target 7 hari"),
      task("activity-1791870446709", "Merapikan tasklist di Asana - September Week 3", "Recape Sep 3", "active", "Target 7 hari"),
      task("activity-1791870455124", "Merapikan tasklist di Asana - September Week 4", "Recape Sep 4", "todo", "Target 7 hari"),
      task("activity-1791870477320", "Merapikan tasklist di Asana - Oktober Week 1", "Recape Okt 1", "todo", "Target 7 hari"),
      task("activity-1791870490636", "Merapikan tasklist di Asana - Oktober Week 2", "Recape Okt 2", "todo", "Target 7 hari"),
      task("activity-1791870731159", "Export Token Asana", "Migrasi", "todo", "Target 7 hari")
    ]
  }
];

let projects = loadProjects();
function normalizeCategory(category){ return CATEGORY_ALIASES[category] || "Others"; }
function normalizeUrgency(urgency){ return URGENCY_ALIASES[urgency] || "Medium"; }
function normalizeProjects(items){ return items.map(project=>({...project,category:normalizeCategory(project.category),urgency:normalizeUrgency(project.urgency||project.priority),tasks:(project.tasks||[]).map(item=>{const status=item.status==="blocked"?"active":Object.hasOwn(STATUS_VALUE,item.status)?item.status:"todo";const startedAt=typeof item.startedAt==="string"&&item.startedAt?item.startedAt:(project.start||"");const dueAt=typeof item.dueAt==="string"&&item.dueAt?item.dueAt:(project.end||"");return {...item,status,startedAt,dueAt,completedAt:status==="done"&&typeof item.completedAt==="string"?item.completedAt:""};})})); }
function isResetSnapshot(items){ const resetIds=new Set(["team1-calculator","team1-book","team1-retail-web","team1-operations"]); return items.length===resetIds.size&&items.every(item=>resetIds.has(item.id)); }
function loadProjects(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(Array.isArray(saved)) return normalizeProjects(saved);
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    const legacyUpdateTime=Date.parse(localStorage.getItem(LAST_UPDATE_KEY));
    const baselineUpdateTime=Date.parse(DEFAULT_LAST_UPDATE);
    if(Array.isArray(legacy) && !isResetSnapshot(legacy) && legacyUpdateTime>baselineUpdateTime){
      const migrated=normalizeProjects(legacy); localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated)); return migrated;
    }
    const restored=normalizeProjects(structuredClone(weeklyProjects)); localStorage.setItem(STORAGE_KEY,JSON.stringify(restored)); return restored;
  } catch {
    const restored=normalizeProjects(structuredClone(weeklyProjects)); localStorage.setItem(STORAGE_KEY,JSON.stringify(restored)); return restored;
  }
}
function saveProjects(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); markDataUpdated(); renderCurrentWeekProjects(); }
function allTasks(){ return projects.flatMap(project => project.tasks || []); }
function progressOf(project){ const tasks = project.tasks || []; return tasks.length ? Math.round(tasks.reduce((total, item) => total + (STATUS_VALUE[item.status] || 0), 0) / tasks.length * 100) : 0; }
function stateOf(project){ const tasks=project.tasks||[]; if(tasks.length&&tasks.every(item=>item.status==="done"))return "Done"; if(tasks.some(item=>item.status!=="todo"))return "On going"; return "Not Started"; }
function daysUntil(date){ const a = new Date(); a.setHours(0,0,0,0); return Math.ceil((new Date(date+"T00:00:00") - a)/86400000); }
function formatDate(date, long=false){ return new Intl.DateTimeFormat("id-ID", long ? {day:"numeric",month:"long",year:"numeric"}:{day:"numeric",month:"short",year:"numeric"}).format(new Date(date+"T00:00:00")); }
function todayISO(){const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
function updateReportDate(){const today=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"long",year:"numeric"}).format(new Date());document.getElementById("reportDateText").textContent=today;document.getElementById("targetSubtitle").textContent=`Otomatis dari project yang belum selesai per ${today}`;}
function formatLastUpdate(value){let date=new Date(value);if(Number.isNaN(date.getTime()))date=new Date(DEFAULT_LAST_UPDATE);const parts=Object.fromEntries(new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}.${parts.minute} WIB`;}
function latestUpdateValue(value=localStorage.getItem(LAST_UPDATE_KEY)){const storedTime=Date.parse(value);const baselineTime=Date.parse(DEFAULT_LAST_UPDATE);const latest=Number.isNaN(storedTime)||storedTime<baselineTime?DEFAULT_LAST_UPDATE:value;if(latest!==value)localStorage.setItem(LAST_UPDATE_KEY,latest);return latest;}
function updateLastUpdateText(value){document.getElementById("lastUpdateText").textContent=`Last Update: ${formatLastUpdate(latestUpdateValue(value))}`;}
function markDataUpdated(){const value=new Date().toISOString();localStorage.setItem(LAST_UPDATE_KEY,value);updateLastUpdateText(value);}
function initials(name){ return name.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase(); }
function escapeHTML(str){ return String(str).replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function upcomingTasks(project){ return (project.tasks || []).filter(item => item.status !== "done"); }
function unfinishedProjects(){ return projects.filter(project => progressOf(project) < 100); }
function nextWeekTasks(project){
  const today=todayISO();
  const horizon=addDays(today,7);
  return (project.tasks || []).filter(item=>item.status!=="done"&&item.dueAt&&item.dueAt>=today&&item.dueAt<=horizon).sort((a,b)=>(a.dueAt||"").localeCompare(b.dueAt||""));
}
function completedLastSevenDays(){
  const today=todayISO();
  const weekStart=addDays(today,-7);
  const yesterday=addDays(today,-1);
  return projects.map(project=>({project,tasks:(project.tasks||[]).filter(item=>item.status==="done"&&item.completedAt&&item.completedAt>=weekStart&&item.completedAt<=yesterday)})).filter(({tasks})=>tasks.length);
}

function refreshDashboardData(){
  const button=document.getElementById("refreshTargetsBtn");
  button.disabled=true;button.classList.remove("is-refreshing");void button.offsetWidth;button.classList.add("is-refreshing");
  projects=loadProjects();render();updateReportDate();updateLastUpdateText();
  showToast("Target Selanjutnya diperbarui dari data project terbaru.");
  setTimeout(()=>{button.disabled=false;button.classList.remove("is-refreshing");},500);
}

function setTargetNextVisibility(hidden){
  const list=document.getElementById("deadlineList");
  const card=document.querySelector(".target-next-card");
  const button=document.getElementById("toggleNextTargetsBtn");
  if(!list||!card||!button)return;
  list.hidden=hidden;
  list.style.display=hidden?"none":"";
  card.classList.toggle("is-collapsed",hidden);
  button.setAttribute("aria-expanded",String(!hidden));
  button.title=hidden?"Tampilkan Target Selanjutnya":"Sembunyikan Target Selanjutnya";
  const icon=button.querySelector(".material-symbols-rounded");
  const label=button.querySelector("span:last-child");
  if(icon)icon.textContent=hidden?"visibility":"visibility_off";
  if(label)label.textContent=hidden?"Tampilkan":"Sembunyikan";
}

function toggleTargetNextVisibility(){
  const hidden=localStorage.getItem(TARGET_NEXT_HIDDEN_KEY)==="true";
  const next=!hidden;
  localStorage.setItem(TARGET_NEXT_HIDDEN_KEY,String(next));
  setTargetNextVisibility(next);
}

function render(){
  const filtered = projects.filter(p => {
    const searchable = `${p.name} ${p.owner} ${p.category} ${p.urgency} ${(p.tasks||[]).map(t=>t.name).join(" ")}`.toLowerCase();
    return (currentFilter === "Semua" || stateOf(p) === currentFilter) && searchable.includes(searchQuery);
  });
  const tasks = allTasks();
  const done = tasks.filter(t=>t.status === "done").length;
  const active = projects.filter(p=>progressOf(p)<100).length;
  const avg = projects.length ? Math.round(projects.reduce((sum,p)=>sum+progressOf(p),0)/projects.length) : 0;
  const completionRate = tasks.length ? Math.round(done/tasks.length*100) : 0;

  document.getElementById("totalProjects").textContent = projects.length;
  document.getElementById("activeSummary").textContent = `${active} project aktif`;
  document.getElementById("avgProgress").textContent = `${avg}%`;
  document.getElementById("completedProjects").textContent = done;
  document.getElementById("completedSummary").textContent = `${done} dari ${tasks.length} item pekerjaan`;
  document.getElementById("completionRate").textContent = `${completionRate}%`;
  document.getElementById("completionRing").style.setProperty("--ring", `${completionRate}%`);
  document.getElementById("projectList").innerHTML = filtered.map((project,index)=>projectRow(project,index)).join("");
  document.getElementById("emptyState").hidden = filtered.length > 0;
  renderTargets(); renderDistribution();
}

function projectRow(project,index){
  const progress = progressOf(project);
  const tasks = project.tasks || [];
  const displayTasks = tasks;
  const deadlineDays=project.end?daysUntil(project.end):null;
  const deadlineTone=progress>=100?"complete":deadlineDays!==null&&deadlineDays<0?"overdue":deadlineDays!==null&&deadlineDays<=7?"urgent":"";
  const editorMode=location.hash==="#project"&&Boolean(authUser);
  const timeline = displayTasks.map((item,index)=>{
    const stepPosition=displayTasks.length===1 ? 50 : index/(displayTasks.length-1)*100;
    const nextPosition=displayTasks.length===1 ? 50 : Math.min(100,(index+1)/(displayTasks.length-1)*100);
    return `<div class="timeline-node ${item.status}" style="--step-position:${stepPosition}%;--next-position:${nextPosition}%" title="${escapeHTML(item.short)}"><i></i><span>${escapeHTML(item.short)}</span></div>`;
  }).join("");
  return `<article class="project-row ${URGENCY_CLASS[project.urgency]||URGENCY_CLASS.Medium}" data-id="${project.id}" data-urgency="${escapeHTML(project.urgency)}">
    <div class="row-order"><span class="project-index">${index+1}</span><button class="drag-handle" type="button" draggable="${editorMode}" data-reorder-project="${project.id}" aria-label="Ubah urutan ${escapeHTML(project.name)}" title="Tarik untuk mengubah urutan"><span class="material-symbols-rounded" aria-hidden="true">drag_indicator</span></button></div>
    <div class="project-main"><div><h3>${escapeHTML(project.name)}</h3></div></div>
    <div class="project-kind"><strong>${escapeHTML(project.category)}</strong><span>PIC: ${escapeHTML(project.owner)}</span></div>
    <div class="urgency-cell"><span class="urgency-badge">${escapeHTML(project.urgency)}</span></div>
    <div class="progress-cell">
      <span class="project-progress-ring${progress===100?' is-complete':''}" style="--project-progress:${progress}%" role="progressbar" aria-label="Progress ${progress} persen" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">${progress===100?'<span class="material-symbols-rounded" aria-hidden="true">check</span>':''}</span>
      <strong>${progress}%</strong>
    </div>
    <div class="project-timeline">
      <div class="timeline-boundary project-start"><span class="material-symbols-rounded" aria-hidden="true">play_circle</span><strong>${project.start?formatDate(project.start):"-"}</strong></div>
      <div class="timeline-steps ${displayTasks.length>6?'timeline-dense':''}" aria-label="Aktivitas ${escapeHTML(project.name)}">${timeline}</div>
      <div class="timeline-boundary project-deadline ${deadlineTone}"><span class="material-symbols-rounded" aria-hidden="true">event</span><strong>${project.end?formatDate(project.end):"-"}</strong></div>
    </div>
    <button class="more-btn" data-open-project="${project.id}" aria-label="Buka detail ${escapeHTML(project.name)}"><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
  </article>`;
}

function moveProject(sourceId,targetId,placeAfter=false){
  if(!authUser||sourceId===targetId)return false;
  const sourceIndex=projects.findIndex(project=>project.id===sourceId);
  if(sourceIndex<0)return false;
  const [moved]=projects.splice(sourceIndex,1);
  let targetIndex=projects.findIndex(project=>project.id===targetId);
  if(targetIndex<0){projects.splice(sourceIndex,0,moved);return false;}
  if(placeAfter)targetIndex+=1;
  projects.splice(targetIndex,0,moved);
  saveProjects();render();showToast("Urutan project diperbarui dan tersimpan.");
  return true;
}

function moveTask(projectId,sourceKey,targetKey,placeAfter=false){
  if(!authUser||sourceKey===targetKey)return false;
  const project=projects.find(item=>item.id===projectId);
  if(!project)return false;
  const sourceIndex=project.tasks.findIndex(item=>item.key===sourceKey);
  if(sourceIndex<0)return false;
  const [moved]=project.tasks.splice(sourceIndex,1);
  let targetIndex=project.tasks.findIndex(item=>item.key===targetKey);
  if(targetIndex<0){project.tasks.splice(sourceIndex,0,moved);return false;}
  if(placeAfter)targetIndex+=1;
  project.tasks.splice(targetIndex,0,moved);
  saveProjects();render();openDrawer(projectId);showToast("Urutan aktivitas diperbarui dan tersimpan.");
  return true;
}

function duplicateTask(projectId,taskKey){
  if(!requireEditor())return;
  const project=projects.find(item=>item.id===projectId);
  const sourceIndex=project?.tasks?.findIndex(item=>item.key===taskKey)??-1;
  if(!project||sourceIndex<0)return;
  const source=project.tasks[sourceIndex];
  const copy={...structuredClone(source),key:`activity-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:`${source.name} (Salinan)`};
  project.tasks.splice(sourceIndex+1,0,copy);
  saveProjects();render();openDrawer(projectId);showToast(`Aktivitas “${source.name}” berhasil diduplikasi.`);
}

function renderTargets(){
  const items = unfinishedProjects().map(project=>({project,tasks:upcomingTasks(project)}));
  document.getElementById("deadlineList").innerHTML = items.length ? items.map(({project,tasks},i)=>targetCardMarkup(project,tasks,i,"next")) .join("") : `<div class="empty-state"><p>Semua pekerjaan sudah selesai.</p></div>`;
  renderCurrentWeekProjects();
  renderNextWeekTargets();
}

function renderCurrentWeekProjects(){
  const subtitle=document.getElementById("currentWeekSubtitle");
  if(subtitle)subtitle.textContent="Aktivitas berstatus Done dalam 7 hari sebelumnya";
  const list=document.getElementById("currentWeekList");
  if(!list)return;
  const items=completedLastSevenDays();
  list.innerHTML=items.length?items.map(({project,tasks},i)=>targetCardMarkup(project,tasks,i,"completed")).join(""): `<div class="empty-state current-week-empty"><p>Belum ada aktivitas Done dengan tanggal penyelesaian dalam 7 hari sebelumnya.</p></div>`;
}

function targetCardMarkup(project,tasks,index,variant="next"){
  const taskItems=tasks||[];
  const dates=taskItems.map(item=>item.dueAt).filter(Boolean).sort();
  const firstDue=dates[0]||project.end;
  const lastDue=dates[dates.length-1]||project.end;
  const totalProjectTasks=(project.tasks||[]).length;
  const progress=variant==="completed"&&totalProjectTasks?Math.round(taskItems.length/totalProjectTasks*100):progressOf(project);
  const urgency=project.urgency||"Medium";
  const urgencyClass=URGENCY_CLASS[urgency]||"urgency-medium";
  const visibleTasks=variant==="next"||variant==="completed"?taskItems:taskItems.slice(0,4);
  const remainingTasks=variant==="next"||variant==="completed"?[]:taskItems.slice(visibleTasks.length);
  const timing=firstDue?daysUntil(firstDue):null;
  const timingLabel=timing===null?"Deadline belum diatur":timing<=0?"Jatuh tempo hari ini":`${timing} hari lagi`;
  const timingIcon="event_upcoming";
  const countdownMeta=variant==="completed"?"":`<span class="target-card-countdown"><span class="material-symbols-rounded">${timingIcon}</span>${timingLabel}</span>`;
  const showExactDates=variant==="next";
  const deadlineMeta=variant!=="next"
    ? ""
    : `<span class="target-card-deadline"><span class="material-symbols-rounded">calendar_month</span>${lastDue?`Sampai ${formatDate(lastDue)}`:"Tanpa deadline"}</span>`;
  const taskList=visibleTasks.length?visibleTasks.map(item=>`<li><span class="target-task-dot"></span><span>${escapeHTML(item.name)}</span>${showExactDates&&item.dueAt?`<time>${formatDate(item.dueAt)}</time>`:""}</li>`).join(""):"<li><span class=\"target-task-dot\"></span><span>Belum ada aktivitas</span></li>";
  return `<article class="target-card ${variant==='next'?'target-card-next':''} ${variant==='completed'?'target-card-completed':''}">
    <div class="target-card-top">
      <span class="target-card-index">${String(index+1).padStart(2,"0")}</span>
      <div class="target-card-heading"><h3>${escapeHTML(project.name)}</h3><p><span>${escapeHTML(project.owner||"PIC belum diatur")}</span><b>•</b>${taskItems.length} aktivitas</p></div>
      <div class="target-progress" style="--target-progress:${progress*3.6}deg"><strong>${progress}%</strong></div>
    </div>
    <div class="target-card-info"><span class="target-card-urgency ${urgencyClass}"><span class="urgency-badge">${escapeHTML(urgency)}</span></span>${deadlineMeta}${countdownMeta}</div>
    <div class="target-card-task-area ${remainingTasks.length?"has-more":""}">
      <ul class="target-card-tasks">${taskList}</ul>
      ${remainingTasks.length?`<div class="target-card-more">${remainingTasks.map(item=>`<span class="target-card-more-item"><span class="target-task-dot"></span>${escapeHTML(item.name)}</span>`).join("")}</div>`:""}
    </div>
  </article>`;
}

function renderNextWeekTargets(){
  const today=todayISO();
  const horizon=addDays(today,7);
  const subtitle=document.getElementById("nextWeekSubtitle");
  if(subtitle)subtitle.textContent=`Aktivitas belum selesai dengan deadline sampai ${formatDate(horizon,true)}`;
  const items=projects.map(project=>({project,tasks:nextWeekTasks(project)})).filter(({tasks})=>tasks.length);
  const list=document.getElementById("nextWeekList");
  if(!list)return;
  list.innerHTML=items.length?items.map(({project,tasks},i)=>targetCardMarkup(project,tasks,i,"week")).join(""): `<div class="empty-state next-week-empty"><p>Tidak ada aktivitas yang belum selesai sampai ${formatDate(horizon,true)}.</p></div>`;
}

function renderDistribution(){
  const tasks = allTasks();
  const counts = {
    Done: tasks.filter(t=>t.status==="done").length,
    "On going": tasks.filter(t=>t.status==="active").length,
    "Not Started": tasks.filter(t=>t.status==="todo").length
  };
  const total = tasks.length || 1;
  const p1=counts.Done/total*360, p2=p1+counts["On going"]/total*360;
  const donut=document.getElementById("distributionDonut"); donut.style.setProperty("--p1",`${p1}deg`);donut.style.setProperty("--p2",`${p2}deg`);
  document.getElementById("donutTotal").textContent=tasks.length;
  const colors={Done:"var(--green)","On going":"#ffad14","Not Started":"#dfe6e4"};
  document.getElementById("distributionLegend").innerHTML=Object.entries(counts).map(([label,value])=>`<div class="legend-item"><i style="background:${colors[label]}"></i><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function createDefaultTasks(startedAt=todayISO(),dueAt=addDays(new Date(),7)){
  return [
    task("planning","Perencanaan dan ruang lingkup","Plan","todo","Project baru","",startedAt,dueAt),
    task("design","Desain solusi","Desain","todo","Project baru","",startedAt,dueAt),
    task("development","Implementasi","Build","todo","Project baru","",startedAt,dueAt),
    task("testing","Pengujian","Test","todo","Project baru","",startedAt,dueAt),
    task("final","Finalisasi","Final","todo","Project baru","",startedAt,dueAt)
  ];
}

function openModal(project=null){
  if(!requireEditor())return;
  const form=document.getElementById("projectForm"); form.reset();
  document.getElementById("projectId").value=project?.id || "";
  document.getElementById("modalTitle").textContent=project ? "Edit informasi project" : "Tambahkan pekerjaan";
  document.querySelector('.modal-actions .primary-btn').innerHTML=project ? 'Simpan Perubahan <span>→</span>' : 'Buat Project <span>→</span>';
  document.getElementById("projectStart").value=project?.start || new Date().toISOString().slice(0,10);
  document.getElementById("projectEnd").value=project?.end || addDays(new Date(),7);
  if(project){
    document.getElementById("projectName").value=project.name; document.getElementById("projectOwner").value=project.owner==="Restu"?"Restu":"Dita";
    const selectedCategory=normalizeCategory(project.category);
    document.getElementById("projectCategory").value=[...document.getElementById("projectCategory").options].some(o=>o.value===selectedCategory)?selectedCategory:"Others";
    document.getElementById("projectUrgency").value=normalizeUrgency(project.urgency||project.priority);
  }
  document.getElementById("projectModal").hidden=false; setTimeout(()=>document.getElementById("projectName").focus(),50);
}
function closeModal(){document.getElementById("projectModal").hidden=true;}
function showToast(message){const toast=document.getElementById("toast");toast.querySelector("p").textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2600);}

function updateAuthUI(){
  const session=document.getElementById("editorSession");
  session.hidden=!authUser;
  if(!authUser)return;
  document.getElementById("editorName").textContent=authUser.name;
  document.getElementById("editorAvatar").textContent=authUser.name.split(/\s+/).map(part=>part[0]).slice(0,2).join("").toUpperCase();
}
function openLoginModal(returnHash="#project"){
  pendingProtectedHash=returnHash;
  const form=document.getElementById("loginForm");
  form.reset();
  const error=document.getElementById("loginError");
  error.hidden=true; error.textContent="";
  document.getElementById("loginModal").hidden=false;
  setTimeout(()=>document.getElementById("loginUser").focus(),50);
}
function closeLoginModal(){document.getElementById("loginModal").hidden=true;}
function requireEditor(){if(authUser)return true;openLoginModal("#project");return false;}
async function refreshAuth(){
  try{
    const response=await fetch(AUTH_ENDPOINT,{credentials:"same-origin",headers:{Accept:"application/json"}});
    const data=response.ok?await response.json():{authenticated:false};
    authUser=data.authenticated?data.user:null;
  }catch{authUser=null;}
  authChecked=true; updateAuthUI(); syncView();
}

function openTaskModal(projectId,index=null){
  if(!requireEditor())return;
  const project=projects.find(item=>item.id===projectId); if(!project)return;
  const item=index===null?null:project.tasks?.[index];
  const form=document.getElementById("taskForm"); form.reset();
  document.getElementById("taskProjectId").value=projectId;
  document.getElementById("taskIndex").value=index===null?"":String(index);
  document.getElementById("taskModalTitle").textContent=item?"Edit aktivitas":"Tambah aktivitas";
  document.getElementById("deleteTaskBtn").hidden=!item;
  document.getElementById("taskName").value=item?.name||"";
  document.getElementById("taskShort").value=item?.short||"";
  document.getElementById("taskStartedDate").value=item?.startedAt||todayISO();
  document.getElementById("taskDueDate").value=item?.dueAt||project.end||addDays(new Date(),7);
  document.getElementById("taskStatus").value=item?.status||"todo";
  document.getElementById("taskCompletedDate").value=item?.completedAt||"";
  syncTaskCompletedDateField(false);
  document.getElementById("taskModal").hidden=false;
  setTimeout(()=>document.getElementById("taskName").focus(),50);
}
function closeTaskModal(){document.getElementById("taskModal").hidden=true;}
function syncTaskCompletedDateField(autoFill=true){
  const field=document.getElementById("taskCompletedDateField");
  const input=document.getElementById("taskCompletedDate");
  const isDone=document.getElementById("taskStatus").value==="done";
  field.hidden=!isDone; input.disabled=!isDone; input.required=isDone;
  if(isDone&&autoFill&&!input.value)input.value=todayISO();
  if(!isDone)input.value="";
}

function openDrawer(id){
  if(!requireEditor())return;
  const project=projects.find(x=>x.id===id); if(!project)return; const progress=progressOf(project);
  document.getElementById("drawerTitle").textContent=project.name;
  document.getElementById("drawerContent").innerHTML=`
    <div class="drawer-progress"><div class="big-progress"><div><span>PROGRES KESELURUHAN</span><strong>${progress}%</strong></div><span>${progress===100?"Semua item selesai":`${100-progress}% menuju final`}</span></div><div class="progress-track"><i style="width:${progress}%"></i></div></div>
    <div class="drawer-meta"><div><span>PIC</span><strong>${escapeHTML(project.owner)}</strong></div><div><span>Target</span><strong>${formatDate(project.end)}</strong></div><div><span>Status</span><strong>${stateOf(project)}</strong></div></div>
    <p class="drawer-source-note"><strong>Sumber:</strong> ${escapeHTML(project.source || "Input dashboard")} • Snapshot 29 September 2026. Status dan detail aktivitas dapat diperbarui langsung dari daftar di bawah.</p>
    <div class="stage-heading"><div><h3>Aktivitas</h3><span>Edit status atau detail setiap aktivitas</span></div><button class="task-add-btn" data-add-task="${project.id}">＋ Tambah Aktivitas</button></div>
    <div class="stage-list" data-task-list="${project.id}">${(project.tasks||[]).map((item,index)=>`<div class="stage-item ${item.status}" data-task-key="${escapeHTML(item.key)}" data-project="${project.id}"><div class="stage-order"><button class="task-drag-handle" type="button" draggable="true" data-reorder-task="${escapeHTML(item.key)}" data-project="${project.id}" aria-label="Ubah urutan aktivitas ${escapeHTML(item.name)}" title="Tarik untuk mengubah urutan"><span class="material-symbols-rounded" aria-hidden="true">drag_indicator</span></button><div class="stage-number">${item.status==='done'?'✓':index+1}</div></div><div class="stage-copy"><h4>${escapeHTML(item.name)}</h4><p>Kontribusi ${Math.round(100/project.tasks.length)}%</p><div class="activity-dates"><label class="activity-date-editor start-date-editor"><span><span class="material-symbols-rounded" aria-hidden="true">play_circle</span>Tanggal mulai</span><input class="activity-start-date-input" type="date" value="${item.startedAt||project.start||''}" data-project="${project.id}" data-task-index="${index}" aria-label="Tanggal mulai ${escapeHTML(item.name)}" /></label><label class="activity-date-editor deadline-date-editor"><span><span class="material-symbols-rounded" aria-hidden="true">event</span>Deadline</span><input class="activity-deadline-input" type="date" value="${item.dueAt||project.end||''}" data-project="${project.id}" data-task-index="${index}" aria-label="Deadline ${escapeHTML(item.name)}" /></label>${item.status==='done'?`<label class="activity-date-editor completion-date-editor ${item.completedAt?'':'missing'}"><span><span class="material-symbols-rounded" aria-hidden="true">event_available</span>Tanggal selesai</span><input class="completion-date-input" type="date" value="${item.completedAt||''}" data-project="${project.id}" data-task-index="${index}" aria-label="Tanggal penyelesaian ${escapeHTML(item.name)}" /></label>`:''}</div></div><div class="stage-controls"><select class="stage-select" data-project="${project.id}" data-task-index="${index}" aria-label="Status ${escapeHTML(item.name)}"><option value="done" ${item.status==='done'?'selected':''}>Done</option><option value="active" ${item.status==='active'?'selected':''}>On going</option><option value="todo" ${item.status==='todo'?'selected':''}>Not Started</option></select><button class="task-duplicate-btn" data-duplicate-task="${escapeHTML(item.key)}" data-project="${project.id}" aria-label="Duplikasi aktivitas ${escapeHTML(item.name)}" title="Duplikasi aktivitas"><span class="material-symbols-rounded" aria-hidden="true">content_copy</span></button><button class="task-edit-btn" data-edit-task="${index}" data-project="${project.id}" aria-label="Edit aktivitas ${escapeHTML(item.name)}" title="Edit aktivitas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.7 4.7L8 20l10.8-10.8a2.1 2.1 0 0 0-3-3L4 16Z"/><path d="m14.5 7.5 3 3"/></svg></button></div></div>`).join("")}</div>
    ${(project.tasks||[]).length?"":'<div class="empty-task-state">Belum ada aktivitas. Klik “Tambah Aktivitas” untuk memulai.</div>'}
    <div class="danger-zone"><button class="secondary-btn" data-edit-project="${project.id}">Edit informasi</button><button class="danger-btn" data-delete-project="${project.id}">Hapus project</button></div>`;
  document.getElementById("detailDrawer").hidden=false;
}
function closeDrawer(){document.getElementById("detailDrawer").hidden=true;}

function syncView(){
  let isWorkstream=location.hash==="#project";
  if(isWorkstream&&authChecked&&!authUser){
    history.replaceState(null,"","#dashboard-app");
    isWorkstream=false;
    openLoginModal("#project");
  }
  document.body.classList.toggle("workstream-view",isWorkstream);
  document.body.classList.toggle("dashboard-view",!isWorkstream);
  document.getElementById("pageEyebrow").textContent="TEAM 1";
  document.getElementById("pageTitle").textContent="SME UNDERWRITING & ADMINISTRATION";
  document.getElementById("pageSubtitle").textContent="PROJECT REPORT";
  document.getElementById("workstreamSectionTitle").textContent=isWorkstream?"Draft Project":"Progress Project";
  document.getElementById("workstreamSectionDescription").textContent=isWorkstream?"Edit detail dan susun urutan project":"Ringkasan progres seluruh pekerjaan";
  document.getElementById("reorderHint").hidden=!isWorkstream;
  const fab=document.getElementById("workstreamFab");
  const label=isWorkstream?"Kembali ke dashboard":"Buka draft project";
  fab.href=isWorkstream?"#dashboard-app":"#project";
  fab.setAttribute("aria-label",label);
  fab.title=label;
  document.getElementById("workstreamFabLabel").textContent=label;
  updateAuthUI();
  if(!isWorkstream&&(currentFilter!=="Semua"||searchQuery)){
    currentFilter="Semua";searchQuery="";document.getElementById("searchInput").value="";
    document.querySelectorAll(".filter-chip").forEach(chip=>chip.classList.toggle("active",chip.dataset.filter==="Semua"));
  }
  render();
  window.scrollTo(0,0);
}

updateReportDate();
updateLastUpdateText();
setInterval(updateReportDate,60000);
window.addEventListener("storage",event=>{
  if(event.key===STORAGE_KEY){projects=loadProjects();render();}
  if(event.key===LAST_UPDATE_KEY)updateLastUpdateText(event.newValue||DEFAULT_LAST_UPDATE);
});
document.getElementById("refreshTargetsBtn").addEventListener("click",refreshDashboardData);
document.getElementById("toggleNextTargetsBtn").addEventListener("click",toggleTargetNextVisibility);
document.getElementById("addProjectBtn").addEventListener("click",()=>openModal());
document.getElementById("workstreamFab").addEventListener("click",event=>{if(location.hash!=="#project"&&!authUser){event.preventDefault();openLoginModal("#project");}});
document.querySelectorAll("[data-close-login]").forEach(button=>button.addEventListener("click",closeLoginModal));
document.querySelectorAll("[data-close-modal]").forEach(button=>button.addEventListener("click",closeModal));
document.querySelectorAll("[data-close-task]").forEach(button=>button.addEventListener("click",closeTaskModal));
document.getElementById("closeDrawer").addEventListener("click",closeDrawer);
document.getElementById("projectModal").addEventListener("click",event=>{if(event.target.id==="projectModal")closeModal()});
document.getElementById("taskModal").addEventListener("click",event=>{if(event.target.id==="taskModal")closeTaskModal()});
document.getElementById("detailDrawer").addEventListener("click",event=>{if(event.target.id==="detailDrawer")closeDrawer()});
document.getElementById("loginModal").addEventListener("click",event=>{if(event.target.id==="loginModal")closeLoginModal()});
window.addEventListener("hashchange",syncView);
document.addEventListener("keydown",event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();document.getElementById("searchInput").focus()}if(event.key==="Escape"){closeLoginModal();closeTaskModal();closeModal();closeDrawer();}});
document.getElementById("searchInput").addEventListener("input",event=>{searchQuery=event.target.value.trim().toLowerCase();render()});
document.querySelectorAll(".filter-chip,.filter-nav").forEach(button=>button.addEventListener("click",()=>{currentFilter=button.dataset.filter;document.querySelectorAll(".filter-chip").forEach(chip=>chip.classList.toggle("active",chip.dataset.filter===currentFilter));render();if(button.classList.contains("filter-nav"))document.querySelector(".sidebar").classList.remove("open");}));

document.getElementById("loginForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const submit=document.getElementById("loginSubmit");
  const error=document.getElementById("loginError");
  submit.disabled=true; submit.innerHTML='Memeriksa…'; error.hidden=true;
  try{
    const response=await fetch(AUTH_ENDPOINT,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({user:document.getElementById("loginUser").value,password:document.getElementById("loginPassword").value})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.authenticated)throw new Error(data.error||"Login belum dapat diproses.");
    authUser=data.user; authChecked=true; closeLoginModal(); updateAuthUI();
    const destination=pendingProtectedHash||"#project"; pendingProtectedHash="#project";
    if(location.hash===destination)syncView();else location.hash=destination;
    showToast(`Login berhasil. Selamat datang, ${authUser.name}.`);
  }catch(loginError){
    error.textContent=loginError.message||"User atau password tidak sesuai."; error.hidden=false;
    document.getElementById("loginPassword").select();
  }finally{submit.disabled=false;submit.innerHTML='Masuk ke Editor <span>→</span>';}
});

document.getElementById("logoutBtn").addEventListener("click",async()=>{
  try{await fetch(AUTH_ENDPOINT,{method:"DELETE",credentials:"same-origin",headers:{Accept:"application/json"}});}catch{}
  authUser=null; closeTaskModal(); closeModal(); closeDrawer(); history.replaceState(null,"","#dashboard-app"); syncView(); showToast("Anda sudah keluar dari mode editor.");
});

document.getElementById("projectForm").addEventListener("submit",event=>{
  event.preventDefault(); if(!requireEditor()){closeModal();return;} const start=document.getElementById("projectStart").value,end=document.getElementById("projectEnd").value;
  if(new Date(end)<new Date(start)){showToast("Target selesai harus setelah tanggal mulai.");return;}
  const editId=document.getElementById("projectId").value;
  const old=projects.find(project=>project.id===editId);
  const project={id:editId || `project-${Date.now()}`,name:document.getElementById("projectName").value.trim(),owner:document.getElementById("projectOwner").value.trim(),category:document.getElementById("projectCategory").value,start,end,urgency:document.getElementById("projectUrgency").value,source:old?.source || "Input dashboard",tasks:old?.tasks || createDefaultTasks(start,end)};
  if(old) projects=projects.map(item=>item.id===editId?project:item); else projects.unshift(project);
  saveProjects();closeModal();render();showToast(old ? "Informasi project diperbarui." : `Project “${project.name}” berhasil dibuat.`);setTimeout(()=>openDrawer(project.id),350);
});

document.getElementById("taskForm").addEventListener("submit",event=>{
  event.preventDefault();
  if(!requireEditor()){closeTaskModal();return;}
  const projectId=document.getElementById("taskProjectId").value;
  const project=projects.find(item=>item.id===projectId); if(!project)return;
  const indexValue=document.getElementById("taskIndex").value;
  const index=indexValue===""?null:Number(indexValue);
  const previous=index===null?null:project.tasks[index];
  const status=document.getElementById("taskStatus").value;
  const startedAt=document.getElementById("taskStartedDate").value;
  const dueAt=document.getElementById("taskDueDate").value;
  const completedAt=status==="done"?document.getElementById("taskCompletedDate").value:"";
  if(dueAt<startedAt){showToast("Deadline aktivitas tidak boleh lebih awal dari tanggal mulai.");return;}
  if(completedAt&&completedAt<startedAt){showToast("Tanggal penyelesaian tidak boleh lebih awal dari tanggal mulai aktivitas.");return;}
  const activity={key:previous?.key||`activity-${Date.now()}`,name:document.getElementById("taskName").value.trim(),short:document.getElementById("taskShort").value.trim(),status,context:previous?.context||"",startedAt,dueAt,completedAt};
  if(index===null)project.tasks.push(activity);else project.tasks[index]=activity;
  saveProjects();closeTaskModal();render();openDrawer(projectId);showToast(index===null?"Aktivitas berhasil ditambahkan.":"Aktivitas berhasil diperbarui.");
});

document.getElementById("deleteTaskBtn").addEventListener("click",()=>{
  if(!requireEditor()){closeTaskModal();return;}
  const projectId=document.getElementById("taskProjectId").value;
  const index=Number(document.getElementById("taskIndex").value);
  const project=projects.find(item=>item.id===projectId); const item=project?.tasks?.[index]; if(!item)return;
  if(confirm(`Hapus aktivitas “${item.name}”?`)){project.tasks.splice(index,1);saveProjects();closeTaskModal();render();openDrawer(projectId);showToast("Aktivitas dihapus.");}
});

document.getElementById("projectList").addEventListener("click",event=>{const button=event.target.closest("[data-open-project]");if(button)openDrawer(button.dataset.openProject);});
document.getElementById("projectList").addEventListener("dragstart",event=>{
  const handle=event.target.closest(".drag-handle");
  if(!handle||!authUser||location.hash!=="#project"){event.preventDefault();return;}
  draggedProjectId=handle.dataset.reorderProject;
  const row=handle.closest(".project-row");
  row.classList.add("dragging");
  event.dataTransfer.effectAllowed="move";
  event.dataTransfer.setData("text/plain",draggedProjectId);
});
document.getElementById("projectList").addEventListener("dragover",event=>{
  if(!draggedProjectId)return;
  const row=event.target.closest(".project-row");
  if(!row||row.dataset.id===draggedProjectId)return;
  event.preventDefault();
  document.querySelectorAll(".project-row.drag-over-before,.project-row.drag-over-after").forEach(item=>item.classList.remove("drag-over-before","drag-over-after"));
  const rect=row.getBoundingClientRect();
  row.classList.add(event.clientY>rect.top+rect.height/2?"drag-over-after":"drag-over-before");
  event.dataTransfer.dropEffect="move";
});
document.getElementById("projectList").addEventListener("drop",event=>{
  const row=event.target.closest(".project-row");
  if(!draggedProjectId||!row)return;
  event.preventDefault();
  const rect=row.getBoundingClientRect();
  moveProject(draggedProjectId,row.dataset.id,event.clientY>rect.top+rect.height/2);
});
document.getElementById("projectList").addEventListener("dragend",()=>{
  draggedProjectId=null;
  document.querySelectorAll(".project-row.dragging,.project-row.drag-over-before,.project-row.drag-over-after").forEach(item=>item.classList.remove("dragging","drag-over-before","drag-over-after"));
});
document.getElementById("projectList").addEventListener("keydown",event=>{
  const handle=event.target.closest(".drag-handle");
  if(!handle||!authUser||!['ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();
  const index=projects.findIndex(project=>project.id===handle.dataset.reorderProject);
  const targetIndex=event.key==='ArrowUp'?index-1:index+1;
  if(index<0||targetIndex<0||targetIndex>=projects.length)return;
  const targetId=projects[targetIndex].id;
  if(moveProject(handle.dataset.reorderProject,targetId,event.key==='ArrowDown')){
    requestAnimationFrame(()=>document.querySelector(`[data-reorder-project="${handle.dataset.reorderProject}"]`)?.focus());
  }
});
document.getElementById("taskStatus").addEventListener("change",()=>syncTaskCompletedDateField(true));
document.getElementById("drawerContent").addEventListener("change",event=>{
  if(event.target.matches(".activity-start-date-input")){
    const project=projects.find(item=>item.id===event.target.dataset.project); const activity=project?.tasks?.[Number(event.target.dataset.taskIndex)]; if(!activity)return;
    if(!event.target.value){event.target.value=activity.startedAt||project.start||todayISO();showToast("Tanggal mulai aktivitas wajib diisi.");return;}
    if(activity.dueAt&&event.target.value>activity.dueAt){event.target.value=activity.startedAt||project.start||todayISO();showToast("Tanggal mulai tidak boleh melewati deadline aktivitas.");return;}
    if(activity.completedAt&&event.target.value>activity.completedAt){event.target.value=activity.startedAt||project.start||todayISO();showToast("Tanggal mulai tidak boleh melewati tanggal penyelesaian.");return;}
    activity.startedAt=event.target.value; saveProjects(); openDrawer(project.id); showToast(`Tanggal mulai aktivitas diperbarui menjadi ${formatDate(activity.startedAt)}.`); return;
  }
  if(event.target.matches(".activity-deadline-input")){
    const project=projects.find(item=>item.id===event.target.dataset.project); const activity=project?.tasks?.[Number(event.target.dataset.taskIndex)]; if(!activity)return;
    if(!event.target.value){event.target.value=activity.dueAt||project.end||todayISO();showToast("Deadline aktivitas wajib diisi.");return;}
    if(activity.startedAt&&event.target.value<activity.startedAt){event.target.value=activity.dueAt||project.end||todayISO();showToast("Deadline aktivitas tidak boleh lebih awal dari tanggal mulai.");return;}
    activity.dueAt=event.target.value; saveProjects(); openDrawer(project.id); showToast(`Deadline aktivitas diperbarui menjadi ${formatDate(activity.dueAt)}.`); return;
  }
  if(event.target.matches(".completion-date-input")){
    const project=projects.find(item=>item.id===event.target.dataset.project); const activity=project?.tasks?.[Number(event.target.dataset.taskIndex)]; if(!activity)return;
    if(!event.target.value){event.target.value=activity.completedAt||todayISO();showToast("Tanggal penyelesaian wajib diisi.");return;}
    if(activity.startedAt&&event.target.value<activity.startedAt){event.target.value=activity.completedAt||todayISO();showToast("Tanggal penyelesaian tidak boleh lebih awal dari tanggal mulai aktivitas.");return;}
    activity.completedAt=event.target.value; saveProjects(); openDrawer(project.id); showToast(`Tanggal penyelesaian diperbarui menjadi ${formatDate(activity.completedAt)}.`); return;
  }
  if(!event.target.matches(".stage-select"))return;
  const project=projects.find(item=>item.id===event.target.dataset.project);const activity=project.tasks[Number(event.target.dataset.taskIndex)];activity.status=event.target.value;activity.startedAt=activity.startedAt||project.start||todayISO();activity.dueAt=activity.dueAt||project.end||activity.startedAt;activity.completedAt=activity.status==="done"?(activity.completedAt||todayISO()):"";if(activity.completedAt<activity.startedAt)activity.completedAt=activity.startedAt;saveProjects();render();openDrawer(project.id);showToast(activity.status==="done"?`Aktivitas selesai pada ${formatDate(activity.completedAt)}.`:"Progress project diperbarui.");
});
document.getElementById("drawerContent").addEventListener("click",event=>{
  const addTask=event.target.closest("[data-add-task]"); if(addTask){openTaskModal(addTask.dataset.addTask);return;}
  const duplicate=event.target.closest("[data-duplicate-task]"); if(duplicate){duplicateTask(duplicate.dataset.project,duplicate.dataset.duplicateTask);return;}
  const editTask=event.target.closest("[data-edit-task]"); if(editTask){openTaskModal(editTask.dataset.project,Number(editTask.dataset.editTask));return;}
  const remove=event.target.closest("[data-delete-project]"); if(remove){const project=projects.find(item=>item.id===remove.dataset.deleteProject);if(confirm(`Hapus project “${project.name}”?`)){projects=projects.filter(item=>item.id!==project.id);saveProjects();closeDrawer();render();showToast("Project dihapus.");}}
  const edit=event.target.closest("[data-edit-project]"); if(edit){const project=projects.find(item=>item.id===edit.dataset.editProject);closeDrawer();openModal(project);}
});
document.getElementById("drawerContent").addEventListener("dragstart",event=>{
  const handle=event.target.closest(".task-drag-handle");
  if(!handle||!authUser){event.preventDefault();return;}
  draggedTask={projectId:handle.dataset.project,key:handle.dataset.reorderTask};
  handle.closest(".stage-item")?.classList.add("task-dragging");
  event.dataTransfer.effectAllowed="move";
  event.dataTransfer.setData("text/plain",draggedTask.key);
});
document.getElementById("drawerContent").addEventListener("dragover",event=>{
  if(!draggedTask)return;
  const row=event.target.closest(".stage-item");
  if(!row||row.dataset.project!==draggedTask.projectId||row.dataset.taskKey===draggedTask.key)return;
  event.preventDefault();
  document.querySelectorAll(".stage-item.task-drag-over-before,.stage-item.task-drag-over-after").forEach(item=>item.classList.remove("task-drag-over-before","task-drag-over-after"));
  const rect=row.getBoundingClientRect();
  row.classList.add(event.clientY>rect.top+rect.height/2?"task-drag-over-after":"task-drag-over-before");
  event.dataTransfer.dropEffect="move";
});
document.getElementById("drawerContent").addEventListener("drop",event=>{
  const row=event.target.closest(".stage-item");
  if(!draggedTask||!row||row.dataset.project!==draggedTask.projectId)return;
  event.preventDefault();
  const rect=row.getBoundingClientRect();
  moveTask(draggedTask.projectId,draggedTask.key,row.dataset.taskKey,event.clientY>rect.top+rect.height/2);
  draggedTask=null;
});
document.getElementById("drawerContent").addEventListener("dragend",()=>{
  draggedTask=null;
  document.querySelectorAll(".stage-item.task-dragging,.stage-item.task-drag-over-before,.stage-item.task-drag-over-after").forEach(item=>item.classList.remove("task-dragging","task-drag-over-before","task-drag-over-after"));
});
document.getElementById("drawerContent").addEventListener("keydown",event=>{
  const handle=event.target.closest(".task-drag-handle");
  if(!handle||!authUser||!['ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();
  const project=projects.find(item=>item.id===handle.dataset.project);
  const index=project?.tasks?.findIndex(item=>item.key===handle.dataset.reorderTask)??-1;
  const targetIndex=event.key==='ArrowUp'?index-1:index+1;
  if(index<0||targetIndex<0||targetIndex>=project.tasks.length)return;
  const targetKey=project.tasks[targetIndex].key;
  if(moveTask(project.id,handle.dataset.reorderTask,targetKey,event.key==='ArrowDown')){
    requestAnimationFrame(()=>document.querySelector(`[data-reorder-task="${CSS.escape(handle.dataset.reorderTask)}"]`)?.focus());
  }
});
render();
setTargetNextVisibility(localStorage.getItem(TARGET_NEXT_HIDDEN_KEY)==="true");
refreshAuth();
let realtimeDashboardDay=todayISO();
setInterval(()=>{
  const currentDay=todayISO();
  if(currentDay===realtimeDashboardDay)return;
  realtimeDashboardDay=currentDay;
  updateReportDate();
  render();
},60000);
