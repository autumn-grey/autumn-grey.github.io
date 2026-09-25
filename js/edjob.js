// ======================================================================
// EDUCATION & JOB
// ======================================================================

/** Returns the faculty heading a course sits under. */
function edJobFaculty(cb){
  const topic=cb.closest(".education-topic");
  return topic?.querySelector("summary")?.textContent.trim()||"Other";
}
/** Returns every course with its state, length, prerequisites and rewards. */
function edJobCourses(){
  const info=(window.live&&window.live.courseInfo)||{};
  return [...document.querySelectorAll(".education-course-check")].map(cb=>{
    const extra=info[cb.id]||{};
    return {
      id:cb.id,
      name:(cb.dataset.course||"").trim(),
      faculty:edJobFaculty(cb),
      done:cb.checked,
      days:courseDaysFor(cb.id),
      needs:extra.needs||[],
      gains:extra.gains||[]
    };
  });
}
/** Returns the days a course takes this player after reductions. */
function edJobCourseDays(course){
  return course.days*(1-educationTimeReduction())*educationJpFactor();
}
/** Says whether every prerequisite of a course is done. */
function edJobUnlocked(course,have){
  return course.needs.every(n=>have.has(n));
}
/** Formats a course length as days, or weeks and days. */
function edJobDays(days){
  const d=Math.round(days);
  if(!(d>0)) return "-";
  if(d<14) return `${d} day${d===1?"":"s"}`;
  const weeks=Math.floor(d/7), rest=d%7;
  return `${weeks} week${weeks===1?"":"s"}`+(rest?` ${rest} day${rest===1?"":"s"}`:"");
}

// ----------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------
/** Formats a day count as "Xy Ym Zd". */
function edJobYmd(days){
  const p=durationParts(days);
  return p?`${p.years}y ${p.months}m ${p.days}d`:"100+y";
}
/** Draws the Snapshot panel. */
function renderEdJobSummary(list){
  const box=$("edJobProgress");
  if(!box) return;
  const done=list.filter(c=>c.done), left=list.filter(c=>!c.done);
  const raw=arr=>arr.reduce((n,c)=>n+c.days,0);
  const cut=arr=>arr.reduce((n,c)=>n+edJobCourseDays(c),0);
  const pct=n=>list.length?`${Math.round(n/list.length*100)}%`:"0%";
  const row=(title,count,days,share)=>
    `<div class="edjob-stat-title">${esc(title)}</div>`
    +`<span class="edjob-stat-num">${count}</span>`
    +`<span class="edjob-stat-time">${esc(edJobYmd(days))}</span>`
    +`<span class="edjob-stat-pct">${esc(share)}</span>`;
  box.innerHTML=`<div class="edjob-module-head"><span>Snapshot</span>`
    +`<span>${done.length}/${list.length}</span></div>`
    +`<div class="edjob-stats">`
    +row("Completed",done.length,cut(done),pct(done.length))
    +row("Remaining",left.length,cut(left),pct(left.length))
    +`<div class="edjob-stat-title">Saved</div>`
    +`<div class="edjob-stat-saved">`
    +`<span class="edjob-stat-num">${esc(edJobYmd(raw(done)-cut(done)))}<small>Saved so far</small></span>`
    +`<span class="edjob-stat-time">${esc(edJobYmd(raw(left)-cut(left)))}<small>Saved on remaining</small></span>`
    +`</div>`
    +`<div class="edjob-stat-title">Earliest completion</div>`
    +`<div class="edjob-stat-date">${esc(left.length?edJobFinishDate(cut(left)):"-")}</div>`
    +`</div>`;
}
/** Returns the date a number of days from today. */
function edJobFinishDate(days){
  const d=new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()+Math.round(days));
  return d.toISOString().slice(0,10);
}
/** Course names that give each perk category. */
const PERK_COURSES={
  "Company Ownership":[],
  "Crime":[],
  "Gym Gains":[],
  "Jail":[],
  "Medical":["Advanced Biochemistry","Intermediate Biochemistry","Intravenous Therapy"],
  "Passive Stats":[],
  "Profit":[],
  "Viruses":[]
};
/** Returns the courses the chosen perk categories point to, and the prerequisites they need. */
function edJobWanted(list){
  const byName=Object.fromEntries(list.map(c=>[c.name.toLowerCase(),c]));
  const byId=Object.fromEntries(list.map(c=>[c.id,c]));
  const out=new Map(), direct=[];
  (window.edJobPerkPrefs||[]).forEach(perk=>(PERK_COURSES[perk]||[]).forEach(n=>{
    const c=byName[String(n).toLowerCase()];
    if(c&&!out.has(c.id)){ out.set(c.id,{perk,direct:true}); direct.push(c) }
  }));
  const walk=(c,perk)=>c.needs.forEach(id=>{
    if(out.has(id)||!byId[id]) return;
    out.set(id,{perk,direct:false});
    walk(byId[id],perk);
  });
  direct.forEach(c=>walk(c,out.get(c.id).perk));
  return out;
}
/** Draws the course list, one block per faculty. */
function renderEdJobPicker(list){
  const box=$("edJobPicker");
  if(!box) return;
  const hide=boolVal("edJobHideDone");
  const find=String($("edJobFind")?.value||"").trim().toLowerCase();
  const have=new Set(list.filter(c=>c.done).map(c=>c.id));
  const name=Object.fromEntries(list.map(c=>[c.id,c.name]));
  const faculties=[...new Set(list.map(c=>c.faculty))];
  const wanted=edJobWanted(list);
  const html=faculties.map(faculty=>{
    const all=list.filter(c=>c.faculty===faculty);
    const shown=all.filter(c=>(!hide||!c.done)
      &&(!find||c.name.toLowerCase().includes(find)));
    if(!shown.length) return "";
    const todo=all.filter(c=>!c.done).length;
    const rows=shown.map(c=>{
      const open=edJobUnlocked(c,have);
      const blockers=c.needs.filter(n=>!have.has(n)).map(n=>name[n]).filter(Boolean);
      const notes=[];
      const want=wanted.get(c.id);
      if(!c.done&&blockers.length) notes.push(`needs ${blockers.join(", ")}`);
      c.gains.forEach(g=>notes.push(g));
      const tag=want?`<span class="edjob-course-tag">${esc(want.direct?want.perk:`needed for ${want.perk}`)}</span>`:"";
      return `<label class="edjob-course${c.done?" done":""}${!c.done&&!open?" locked":""}`
        +`${want?(want.direct?" wanted":" wanted-pre"):""}">`
        +`<input type="checkbox" class="edjob-course-check" data-course-id="${esc(c.id)}"`
        +`${c.done?" checked":""}>`
        +`<span class="edjob-course-name">${esc(c.name)}${tag}</span>`
        +`<span class="edjob-course-meta">${esc(edJobDays(edJobCourseDays(c)))}</span>`
        +(notes.length?`<span class="edjob-course-notes">${notes.map(n=>esc(n)).join(" · ")}</span>`:"")
        +`</label>`;
    }).join("");
    return `<details class="edjob-faculty"${todo?" open":""}>`
      +`<summary>${esc(faculty)}<span class="edjob-faculty-count">`
      +`${todo?`${todo} to do`:"all done"}</span></summary>`
      +`<div class="edjob-course-list">${rows}</div></details>`;
  }).join("");
  box.innerHTML=html||`<p class="help">Nothing matches that.</p>`;
}
/** Copies the Investments education settings into Education Boosters, with what each is worth. */
function syncEdJobSettings(){
  document.querySelectorAll("#pageEduJob [data-mirror]").forEach(el=>{
    const master=$(el.dataset.mirror);
    if(!master) return;
    if(el.type==="checkbox") el.checked=master.checked;
    else el.value=master.value;
  });
  const set=(id,t)=>{ const el=$(id); if(el) el.textContent=t };
  set("ejBoostTotal",`-${Math.round(educationTimeReduction()*100)}%`);
  set("ejCompanyEffect",hoursPerDayLabel(companyHoursPerDay()));
  set("ejMeritsEffect",`-${Math.round(+($("educationMerits")?.value||0)*EDU_MERIT_REDUCTION*100)}%`);
}
const PERK_CATEGORIES=["Company Ownership","Crime","Gym Gains","Jail","Medical",
  "Passive Stats","Profit","Viruses"];
try{ window.edJobPerkPrefs=JSON.parse(localStorage.getItem("tornInvPerkPrefs")||"[]")
  .filter(p=>PERK_CATEGORIES.includes(p)) }
catch(e){ window.edJobPerkPrefs=[]; logProblem("Perk preferences could not be read",e) }
/** Draws the perk preference list, chosen ones first in priority order. */
function renderEdJobPerks(){
  const box=$("edJobPerks");
  if(!box) return;
  const on=window.edJobPerkPrefs;
  const rest=PERK_CATEGORIES.filter(p=>!on.includes(p));
  const row=(p,i)=>i>=0
    ? `<li class="edjob-perk on" tabindex="0" role="button" aria-pressed="true" data-perk="${esc(p)}">`
      +`<span class="edjob-perk-grip" aria-hidden="true">⠿</span><span>${esc(p)}</span>`
      +`<span class="edjob-perk-rank">${i+1}</span></li>`
    : `<li class="edjob-perk" tabindex="0" role="button" aria-pressed="false" data-perk="${esc(p)}">`
      +`<span class="edjob-perk-grip" aria-hidden="true"></span><span>${esc(p)}</span></li>`;
  box.innerHTML=`<div class="edjob-module-head"><span>Perk preferences</span></div>`
    +`<ul class="edjob-perk-list">${on.map((p,i)=>row(p,i)).join("")}${rest.map(p=>row(p,-1)).join("")}</ul>`;
}
/** Chooses or unchooses a perk category. */
function toggleEdJobPerk(name){
  const on=window.edJobPerkPrefs, i=on.indexOf(name);
  if(i>=0) on.splice(i,1); else on.push(name);
  renderEdJobPerks();
  renderEdJobPicker(edJobCourses());
  focusEdJobPerk(name);
}
/** Puts keyboard focus back on a perk row after a redraw. */
function focusEdJobPerk(name){
  [...document.querySelectorAll("#edJobPerks .edjob-perk")].find(li=>li.dataset.perk===name)?.focus();
}
/** Draws the whole Education & Job page. */
function renderEdJob(){
  const list=edJobCourses();
  syncEdJobSettings();
  renderEdJobSummary(list);
  renderEdJobPerks();
  renderEdJobPicker(list);
}

// ----------------------------------------------------------------------
// Wiring
// ----------------------------------------------------------------------
/** Ticks the matching Investments course and redraws both pages. */
$("edJobPicker")?.addEventListener("change",e=>{
  const cb=e.target.closest(".edjob-course-check");
  if(!cb) return;
  const master=$(cb.dataset.courseId);
  if(!master) return;
  master.checked=cb.checked;
  if(typeof calculate==="function") calculate();
  renderEdJob();
});
/** Writes an Education Boosters change to the Investments setting it mirrors. */
document.querySelectorAll("#pageEduJob [data-mirror]").forEach(el=>el.addEventListener("change",()=>{
  const master=$(el.dataset.mirror);
  if(!master) return;
  if(el.type==="checkbox") master.checked=el.checked;
  else master.value=el.value;
  master.dispatchEvent(new Event("input"));
  renderEdJob();
}));
/** Collapses the API key column to a vertical tab. */
function setEdJobConfigCollapsed(collapsed){
  $("eduJobGrid")?.classList.toggle("config-collapsed",collapsed);
  try{localStorage.setItem("tornEdJobConfigCollapsed",collapsed?"1":"0")}
  catch(e){ logProblem("Education & Job API key panel state could not be saved",e) }
}
$("collapseEduJobConfig")?.addEventListener("click",()=>setEdJobConfigCollapsed(true));
$("eduJobConfigTab")?.addEventListener("click",()=>setEdJobConfigCollapsed(false));
try{ if(localStorage.getItem("tornEdJobConfigCollapsed")==="1") setEdJobConfigCollapsed(true) }
catch(e){ logProblem("Education & Job API key panel state could not be read",e) }
/** Chooses a perk row on click, Enter or Space. */
$("edJobPerks")?.addEventListener("click",e=>{
  const li=e.target.closest(".edjob-perk");
  if(edJobPerkDragged){ edJobPerkDragged=false; return }
  if(li) toggleEdJobPerk(li.dataset.perk);
});
$("edJobPerks")?.addEventListener("keydown",e=>{
  const li=e.target.closest(".edjob-perk");
  if(!li||(e.key!=="Enter"&&e.key!==" ")) return;
  e.preventDefault();
  toggleEdJobPerk(li.dataset.perk);
});
/** Lets the chosen perk rows be dragged into priority order, shuffling the others live. */
let edJobPerkDrag=null, edJobPerkDragged=false;
$("edJobPerks")?.addEventListener("pointerdown",e=>{
  const li=e.target.closest(".edjob-perk.on");
  if(!li||e.button!==0) return;
  edJobPerkDrag={li,startY:e.clientY,grab:e.clientY-li.getBoundingClientRect().top,moving:false};
  li.setPointerCapture(e.pointerId);
});
$("edJobPerks")?.addEventListener("pointermove",e=>{
  const d=edJobPerkDrag;
  if(!d) return;
  if(!d.moving){
    if(Math.abs(e.clientY-d.startY)<4) return;
    d.moving=true;
    d.li.classList.add("dragging");
  }
  const list=d.li.parentElement;
  const top=e.clientY-list.getBoundingClientRect().top-d.grab;
  const mid=top+d.li.offsetHeight/2;
  const prev=d.li.previousElementSibling, next=d.li.nextElementSibling;
  if(next?.classList.contains("on")&&mid>next.offsetTop+next.offsetHeight/2) edJobPerkShift(next,()=>list.insertBefore(d.li,next.nextSibling));
  else if(prev?.classList.contains("on")&&mid<prev.offsetTop+prev.offsetHeight/2) edJobPerkShift(prev,()=>list.insertBefore(d.li,prev));
  d.li.style.transform=`translateY(${top-d.li.offsetTop}px)`;
});
/** Moves the dragged row past a neighbour and slides that neighbour into its new place. */
function edJobPerkShift(el,move){
  const before=el.offsetTop;
  move();
  el.style.transition="none";
  el.style.transform=`translateY(${before-el.offsetTop}px)`;
  void el.offsetHeight;
  el.style.transition="transform .15s ease";
  el.style.transform="";
}
/** Ends a drag and records the new order. */
function endEdJobPerkDrag(){
  const d=edJobPerkDrag;
  edJobPerkDrag=null;
  if(!d||!d.moving) return;
  edJobPerkDragged=true;
  setTimeout(()=>{ edJobPerkDragged=false },0);
  window.edJobPerkPrefs=[...document.querySelectorAll("#edJobPerks .edjob-perk.on")].map(li=>li.dataset.perk);
  renderEdJobPerks();
  renderEdJobPicker(edJobCourses());
}
$("edJobPerks")?.addEventListener("pointerup",endEdJobPerkDrag);
$("edJobPerks")?.addEventListener("pointercancel",endEdJobPerkDrag);
$("edJobHideDone")?.addEventListener("change",renderEdJob);
$("edJobFind")?.addEventListener("input",()=>renderEdJobPicker(edJobCourses()));
