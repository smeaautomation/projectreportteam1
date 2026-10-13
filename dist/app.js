const REPORT_DATE = "2026-09-29";
const REPORT_TARGET_DATE = "2026-10-06";
const STATUS_VALUE = { todo: 0, active: .5, done: 1 };
const STORAGE_KEY = "team1-weekly-progress-v2";
let currentFilter = "Semua";
let searchQuery = "";

const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const task = (key, name, short, status, context) => ({ key, name, short, status, context });
const weeklyProjects = [
  {
    id: "team1-calculator", name: "Kalkulator Premi Jasindo Travel", owner: "Dita & Restu", category: "Digital Product",
    start: "2026-09-22", end: REPORT_TARGET_DATE, priority: "Tinggi", source: "Weekly Report Team 1",
    tasks: [
      task("url", "Rekomendasi URL untuk web app kalkulator premi", "URL", "done", "Target minggu lalu"),
      task("uiux", "Referensi UI/UX lain yang lebih modern", "UI/UX", "done", "Target minggu lalu"),
      task("excel", "Excel kalkulator premi untuk penyesuaian tarif Travel Safe", "Excel", "done", "Tambahan di luar target"),
      task("landing", "Usulan landing page kalkulator premi", "Landing", "todo", "Target 7 hari"),
      task("deploy", "Deployment ke domain asuransijasindo.co.id", "Deploy", "active", "Tidak tercapai • Target 7 hari")
    ]
  },
  {
    id: "team1-book", name: "Buku Otomatisasi Underwriting", owner: "Dita", category: "Dokumentasi",
    start: "2026-09-22", end: REPORT_TARGET_DATE, priority: "Normal", source: "Weekly Report Team 1",
    tasks: [
      task("discussion", "Diskusi dengan GH", "Diskusi", "done", "Target minggu lalu • GH mereviu mandiri"),
      task("revision", "Perbaikan sebagai hasil diskusi dengan GH", "Perbaikan", "todo", "Target 7 hari")
    ]
  },
  {
    id: "team1-retail-web", name: "Web Asuransi Ritel", owner: "Restu", category: "Web Platform",
    start: "2026-09-22", end: REPORT_TARGET_DATE, priority: "Tinggi", source: "Weekly Report Team 1",
    tasks: [
      task("socialization", "Sosialisasi Web #1", "Sosial", "done", "Target minggu lalu"),
      task("uat", "UAT terakhir semua produk - flow Internal dan Eksternal", "UAT", "done", "Target minggu lalu"),
      task("brd", "Draft #2 BRD Flow Internal, Eksternal, dan Rekanan", "BRD", "done", "Target minggu lalu"),
      task("tripguard", "Mapping field untuk flow Rekanan produk Trip Guard", "Mapping", "active", "Sedang dikerjakan"),
      task("travelsafe", "Pembaruan perhitungan Travel Safe", "Travel", "todo", "Target 7 hari"),
      task("feedback", "Perbaikan web berdasarkan feedback saat sosialisasi", "Feedback", "active", "Tidak tercapai • Target 7 hari"),
      task("testcase", "Dokumentasi test case semua produk", "TC", "todo", "Target 7 hari"),
      task("cob728", "Finalisasi dokumentasi mapping dummy web rekanan COB 728", "COB 728", "todo", "Target 7 hari")
    ]
  },
  {
    id: "team1-operations", name: "Monitoring Operasional", owner: "Dita & Restu", category: "Operasional",
    start: REPORT_DATE, end: REPORT_TARGET_DATE, priority: "Normal", source: "Weekly Report Team 1",
    tasks: [task("asana", "Merapikan tasklist di Asana", "Asana", "todo", "Target 7 hari")]
  }
];

let projects = loadProjects();
function normalizeProjects(items){ return items.map(project=>({...project,tasks:(project.tasks||[]).map(item=>({...item,status:item.status==="blocked"?"active":Object.hasOwn(STATUS_VALUE,item.status)?item.status:"todo"}))})); }
function loadProjects(){ try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return normalizeProjects(Array.isArray(saved) ? saved : structuredClone(weeklyProjects)); } catch { return normalizeProjects(structuredClone(weeklyProjects)); } }
function saveProjects(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); }
function allTasks(){ return projects.flatMap(project => project.tasks || []); }
function progressOf(project){ const tasks = project.tasks || []; return tasks.length ? Math.round(tasks.reduce((total, item) => total + (STATUS_VALUE[item.status] || 0), 0) / tasks.length * 100) : 0; }
function stateOf(project){ const tasks=project.tasks||[]; if(tasks.length&&tasks.every(item=>item.status==="done"))return "Done"; if(tasks.some(item=>item.status!=="todo"))return "On going"; return "Not Started"; }
function daysUntil(date){ const a = new Date(); a.setHours(0,0,0,0); return Math.ceil((new Date(date+"T00:00:00") - a)/86400000); }
function formatDate(date, long=false){ return new Intl.DateTimeFormat("id-ID", long ? {day:"numeric",month:"long",year:"numeric"}:{day:"numeric",month:"short",year:"numeric"}).format(new Date(date+"T00:00:00")); }
function initials(name){ return name.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase(); }
function escapeHTML(str){ return String(str).replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function upcomingTasks(project){ return (project.tasks || []).filter(item => item.status !== "done"); }

function render(){
  const filtered = projects.filter(p => {
    const searchable = `${p.name} ${p.owner} ${p.category} ${(p.tasks||[]).map(t=>t.name).join(" ")}`.toLowerCase();
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
  document.getElementById("projectList").innerHTML = filtered.map(projectRow).join("");
  document.getElementById("emptyState").hidden = filtered.length > 0;
  renderTargets(); renderDistribution();
}

function projectRow(project){
  const progress = progressOf(project);
  const tasks = project.tasks || [];
  const displayTasks = tasks;
  const timeline = displayTasks.map((item,index)=>{
    const stepPosition=displayTasks.length===1 ? 50 : index/(displayTasks.length-1)*100;
    const nextPosition=displayTasks.length===1 ? 50 : Math.min(100,(index+1)/(displayTasks.length-1)*100);
    return `<div class="timeline-node ${item.status}" style="--step-position:${stepPosition}%;--next-position:${nextPosition}%" title="${escapeHTML(item.short)}"><i></i><span>${escapeHTML(item.short)}</span></div>`;
  }).join("");
  return `<article class="project-row" data-id="${project.id}">
    <div class="project-main"><div><h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.category)} • ${escapeHTML(project.owner)}</p></div></div>
    <div class="progress-cell"><div class="progress-track"><i style="width:${progress}%"></i></div><strong>${progress}%</strong></div>
    <div class="timeline-steps ${displayTasks.length>6?'timeline-dense':''}" aria-label="Aktivitas ${escapeHTML(project.name)}">${timeline}</div>
    <div class="deadline-cell"><strong>${formatDate(project.end)}</strong><span class="snapshot-label">Target 7 hari</span></div>
    <button class="more-btn" data-open-project="${project.id}" aria-label="Buka detail ${escapeHTML(project.name)}">›</button>
  </article>`;
}

function renderTargets(){
  const items = projects.map(p=>({project:p,tasks:upcomingTasks(p)})).filter(x=>x.tasks.length);
  document.getElementById("deadlineList").innerHTML = items.length ? items.map(({project,tasks},i)=>{
    const taskList = tasks.map(task=>`<li>${escapeHTML(task.name)}</li>`).join("");
    return `<div class="deadline-item"><div class="deadline-date"><strong>${i+1}</strong></div><div><h3>${escapeHTML(project.name)}</h3><ul class="deadline-task-list">${taskList}</ul></div></div>`;
  }).join("") : `<div class="empty-state"><p>Semua pekerjaan sudah selesai.</p></div>`;
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
  const colors={Done:"var(--green)","On going":"var(--blue)","Not Started":"#dfe6e4"};
  document.getElementById("distributionLegend").innerHTML=Object.entries(counts).map(([label,value])=>`<div class="legend-item"><i style="background:${colors[label]}"></i><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function createDefaultTasks(){
  return [
    task("planning","Perencanaan dan ruang lingkup","Plan","todo","Project baru"),
    task("design","Desain solusi","Desain","todo","Project baru"),
    task("development","Implementasi","Build","todo","Project baru"),
    task("testing","Pengujian","Test","todo","Project baru"),
    task("final","Finalisasi","Final","todo","Project baru")
  ];
}

function openModal(project=null){
  const form=document.getElementById("projectForm"); form.reset();
  document.getElementById("projectId").value=project?.id || "";
  document.getElementById("modalTitle").textContent=project ? "Edit informasi project" : "Tambahkan pekerjaan";
  document.querySelector('.modal-actions .primary-btn').innerHTML=project ? 'Simpan Perubahan <span>→</span>' : 'Buat Project <span>→</span>';
  document.getElementById("projectStart").value=project?.start || new Date().toISOString().slice(0,10);
  document.getElementById("projectEnd").value=project?.end || addDays(new Date(),7);
  if(project){
    document.getElementById("projectName").value=project.name; document.getElementById("projectOwner").value=project.owner;
    document.getElementById("projectCategory").value=[...document.getElementById("projectCategory").options].some(o=>o.value===project.category)?project.category:"Lainnya";
    document.querySelector(`input[name="priority"][value="${project.priority}"]`).checked=true;
  }
  document.getElementById("projectModal").hidden=false; setTimeout(()=>document.getElementById("projectName").focus(),50);
}
function closeModal(){document.getElementById("projectModal").hidden=true;}
function showToast(message){const toast=document.getElementById("toast");toast.querySelector("p").textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2600);}

function openTaskModal(projectId,index=null){
  const project=projects.find(item=>item.id===projectId); if(!project)return;
  const item=index===null?null:project.tasks?.[index];
  const form=document.getElementById("taskForm"); form.reset();
  document.getElementById("taskProjectId").value=projectId;
  document.getElementById("taskIndex").value=index===null?"":String(index);
  document.getElementById("taskModalTitle").textContent=item?"Edit aktivitas":"Tambah aktivitas";
  document.getElementById("deleteTaskBtn").hidden=!item;
  document.getElementById("taskName").value=item?.name||"";
  document.getElementById("taskShort").value=item?.short||"";
  document.getElementById("taskStatus").value=item?.status||"todo";
  document.getElementById("taskContext").value=item?.context||"";
  document.getElementById("taskModal").hidden=false;
  setTimeout(()=>document.getElementById("taskName").focus(),50);
}
function closeTaskModal(){document.getElementById("taskModal").hidden=true;}

function openDrawer(id){
  const project=projects.find(x=>x.id===id); if(!project)return; const progress=progressOf(project);
  document.getElementById("drawerTitle").textContent=project.name;
  document.getElementById("drawerContent").innerHTML=`
    <div class="drawer-progress"><div class="big-progress"><div><span>PROGRES KESELURUHAN</span><strong>${progress}%</strong></div><span>${progress===100?"Semua item selesai":`${100-progress}% menuju final`}</span></div><div class="progress-track"><i style="width:${progress}%"></i></div></div>
    <div class="drawer-meta"><div><span>PIC</span><strong>${escapeHTML(project.owner)}</strong></div><div><span>Target</span><strong>${formatDate(project.end)}</strong></div><div><span>Status</span><strong>${stateOf(project)}</strong></div></div>
    <p class="drawer-source-note"><strong>Sumber:</strong> ${escapeHTML(project.source || "Input dashboard")} • Snapshot 29 September 2026. Status dan detail aktivitas dapat diperbarui langsung dari daftar di bawah.</p>
    <div class="stage-heading"><div><h3>Aktivitas</h3><span>Edit status atau detail setiap aktivitas</span></div><button class="task-add-btn" data-add-task="${project.id}">＋ Tambah Aktivitas</button></div>
    <div class="stage-list">${(project.tasks||[]).map((item,index)=>`<div class="stage-item ${item.status}"><div class="stage-number">${item.status==='done'?'✓':index+1}</div><div><h4>${escapeHTML(item.name)}</h4><p><span class="status-context">${escapeHTML(item.context)}</span> • Kontribusi ${Math.round(100/project.tasks.length)}%</p></div><div class="stage-controls"><select class="stage-select" data-project="${project.id}" data-task-index="${index}" aria-label="Status ${escapeHTML(item.name)}"><option value="done" ${item.status==='done'?'selected':''}>Done</option><option value="active" ${item.status==='active'?'selected':''}>On going</option><option value="todo" ${item.status==='todo'?'selected':''}>Not Started</option></select><button class="task-edit-btn" data-edit-task="${index}" data-project="${project.id}" aria-label="Edit aktivitas ${escapeHTML(item.name)}" title="Edit aktivitas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.7 4.7L8 20l10.8-10.8a2.1 2.1 0 0 0-3-3L4 16Z"/><path d="m14.5 7.5 3 3"/></svg></button></div></div>`).join("")}</div>
    ${(project.tasks||[]).length?"":'<div class="empty-task-state">Belum ada aktivitas. Klik “Tambah Aktivitas” untuk memulai.</div>'}
    <div class="danger-zone"><button class="secondary-btn" data-edit-project="${project.id}">Edit informasi</button><button class="danger-btn" data-delete-project="${project.id}">Hapus project</button></div>`;
  document.getElementById("detailDrawer").hidden=false;
}
function closeDrawer(){document.getElementById("detailDrawer").hidden=true;}

function syncView(){
  const isWorkstream=location.hash==="#project";
  document.body.classList.toggle("workstream-view",isWorkstream);
  document.body.classList.toggle("dashboard-view",!isWorkstream);
  document.getElementById("pageEyebrow").textContent="TEAM 1";
  document.getElementById("pageTitle").textContent="SME UNDERWRITING & ADMINISTRATION";
  document.getElementById("pageSubtitle").textContent="WEEKLY REPORT";
  document.getElementById("workstreamSectionTitle").textContent=isWorkstream?"Draft Project":"Progress Project";
  document.getElementById("workstreamSectionDescription").textContent=isWorkstream?"Daftar rancangan project yang dapat ditinjau dan diperbarui":"Ringkasan progres seluruh pekerjaan";
  const fab=document.getElementById("workstreamFab");
  const label=isWorkstream?"Kembali ke dashboard":"Buka draft project";
  fab.href=isWorkstream?"#dashboard-app":"#project";
  fab.setAttribute("aria-label",label);
  fab.title=label;
  document.getElementById("workstreamFabLabel").textContent=label;
  if(!isWorkstream&&(currentFilter!=="Semua"||searchQuery)){
    currentFilter="Semua";searchQuery="";document.getElementById("searchInput").value="";
    document.querySelectorAll(".filter-chip").forEach(chip=>chip.classList.toggle("active",chip.dataset.filter==="Semua"));
    render();
  }
  window.scrollTo(0,0);
}

document.getElementById("currentDate").textContent="Laporan 13 Oktober 2026  •  Team 1  •  Dita & Restu";
document.getElementById("targetSubtitle").textContent=`Semua pekerjaan yang belum selesai per ${new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(new Date())}`;
document.getElementById("addProjectBtn").addEventListener("click",()=>openModal());
document.querySelectorAll("[data-close-modal]").forEach(button=>button.addEventListener("click",closeModal));
document.querySelectorAll("[data-close-task]").forEach(button=>button.addEventListener("click",closeTaskModal));
document.getElementById("closeDrawer").addEventListener("click",closeDrawer);
document.getElementById("projectModal").addEventListener("click",event=>{if(event.target.id==="projectModal")closeModal()});
document.getElementById("taskModal").addEventListener("click",event=>{if(event.target.id==="taskModal")closeTaskModal()});
document.getElementById("detailDrawer").addEventListener("click",event=>{if(event.target.id==="detailDrawer")closeDrawer()});
window.addEventListener("hashchange",syncView);
document.addEventListener("keydown",event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();document.getElementById("searchInput").focus()}if(event.key==="Escape"){closeTaskModal();closeModal();closeDrawer();}});
document.getElementById("searchInput").addEventListener("input",event=>{searchQuery=event.target.value.trim().toLowerCase();render()});
document.querySelectorAll(".filter-chip,.filter-nav").forEach(button=>button.addEventListener("click",()=>{currentFilter=button.dataset.filter;document.querySelectorAll(".filter-chip").forEach(chip=>chip.classList.toggle("active",chip.dataset.filter===currentFilter));render();if(button.classList.contains("filter-nav"))document.querySelector(".sidebar").classList.remove("open");}));

document.getElementById("projectForm").addEventListener("submit",event=>{
  event.preventDefault(); const start=document.getElementById("projectStart").value,end=document.getElementById("projectEnd").value;
  if(new Date(end)<new Date(start)){showToast("Target selesai harus setelah tanggal mulai.");return;}
  const editId=document.getElementById("projectId").value;
  const old=projects.find(project=>project.id===editId);
  const project={id:editId || `project-${Date.now()}`,name:document.getElementById("projectName").value.trim(),owner:document.getElementById("projectOwner").value.trim(),category:document.getElementById("projectCategory").value,start,end,priority:document.querySelector('input[name="priority"]:checked').value,source:old?.source || "Input dashboard",tasks:old?.tasks || createDefaultTasks()};
  if(old) projects=projects.map(item=>item.id===editId?project:item); else projects.unshift(project);
  saveProjects();closeModal();render();showToast(old ? "Informasi project diperbarui." : `Project “${project.name}” berhasil dibuat.`);setTimeout(()=>openDrawer(project.id),350);
});

document.getElementById("taskForm").addEventListener("submit",event=>{
  event.preventDefault();
  const projectId=document.getElementById("taskProjectId").value;
  const project=projects.find(item=>item.id===projectId); if(!project)return;
  const indexValue=document.getElementById("taskIndex").value;
  const index=indexValue===""?null:Number(indexValue);
  const previous=index===null?null:project.tasks[index];
  const activity={key:previous?.key||`activity-${Date.now()}`,name:document.getElementById("taskName").value.trim(),short:document.getElementById("taskShort").value.trim(),status:document.getElementById("taskStatus").value,context:document.getElementById("taskContext").value.trim()};
  if(index===null)project.tasks.push(activity);else project.tasks[index]=activity;
  saveProjects();closeTaskModal();render();openDrawer(projectId);showToast(index===null?"Aktivitas berhasil ditambahkan.":"Aktivitas berhasil diperbarui.");
});

document.getElementById("deleteTaskBtn").addEventListener("click",()=>{
  const projectId=document.getElementById("taskProjectId").value;
  const index=Number(document.getElementById("taskIndex").value);
  const project=projects.find(item=>item.id===projectId); const item=project?.tasks?.[index]; if(!item)return;
  if(confirm(`Hapus aktivitas “${item.name}”?`)){project.tasks.splice(index,1);saveProjects();closeTaskModal();render();openDrawer(projectId);showToast("Aktivitas dihapus.");}
});

document.getElementById("projectList").addEventListener("click",event=>{const button=event.target.closest("[data-open-project]");if(button)openDrawer(button.dataset.openProject);});
document.getElementById("drawerContent").addEventListener("change",event=>{if(!event.target.matches(".stage-select"))return;const project=projects.find(item=>item.id===event.target.dataset.project);project.tasks[Number(event.target.dataset.taskIndex)].status=event.target.value;saveProjects();render();openDrawer(project.id);showToast("Progress project diperbarui.");});
document.getElementById("drawerContent").addEventListener("click",event=>{
  const addTask=event.target.closest("[data-add-task]"); if(addTask){openTaskModal(addTask.dataset.addTask);return;}
  const editTask=event.target.closest("[data-edit-task]"); if(editTask){openTaskModal(editTask.dataset.project,Number(editTask.dataset.editTask));return;}
  const remove=event.target.closest("[data-delete-project]"); if(remove){const project=projects.find(item=>item.id===remove.dataset.deleteProject);if(confirm(`Hapus project “${project.name}”?`)){projects=projects.filter(item=>item.id!==project.id);saveProjects();closeDrawer();render();showToast("Project dihapus.");}}
  const edit=event.target.closest("[data-edit-project]"); if(edit){const project=projects.find(item=>item.id===edit.dataset.editProject);closeDrawer();openModal(project);}
});
document.getElementById("resetDemoBtn").addEventListener("click",()=>{projects=structuredClone(weeklyProjects);saveProjects();currentFilter="Semua";searchQuery="";document.getElementById("searchInput").value="";document.querySelectorAll(".filter-chip").forEach(chip=>chip.classList.toggle("active",chip.dataset.filter==="Semua"));render();showToast("Data Weekly Report Team 1 dimuat ulang.");});
syncView();
render();
