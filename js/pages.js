buildPlanPrioritise();buildPlanTargets();buildBankTermOptions();buildBankingTermOptions();
// Cached market data first: the item dropdowns and bank rates have to exist
// before saved settings are re-applied over them.
const hadCache=restoreMarket();
loadLocal();
loadBankingTouched();
syncBankingFromAdvanced();
// The pin buttons are built above, before loadLocal has read the saved pins,
// so their lit state has to be applied once the pins are actually known.
syncPinnedButtons();
applyDefaultPins();
syncBankBoxes();
syncPlanExtraAll();updateGoalDesc();setupTableSorting();calculate();
if(hadCache){
  const age=marketCacheAge();
  applyDefaultBoosters();
  setStatus(age==null?"Showing saved market data · refresh for today's figures."
    :`Showing market data saved ${age<1?"less than an hour":age<48?Math.round(age)+" hour"+(Math.round(age)===1?"":"s"):Math.round(age/24)+" days"} ago · refresh for today's figures.`);
}
// Page switching. Basic/Advanced applies to the Investments page only, so the
// view toggle is hidden while the Planner is open.
const PAGES=["investments","planner","banking","tos","docs","feedback","testing","scripts","edujob"];
function setPage(page){
  if(!PAGES.includes(page)) page="investments";
  const planner=page==="planner", tos=page==="tos", docs=page==="docs", feedback=page==="feedback";
  const scripts=page==="scripts", eduJob=page==="edujob", testing=page==="testing";
  const banking=page==="banking";
  document.body.classList.toggle("planner",planner);
  // Basic/Advanced is an Investments idea, so the toggle is hidden here too.
  document.body.classList.toggle("banking",banking);
  // Education & Job is a section of its own rather than a footer page, so it
  // keeps the full chrome and turns the accent aqua instead.
  document.body.classList.toggle("edujob",eduJob);
  // Every page reached from the footer shares the ToS page's stripped-back chrome.
  document.body.classList.toggle("tos",tos||docs||feedback||testing||scripts);
  $("pageInvestments").hidden=page!=="investments";
  $("pagePlanner").hidden=!planner;
  if($("pageBanking")) $("pageBanking").hidden=!banking;
  $("pageTos").hidden=!tos;
  $("pageDocs").hidden=!docs;
  if($("pageFeedback")) $("pageFeedback").hidden=!feedback;
  if($("pageTesting")) $("pageTesting").hidden=!testing;
  if($("pageScripts")) $("pageScripts").hidden=!scripts;
  if($("pageEduJob")) $("pageEduJob").hidden=!eduJob;
  // Opened fresh each time so the timestamp in the title is current.
  if(feedback&&typeof syncFeedbackType==="function") syncFeedbackType();
  // Fetched on first open rather than at boot, so the file costs nothing to
  // anyone who never looks at this page.
  if(scripts&&typeof loadScripts==="function"){ loadScripts(); renderScripts() }
  if(testing&&typeof openTestingForm==="function") openTestingForm();
  const cta=$("testingCta");
  if(cta) cta.hidden=testing;
  // Each button shows whether its own page is the one open. Education & Job is
  // the exception: on its own page the row is replaced by the way back out.
  const inv=$("goInvestments"), pln=$("goPlanner"), bnk=$("goBanking"), edj=$("goEduJob");
  if(inv){ inv.classList.toggle("active",page==="investments"); inv.setAttribute("aria-pressed",String(page==="investments")) }
  if(pln){ pln.classList.toggle("active",planner); pln.setAttribute("aria-pressed",String(planner)) }
  if(bnk){ bnk.classList.toggle("active",banking); bnk.setAttribute("aria-pressed",String(banking)) }
  if(edj){ edj.classList.toggle("active",eduJob); edj.setAttribute("aria-pressed",String(eduJob)) }
  // The API panel follows the active page so the key is always reachable. The
  // ToS page has no slot for it, so it is parked back on the Investments page.
  const api=$("apiPanel");
  if(api){
    if(planner) $("plannerApiSlot").appendChild(api);
    else if(banking) $("bankingApiSlot").appendChild(api);
    else if(document.body.classList.contains("basic")) $("noDataNotice")?.before(api);
    else $("collapseConfig")?.after(api);
  }
  if(location.hash!=="#"+page) history.replaceState(null,"","#"+page);
  if(typeof syncToTop==="function") syncToTop();
}
$("planPrioAll")?.addEventListener("change",e=>{
  document.querySelectorAll(".plan-prio").forEach(cb=>cb.checked=e.target.checked);
  // Unticking everything also drops the pins, or the plan would still be
  // aiming first at something it is no longer planning for.
  if(!e.target.checked){
    window.pinnedStocks.clear();
    window.dudPinned=false;
    syncPinnedButtons();
    savePinned();
  }
  markPlanStale();
});
$("planExtraAll")?.addEventListener("change",e=>{
  document.querySelectorAll(".plan-extra").forEach(cb=>cb.checked=e.target.checked);
  syncPlanExtraAll();
  markPlanStale();
});
document.querySelectorAll(".plan-extra").forEach(cb=>cb.addEventListener("change",syncPlanExtraAll));
// Planner settings never rebuild the plan by themselves any more, they just
// mark it out of date, and the button does the work.
["planGoal","planTarget","planTargetBlock","planTci","planIncMax","planPiOwn","planPiRent","planCayman","planCityBank"]
  .forEach(id=>$(id)?.addEventListener("change",planSettingChanged));
// One button per page rather than a toggle, so the page you are on is always
// shown filled in rather than being inferred from another button's label.
$("goInvestments")?.addEventListener("click",()=>setPage("investments"));
$("goPlanner")?.addEventListener("click",()=>setPage("planner"));
$("goBanking")?.addEventListener("click",()=>setPage("banking"));
// Education & Job and the orange button that leaves it again are the same kind
// of move as the three above, so they push a hash the same way.
["goEduJob","eduJobLink"].forEach(id=>$(id)?.addEventListener("click",e=>{
  e.preventDefault();
  history.pushState(null,"","#edujob");
  setPage("edujob");
  window.scrollTo({top:0,behavior:"smooth"});
}));
["goInvestmentsEduJob","investmentsLink"].forEach(id=>$(id)?.addEventListener("click",e=>{
  e.preventDefault();
  history.pushState(null,"","#investments");
  setPage("investments");
  window.scrollTo({top:0,behavior:"smooth"});
}));
// The ToS is reached by the footer link and left by the back button, so the
// hash is the single source of truth for which page is showing.
$("docsLink")?.addEventListener("click",e=>{
  e.preventDefault();
  window.tosReturnTo=document.body.classList.contains("planner")?"planner":"investments";
  history.pushState(null,"","#docs");
  setPage("docs");
  window.scrollTo({top:0,behavior:"smooth"});
});
// A Beautiful Secret picks a fresh video on every click. The href is set before
// the browser follows the link, so the anchor still works with JS disabled and
// a middle-click or "open in new tab" gets a real URL rather than a popup.
const SECRET_VIDEOS=["ZbM6WbUw7Bs","b6rkXGikuNA","bcXiwNjkhxU","8B1rXxwX-2E","PLOPygVcaVE",
  "lzplodCcz7U","lr_vl62JblQ","PmQhkaw_ypE","fKEXSWC-EqI","d-ae06Z1NcM","2riqL4GOfR8",
  "YCeQLeQiRP4","erh2ngRZxs0","szxp1f9EnP0","-5x5OXfe9KY","csnZJ1b_ESU","1IAXrxlDK6c",
  "tKNhPpUR0Pg","GmCrOTMAQ38","dcD_WXYWqHk","VV1XWJN3nJo","RyeYee2lxBY"];
function pickSecret(el){
  const id=SECRET_VIDEOS[Math.floor(Math.random()*SECRET_VIDEOS.length)];
  el.href="https://www.youtube.com/watch?v="+id;
}
// pointerdown fires before the click that follows the link, and also before the
// browser builds the context menu, so both routes get a freshly picked video.
["pointerdown","click","auxclick","contextmenu"].forEach(ev=>
  $("secretCard")?.addEventListener(ev,function(){pickSecret(this)}));
// The title doubles as a home button. From Docs or the ToS it returns to
// whichever working page you came from, which keeps the Basic/Advanced view
// you had. On a working page there is nowhere to go, so it does nothing.
function goHome(){
  if(!document.body.classList.contains("tos")) return;
  const back=window.tosReturnTo||"investments";
  history.pushState(null,"","#"+back);
  setPage(back);
  window.scrollTo({top:0,behavior:"smooth"});
}
$("homeBtn")?.addEventListener("click",goHome);
$("docsOk")?.addEventListener("click",()=>{
  const back=window.tosReturnTo||"investments";
  history.pushState(null,"","#"+back);
  setPage(back);
  window.scrollTo({top:0,behavior:"smooth"});
});
$("tosLink")?.addEventListener("click",e=>{
  e.preventDefault();
  // Remembered so OK can return here. A direct link to #tos has no previous
  // page of ours, so that case falls back to Investments.
  window.tosReturnTo=document.body.classList.contains("planner")?"planner":"investments";
  history.pushState(null,"","#tos");
  setPage("tos");
  window.scrollTo({top:0,behavior:"smooth"});
});
// OK goes back the way the reader came. history.back() would work when they
// arrived by the link, but not on a direct #tos load, so the page is set
// explicitly and the hash kept in step.
$("tosOk")?.addEventListener("click",()=>{
  const back=window.tosReturnTo||"investments";
  history.pushState(null,"","#"+back);
  setPage(back);
  window.scrollTo({top:0,behavior:"smooth"});
});
addEventListener("hashchange",()=>setPage(location.hash.replace("#","")||"investments"));
// Whichever page is on screen is the one the jump-to-top tab measures against.
function activePageEl(){
  if(!$("pageDocs").hidden) return $("pageDocs");
  if(!$("pageTos").hidden) return $("pageTos");
  if($("pageFeedback")&&!$("pageFeedback").hidden) return $("pageFeedback");
  if($("pageTesting")&&!$("pageTesting").hidden) return $("pageTesting");
  if($("pageScripts")&&!$("pageScripts").hidden) return $("pageScripts");
  if($("pageEduJob")&&!$("pageEduJob").hidden) return $("pageEduJob");
  if($("pageBanking")&&!$("pageBanking").hidden) return $("pageBanking");
  return document.body.classList.contains("planner")?$("pagePlanner"):$("pageInvestments");
}
function syncToTop(){
  const btn=$("toTop"), el=activePageEl();
  if(!btn||!el) return;
  // The Terms of Service is a single short read with its own OK button, so it
  // gets no tab at all.
  if(!$("pageTos").hidden){ btn.hidden=true; return }
  btn.hidden=el.getBoundingClientRect().top>=0;
  if(btn.hidden) return;
  // Once the footer scrolls into view the tab stops with it, so it parks at the
  // bottom of the lowest module instead of floating over the fine print.
  const foot=document.querySelector(".site-footer");
  const rest=window.innerWidth<=820?80:96;
  let bottom=rest;
  if(foot){
    const overlap=window.innerHeight-foot.getBoundingClientRect().top;
    if(overlap>bottom-10) bottom=overlap+10;
  }
  btn.style.bottom=bottom+"px";
}
$("toTop")?.addEventListener("click",()=>{
  const el=activePageEl();
  if(!el) return;
  window.scrollTo({top:Math.max(0,el.getBoundingClientRect().top+window.scrollY-12),behavior:"smooth"});
});
addEventListener("scroll",syncToTop,{passive:true});
addEventListener("resize",syncToTop);
