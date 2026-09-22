// ======================================================================
// TESTING FEEDBACK  ·  A survey that posts to the same Discord channel as one
// text file, with the tables attached when the tester agrees to share them.
// ======================================================================
const TESTING_SECTIONS=[
  {id:"key",label:"What kind of key did you use?",options:["Access Only","Customised"]},
  {id:"parts",label:"1. Which parts of the site did you use?",options:[
    {label:"Investments Basic View",groups:[
      {id:"basic",label:"Did you try or view:",options:[
        "Changing the basic settings",
        "The Investments table",
        "The investments total calculator",
        "The buy next tool",
        "Selecting, skipping or deselecting different stocks in investments"]}]},
    {label:"Investments Advanced View",groups:[
      {id:"adv",label:"Did you try or view:",options:[
        "Changing the Money Stuff settings",
        "Changing the Education Stuff settings",
        "Changing the Miscellaneous Stuff settings",
        "Changing the Investment Preferences settings",
        "The Investments table",
        "The investments total calculator",
        "The buy next tool",
        "Selecting, skipping or deselecting different stocks in investments",
        "Adding investments to a custom plan"]}]},
    {label:"Planner View",groups:[
      {id:"paths",label:"Which planning paths did you try:",options:[
        "One of Everything","A Certain Investment","Custom Plan","1000 Energy",
        "Just Give Me Money","Increment Amount","Total Newbie"]},
      {id:"plancfg",label:"Did you try the:",options:[
        "Your Position settings","Planner Configuration settings"]},
      {id:"planuse",label:"Once the planner loaded did you:",options:[
        "Check off investments in suggested order",
        "Check off investments in a different order",
        "Move to a new page"]},
      {id:"tally",label:"Did you view the portfolio tally at the bottom?",options:["Yes"]}]},
    "Basic Banking",
    "Education & Job Planner",
    {label:"Other pages at the bottom",groups:[
      {id:"other",label:"Did you view:",options:[
        "Docs","Terms of Service","Feedback & Reporting","Scripts"]}]}
  ]}
];
const TESTING_TEXTS=[
  "This prototype was deliberately designed with no guide or tutorial. Were there any parts of navigating the interface you found difficult, or would like explained clearer?",
  "Are there parts of this tool you think another application performs better? If so why?",
  "Are you likely to use this app? If so which parts? If not, mind sharing why?",
  "Did you find any errors or issues while using the app?",
  "Is there anything you would add or change?"
];
const TESTING_SHARE_Q="Are you OK with sharing your investment and planner table data for analysis?";
const TESTING_SAVE_KEY="tornTestingFeedback";

// ---- the form ----------------------------------------------------------
function testingOpt(opt){ return typeof opt==="string"?{label:opt}:opt }
function testingId(sec,i){ return "tf-"+sec.id+"-"+i }
/** Builds one question and every question it reveals. */
function testingGroupEl(sec){
  const box=document.createElement("fieldset");
  box.className="tf-group";
  const legend=document.createElement("legend");
  legend.textContent=sec.label;
  box.appendChild(legend);
  sec.options.forEach((opt,i)=>{
    const o=testingOpt(opt);
    const lab=document.createElement("label");
    lab.className="tf-check";
    const cb=document.createElement("input");
    cb.type="checkbox";
    cb.id=testingId(sec,i);
    const sp=document.createElement("span");
    sp.textContent=o.label;
    lab.append(cb,sp);
    box.appendChild(lab);
    if(!o.groups) return;
    const sub=document.createElement("div");
    sub.className="tf-sub";
    sub.id=testingId(sec,i)+"-sub";
    sub.hidden=true;
    o.groups.forEach(g=>sub.appendChild(testingGroupEl(g)));
    box.appendChild(sub);
    cb.addEventListener("change",()=>{ sub.hidden=!cb.checked });
  });
  return box;
}
/** Draws the whole survey once. */
function buildTestingForm(){
  const host=$("tfQuestions");
  if(!host||host.dataset.built) return;
  host.dataset.built="1";
  TESTING_SECTIONS.forEach(sec=>host.appendChild(testingGroupEl(sec)));
  TESTING_TEXTS.forEach((q,i)=>{
    const field=document.createElement("div");
    field.className="field tf-text";
    const label=document.createElement("label");
    label.className="tf-question";
    label.htmlFor="tfText"+i;
    label.textContent=q;
    const ta=document.createElement("textarea");
    ta.id="tfText"+i;
    ta.rows=4;
    field.append(label,ta);
    host.appendChild(field);
  });
}
/** Runs a callback over every option in a question tree. */
function testingWalk(sec,fn){
  sec.options.forEach((opt,i)=>{
    const o=testingOpt(opt);
    fn(sec,i,o);
    if(o.groups) o.groups.forEach(g=>testingWalk(g,fn));
  });
}
function testingTitle(){ return "TFB - "+APP_VERSION+" - "+utcStamp()+" - "+feedbackWho() }
function refreshTestingTitle(){
  const el=$("tfTitle");
  if(el) el.textContent=testingTitle();
}
function testingTitleText(){ return $("tfTitle")?.textContent||testingTitle() }

// ---- saving and coming back --------------------------------------------
function testingState(){
  const checks={};
  TESTING_SECTIONS.forEach(sec=>testingWalk(sec,(s,i)=>{
    const cb=$(testingId(s,i));
    if(cb) checks[testingId(s,i)]=cb.checked;
  }));
  return {checks:checks,
    texts:TESTING_TEXTS.map((q,i)=>$("tfText"+i)?.value||""),
    share:!!($("tfShare")?.checked)};
}
function applyTestingState(st){
  if(!st) return;
  Object.entries(st.checks||{}).forEach(([id,on])=>{
    const cb=$(id);
    if(!cb) return;
    cb.checked=!!on;
    const sub=$(id+"-sub");
    if(sub) sub.hidden=!on;
  });
  (st.texts||[]).forEach((v,i)=>{ const ta=$("tfText"+i); if(ta) ta.value=v });
  if($("tfShare")) $("tfShare").checked=!!st.share;
}
function saveTestingForm(){
  try{
    localStorage.setItem(TESTING_SAVE_KEY,JSON.stringify(testingState()));
    feedbackToast("Form saved");
  }catch(e){
    logProblem("Testing feedback could not be saved",e);
    renderFeedbackStatus([],["The form could not be saved in this browser."],true,{el:"tfStatus"});
  }
}
function loadTestingForm(){
  try{
    const raw=localStorage.getItem(TESTING_SAVE_KEY);
    if(raw) applyTestingState(JSON.parse(raw));
  }catch(e){ logProblem("Saved testing feedback could not be read",e) }
}
/** Opens the survey with anything already saved filled back in. */
function openTestingForm(){
  buildTestingForm();
  if(!window.testingLoaded){ window.testingLoaded=true; loadTestingForm() }
  refreshTestingTitle();
}

// ---- the report --------------------------------------------------------
function testingSectionLines(sec,depth,out){
  const pad="  ".repeat(depth);
  out.push(pad+sec.label);
  sec.options.forEach((opt,i)=>{
    const o=testingOpt(opt);
    const on=!!($(testingId(sec,i))?.checked);
    out.push(pad+"  ["+(on?"x":" ")+"] "+o.label);
    if(o.groups&&on) o.groups.forEach(g=>testingSectionLines(g,depth+2,out));
  });
  out.push("");
}
function testingReport(){
  const out=[testingTitleText(),""];
  TESTING_SECTIONS.forEach(sec=>testingSectionLines(sec,0,out));
  TESTING_TEXTS.forEach((q,i)=>{
    out.push(q);
    out.push("  "+((($("tfText"+i)?.value)||"").trim()||"(no answer)"));
    out.push("");
  });
  out.push(TESTING_SHARE_Q+" "+($("tfShare")?.checked?"Yes":"No"));
  return out.join("\n");
}
function testingAnswered(){
  let any=false;
  TESTING_SECTIONS.forEach(sec=>testingWalk(sec,(s,i)=>{ if($(testingId(s,i))?.checked) any=true }));
  return any||TESTING_TEXTS.some((q,i)=>((($("tfText"+i)?.value)||"").trim()!==""));
}
async function submitTestingFeedback(){
  const btn=$("tfSubmit");
  refreshTestingTitle();
  if(!testingAnswered()){
    renderFeedbackStatus([],["Nothing was sent: the form is empty."],true,{el:"tfStatus"});
    return;
  }
  if(btn){ btn.disabled=true; btn.textContent="Sending..." }
  const good=[], bad=[];
  const title=testingTitleText().trim();
  const report=testingReport();
  const files=[{name:safeFileName(title)+".txt",type:"text/plain",text:report}];
  if($("tfShare")?.checked) ["investment-state","planner-state"].forEach(key=>{
    try{ files.push(FEEDBACK_BUILDERS[key]()) }
    catch(e){ bad.push(key+" could not be pulled - "+(e.message||"unknown error")) }
  });
  const fd=new FormData();
  fd.append("payload_json",JSON.stringify({content:scrubKey(title).slice(0,1990)}));
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
    good.push("Sent: "+files.map(f=>f.name).join(", "));
  }else{
    bad.unshift("Form failed to submit - "+why+".");
  }
  renderFeedbackStatus(good,bad,sent,{el:"tfStatus",copy:()=>report});
  if(btn){ btn.disabled=false; btn.textContent="Submit form" }
}
$("tfSave")?.addEventListener("click",saveTestingForm);
$("tfSubmit")?.addEventListener("click",submitTestingFeedback);
/** Opens Testing Feedback and remembers where to come back to. */
function goTesting(){
  window.tosReturnTo=document.body.classList.contains("planner")?"planner":"investments";
  history.pushState(null,"","#testing");
  setPage("testing");
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".tf-jump").forEach(a=>
  a.addEventListener("click",e=>{ e.preventDefault(); goTesting() }));
$("testingCta")?.addEventListener("click",goTesting);
$("tfOk")?.addEventListener("click",()=>{
  const back=window.tosReturnTo||"investments";
  history.pushState(null,"","#"+back);
  setPage(back);
  window.scrollTo({top:0,behavior:"smooth"});
});
