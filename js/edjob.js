// ======================================================================
// EDUCATION & JOB
// ======================================================================

/** Returns every course with its state, code, length, prerequisites and rewards. */
function edJobCourses(){
  const info=(window.live&&window.live.courseInfo)||{};
  return [...document.querySelectorAll(".education-course-check")].map(cb=>{
    const extra=info[cb.id]||{};
    return {
      id:cb.id,
      name:(cb.dataset.course||"").trim(),
      faculty:cb.closest(".education-topic")?.querySelector("summary")?.textContent.trim()||"Other",
      code:extra.code||"",
      perk:extra.perk||"",
      stats:extra.stats||{man:0,int:0,end:0},
      done:cb.checked,
      days:courseDaysFor(cb.id),
      needs:extra.needs||[],
      gains:extra.gains||[]
    };
  });
}
/** Formats a course length as a whole number of days. */
function edJobShort(days){
  return `${Math.round(days)}d`;
}
/** Returns the days a course takes this player after reductions. */
function edJobCourseDays(course){
  return course.days*(1-educationTimeReduction())*educationJpFactor();
}

// ----------------------------------------------------------------------
// Dragging
// ----------------------------------------------------------------------
/** Moves the dragged row past a neighbour and slides that neighbour into its new place. */
function edJobShift(el,move){
  const before=el.offsetTop;
  move();
  el.style.transition="none";
  el.style.transform=`translateY(${before-el.offsetTop}px)`;
  void el.offsetHeight;
  el.style.transition="transform .15s ease";
  el.style.transform="";
}
/** Makes the rows of a list draggable into a new order, shuffling the others live and scrolling at the edges. */
function edJobSortable(box,{row,movable,together,drop}){
  let d=null;
  const place=()=>{
    const list=d.li.parentElement;
    const top=d.y-list.getBoundingClientRect().top-d.grab;
    const mid=top+d.li.offsetHeight/2;
    for(;;){
      const prev=d.li.previousElementSibling, next=d.li.nextElementSibling;
      if(next&&together(d.li,next)&&mid>next.offsetTop+next.offsetHeight/2) edJobShift(next,()=>list.insertBefore(d.li,next.nextSibling));
      else if(prev&&together(d.li,prev)&&mid<prev.offsetTop+prev.offsetHeight/2) edJobShift(prev,()=>list.insertBefore(d.li,prev));
      else break;
    }
    d.li.style.transform=`translateY(${top-d.li.offsetTop}px)`;
  };
  const edge=()=>{
    if(!d||!d.moving) return;
    const gap=60, h=window.innerHeight;
    const step=d.y<gap?-(gap-d.y)/3:d.y>h-gap?(d.y-(h-gap))/3:0;
    if(step){ window.scrollBy(0,step); place() }
    requestAnimationFrame(edge);
  };
  box.addEventListener("pointerdown",e=>{
    const li=e.target.closest(row);
    if(!li||e.button!==0||e.target.closest("input,button,a")||!movable(li,e)) return;
    d={li,y:e.clientY,startY:e.clientY,grab:e.clientY-li.getBoundingClientRect().top,moving:false};
    li.setPointerCapture(e.pointerId);
  });
  box.addEventListener("pointermove",e=>{
    if(!d) return;
    d.y=e.clientY;
    if(!d.moving){
      if(Math.abs(d.y-d.startY)<4) return;
      d.moving=true;
      d.li.classList.add("dragging");
      requestAnimationFrame(edge);
    }
    place();
  });
  const end=()=>{
    const x=d;
    d=null;
    if(!x||!x.moving) return;
    box.dataset.dragged="1";
    setTimeout(()=>{ delete box.dataset.dragged },0);
    drop(x.li);
  };
  box.addEventListener("pointerup",end);
  box.addEventListener("pointercancel",end);
}

// ----------------------------------------------------------------------
// Snapshot
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
  box.innerHTML=`<div class="edjob-module-head"><button type="button" class="edjob-fold" aria-label="Hide snapshot">Snapshot</button>`
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
  // Do not use toISOString: it converts to UTC and lands a day early east of Greenwich.
  const pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// ----------------------------------------------------------------------
// Perk preferences
// ----------------------------------------------------------------------
/** Course codes that give each perk category, in the order to study them. */
const PERK_COURSES={
  "Attacking":["DEF1700","DEF2720","DEF2740","DEF2750","DEF2760","DEF2710","DEF2730","DEF3770","BIO1340","BIO2380","BIO2400","BIO2410","HAF1103","HAF2107","HAF2106","HAF2105","HAF2104","HAF2108","HAF2109","HAF2110","HAF3111"],
  "Company Ownership":["BUS1100","BUS2300","BUS2200","BUS2500","BUS2800","BUS2400","BUS2900","BUS2110","BUS2100","BUS2120","BUS2600","BUS2700","BUS3130","LAW1880","LAW2100","MTH1220","MTH2280"],
  "Crime":["PSY1630","PSY2132","PSY2640","PSY2660","PSY2650","PSY2670","PSY2680","PSY3690","CMT1520","CMT2230","CMT2530","CMT2130","CMT2131","CMT2570","CMT2128","CMT2129"],
  "Gym Gains":["SPT1430","SPT2440","SPT2450","SPT2460","SPT2470","SPT2126","SPT2490","SPT2500","SPT2480","SPT3510"],
  "Jail":["LAW1880","LAW2890","LAW2920","LAW2930","LAW2900","LAW2970","LAW2980","LAW2990","LAW2910","LAW2940","LAW2950","LAW2960","LAW2101","LAW2100","LAW3102"],
  "Medical":["BIO1340","BIO2127","BIO2360","BIO2370","BIO2350","BIO2390","BIO2380","BIO2410","BIO2400","BIO3420","SPT1430","SPT2480"],
  "Passive DEF":["SPT1430","SPT2500","DEF1700","DEF2740","DEF2710","DEF2730","MTH1220","MTH2320","MTH2260"],
  "Passive DEX":["SPT1430","SPT2500","PSY1630","PSY2640","PSY2660","PSY2650","PSY2670","HAF1103","HAF2104","HAF2108"],
  "Passive SPD":["SPT1430","SPT2490","DEF1700","DEF2750","DEF2760","HAF1103","HAF2105","HAF2109","MTH1220","MTH2240","MTH2250","CBT1780","CBT2790"],
  "Passive STR":["SPT1430","SPT2490","HAF1103","HAF2107","HAF2106"],
  "Profit":["HIS1140","HIS2180","HIS2190","HIS2200","HIS2150","HIS2160","HIS2170","HIS3210","SPT1430","SPT2126","PSY1630","PSY2680","CMT1520","CMT2530","CMT2560","CMT2580","CMT2600","LAW1880","LAW2910","GEN1112","GEN2120"],
  "Viruses":["CMT1520","CMT2530","CMT2560","CMT2580","CMT2600"],
  "Weapons":["CBT1780","CBT2790","CBT2830","CBT2850","CBT2125","CBT2840","CBT2820","CBT2860","CBT2800","CBT2810","CBT3870","BIO1340","BIO2350","HIS1140","HIS2170","HIS2160","MTH1220","MTH2310","MTH2240","MTH2260","MTH2250","MTH2320","MTH2270","MTH2280","MTH2290","MTH2300","MTH3330","GEN1112","GEN2116","GEN2119"]
};
const PERK_CATEGORIES=Object.keys(PERK_COURSES);
try{ window.edJobPerkPrefs=JSON.parse(localStorage.getItem("tornInvPerkPrefs")||"[]")
  .filter(p=>PERK_CATEGORIES.includes(p)) }
catch(e){ window.edJobPerkPrefs=[]; logProblem("Perk preferences could not be read",e) }
/** Returns a lookup from a course code or name to the course. */
function edJobFinder(list){
  const byCode=Object.fromEntries(list.filter(c=>c.code).map(c=>[c.code.toUpperCase(),c]));
  const byName=Object.fromEntries(list.map(c=>[c.name.toLowerCase(),c]));
  return n=>byCode[String(n).toUpperCase()]||byName[String(n).toLowerCase()];
}
/** Returns the courses the chosen perk categories point to, and the prerequisites they need. */
function edJobWanted(list){
  const find=edJobFinder(list);
  const byId=Object.fromEntries(list.map(c=>[c.id,c]));
  const out=new Map(), direct=[];
  (window.edJobPerkPrefs||[]).forEach(perk=>(PERK_COURSES[perk]||[]).forEach(n=>{
    const c=find(n);
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
  box.innerHTML=`<div class="edjob-module-head"><button type="button" class="edjob-fold" aria-label="Hide perk preferences">Perk preferences</button></div>`
    +`<ul class="edjob-perk-list">${on.map((p,i)=>row(p,i)).join("")}${rest.map(p=>row(p,-1)).join("")}</ul>`;
}
/** Chooses or unchooses a perk category. */
function toggleEdJobPerk(name){
  const on=window.edJobPerkPrefs, i=on.indexOf(name);
  if(i>=0) on.splice(i,1); else on.push(name);
  renderEdJobPerks();
  renderEdJobCourses(edJobCourses());
  focusEdJobPerk(name);
}
/** Puts keyboard focus back on a perk row after a redraw. */
function focusEdJobPerk(name){
  [...document.querySelectorAll("#edJobPerks .edjob-perk")].find(li=>li.dataset.perk===name)?.focus();
}

// ----------------------------------------------------------------------
// Education Boosters
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// Courses
// ----------------------------------------------------------------------
try{ window.edJobCourseOrder=JSON.parse(localStorage.getItem("tornInvCourseOrder")||"[]") }
catch(e){ window.edJobCourseOrder=[]; logProblem("Completed course order could not be read",e) }
try{ window.edJobPlan=JSON.parse(localStorage.getItem("tornInvCoursePlan")||"[]") }
catch(e){ window.edJobPlan=[]; logProblem("Course plan could not be read",e) }
window.edJobCurrent=null;
window.edJobCurrentUntil=0;
try{
  const saved=JSON.parse(localStorage.getItem("tornInvCurrentCourse")||"null");
  if(saved?.id&&!(saved.until&&saved.until<Date.now())){
    window.edJobCurrent=saved.id;
    window.edJobCurrentUntil=+saved.until||0;
  }
}catch(e){ logProblem("Current course could not be read",e) }
/** Records which course Torn says is being studied now, and when it finishes. */
function edJobSetCurrent(data){
  const raw=data?.education_current??data?.education?.current?.id;
  const name=+raw>0?window.educationIndex?.[String(raw)]:"";
  window.edJobCurrent=name?educationIdFor(name)||null:null;
  const left=+(data?.education_timeleft||0), until=+(data?.education?.current?.until||0);
  window.edJobCurrentUntil=!window.edJobCurrent?0
    :left>0?Date.now()+left*1000:until>0?until*1000:0;
}
/** Returns the days left on the course being studied, or 0 when that is not known. */
function edJobCurrentLeft(){
  return window.edJobCurrentUntil?Math.max(0,window.edJobCurrentUntil-Date.now())/86400000:0;
}
/** Returns the ids of the courses the chosen perks call for, each after the prerequisites it still needs, in perk priority order. */
function edJobAuto(list){
  const byId=Object.fromEntries(list.map(c=>[c.id,c]));
  const find=edJobFinder(list);
  const skip=new Set(list.filter(c=>c.done).map(c=>c.id));
  if(window.edJobCurrent) skip.add(window.edJobCurrent);
  const out=[], seen=new Set();
  const add=c=>{
    if(!c||skip.has(c.id)||seen.has(c.id)) return;
    seen.add(c.id);
    c.needs.forEach(n=>add(byId[n]));
    out.push(c.id);
  };
  (window.edJobPerkPrefs||[]).forEach(perk=>(PERK_COURSES[perk]||[]).forEach(n=>add(find(n))));
  return out;
}
/** Returns the plan: the perk courses first, then the hand-placed ones, dropping any finished, being studied or unknown. */
function edJobPlanned(list){
  const byId=Object.fromEntries(list.map(c=>[c.id,c]));
  window.edJobPlan=window.edJobPlan.filter((id,i,a)=>byId[id]&&!byId[id].done
    &&id!==window.edJobCurrent&&a.indexOf(id)===i);
  const auto=edJobAuto(list);
  return {auto:auto.map(id=>byId[id]),
    manual:window.edJobPlan.filter(id=>!auto.includes(id)).map(id=>byId[id])};
}
/** Returns the completed courses in the order they were arranged. */
function edJobCompleted(list){
  const byId=Object.fromEntries(list.map(c=>[c.id,c]));
  const order=window.edJobCourseOrder.filter(id=>byId[id]?.done);
  list.forEach(c=>{ if(c.done&&!order.includes(c.id)) order.push(c.id) });
  window.edJobCourseOrder=order;
  return order.map(id=>byId[id]);
}
/** Returns the ids of planned courses with a prerequisite that is neither done nor planned before them. */
function edJobBlocked(plan,list){
  const have=new Set(list.filter(c=>c.done).map(c=>c.id));
  if(window.edJobCurrent) have.add(window.edJobCurrent);
  const out=new Set();
  plan.forEach(c=>{ if(c.needs.some(n=>!have.has(n))) out.add(c.id); have.add(c.id) });
  return out;
}
/** Returns one course row. */
function edJobRow(c,cls,removable){
  const fac="fac-"+c.faculty.toLowerCase().replace(/[^a-z]+/g,"-");
  return `<li class="edjob-course ${fac}${cls}" data-id="${esc(c.id)}">`
    +`<span class="edjob-course-grip" aria-hidden="true">⠿</span>`
    +`<input type="checkbox" class="edjob-course-check" aria-label="${esc(c.name)} completed"${c.done?" checked":""}>`
    +`<span class="edjob-course-code">${esc(c.code)}</span>`
    +`<span class="edjob-course-name">${esc(c.name)}</span>`
    +`<span class="edjob-course-time">${esc(edJobShort(edJobCourseDays(c)))}</span>`
    +`<span class="edjob-course-perk">${esc(c.perk)}</span>`
    +(removable?`<button type="button" class="edjob-course-remove" aria-label="Take ${esc(c.name)} off the plan">×</button>`:"")
    +`</li>`;
}
try{ window.edJobFacultyFolds=JSON.parse(localStorage.getItem("tornEdJobFacultyFolds")||"[]") }
catch(e){ window.edJobFacultyFolds=[]; logProblem("Folded subjects could not be read",e) }
/** Folds or opens one subject in the catalogue and remembers it. */
function toggleEdJobFaculty(head){
  const sec=head.closest(".edjob-faculty"), f=sec.dataset.faculty;
  const folded=!sec.classList.contains("folded");
  sec.classList.toggle("folded",folded);
  head.setAttribute("aria-expanded",String(!folded));
  window.edJobFacultyFolds=window.edJobFacultyFolds.filter(x=>x!==f);
  if(folded) window.edJobFacultyFolds.push(f);
  try{ localStorage.setItem("tornEdJobFacultyFolds",JSON.stringify(window.edJobFacultyFolds)) }
  catch(e){ logProblem("Folded subjects could not be saved",e) }
}
/** Torn events that reward having a particular course finished first. */
const EDJOB_EVENTS=[
  {name:"Awareness Week",on:y=>{ const d=new Date(y,0,1); d.setDate(1+(8-d.getDay())%7+14); return d },
    course:"Bachelor of Psychological Sciences",
    text:"Increased awareness for one week, complete Bachelor of Psychological Sciences to maximise benefits"},
  {name:"Museum Day",on:y=>new Date(y,4,18),course:"Bachelor of History",
    text:"10% bonus to museum point rewards, complete Bachelor of History to maximise benefits"},
  {name:"World Blood Donor Day",on:y=>new Date(y,5,14),course:"Intravenous Therapy",
    text:"Life and cooldown penalties for drawing blood are halved, complete Biology - Intravenous Therapy to maximise benefits"},
  {name:"World Population Day",on:y=>new Date(y,6,11),course:"Bachelor of Military Arts and Science",
    text:"Level and weapon EXP gained while attacking is doubled, complete Bachelor of Military Arts and Science to maximise benefits"},
  {name:"World Tiger Day",on:y=>new Date(y,6,29),course:"Survival Skills",
    text:"500% hunting experience bonus, complete General Studies - Survival Skills to maximise benefits"}
];
/** Returns the events that fall within the plan, each against the planned course it comes before and whether its course is done in time. */
function edJobEvents(list,rows,start,currentEnd){
  if(!rows.length) return [];
  const byName=Object.fromEntries(list.map(c=>[c.name,c]));
  const finishOf=Object.fromEntries(rows.map(r=>[r.id,r.finish]));
  const ready=(name,when)=>{
    const c=byName[name];
    if(!c) return false;
    if(c.done) return true;
    if(c.id===window.edJobCurrent) return !!currentEnd&&currentEnd<when;
    return !!finishOf[c.id]&&finishOf[c.id]<when;
  };
  const out=[], last=rows[rows.length-1].finish;
  for(let y=start.getFullYear();y<=last.getFullYear();y++){
    EDJOB_EVENTS.forEach(ev=>{
      const when=ev.on(y);
      if(when<start) return;
      const row=rows.find(r=>r.finish>=when);
      if(row) out.push({row:row.at,ev,when,met:ready(ev.course,when)});
    });
  }
  return out;
}
/** Returns the half year a date falls in, as a key and a heading such as "June 2027". */
function edJobHalf(d){
  const late=d.getMonth()>=5;
  return {key:d.getFullYear()*2+(late?1:0),label:`${late?"June":"January"} ${d.getFullYear()}`};
}
/** Draws the course catalogue, the plan with its half-year headings, and the completed courses. */
function renderEdJobCourses(list){
  const cat=$("edJobCatalogue"), todo=$("edJobTodo"), doneBox=$("edJobDone");
  if(!cat||!todo||!doneBox) return;
  const {auto,manual}=edJobPlanned(list);
  const plan=[...auto,...manual];
  const planned=new Set(plan.map(c=>c.id));
  const blocked=edJobBlocked(plan,list);
  const wanted=edJobWanted(list);
  const aqua=c=>{ const w=wanted.get(c.id); return w?(w.direct?" wanted":" wanted-pre"):"" };
  const current=list.find(c=>c.id===window.edJobCurrent&&!c.done);
  const faculties=[...new Set(list.map(c=>c.faculty))];
  cat.innerHTML=`<div class="edjob-col-head"><button type="button" class="edjob-fold" id="edJobCatalogueFold" aria-label="Hide subject list">Subject List</button></div>`
    +faculties.map(f=>{
    const items=list.filter(c=>c.faculty===f);
    const rows=items.map(c=>edJobRow(c,c.done?" done":c===current?" current"
      :planned.has(c.id)?" planned":aqua(c))).join("");
    const folded=window.edJobFacultyFolds.includes(f);
    return `<section class="panel edjob-module edjob-courses edjob-faculty fac-${f.toLowerCase().replace(/[^a-z]+/g,"-")}${folded?" folded":""}" data-faculty="${esc(f)}">`
      +`<div class="edjob-module-head edjob-faculty-head" role="button" tabindex="0" aria-expanded="${!folded}">`
      +`<span class="edjob-course-grip" aria-hidden="true">⠿</span>`
      +`<span class="edjob-faculty-name">${esc(f)}</span><span>${items.filter(c=>c.done).length}/${items.length}</span></div>`
      +`<ul class="edjob-course-list">${rows}</ul></section>`;
  }).join("");
  const start=new Date();
  start.setHours(0,0,0,0);
  let days=current?(edJobCurrentLeft()||edJobCourseDays(current)):0;
  let half=edJobHalf(start).key;
  const stats={man:0,int:0,end:0};
  const addStats=c=>{ stats.man+=c.stats.man; stats.int+=c.stats.int; stats.end+=c.stats.end };
  list.filter(c=>c.done).forEach(addStats);
  if(current) addStats(current);
  const n=v=>v.toLocaleString("en-US");
  const timeline=[], rows=[];
  const currentEnd=current?new Date(start.getTime()+Math.round(days)*86400000):null;
  todo.innerHTML=plan.map(c=>{
    const d=new Date(start);
    d.setDate(d.getDate()+Math.round(days));
    days+=edJobCourseDays(c);
    const h=edJobHalf(d);
    const head=h.key!==half;
    half=h.key;
    addStats(c);
    const pinned=auto.includes(c);
    if(head) timeline.push(`<li class="edjob-tl-row edjob-tl-labels"><span>Completes</span><span>MAN</span><span>INT</span><span>END</span></li>`);
    const finish=new Date(start);
    finish.setDate(finish.getDate()+Math.round(days));
    rows.push({id:c.id,finish,at:timeline.length});
    timeline.push(`<li class="edjob-tl-row"><span class="edjob-tl-end">${esc(edJobFinishDate(days))}</span>`
      +`<span>${n(stats.man)}</span><span>${n(stats.int)}</span><span>${n(stats.end)}</span></li>`);
    return (head?`<li class="edjob-year">${h.label}</li>`:"")
      +edJobRow(c,(pinned?" auto":"")+(blocked.has(c.id)?" blocked":aqua(c)),!pinned);
  }).join("");
  const marks={};
  edJobEvents(list,rows,start,currentEnd).forEach(m=>{
    (marks[m.row]=marks[m.row]||[]).push(`<span class="edjob-tl-event ${m.met?"met":"unmet"}" tabindex="0" role="button"`
      +` data-event="${esc(m.ev.name)}" title="${esc(m.ev.name+":\n"+m.ev.text)}">${esc(m.ev.name)}`
      +` <span class="edjob-tl-event-date">${esc(edJobFinishDate((m.when-start)/86400000))}</span></span>`);
  });
  Object.entries(marks).forEach(([i,spans])=>{
    timeline[i]=timeline[i].replace("</li>",`<span class="edjob-tl-events">${spans.join("")}</span></li>`);
  });
  const tl=$("edJobTimeline");
  if(tl) tl.innerHTML=timeline.join("");
  $("edJobTodoWrap")?.classList.toggle("no-plan",!plan.length);
  edJobSyncTimeline();
  doneBox.innerHTML=edJobCompleted(list).map(c=>edJobRow(c," done")).join("")
    +(current?edJobRow(current," current"):"");
  $("edJobDoneCount").textContent=`${list.filter(c=>c.done).length}/${list.length}`;
  $("edJobTodoCount").textContent=`${plan.length}`;
}
/** Sizes each timeline row to the planned course beside it, so the two tables line up. */
function edJobSyncTimeline(){
  const todo=$("edJobTodo"), tl=$("edJobTimeline");
  if(!todo||!tl||!tl.offsetParent) return;
  tl.style.paddingTop="0px";
  const plan=[...todo.children], rows=[...tl.children];
  if(!plan.length) return;
  tl.style.paddingTop=Math.max(0,plan[0].getBoundingClientRect().top-rows[0].getBoundingClientRect().top)+"px";
  rows.forEach((li,i)=>{
    if(!plan[i]) return;
    const cs=getComputedStyle(plan[i]);
    li.style.height=plan[i].getBoundingClientRect().height+"px";
    li.style.marginTop=cs.marginTop;
    li.style.marginBottom=cs.marginBottom;
  });
}
addEventListener("resize",()=>edJobSyncTimeline());
/** Returns which block a completed-panel row belongs to: completed or current. */
function edJobGroup(li){
  return li.classList.contains("current")?"current":"done";
}
/** Floats "Prerequisite not met" over a planned course. */
function edJobWarn(id){
  const li=[...document.querySelectorAll("#edJobTodo .edjob-course")].find(x=>x.dataset.id===id);
  if(li&&typeof floatOverElement==="function") floatOverElement(li,"Prerequisite not met");
}

window.edJobUndo=[];
window.edJobRedo=[];
/** Returns the course ticks, plan and completed order as they stand. */
function edJobSnapshot(){
  return {order:[...window.edJobCourseOrder],plan:[...window.edJobPlan],perks:[...window.edJobPerkPrefs],
    done:[...document.querySelectorAll(".education-course-check")].filter(cb=>cb.checked).map(cb=>cb.id)};
}
/** Records the course state before a change so it can be undone. */
function pushEdJobUndo(){
  window.edJobUndo.push(edJobSnapshot());
  if(window.edJobUndo.length>100) window.edJobUndo.shift();
  window.edJobRedo.length=0;
}
/** Puts the course ticks, plan and completed order back to a recorded state. */
function restoreEdJob(snap){
  const done=new Set(snap.done);
  document.querySelectorAll(".education-course-check").forEach(cb=>{ cb.checked=done.has(cb.id) });
  window.edJobCourseOrder=[...snap.order];
  window.edJobPlan=[...(snap.plan||[])];
  if(snap.perks) window.edJobPerkPrefs=[...snap.perks];
  if(typeof calculate==="function") calculate();
  renderEdJob();
}
/** Floats an event's explanation over its label. */
function edJobShowEvent(el){
  const ev=EDJOB_EVENTS.find(x=>x.name===el.dataset.event);
  if(ev&&typeof floatOverElement==="function") floatOverElement(el,`${ev.name}: ${ev.text}`);
}
/** Asks before emptying the course planner, then empties it and unchooses the perk preferences that fill it. */
function askEdJobClear(){
  const box=$("edJobConfirm");
  if(!box) return;
  box.hidden=false;
  $("edJobConfirmNo")?.focus();
}
/** Closes the clear-planner question, clearing the planner when confirmed. */
function closeEdJobClear(confirmed){
  const box=$("edJobConfirm");
  if(!box||box.hidden) return;
  box.hidden=true;
  if(!confirmed) return;
  pushEdJobUndo();
  window.edJobPlan=[];
  window.edJobPerkPrefs=[];
  renderEdJob();
}
$("edJobConfirmYes")?.addEventListener("click",()=>closeEdJobClear(true));
$("edJobConfirmNo")?.addEventListener("click",()=>closeEdJobClear(false));
$("edJobConfirm")?.addEventListener("click",e=>{ if(e.target===$("edJobConfirm")) closeEdJobClear(false) });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeEdJobClear(false) });
/** Undoes the last course change. */
function undoEdJob(){
  if(!window.edJobUndo.length) return false;
  window.edJobRedo.push(edJobSnapshot());
  restoreEdJob(window.edJobUndo.pop());
  return true;
}
/** Redoes the last undone course change. */
function redoEdJob(){
  if(!window.edJobRedo.length) return false;
  window.edJobUndo.push(edJobSnapshot());
  restoreEdJob(window.edJobRedo.pop());
  return true;
}
/** Shows "Prerequisite not met" over the first of these courses that is now red. */
function edJobWarnAny(ids){
  const list=edJobCourses();
  const {auto,manual}=edJobPlanned(list);
  const blocked=edJobBlocked([...auto,...manual],list);
  const id=ids.find(x=>blocked.has(x));
  if(id) edJobWarn(id);
}
/** Slides the other rows of a list to their new places after it changes. */
function edJobFlip(list,skip,change){
  const els=[...list.children].filter(el=>el!==skip);
  const before=new Map(els.map(el=>[el,el.getBoundingClientRect().top]));
  change();
  els.forEach(el=>{
    if(!el.isConnected) return;
    const dy=before.get(el)-el.getBoundingClientRect().top;
    if(!dy) return;
    el.style.transition="none";
    el.style.transform=`translateY(${dy}px)`;
    void el.offsetHeight;
    el.style.transition="transform .15s ease";
    el.style.transform="";
  });
}
/** Lets courses and whole faculties be dragged into the plan, and hand-placed courses around it or back out. */
function edJobPlanDrag(area){
  let d=null;
  const planPanel=()=>document.querySelector("#edJobTodoWrap:not(.collapsed) .panel");
  const place=()=>{
    d.ghost.style.transform=`translate(${d.x-d.gx}px,${d.y-d.gy}px)`;
    const panel=planPanel(), list=$("edJobTodo");
    const r=panel?.getBoundingClientRect();
    const over=!!r&&d.x>=r.left&&d.x<=r.right&&d.y>=r.top&&d.y<=r.bottom;
    panel?.classList.toggle("dropping",over);
    if(!over){
      if(d.gap.isConnected) edJobFlip(list,d.gap,()=>d.gap.remove());
      return;
    }
    const y=d.y-list.getBoundingClientRect().top;
    const after=el=>d.gap.isConnected&&(d.gap.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING);
    const rows=[...list.querySelectorAll(".edjob-course:not(.auto)")];
    const next=rows.find(li=>y<li.offsetTop-(after(li)?d.h+4:0)+li.offsetHeight/2);
    const anchor=next&&next.previousElementSibling?.classList.contains("edjob-year")?next.previousElementSibling:next;
    if(anchor?anchor===d.gap.nextElementSibling:(d.gap.isConnected&&!d.gap.nextElementSibling)) return;
    edJobFlip(list,d.gap,()=>{ if(anchor) list.insertBefore(d.gap,anchor); else list.appendChild(d.gap) });
  };
  const edge=()=>{
    if(!d||!d.moving||d.done) return;
    const col=$("edJobPlanCol"), gap=60;
    const cr=col.getBoundingClientRect();
    if(getComputedStyle(col).position==="sticky"&&d.x>=cr.left&&d.x<=cr.right){
      const step=d.y<cr.top+gap?-(cr.top+gap-d.y)/3:d.y>cr.bottom-gap?(d.y-(cr.bottom-gap))/3:0;
      if(step){ col.scrollTop+=step; place() }
    }
    const h=window.innerHeight;
    const step=d.y<gap?-(gap-d.y)/3:d.y>h-gap?(d.y-(h-gap))/3:0;
    if(step){ window.scrollBy(0,step); place() }
    requestAnimationFrame(edge);
  };
  area.addEventListener("pointerdown",e=>{
    if(d||e.button!==0||e.target.closest("input,button,a")) return;
    if(e.pointerType!=="mouse"&&!e.target.closest(".edjob-course-grip")) return;
    const head=e.target.closest(".edjob-faculty-head");
    const row=e.target.closest(".edjob-course");
    let src=null, ids=[];
    if(head){
      src=head.closest(".edjob-faculty");
      ids=[...src.querySelectorAll(".edjob-course:not(.done):not(.current):not(.planned)")].map(li=>li.dataset.id);
    }else if(row?.closest("#edJobCatalogue")&&!/\b(done|current|planned)\b/.test(row.className)){
      src=row; ids=[row.dataset.id];
    }else if(row?.closest("#edJobTodo")&&!row.classList.contains("auto")){
      src=row; ids=[row.dataset.id];
    }
    if(!src||!ids.length) return;
    const b=src.getBoundingClientRect();
    d={src,ids,head:!!head,fromPlan:!!src.closest("#edJobTodo"),x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,
      gx:e.clientX-b.left,gy:e.clientY-b.top,w:b.width,h:head?48:b.height,moving:false};
  });
  area.addEventListener("pointermove",e=>{
    if(!d||d.done) return;
    d.x=e.clientX; d.y=e.clientY;
    if(!d.moving){
      if(Math.hypot(d.x-d.sx,d.y-d.sy)<5) return;
      d.moving=true;
      // Do not capture on pointerdown: it sends the click to the area and a plain click on a heading does nothing.
      area.setPointerCapture(e.pointerId);
      window.getSelection()?.removeAllRanges();
      if(d.head){
        d.ghost=document.createElement("div");
        d.ghost.className="panel edjob-ghost";
        d.ghost.innerHTML=`<div class="edjob-module-head"><span>${esc(d.src.dataset.faculty)}</span>`
          +`<span>${d.ids.length} course${d.ids.length===1?"":"s"}</span></div>`;
        d.gy=Math.min(d.gy,24);
      }else{
        d.ghost=d.src.cloneNode(true);
        d.ghost.classList.add("edjob-ghost");
        d.ghost.style.gridTemplateColumns=getComputedStyle(d.src).gridTemplateColumns;
      }
      d.ghost.style.width=d.w+"px";
      document.body.appendChild(d.ghost);
      d.gap=document.createElement("li");
      d.gap.className="edjob-gap";
      d.gap.style.height=d.h+"px";
      if(d.fromPlan) d.src.replaceWith(d.gap);
      else d.src.classList.add("picked");
      requestAnimationFrame(edge);
    }
    place();
  });
  const commit=x=>{
    x.ghost.remove();
    x.src.classList.remove("picked");
    planPanel()?.classList.remove("dropping");
    const list=$("edJobTodo");
    const into=x.gap.isConnected;
    const at=into?[...list.children].filter(el=>el===x.gap||el.matches(".edjob-course:not(.auto)")).indexOf(x.gap):-1;
    x.gap.remove();
    if(!into&&!x.fromPlan){ renderEdJob(); return }
    pushEdJobUndo();
    const auto=edJobAuto(edJobCourses());
    const plan=window.edJobPlan.filter(id=>!x.ids.includes(id));
    if(into){
      const shown=plan.filter(id=>!auto.includes(id));
      const pos=at<shown.length?plan.indexOf(shown[at]):plan.length;
      plan.splice(pos,0,...x.ids);
    }
    window.edJobPlan=plan;
    renderEdJob();
    if(into) edJobWarnAny(x.ids);
  };
  const end=()=>{
    const x=d;
    if(!x||x.done) return;
    if(!x.moving){ d=null; return }
    x.done=true;
    area.dataset.dragged="1";
    setTimeout(()=>{ delete area.dataset.dragged },0);
    const finish=()=>{ d=null; commit(x) };
    if(!x.gap.isConnected){ finish(); return }
    const g=x.gap.getBoundingClientRect();
    x.ghost.style.transition="transform .15s ease";
    x.ghost.style.transform=`translate(${g.left}px,${g.top}px)`;
    setTimeout(finish,150);
  };
  area.addEventListener("pointerup",end);
  area.addEventListener("pointercancel",end);
}

/** Draws the whole Education & Job page. */
function renderEdJob(){
  const list=edJobCourses();
  const api=$("apiPanel")?.querySelector("details");
  if(api) api.open=true;
  syncEdJobSettings();
  renderEdJobSummary(list);
  renderEdJobPerks();
  renderEdJobCourses(list);
}

// ----------------------------------------------------------------------
// Wiring
// ----------------------------------------------------------------------
/** Ticks or unticks a course, moving it between the plan and the completed courses. */
$("edJobCourses")?.addEventListener("change",e=>{
  const cb=e.target.closest(".edjob-course-check");
  const id=cb?.closest(".edjob-course")?.dataset.id;
  const master=id&&$(id);
  if(!master) return;
  pushEdJobUndo();
  master.checked=cb.checked;
  window.edJobPlan=window.edJobPlan.filter(x=>x!==id);
  window.edJobCourseOrder=window.edJobCourseOrder.filter(x=>x!==id);
  if(cb.checked) window.edJobCourseOrder.push(id);
  else if(cb.closest("#edJobDone")) window.edJobPlan.unshift(id);
  if(typeof calculate==="function") calculate();
  renderEdJob();
});
/** Takes a course off the plan, or shows why a red course is red. */
$("edJobCourses")?.addEventListener("click",e=>{
  if($("edJobCourses").dataset.dragged||$("edJobDone").dataset.dragged) return;
  const remove=e.target.closest(".edjob-course-remove");
  if(remove){
    pushEdJobUndo();
    const id=remove.closest(".edjob-course").dataset.id;
    window.edJobPlan=window.edJobPlan.filter(x=>x!==id);
    renderEdJob();
    return;
  }
  if(e.target.closest("#edJobCatalogueFold")){ setEdJobCatalogueFolded(true); return }
  if(e.target.closest("#edJobClearPlan")){ askEdJobClear(); return }
  const event=e.target.closest(".edjob-tl-event");
  if(event){ edJobShowEvent(event); return }
  if(e.target.closest("#edJobCatalogueTab")){ setEdJobCatalogueFolded(false); return }
  if(e.target.closest("input")) return;
  const head=e.target.closest(".edjob-faculty-head");
  if(head){ toggleEdJobFaculty(head); return }
  const li=e.target.closest("#edJobTodo .edjob-course.blocked");
  if(li) edJobWarn(li.dataset.id);
});
/** Folds or opens a subject, or explains an event, from the keyboard. */
$("edJobCourses")?.addEventListener("keydown",e=>{
  const event=e.target.closest(".edjob-tl-event");
  if(event&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); edJobShowEvent(event); return }
  const head=e.target.closest(".edjob-faculty-head");
  if(!head||(e.key!=="Enter"&&e.key!==" ")) return;
  e.preventDefault();
  toggleEdJobFaculty(head);
});
try{ if(localStorage.getItem("tornEdJobFold_catalogue")==="1") setEdJobCatalogueFolded(true) }
catch(e){ logProblem("Subject list state could not be read",e) }
if($("edJobCourses")) edJobPlanDrag($("edJobCourses"));
edJobSortable($("edJobDone"),{
  row:".edjob-course",
  movable:(li,e)=>!li.classList.contains("current")
    &&(e.pointerType==="mouse"||!!e.target.closest(".edjob-course-grip")),
  together:(a,b)=>edJobGroup(a)===edJobGroup(b),
  drop:()=>{
    pushEdJobUndo();
    window.edJobCourseOrder=[...document.querySelectorAll("#edJobDone .edjob-course.done")].map(x=>x.dataset.id);
    renderEdJob();
  }
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
/** Folds the API key panel into its vertical tab from its own heading while on this page. */
$("apiPanel")?.querySelector("summary")?.addEventListener("click",e=>{
  if(!document.body.classList.contains("edujob")) return;
  e.preventDefault();
  const wrap=$("edJobApiWrap");
  if(wrap) setEdJobFolded(wrap,true);
});
/** Chooses a perk row on click, Enter or Space. */
$("edJobPerks")?.addEventListener("click",e=>{
  if($("edJobPerks").dataset.dragged) return;
  const li=e.target.closest(".edjob-perk");
  if(li) toggleEdJobPerk(li.dataset.perk);
});
$("edJobPerks")?.addEventListener("keydown",e=>{
  const li=e.target.closest(".edjob-perk");
  if(!li||(e.key!=="Enter"&&e.key!==" ")) return;
  e.preventDefault();
  toggleEdJobPerk(li.dataset.perk);
});
edJobSortable($("edJobPerks"),{
  row:".edjob-perk",
  movable:li=>li.classList.contains("on"),
  together:(a,b)=>b.classList.contains("on"),
  drop:()=>{
    window.edJobPerkPrefs=[...document.querySelectorAll("#edJobPerks .edjob-perk.on")].map(li=>li.dataset.perk);
    renderEdJobPerks();
    renderEdJobCourses(edJobCourses());
  }
});
const EDJOB_COLUMNS={left:{sel:"#eduJobGrid>.grid-left",min:220},catalogue:{sel:"#edJobCatalogue",min:280},upcoming:{sel:"#edJobTodoWrap .edjob-courses",min:300}};
try{ window.edJobWidths=JSON.parse(localStorage.getItem("tornEdJobWidths")||"{}")||{} }
catch(e){ window.edJobWidths={}; logProblem("Column widths could not be read",e) }
/** Gives a column the width it was dragged to, or its natural width when none is set. */
function applyEdJobWidth(key){
  const el=document.querySelector(EDJOB_COLUMNS[key].sel);
  if(!el) return;
  const w=window.edJobWidths[key];
  el.style.width=w?w+"px":"";
  el.classList.toggle("sized",!!w);
}
/** Remembers the dragged column widths. */
function saveEdJobWidths(){
  try{ localStorage.setItem("tornEdJobWidths",JSON.stringify(window.edJobWidths)) }
  catch(e){ logProblem("Column widths could not be saved",e) }
}
/** Lets each column be made wider or narrower by dragging the bar beside it, and reset by double-clicking it. */
document.querySelectorAll("#pageEduJob .edjob-resizer").forEach(bar=>{
  const key=bar.dataset.for;
  let d=null;
  bar.addEventListener("pointerdown",e=>{
    if(e.button!==0) return;
    const el=document.querySelector(EDJOB_COLUMNS[key].sel);
    if(!el) return;
    e.preventDefault();
    d={x:e.clientX,w:el.getBoundingClientRect().width};
    bar.setPointerCapture(e.pointerId);
    bar.classList.add("dragging");
    document.body.classList.add("edjob-resizing");
  });
  bar.addEventListener("pointermove",e=>{
    if(!d) return;
    window.edJobWidths[key]=Math.round(Math.max(EDJOB_COLUMNS[key].min,Math.min(1200,d.w+e.clientX-d.x)));
    applyEdJobWidth(key);
    edJobSyncTimeline();
  });
  const end=()=>{
    if(!d) return;
    d=null;
    bar.classList.remove("dragging");
    document.body.classList.remove("edjob-resizing");
    saveEdJobWidths();
    edJobSyncTimeline();
  };
  bar.addEventListener("pointerup",end);
  bar.addEventListener("pointercancel",end);
  bar.addEventListener("dblclick",()=>{
    delete window.edJobWidths[key];
    applyEdJobWidth(key);
    saveEdJobWidths();
    edJobSyncTimeline();
  });
  applyEdJobWidth(key);
});
/** Folds the subject list into its vertical tab, or opens it again. */
function setEdJobCatalogueFolded(folded){
  $("edJobCourses")?.classList.toggle("catalogue-folded",folded);
  try{ localStorage.setItem("tornEdJobFold_catalogue",folded?"1":"0") }
  catch(e){ logProblem("Subject list state could not be saved",e) }
  if(typeof fitLeftColumns==="function") fitLeftColumns();
}
/** Folds a panel into its vertical tab, or opens it again. */
function setEdJobFolded(wrap,folded){
  wrap.classList.toggle("collapsed",folded);
  if(!folded) edJobSyncTimeline();
  try{localStorage.setItem("tornEdJobFold_"+wrap.id,folded?"1":"0")}
  catch(e){ logProblem("Panel state could not be saved",e) }
}
/** Folds a panel from its heading, or opens it from its tab. */
$("pageEduJob")?.addEventListener("click",e=>{
  const wrap=e.target.closest(".edjob-foldable");
  if(!wrap) return;
  if(e.target.closest(".edjob-fold")&&e.target.closest(".edjob-foldable")===wrap) setEdJobFolded(wrap,true);
  else if(e.target.closest(".config-tab")?.parentElement===wrap) setEdJobFolded(wrap,false);
});
document.querySelectorAll("#pageEduJob .edjob-foldable").forEach(wrap=>{
  try{ if(localStorage.getItem("tornEdJobFold_"+wrap.id)==="1") setEdJobFolded(wrap,true) }
  catch(e){ logProblem("Panel state could not be read",e) }
});
