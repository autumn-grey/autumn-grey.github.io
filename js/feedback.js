// ======================================================================
// FEEDBACK & REPORTING  ·  A form that posts to a Discord channel, with the
// logs for whatever the user says went wrong attached to it.
// ======================================================================
// A webhook is not a token: it can only post into the one channel it was made
// for, cannot read anything, and dies the moment it is deleted. It is in the
// page source because the page has no backend, so treat it as public and
// regenerate it if the channel ever gets spammed.
const FEEDBACK_WEBHOOK="https://discord.com/api/webhooks/1545275151774515200/_bnIUWt7SU7yAqDuITkTKoA6eTxfg_l__ejZ5IwMJPy8SiTMFTHBlcxOGOYKGV2f2RRh";
const AUTUMN_XID=4386333;
// Torn's compose page takes a recipient and nothing else, so the subject and
// body cannot be prefilled and the copy button stays.
const TORN_COMPOSE="https://www.torn.com/messages.php#/p=compose&XID="+AUTUMN_XID;
// Discord caps a message at 2000 characters. The longest possible heading is
// the title (66 with a 15 character Torn name) plus the longest related-to line
// (43) plus the newlines between them, which is 112. 1800 leaves that room and
// a little slack, so the whole form always travels as one readable message.
const FEEDBACK_MAX=1800;
// The running count only appears once the limit is close enough to matter.
const FEEDBACK_COUNT_FROM=1700;
const FEEDBACK_PLACEHOLDER="Please explain the problem you've encountered, what you were doing when this happened and anything else you think might be helpful";
// Which logs go with which answer. The error log always goes.
const FEEDBACK_ATTACHMENTS={
  api:["error-log","api-log"],
  planner:["error-log","planner-state"],
  investments:["error-log","investment-state"],
  other:["error-log","api-log","planner-state","investment-state"]
};

// Reports are timestamped in UTC. Local time reads better for one person and
// sorts into nonsense once reports arrive from sixteen countries.
function utcStamp(){
  const d=new Date();
  const p=n=>String(n).padStart(2,"0");
  return d.getUTCFullYear()+"-"+p(d.getUTCMonth()+1)+"-"+p(d.getUTCDate())+" "
        +p(d.getUTCHours())+":"+p(d.getUTCMinutes())+":"+p(d.getUTCSeconds())+" UTC";
}
function feedbackWho(){
  const id=+(window.userId||0);
  const name=window.userName||"Unknown";
  return name+" ["+(id||"?")+"]";
}
function feedbackTitle(){
  return ($("fbType")?.value==="inc"?"INC":"FSQ")+" - "+APP_VERSION+" - "+utcStamp()+" - "+feedbackWho();
}
// A key must never leave the browser, so every file is swept for it on the way
// out even though nothing is supposed to write it in the first place.
function scrubKey(text){
  const key=($("apiKey")?.value||"").trim();
  let out=String(text==null?"":text);
  if(key.length>=8) out=out.split(key).join("[api key removed]");
  return out;
}
// Discord rejects some characters in an attachment name, and the title is full
// of them.
function safeFileName(s){
  return String(s).replace(/[^A-Za-z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,180);
}

// ---- the attachments ---------------------------------------------------
// Every setting that shapes a number, so a report can be reproduced exactly.
function configurationRows(){
  const out=[["Setting","Value"]];
  SAVED_FIELDS.forEach(k=>{
    const el=$(k);
    if(!el) return;
    out.push([k, el.type==="checkbox"?(el.checked?"on":"off"):String(el.value)]);
  });
  const courses=Object.entries(educationCourseState()||{}).filter(([,v])=>v).map(([k])=>k);
  out.push(["education courses studied", courses.length?courses.join(" "):"none"]);
  out.push(["pinned stocks",[...(window.pinnedStocks||[])].sort().join(" ")||"none"]);
  out.push(["IST pinned",window.dudPinned?"yes":"no"]);
  out.push(["situational stocks ticked",[...prioritisedTickers()].sort().join(" ")||"none"]);
  out.push(["marked owned",[...window.ownedRows].sort().join(" ")||"none"]);
  out.push(["marked skipped",[...window.skippedRows].sort().join(" ")||"none"]);
  out.push(["ticked to plan",[...window.selectedRows].sort().join(" ")||"none"]);
  out.push(["view",document.body.classList.contains("basic")?"Basic":"Advanced"]);
  const age=marketCacheAge();
  out.push(["market data age (hours)",age==null?"none":age.toFixed(1)]);
  return out;
}
const FEEDBACK_BUILDERS={
  "error-log":()=>{
    const log=$("debugLogBody");
    const lines=log&&log.children.length
      ? [...log.children].map(d=>[...d.childNodes].map(n=>n.textContent.trim()).filter(Boolean).join(" "))
      : ["No problems were logged in this session."];
    return {name:"error-log.txt",type:"text/plain",
      text:["Error log",APP_VERSION,utcStamp(),feedbackWho(),""].concat(lines).join("\n")};
  },
  // Each of these checks the thing itself rather than the row count: every one
  // of these files carries a header and a settings footer, so it is never empty
  // even when there is no data in it at all.
  "api-log":()=>{
    const el=$("userStatus");
    if(!el||el.hidden||!el.querySelector(".us-wrap"))
      throw new Error("no API report on this page yet, refresh your data first");
    return {name:"api-log.txt",type:"text/plain",text:userStatusText()};
  },
  "planner-state":()=>{
    if(!(window.planStepOrder||[]).length) throw new Error("no plan has been built yet");
    return {name:"planner-state.tsv",type:"text/tab-separated-values",
      text:outText(planTableRows())+"\n\n"+outText(configurationRows())};
  },
  "investment-state":()=>{
    if(!rows.length) throw new Error("the investments table is empty, refresh your data first");
    return {name:"investment-state.tsv",type:"text/tab-separated-values",
      text:outText(investmentsTableRows())+"\n\n"+outText(configurationRows())};
  }
};

// ---- the form ----------------------------------------------------------
// Rebuilt on every change and again at submit, so the timestamp is the moment
// the report was sent. It is displayed rather than typed into, so there is
// nothing to preserve.
function refreshFeedbackTitle(){
  const el=$("fbTitle");
  if(el) el.textContent=feedbackTitle();
}
function fbTitleText(){ return $("fbTitle")?.textContent||feedbackTitle() }
function syncFeedbackCount(){
  const ta=$("fbBody"), el=$("fbCount");
  if(!ta||!el) return;
  const n=ta.value.length;
  el.textContent=(n>=FEEDBACK_COUNT_FROM?n+"/"+FEEDBACK_MAX:String(FEEDBACK_MAX))+" character limit";
  el.classList.toggle("full",n>=FEEDBACK_MAX);
}
// Removed and re-added so a second overflow restarts the animation rather than
// being swallowed while the first one is still running.
function fbFlashLimit(){
  const box=document.querySelector(".fb-body-box");
  if(!box) return;
  box.classList.remove("fb-limit");
  void box.offsetWidth;
  box.classList.add("fb-limit");
  clearTimeout(window.fbLimitTimer);
  window.fbLimitTimer=setTimeout(()=>box.classList.remove("fb-limit"),700);
}
function syncFeedbackType(){
  const inc=$("fbType")?.value==="inc";
  const area=$("fbAreaField"), note=$("fbNote"), body=$("fbBody");
  if(area) area.hidden=!inc;
  if(note) note.hidden=!inc;
  if(body) body.placeholder=inc?FEEDBACK_PLACEHOLDER:"";
  syncFeedbackCount();
  refreshFeedbackTitle();
}
function feedbackToast(text){
  let t=$("fbToast");
  if(!t){ t=document.createElement("div"); t.id="fbToast"; t.className="fb-toast"; document.body.appendChild(t) }
  t.textContent=text; t.hidden=false;
  clearTimeout(window.fbToastTimer);
  window.fbToastTimer=setTimeout(()=>{ t.hidden=true },1800);
}
// Green for what worked, red underneath for what did not, and the red half
// carries the way to reach Autumn by hand.
function renderFeedbackStatus(good,bad,plain,opts){
  const o=opts||{};
  const el=$(o.el||"fbStatus");
  if(!el) return;
  el.hidden=false;
  el.innerHTML="";
  const text=document.createElement("div");
  text.className="fb-status-text";
  if(good.length){
    const p=document.createElement("p");
    p.className="fb-ok";
    p.textContent=good.join("\n");
    text.appendChild(p);
  }
  if(bad.length){
    const p=document.createElement("p");
    p.className="fb-bad";
    // A form that failed to reach Autumn needs the way to reach her by hand.
    // A form the user has not finished filling in does not.
    if(plain){ p.textContent=bad.join("\n") }
    else{
      p.append(bad.join("\n")+"\nPlease copy this result and send to AutumnGrey directly ");
      const a=document.createElement("a");
      a.href=TORN_COMPOSE; a.target="_blank"; a.rel="noopener noreferrer"; a.textContent="here";
      p.appendChild(a);
      p.append(".");
    }
    text.appendChild(p);
  }
  el.appendChild(text);
  if(bad.length&&!plain){
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="btn btn-icon fb-copy";
    btn.title="Copy the whole form";
    btn.setAttribute("aria-label","Copy the whole form");
    btn.innerHTML=COPY_ICON;
    btn.addEventListener("click",()=>{
      const all=o.copy?o.copy():[fbTitleText(),"",$("fbBody")?.value||"","",good.join("\n"),bad.join("\n")]
        .filter((v,i)=>!(v===""&&i>3)).join("\n");
      const done=()=>feedbackToast("Whole form copied");
      if(navigator.clipboard?.writeText) navigator.clipboard.writeText(all).then(done,()=>copyFallback(all,done));
      else copyFallback(all,done);
    });
    el.appendChild(btn);
  }
}
async function submitFeedback(){
  const btn=$("fbSubmit");
  const inc=$("fbType")?.value==="inc";
  refreshFeedbackTitle();
  const title=fbTitleText().trim();
  const body=($("fbBody")?.value||"").trim();
  if(!body){ renderFeedbackStatus([],["Nothing was sent: the body is empty."],true); return }
  if(btn){ btn.disabled=true; btn.textContent="Sending..." }
  const good=[], bad=[];
  const related=inc?"Related to: "+($("fbArea")?.selectedOptions[0]?.textContent||""):"";
  const content=[title,related,"",body].filter(v=>v!=="").join("\n");
  const files=[];
  const wanted=inc?(FEEDBACK_ATTACHMENTS[$("fbArea")?.value]||FEEDBACK_ATTACHMENTS.other):[];
  wanted.forEach(key=>{
    try{ files.push(FEEDBACK_BUILDERS[key]()) }
    catch(e){ bad.push(key+" could not be pulled - "+(e.message||"unknown error")) }
  });
  const fd=new FormData();
  fd.append("payload_json",JSON.stringify({content:scrubKey(content).slice(0,1990)}));
  files.forEach((f,i)=>fd.append("files["+i+"]",
    new Blob([scrubKey(f.text)],{type:f.type}),f.name));
  let sent=false, why="";
  try{
    const res=await fetch(FEEDBACK_WEBHOOK+"?wait=true",{method:"POST",body:fd});
    sent=res.ok;
    if(!res.ok) why="the server answered "+res.status+(res.status===429?" (rate limited, try again in a minute)":"");
  }catch(e){ why=e.message||"the request could not be sent" }
  if(sent){
    good.push("Form submitted successfully.");
    good.push(files.length?"Sent: the form, plus "+files.map(f=>f.name).join(", ")
                          :"Sent: the form.");
  }else{
    bad.unshift("Form failed to submit - "+why+".");
  }
  renderFeedbackStatus(good,bad);
  if(sent&&!bad.length){ if($("fbBody")) $("fbBody").value=""; syncFeedbackCount() }
  if(btn){ btn.disabled=false; btn.textContent="Submit form" }
}
$("fbType")?.addEventListener("change",syncFeedbackType);
$("fbArea")?.addEventListener("change",()=>{});
// Typing at the limit is refused outright; a paste that would overshoot is
// trimmed on the way in. Both shake.
$("fbBody")?.addEventListener("beforeinput",e=>{
  if(/delete|history/i.test(e.inputType||"")) return;
  const ta=e.target;
  const replacing=ta.selectionEnd-ta.selectionStart;
  const adding=(e.data||"").length||1;
  if(ta.value.length-replacing+adding>FEEDBACK_MAX){
    e.preventDefault();
    fbFlashLimit();
    syncFeedbackCount();
  }
});
$("fbBody")?.addEventListener("input",()=>{
  const ta=$("fbBody");
  if(ta.value.length>FEEDBACK_MAX){ ta.value=ta.value.slice(0,FEEDBACK_MAX); fbFlashLimit() }
  syncFeedbackCount();
});
$("fbSubmit")?.addEventListener("click",submitFeedback);
// Opens Feedback & Reporting with the right type already chosen.
function goFeedback(kind){
  window.tosReturnTo=document.body.classList.contains("planner")?"planner":"investments";
  history.pushState(null,"","#feedback");
  setPage("feedback");
  const sel=$("fbType");
  if(sel&&kind){ sel.value=kind; syncFeedbackType() }
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".fb-jump").forEach(a=>
  a.addEventListener("click",e=>{ e.preventDefault(); goFeedback(a.dataset.fb) }));
$("feedbackLink")?.addEventListener("click",e=>{
  e.preventDefault();
  window.tosReturnTo=document.body.classList.contains("planner")?"planner":"investments";
  history.pushState(null,"","#feedback");
  setPage("feedback");
  window.scrollTo({top:0,behavior:"smooth"});
});
// The two placeholders navigate like the other footer pages.
$("scriptsLink")?.addEventListener("click",e=>{
  e.preventDefault();
  window.tosReturnTo=document.body.classList.contains("planner")?"planner":"investments";
  history.pushState(null,"","#scripts");
  setPage("scripts");
  window.scrollTo({top:0,behavior:"smooth"});
});
["scriptsOk"].forEach(id=>$(id)?.addEventListener("click",()=>{
  const back=window.tosReturnTo||"investments";
  history.pushState(null,"","#"+back);
  setPage(back);
  window.scrollTo({top:0,behavior:"smooth"});
}));
$("fbOk")?.addEventListener("click",()=>{
  const back=window.tosReturnTo||"investments";
  history.pushState(null,"","#"+back);
  setPage(back);
  window.scrollTo({top:0,behavior:"smooth"});
});
