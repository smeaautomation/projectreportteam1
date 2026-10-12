const STAGES = [
  { key: "planning", name: "Perencanaan", short: "Plan", weight: 10 },
  { key: "design", name: "Desain", short: "Desain", weight: 20 },
  { key: "development", name: "Pengembangan", short: "Build", weight: 35 },
  { key: "testing", name: "Pengujian", short: "Test", weight: 20 },
  { key: "final", name: "Finalisasi", short: "Final", weight: 15 }
];

const STATUS_VALUE = { todo: 0, active: .5, done: 1 };
const STORAGE_KEY = "alur-projects-v1";
let currentFilter = "Semua";
let searchQuery = "";

const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const now = new Date();
const demoProjects = [
  { id:"p-website", name:"Website Company Profile", owner:"Dimas Pratama", category:"Website", start:addDays(now,-24), end:addDays(now,18), priority:"Tinggi", stages:{planning:"done",design:"done",development:"active",testing:"todo",final:"todo"}},
  { id:"p-mobile", name:"Aplikasi Mobile Pelanggan", owner:"Nadia Putri", category:"Mobile App", start:addDays(now,-42), end:addDays(now,9), priority:"Tinggi", stages:{planning:"done",design:"done",development:"done",testing:"active",final:"todo"}},
  { id:"p-campaign", name:"Kampanye Q4 Digital", owner:"Rizky Akbar", category:"Marketing", start:addDays(now,-16), end:addDays(now,34), priority:"Normal", stages:{planning:"done",design:"active",development:"todo",testing:"todo",final:"todo"}},
  { id:"p-system", name:"Migrasi Sistem Internal", owner:"Sarah Wijaya", category:"Internal", start:addDays(now,-61), end:addDays(now,-2), priority:"Normal", stages:{planning:"done",design:"done",development:"done",testing:"done",final:"done"}}
];

let projects = loadProjects();
function loadProjects(){ try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(saved) ? saved : demoProjects; } catch { return demoProjects; } }
function saveProjects(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); }
function progressOf(project){ return Math.round(STAGES.reduce((total, stage) => total + stage.weight * (STATUS_VALUE[project.stages[stage.key]] || 0), 0)); }
function stateOf(project){ const progress = progressOf(project); if(progress === 100) return "Selesai"; const left = daysUntil(project.end); if(left < 0 || (left <= 7 && progress < 75)) return "Berisiko"; return "Berjalan"; }
function daysUntil(date){ const a = new Date(); a.setHours(0,0,0,0); return Math.ceil((new Date(date+"T00:00:00") - a)/86400000); }
function formatDate(date, long=false){ return new Intl.DateTimeFormat("id-ID", long ? {day:"numeric",month:"long",year:"numeric"}:{day:"numeric",month:"short",year:"numeric"}).format(new Date(date+"T00:00:00")); }
function initials(name){ return name.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase(); }
function escapeHTML(str){ return String(str).replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }

function render(){
  const filtered = projects.filter(p => (currentFilter === "Semua" || stateOf(p) === currentFilter) && `${p.name} ${p.owner} ${p.category}`.toLowerCase().includes(searchQuery));
  document.getElementById("navProjectCount").textContent = projects.length;
  document.getElementById("totalProjects").textContent = projects.length;
  const active = projects.filter(p=>progressOf(p)<100).length;
  document.getElementById("activeSummary").textContent = `${active} proyek aktif`;
  const avg = projects.length ? Math.round(projects.reduce((s,p)=>s+progressOf(p),0)/projects.length) : 0;
  document.getElementById("avgProgress").textContent = `${avg}%`;
  const completed = projects.filter(p=>progressOf(p)===100).length;
  document.getElementById("completedProjects").textContent = completed;
  document.getElementById("completedSummary").textContent = completed ? `${completed} berhasil mencapai final` : "Belum ada proyek final";
  const rate = projects.length ? Math.round(completed/projects.length*100) : 0;
  document.getElementById("completionRate").textContent = `${rate}%`;
  document.getElementById("completionRing").style.setProperty("--ring", `${rate}%`);
  document.getElementById("projectList").innerHTML = filtered.map(projectRow).join("");
  document.getElementById("emptyState").hidden = filtered.length > 0;
  renderDeadlines(); renderDistribution();
}

function projectRow(project, idx){
  const progress = progressOf(project), left = daysUntil(project.end), state = stateOf(project);
  const badgeClass = ["","coral","blue"][idx%3];
  const timeline = STAGES.map(stage=>`<div class="timeline-node ${project.stages[stage.key]}"><i></i><span>${stage.short}</span></div>`).join("");
  const dueText = left < 0 ? `Terlambat ${Math.abs(left)} hari` : left === 0 ? "Hari ini" : `${left} hari lagi`;
  return `<article class="project-row" data-id="${project.id}">
    <div class="project-main"><div class="project-badge ${badgeClass}">${initials(project.name)}</div><div><h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.category)} • ${escapeHTML(project.owner)}</p></div></div>
    <div class="progress-cell"><div class="progress-track"><i style="width:${progress}%"></i></div><strong>${progress}%</strong></div>
    <div class="timeline-steps" aria-label="Timeline ${escapeHTML(project.name)}">${timeline}</div>
    <div class="deadline-cell ${state==='Berisiko'?'urgent':''}"><strong>${formatDate(project.end)}</strong><span>${dueText}</span></div>
    <button class="more-btn" data-open-project="${project.id}" aria-label="Buka detail ${escapeHTML(project.name)}">›</button>
  </article>`;
}

function renderDeadlines(){
  const items = [...projects].filter(p=>progressOf(p)<100).sort((a,b)=>new Date(a.end)-new Date(b.end)).slice(0,3);
  document.getElementById("deadlineList").innerHTML = items.length ? items.map(p=>{
    const d=new Date(p.end+"T00:00:00"), left=daysUntil(p.end), label=left<0?`${Math.abs(left)} hari terlambat`:left===0?"Hari ini":`${left} hari lagi`;
    return `<div class="deadline-item"><div class="deadline-date"><strong>${d.getDate()}</strong><span>${d.toLocaleDateString("id-ID",{month:"short"}).toUpperCase()}</span></div><div><h3>${escapeHTML(p.name)}</h3><p>${progressOf(p)}% selesai • ${escapeHTML(p.owner)}</p></div><span>${label}</span></div>`;
  }).join("") : `<div class="empty-state"><p>Tidak ada deadline aktif.</p></div>`;
}

function renderDistribution(){
  const counts = {Selesai:0,Berjalan:0,Berisiko:0}; projects.forEach(p=>counts[stateOf(p)]++);
  const total = projects.length || 1, p1=counts.Selesai/total*360, p2=p1+counts.Berjalan/total*360, p3=p2+counts.Berisiko/total*360;
  const donut=document.getElementById("distributionDonut"); donut.style.setProperty("--p1",`${p1}deg`);donut.style.setProperty("--p2",`${p2}deg`);donut.style.setProperty("--p3",`${p3}deg`);
  document.getElementById("donutTotal").textContent=projects.length;
  const colors={Selesai:"var(--green)",Berjalan:"var(--blue)",Berisiko:"var(--amber)"};
  document.getElementById("distributionLegend").innerHTML=Object.entries(counts).map(([k,v])=>`<div class="legend-item"><i style="background:${colors[k]}"></i><span>${k}</span><strong>${v}</strong></div>`).join("");
}

function openModal(project=null){
  const form=document.getElementById("projectForm"); form.reset();
  document.getElementById("projectId").value=project?.id || "";
  document.getElementById("modalTitle").textContent=project ? "Edit informasi proyek" : "Mulai perjalanan baru";
  document.querySelector('.modal-actions .primary-btn').innerHTML=project ? 'Simpan Perubahan <span>→</span>' : 'Buat Proyek <span>→</span>';
  document.getElementById("projectStart").value=project?.start || new Date().toISOString().slice(0,10);
  document.getElementById("projectEnd").value=project?.end || addDays(new Date(),45);
  if(project){
    document.getElementById("projectName").value=project.name; document.getElementById("projectOwner").value=project.owner;
    document.getElementById("projectCategory").value=project.category; document.querySelector(`input[name="priority"][value="${project.priority}"]`).checked=true;
  }
  document.getElementById("projectModal").hidden=false; setTimeout(()=>document.getElementById("projectName").focus(),50);
}
function closeModal(){document.getElementById("projectModal").hidden=true;}
function showToast(message){const t=document.getElementById("toast");t.querySelector("p").textContent=message;t.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove("show"),2600);}

function openDrawer(id){
  const p=projects.find(x=>x.id===id); if(!p)return; const progress=progressOf(p);
  document.getElementById("drawerTitle").textContent=p.name;
  document.getElementById("drawerContent").innerHTML=`
    <div class="drawer-progress"><div class="big-progress"><div><span>PROGRES KESELURUHAN</span><strong>${progress}%</strong></div><span>${progress===100?"Proyek telah final":`${100-progress}% menuju final`}</span></div><div class="progress-track"><i style="width:${progress}%"></i></div></div>
    <div class="drawer-meta"><div><span>PIC</span><strong>${escapeHTML(p.owner)}</strong></div><div><span>Deadline</span><strong>${formatDate(p.end)}</strong></div><div><span>Status</span><strong>${stateOf(p)}</strong></div></div>
    <div class="stage-heading"><h3>Tahapan proyek</h3><span>Ubah status untuk update progres</span></div>
    <div class="stage-list">${STAGES.map((s,i)=>`<div class="stage-item ${p.stages[s.key]}"><div class="stage-number">${p.stages[s.key]==='done'?'✓':i+1}</div><div><h4>${s.name}</h4><p>Bobot ${s.weight}% dari total proyek</p></div><select class="stage-select" data-project="${p.id}" data-stage="${s.key}" aria-label="Status ${s.name}"><option value="todo" ${p.stages[s.key]==='todo'?'selected':''}>Belum mulai</option><option value="active" ${p.stages[s.key]==='active'?'selected':''}>Dikerjakan</option><option value="done" ${p.stages[s.key]==='done'?'selected':''}>Selesai</option></select></div>`).join("")}</div>
    <div class="danger-zone"><button class="secondary-btn" data-edit-project="${p.id}">Edit informasi</button><button class="danger-btn" data-delete-project="${p.id}">Hapus proyek</button></div>`;
  document.getElementById("detailDrawer").hidden=false;
}
function closeDrawer(){document.getElementById("detailDrawer").hidden=true;}

document.getElementById("currentDate").textContent=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
document.getElementById("addProjectBtn").addEventListener("click",()=>openModal());
document.querySelectorAll("[data-close-modal]").forEach(b=>b.addEventListener("click",closeModal));
document.getElementById("closeDrawer").addEventListener("click",closeDrawer);
document.getElementById("projectModal").addEventListener("click",e=>{if(e.target.id==="projectModal")closeModal()});
document.getElementById("detailDrawer").addEventListener("click",e=>{if(e.target.id==="detailDrawer")closeDrawer()});
document.getElementById("menuBtn").addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));
document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();document.getElementById("searchInput").focus()}if(e.key==="Escape"){closeModal();closeDrawer();}});
document.getElementById("searchInput").addEventListener("input",e=>{searchQuery=e.target.value.trim().toLowerCase();render()});
document.querySelectorAll(".filter-chip,.filter-nav").forEach(b=>b.addEventListener("click",()=>{currentFilter=b.dataset.filter;document.querySelectorAll(".filter-chip").forEach(x=>x.classList.toggle("active",x.dataset.filter===currentFilter));render();if(b.classList.contains("filter-nav"))document.querySelector(".sidebar").classList.remove("open");}));

document.getElementById("projectForm").addEventListener("submit",e=>{
  e.preventDefault(); const start=document.getElementById("projectStart").value,end=document.getElementById("projectEnd").value;
  if(new Date(end)<new Date(start)){showToast("Target selesai harus setelah tanggal mulai.");return;}
  const editId=document.getElementById("projectId").value;
  const old=projects.find(p=>p.id===editId);
  const project={id:editId || `p-${Date.now()}`,name:document.getElementById("projectName").value.trim(),owner:document.getElementById("projectOwner").value.trim(),category:document.getElementById("projectCategory").value,start,end,priority:document.querySelector('input[name="priority"]:checked').value,stages:old?.stages || {planning:"todo",design:"todo",development:"todo",testing:"todo",final:"todo"}};
  if(old) projects=projects.map(p=>p.id===editId?project:p); else projects.unshift(project);
  saveProjects();closeModal();render();showToast(old ? "Informasi proyek berhasil diperbarui." : `Proyek “${project.name}” berhasil dibuat.`);setTimeout(()=>openDrawer(project.id),350);
});

document.getElementById("projectList").addEventListener("click",e=>{const btn=e.target.closest("[data-open-project]");if(btn)openDrawer(btn.dataset.openProject);});
document.getElementById("drawerContent").addEventListener("change",e=>{if(!e.target.matches(".stage-select"))return;const p=projects.find(x=>x.id===e.target.dataset.project);p.stages[e.target.dataset.stage]=e.target.value;saveProjects();render();openDrawer(p.id);showToast("Progres proyek diperbarui.");});
document.getElementById("drawerContent").addEventListener("click",e=>{
  const del=e.target.closest("[data-delete-project]"); if(del){const p=projects.find(x=>x.id===del.dataset.deleteProject);if(confirm(`Hapus proyek “${p.name}”?`)){projects=projects.filter(x=>x.id!==p.id);saveProjects();closeDrawer();render();showToast("Proyek dihapus.");}}
  const edit=e.target.closest("[data-edit-project]"); if(edit){const p=projects.find(x=>x.id===edit.dataset.editProject);closeDrawer();openModal(p);}
});
document.getElementById("resetDemoBtn").addEventListener("click",()=>{projects=JSON.parse(JSON.stringify(demoProjects));saveProjects();currentFilter="Semua";searchQuery="";document.getElementById("searchInput").value="";document.querySelectorAll(".filter-chip").forEach(x=>x.classList.toggle("active",x.dataset.filter==="Semua"));render();showToast("Data contoh berhasil dipulihkan.");});
document.getElementById("helpBtn").addEventListener("click",()=>showToast("Klik proyek untuk mengubah status setiap tahap."));
render();
