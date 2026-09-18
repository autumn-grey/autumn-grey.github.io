// ======================================================================
// EDUCATION & JOB  ·  The course planner
//
// The Investments page already keeps a tick per course, because several
// stocks are worth more or less depending on how much studying is left. This
// page is the other way round: the same ticks, read as a plan. Nothing is
// stored here. The checkboxes on the Investments page remain the one record
// of what has been studied, and ticking a course here ticks it there, so the
// two can never drift apart and there is still only one thing to save.
//
// Course lengths, prices, prerequisites and rewards come from the game, via
// the education selection fetched at refresh. Before a refresh there is only
// the built-in length and price table, so nothing is known to come first and
// the order is simply shortest course first. The page says so when that is
// the case, because an order worked out without prerequisites is a weaker
// thing and should not look the same as one worked out with them.
// ======================================================================

// The faculty a course belongs to is the heading it sits under, rather than a
// second list here that could fall out of step with the markup.
function edJobFaculty(cb){
  const topic=cb.closest(".education-topic");
  return topic?.querySelector("summary")?.textContent.trim()||"Other";
}
// Every course, as the planner sees it: what it is, whether it is done, and
// what the game says it costs, takes, needs first and gives back.
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
      cost:courseCostFor(cb.id),
      needs:extra.needs||[],
      gains:extra.gains||[]
    };
  });
}
// Days a single course takes for this player. The reductions are the same ones
// the Investments page applies, so the two always quote the same figure.
function edJobCourseDays(course){
  return course.days*(1-educationTimeReduction())*educationJpFactor();
}
// The order to study what is left in. Repeatedly takes whatever is open —
// every prerequisite either already done or already placed — and picks the
// shortest of those, so quick courses are not left stranded behind long ones.
// The prerequisites are what make the order valid, so the game's course tiers
// are not consulted: a tier missing from the data would quietly reorder the
// plan, and it would not say anything the prerequisites have not already.
// A prerequisite naming a course this app has no tick for is ignored rather
// than blocking it forever.
function edJobOrder(list){
  const known=new Set(list.map(c=>c.id));
  const have=new Set(list.filter(c=>c.done).map(c=>c.id));
  const left=list.filter(c=>!c.done);
  const out=[], placed=new Set();
  const open=c=>!placed.has(c.id)
    && c.needs.every(n=>have.has(n)||placed.has(n)||!known.has(n));
  for(;;){
    const next=left.filter(open)
      .sort((a,b)=>(a.days-b.days)||a.name.localeCompare(b.name))[0];
    if(!next) break;
    out.push(next);
    placed.add(next.id);
  }
  // Nothing should reach here, but a prerequisite loop in the data would leave
  // courses unplaced, and dropping them silently would understate the plan.
  left.filter(c=>!placed.has(c.id)).forEach(c=>out.push(c));
  return out;
}
// A course can be started when everything it needs is already done.
function edJobUnlocked(course,have){
  return course.needs.every(n=>have.has(n));
}
// "3 days", "2 weeks 3 days" — course lengths are short enough that the
// calendar walk formatDuration does for whole plans is more than they need.
function edJobDays(days){
  const d=Math.round(days);
  if(!(d>0)) return "—";
  if(d<14) return `${d} day${d===1?"":"s"}`;
  const weeks=Math.floor(d/7), rest=d%7;
  return `${weeks} week${weeks===1?"":"s"}`+(rest?` ${rest} day${rest===1?"":"s"}`:"");
}

// ----------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------
// The four figures across the top: what is left, and what it will take.
function renderEdJobSummary(list){
  const box=$("edJobSummary");
  if(!box) return;
  const left=list.filter(c=>!c.done);
  const days=left.reduce((n,c)=>n+edJobCourseDays(c),0);
  const cost=left.reduce((n,c)=>n+c.cost,0);
  const raw=left.reduce((n,c)=>n+c.days,0);
  const tiles=[
    ["Courses left",`${left.length}`,`of ${list.length}`],
    // What is saved is a span of years like the total, not a course length, so
    // it is read out the same way rather than as a pile of weeks.
    ["Time to finish",formatDuration(days),
      raw>days?`${formatDuration(raw-days)} saved`:"no reductions set"],
    ["Course fees",money(cost),"waived by an IST block"],
    ["Finished by",left.length?edJobFinishDate(days):"—","studying back to back"]
  ];
  box.innerHTML=tiles.map(([label,value,note])=>
    `<div class="edjob-tile"><div class="edjob-tile-label">${esc(label)}</div>`
    +`<div class="edjob-tile-value">${esc(value)}</div>`
    +`<div class="edjob-tile-note">${esc(note)}</div></div>`).join("");
}
function edJobFinishDate(days){
  const d=new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()+Math.round(days));
  return d.toISOString().slice(0,10);
}
// Where the time reduction is coming from, broken out so it is obvious which
// one is still missing. These are set on the Investments page rather than
// here, so that there is one place to change them.
function renderEdJobReductions(){
  const box=$("edJobReductions");
  if(!box) return;
  const merits=Math.max(0,Math.min(10,+($("educationMerits")?.value||0)));
  const rows=[
    ["Education Length merits",merits*EDU_MERIT_REDUCTION,`${merits} of 10`],
    ["WSU stock block",boolVal("wsuOwned")?0.10:0,boolVal("wsuOwned")?"owned":"not owned"],
    ["Principal job perk",boolVal("edJobPerk")?0.10:0,boolVal("edJobPerk")?"earned":"not earned"]
  ];
  const total=educationTimeReduction();
  const jp=companyJp();
  box.innerHTML=rows.map(([label,cut,note])=>
    `<div class="edjob-red${cut?" on":""}"><span>${esc(label)}</span>`
    +`<span class="edjob-red-cut">-${Math.round(cut*100)}%</span>`
    +`<span class="edjob-red-note">${esc(note)}</span></div>`).join("")
    +`<div class="edjob-red total"><span>Total</span>`
    +`<span class="edjob-red-cut">-${Math.round(total*100)}%</span>`
    +`<span class="edjob-red-note">40% is the most there is</span></div>`
    +`<div class="edjob-red${jp?" on":""}"><span>Job point specials</span>`
    +`<span class="edjob-red-cut">${jp?hoursPerDayLabel(companyHoursPerDay()):"none"}</span>`
    +`<span class="edjob-red-note">${jp?"off the course you are on":"Fitness Centre 1★ or Hair Salon 7★"}</span></div>`;
}
// The picker. One block per faculty, open where something is still to do, so
// a finished faculty folds itself away without hiding anything.
function renderEdJobPicker(list){
  const box=$("edJobPicker");
  if(!box) return;
  const hide=boolVal("edJobHideDone");
  const find=String($("edJobFind")?.value||"").trim().toLowerCase();
  const have=new Set(list.filter(c=>c.done).map(c=>c.id));
  const name=Object.fromEntries(list.map(c=>[c.id,c.name]));
  const faculties=[...new Set(list.map(c=>c.faculty))];
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
      if(!c.done&&blockers.length) notes.push(`needs ${blockers.join(", ")}`);
      c.gains.forEach(g=>notes.push(g));
      return `<label class="edjob-course${c.done?" done":""}${!c.done&&!open?" locked":""}">`
        +`<input type="checkbox" class="edjob-course-check" data-course-id="${esc(c.id)}"`
        +`${c.done?" checked":""}>`
        +`<span class="edjob-course-name">${esc(c.name)}</span>`
        +`<span class="edjob-course-meta">${esc(edJobDays(edJobCourseDays(c)))}`
        +` · ${esc(money(c.cost))}</span>`
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
// The plan: everything still to do, in the order to do it, with the totals
// running alongside so any course can be read as "and by then".
function renderEdJobPlan(list){
  const box=$("edJobPlan");
  if(!box) return;
  const order=edJobOrder(list);
  if(!order.length){
    box.innerHTML=`<p class="help">Every course is ticked. There is nothing left to study.</p>`;
    return;
  }
  let days=0, cost=0;
  const rows=order.map((c,i)=>{
    days+=edJobCourseDays(c);
    cost+=c.cost;
    return `<tr><td>${i+1}</td><td>${esc(c.name)}</td><td>${esc(c.faculty)}</td>`
      +`<td>${esc(edJobDays(edJobCourseDays(c)))}</td>`
      +`<td>${esc(money(c.cost))}</td>`
      +`<td>${esc(formatDuration(days))}</td>`
      +`<td>${esc(money(cost))}</td></tr>`;
  }).join("");
  box.innerHTML=`<table class="edjob-table"><thead><tr>`
    +`<th>#</th><th>Course</th><th>Faculty</th><th>Takes</th><th>Costs</th>`
    +`<th>Done after</th><th>Spent by then</th></tr></thead>`
    +`<tbody>${rows}</tbody></table>`;
}
// Says where the course details came from, because an order worked out without
// the game's prerequisites is a weaker thing and should not look the same.
function renderEdJobSource(){
  const el=$("edJobSource");
  if(!el) return;
  if(window.live&&window.live.courseInfo){
    el.textContent="Course lengths, fees, prerequisites and rewards are this"
      +" refresh's, straight from Torn.";
    el.classList.remove("warn");
    return;
  }
  el.textContent=window.educationIndexError
    ? `Course details couldn't be fetched (${window.educationIndexError}), so lengths and fees are the built-in ones and the order ignores prerequisites.`
    : "Refresh to pick up course prerequisites and rewards from Torn. Until then lengths and fees are the built-in ones and the order ignores prerequisites.";
  el.classList.add("warn");
}
function renderEdJob(){
  const list=edJobCourses();
  renderEdJobSummary(list);
  renderEdJobReductions();
  renderEdJobPicker(list);
  renderEdJobPlan(list);
  renderEdJobSource();
}

// ----------------------------------------------------------------------
// Wiring
// ----------------------------------------------------------------------
// The tick goes to the Investments checkbox, and the page is redrawn from
// that, so the planner never holds a copy of the answer.
$("edJobPicker")?.addEventListener("change",e=>{
  const cb=e.target.closest(".edjob-course-check");
  if(!cb) return;
  const master=$(cb.dataset.courseId);
  if(!master) return;
  master.checked=cb.checked;
  // Course ticks move several stock valuations, so the Investments page is
  // brought up to date at the same time.
  if(typeof calculate==="function") calculate();
  renderEdJob();
});
$("edJobHideDone")?.addEventListener("change",renderEdJob);
$("edJobFind")?.addEventListener("input",()=>renderEdJobPicker(edJobCourses()));
