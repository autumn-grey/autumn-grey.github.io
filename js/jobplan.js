// ======================================================================
// JOB PLANNER
// ======================================================================
//
// Works out the fastest route to the player's Job Preferences target by simulating day by day: work stats from
// pay, trains and completed courses, city job promotions bought with job points, and Education points spent on
// work stats as a Principal. Where a route has a choice of when to move, every candidate day is simulated and
// the soonest finish wins. The functions in edjob.js that model effectiveness are reused, so the Snapshot and
// the planner always agree on what a day in a position pays.

/** Each city job rank's required Manual Labour, Intelligence and Endurance, lowest rank first. */
const CITY_JOB_REQS={
  Education:[[0,500,0],[300,750,500],[600,1000,700],[1000,1300,1000],[1500,2000,1500],[1500,3000,1500],[1500,5000,1500]],
  Law:[[0,0,1500],[1750,2500,5000],[2500,5000,7500],[3500,6500,7750],[4000,7250,10000],[6000,9000,15000]],
  Medical:[[0,300,0],[100,600,150],[175,1000,275],[300,1500,500],[600,2500,1000],[1300,5000,2000],[2600,10000,4000]]
};
/** The city jobs a player can target, and the name each is shown under. */
const CITY_TARGETS={Education:"Education",Law:"Law",Medical:"Medicine"};
/** The furthest ahead the planner looks, in days. */
const JOB_PLAN_HORIZON=3650;
/** The fewest days worth going back to a company for. */
const JOB_PLAN_MIN_COMPANY_STAY=5;
/** The days a new recruit waits before receiving trains. */
const JOB_PLAN_RECRUIT_DAYS=3;
/** The points a player starts a city job with the first time they join it. */
const JOB_PLAN_FIRST_POINTS=5;
const JP_STATS=["man","int","end"];

/** Returns a city job's ranks with their gains and requirements. */
function jpRanks(job){
  return Object.entries(CITY_JOBS[job]).map(([name,g],i)=>{
    const r=CITY_JOB_REQS[job][i];
    return {name,gain:{man:g[0],int:g[1],end:g[2]},req:{man:r[0],int:r[1],end:r[2]}};
  });
}
/** Returns whether a set of stats meets a requirement. */
function jpMeets(stats,req){
  return JP_STATS.every(k=>stats[k]>=req[k]);
}
/** Returns how far a stat is below what the current goal needs. */
function jpGap(ctx,s,k){
  return ctx.need?Math.max(0,ctx.need[k]-s.stats[k]):0;
}
/** Returns a copy of a planner state. */
function jpClone(s){
  return {...s,stats:{...s.stats},rank:{...s.rank},points:{...s.points}};
}
/** Adds the work stats from courses that complete on the state's day, once however many steps share that day. */
function jpCourses(ctx,s){
  // Reaching a city job's top rank ends a step without ending the day, and the next step starts on the same day.
  if(s.coursesDay===s.day) return;
  s.coursesDay=s.day;
  const c=ctx.courses.get(s.day);
  if(c) JP_STATS.forEach(k=>{ s.stats[k]+=c[k] });
}
/** Records an action the player should take. */
function jpEvent(s,log,text){
  if(log) log.events.push({day:s.day,text,stats:{...s.stats}});
}
/** Closes a day after payday, recording where the player stands. */
function jpEndDay(s,log,label){
  if(log) log.days.push({day:s.day,stats:{...s.stats},label});
  s.day++;
}
/** Returns "a" or "an" with a name. */
function jpA(name){
  return `a${/^[aeiou]/i.test(name)?"n":""} ${name}`;
}

// ----------------------------------------------------------------------
// Companies
// ----------------------------------------------------------------------
/** Returns a company type's positions with their requirements and gains, main stat first. */
function jpCompany(type){
  const name=(window.live?.companyTypes||[]).find(c=>String(c.id)===String(type))?.name||"company";
  const positions=edJobPositions("company:"+type).filter(n=>n!=="Director").map(n=>{
    const p=window.live?.positionStats?.[`${type}|${n}`];
    return p&&{name:n,req:p.req,gains:p.gains,keys:JP_STATS.filter(k=>p.gains[k]>0).sort((a,b)=>p.gains[b]-p.gains[a])};
  }).filter(Boolean);
  return {type:String(type),name,positions};
}
/** Returns what a company position pays this state each day, trains included. */
function jpCompanyGain(ctx,pos,s){
  const trains=s.tenure>=JOB_PLAN_RECRUIT_DAYS?ctx.trains:0;
  const job={...ctx.job,position:pos.name};
  const ws=edJobWorkStatEffect(s.stats,pos.req,!!+job.hr);
  const effect=edJobAfterGender(job,edJobEffect(job,ws)+s.settled+(+job.merits||0)+(+job.director||0));
  const share=Math.max(0,Math.min(1,effect/100));
  const out={};
  JP_STATS.forEach(k=>{ out[k]=Math.floor(pos.gains[k]*share) });
  pos.keys.forEach((k,i)=>{ out[k]+=trains*(i?25:50)/7 });
  return out;
}
/** Returns how much of a position's daily gain goes towards stats the goal still needs. */
function jpUseful(ctx,pos,s){
  const g=jpCompanyGain(ctx,pos,s);
  return JP_STATS.reduce((n,k)=>n+Math.min(g[k],jpGap(ctx,s,k)),0);
}
/** Returns the position whose main stat is still needed and that pays the most towards the goal. */
function jpBestPosition(ctx,s,positions){
  let best=null, bestUse=-1;
  positions.forEach(pos=>{
    if(jpGap(ctx,s,pos.keys[0])<=0) return;
    const use=jpUseful(ctx,pos,s);
    if(use>bestUse){ best=pos; bestUse=use }
  });
  return best;
}
/** Works one day in a company, moving position once the current one's main stat is done unless the role is fixed. */
function jpCompanyDay(ctx,s,log,fixed){
  jpCourses(ctx,s);
  const co=ctx.companies[s.company];
  let pos=co.positions.find(p=>p.name===s.pos);
  if(!fixed&&ctx.need&&(!pos||jpGap(ctx,s,pos.keys[0])<=0)){
    const best=jpBestPosition(ctx,s,co.positions);
    if(best&&best!==pos&&(!pos||jpUseful(ctx,best,s)>jpUseful(ctx,pos,s))){
      pos=best;
      s.pos=best.name;
      jpEvent(s,log,`Ask your director to move you to ${best.name}`);
    }
  }
  if(pos){
    const g=jpCompanyGain(ctx,pos,s);
    JP_STATS.forEach(k=>{ s.stats[k]+=g[k] });
    if(s.tenure>=JOB_PLAN_RECRUIT_DAYS) s.boughtTrains=(s.boughtTrains||0)+ctx.bought/7;
  }
  s.settled=Math.min(10,s.settled+1);
  s.tenure++;
  jpEndDay(s,log,`${pos?pos.name:"No position"} (${co.name})`);
}
/** Moves the player into a company, starting again as a recruit. */
function jpJoinCompany(ctx,s,type,log,from){
  s.company=String(type);
  s.pos=null;
  s.settled=0;
  s.tenure=0;
  s.inJob=null;
  const name=ctx.companies[s.company].name;
  jpEvent(s,log,type===ctx.home&&from?`Rejoin ${jpA(name)} company`:`${from?`Quit ${from} and join`:"Join"} ${jpA(name)} company`);
}

// ----------------------------------------------------------------------
// City jobs
// ----------------------------------------------------------------------
/** Works one day at a fixed daily gain. */
function jpFixedDay(ctx,s,log,gain,label){
  jpCourses(ctx,s);
  JP_STATS.forEach(k=>{ s.stats[k]+=gain[k] });
  jpEndDay(s,log,label);
}
/** Works one day at the top of a city job, spending Education points on needed stats. */
function jpTopDay(ctx,s,log,job){
  const ranks=ctx.ranks[job], top=ranks.length-1;
  jpCourses(ctx,s);
  JP_STATS.forEach(k=>{ s.stats[k]+=ranks[top].gain[k] });
  s.points[job]=(s.points[job]||0)+top+1;
  if(job==="Education"&&ctx.need){
    while(s.points[job]>=10){
      const k=JP_STATS.reduce((a,b)=>jpGap(ctx,s,b)>jpGap(ctx,s,a)?b:a);
      if(jpGap(ctx,s,k)<=0) break;
      if(!s.buying){ s.buying=true; jpEvent(s,log,"Spend Education points on work stats as they come in: 100 of a stat per 10 points") }
      s.stats[k]+=100;
      s.points[job]-=10;
    }
  }
  jpEndDay(s,log,`${ranks[top].name} (${CITY_TARGETS[job]})`);
}
/** Moves the player into a city job, at their old rank if they have worked it, or returns false when they lack its first rank's stats. */
function jpJoin(ctx,s,job,log,from){
  if(s.inJob===job) return true;
  const ranks=ctx.ranks[job];
  const returning=s.rank[job]!=null;
  if(!returning&&!jpMeets(s.stats,ranks[0].req)) return false;
  if(!returning){ s.rank[job]=0; s.points[job]=(s.points[job]||0)+JOB_PLAN_FIRST_POINTS }
  s.inJob=job;
  s.company=null;
  s.settled=0;
  s.buying=false;
  jpEvent(s,log,`${from?`Quit ${from} and ${returning?"rejoin":"join"}`:returning?"Rejoin":"Join"} ${CITY_TARGETS[job]} as ${ranks[s.rank[job]].name}`);
  return true;
}
/** Works one day climbing a city job, and returns true once its top rank is reached. */
function jpClimbDay(ctx,s,job,log){
  const ranks=ctx.ranks[job], top=ranks.length-1;
  jpCourses(ctx,s);
  let r=s.rank[job];
  while(r<top&&s.points[job]>=5*(r+1)&&jpMeets(s.stats,ranks[r+1].req)){
    s.points[job]-=5*(r+1);
    r++;
    s.rank[job]=r;
    jpEvent(s,log,`Spend ${5*r} ${CITY_TARGETS[job]} points to become ${ranks[r].name}`);
  }
  if(r===top){
    if(job==="Education"&&s.principal==null) s.principal=s.day;
    return true;
  }
  JP_STATS.forEach(k=>{ s.stats[k]+=ranks[r].gain[k] });
  s.points[job]+=r+1;
  jpEndDay(s,log,`${ranks[r].name} (${CITY_TARGETS[job]})`);
  return false;
}
/** Climbs a city job from a state, returning the day its top rank is reached or null past the limit. */
function jpClimb(ctx,s,job,limit,log){
  while(s.day<=limit){
    if(jpClimbDay(ctx,s,job,log)) return s.day;
  }
  return null;
}
/** Works one day in Education towards a stat goal: climbing, then buying stats as Principal. */
function jpEducationDay(ctx,s,log){
  if(s.rank.Education<ctx.ranks.Education.length-1&&!jpClimbDay(ctx,s,"Education",log)) return;
  jpTopDay(ctx,s,log,"Education");
}

// ----------------------------------------------------------------------
// Stays
// ----------------------------------------------------------------------
/** Works one day of a stay between moves. */
function jpStayDay(ctx,s,kind,log){
  if(kind==="company"||kind==="fixed") jpCompanyDay(ctx,s,log,kind==="fixed");
  else if(kind==="director"){ const g=DIRECTOR_GAINS[Math.min(10,+ctx.job.stars||0)]; jpFixedDay(ctx,s,log,{man:g,int:g,end:g},`Director (${ctx.companies[ctx.home]?.name||"company"})`) }
  else if(kind==="education") jpEducationDay(ctx,s,log);
  else if(kind.startsWith("top:")) jpTopDay(ctx,s,log,kind.slice(4));
  else if(kind.startsWith("city:")){ const [,job,rank]=kind.split(":"); const g=CITY_JOBS[job][rank]; jpFixedDay(ctx,s,log,{man:g[0],int:g[1],end:g[2]},`${rank} (${CITY_TARGETS[job]||job})`) }
  else jpEndDay(s,log,"No job");
}
/** Returns the job the player starts in, as a stay kind. */
function jpStartKind(job){
  const [kind,key]=String(job.employer||"").split(":");
  if(kind==="company") return job.position==="Director"?"director":"company";
  if(kind==="job"&&CITY_JOBS[key]?.[job.position]){
    const ranks=Object.keys(CITY_JOBS[key]);
    if(CITY_TARGETS[key]&&ranks.indexOf(job.position)===ranks.length-1) return "top:"+key;
    return `city:${key}:${job.position}`;
  }
  return "none";
}
/** Returns what the player is leaving, for the action text. */
function jpFrom(ctx,kind){
  if(kind==="company"||kind==="fixed") return "your company";
  if(kind==="director") return "directing your company";
  if(kind.startsWith("top:")) return CITY_TARGETS[kind.slice(4)];
  if(kind.startsWith("city:")){ const job=kind.split(":")[1]; return CITY_TARGETS[job]||job }
  return null;
}

// ----------------------------------------------------------------------
// City job routes
// ----------------------------------------------------------------------
/** Returns the switch day that reaches a city job's top soonest from a stay, and the day it is reached. */
// Ties go to the later switch, which keeps the player in their company and its gains for longer.
function jpBestSwitch(ctx,start,kind,job,from,minStay){
  let best=null;
  const s=jpClone(start);
  while(s.day<=JOB_PLAN_HORIZON&&(!best||s.day<best.finish)){
    const c=jpClone(s);
    if(s.day>=start.day+(minStay||0)&&jpJoin(ctx,c,job,null,from)){
      const finish=jpClimb(ctx,c,job,best?best.finish:JOB_PLAN_HORIZON,null);
      if(finish!=null&&(!best||finish<=best.finish)) best={switch:s.day,finish};
    }
    if(start.inJob===job) break;
    jpStayDay(ctx,s,kind,null);
  }
  return best;
}
/** Runs one leg of a city route: the stay, the switch and the climb, returning the state at the top. */
function jpLeg(ctx,start,leg,log){
  const s=jpClone(start);
  if(leg.rejoin){
    if(leg.kind==="director") jpEvent(s,log,"Go back to directing your company");
    else jpJoinCompany(ctx,s,ctx.home,log,leg.from);
  }
  while(s.day<leg.switch) jpStayDay(ctx,s,leg.kind,log);
  jpJoin(ctx,s,leg.job,log,leg.rejoin?(leg.kind==="director"?"directing your company":"your company"):leg.from);
  jpClimb(ctx,s,leg.job,JOB_PLAN_HORIZON,log);
  return s;
}
/** Returns the fastest way to finish the given city jobs in the given order. */
function jpCityRoute(ctx,start,order,startKind){
  const legs=[];
  let s=jpClone(start), prev=null;
  for(const job of order){
    ctx.need=ctx.ranks[job][ctx.ranks[job].length-1].req;
    const options=[];
    if(!prev) options.push({kind:startKind,from:jpFrom(ctx,startKind)});
    else{
      options.push({kind:"top:"+prev,from:CITY_TARGETS[prev]});
      if(ctx.homeKind) options.push({kind:ctx.homeKind,from:CITY_TARGETS[prev],rejoin:true});
    }
    let pick=null;
    options.forEach(o=>{
      const from=jpClone(s);
      if(o.rejoin){
        if(o.kind==="director"){ from.inJob=null; from.settled=0 }
        else jpJoinCompany(ctx,from,ctx.home,null,o.from);
      }
      const b=jpBestSwitch(ctx,from,o.kind,job,o.from,o.rejoin?JOB_PLAN_MIN_COMPANY_STAY:0);
      if(b&&(!pick||b.finish<pick.finish)) pick={...o,job,switch:b.switch,finish:b.finish};
    });
    if(!pick) return null;
    legs.push(pick);
    s=jpLeg(ctx,s,pick,null);
    prev=job;
  }
  return {legs,finish:s.day};
}
/** Returns every order of a list. */
function jpOrders(list){
  if(list.length<2) return [list];
  return list.flatMap((x,i)=>jpOrders(list.filter((_,j)=>j!==i)).map(rest=>[x,...rest]));
}
/** Returns the fastest plan through the chosen city jobs, with its log. */
function jpPlanCity(ctx,start,startKind,jobs){
  let best=null;
  jpOrders(jobs).forEach(order=>{
    const r=jpCityRoute(ctx,start,order,startKind);
    if(r&&(!best||r.finish<best.finish)) best={...r,order};
  });
  if(!best) return {kind:"city",jobs};
  const log={days:[],events:[]};
  let s=start;
  best.legs.forEach(leg=>{
    ctx.need=ctx.ranks[leg.job][ctx.ranks[leg.job].length-1].req;
    s=jpLeg(ctx,s,leg,log);
  });
  const tops=best.order.map(j=>ctx.ranks[j][ctx.ranks[j].length-1].name);
  return {kind:"city",jobs,order:best.order,firstMove:best.legs[0].switch,finish:s.day,log,end:s,
    title:best.order.length>1?"All three":tops[0]};
}

// ----------------------------------------------------------------------
// Stat and job routes
// ----------------------------------------------------------------------
/** Runs a stay until the goal is met, returning the day it is met or null past the limit. */
function jpStayUntilMet(ctx,s,kind,limit,log){
  while(s.day<=limit){
    if(jpMeets(s.stats,ctx.need)) return s.day;
    jpStayDay(ctx,s,kind,log);
  }
  return null;
}
/** Returns the best day to move from a stay into Education for a stat goal, and the day the goal is met. */
// Ties go to the earlier switch, so the player is not moved to a new position days before leaving for Education.
function jpBestEducation(ctx,start,kind,from){
  let best=null;
  const s=jpClone(start);
  while(s.day<=JOB_PLAN_HORIZON&&(!best||s.day<best.finish)){
    if(jpMeets(s.stats,ctx.need)){ if(!best||s.day<best.finish) best={switch:null,finish:s.day}; break }
    const c=jpClone(s);
    if(jpJoin(ctx,c,"Education",null,from)){
      const finish=jpStayUntilMet(ctx,c,"education",best?best.finish:JOB_PLAN_HORIZON,null);
      if(finish!=null&&(!best||finish<best.finish)) best={switch:s.day,finish};
    }
    jpStayDay(ctx,s,kind,null);
  }
  return best;
}
/** Returns the fastest plan to a set of work stats, or to a company position's requirements. */
function jpPlanGoal(ctx,start,startKind,goal){
  const fixed=goal.stay;
  const first=startKind==="company"&&fixed?"fixed":startKind;
  const routes=[{s0:jpClone(start),kind:first}];
  if(goal.company&&goal.company!==ctx.home) routes.push({s0:jpClone(start),kind:"company",joinTarget:true});
  let best=null;
  routes.forEach(r=>{
    const s=jpClone(r.s0);
    if(r.joinTarget) jpJoinCompany(ctx,s,goal.company,null,jpFrom(ctx,first));
    const allowEducation=!fixed;
    const b=allowEducation?jpBestEducation(ctx,s,r.kind,r.joinTarget?"your company":jpFrom(ctx,r.kind))
      :(()=>{ const f=jpStayUntilMet(ctx,jpClone(s),r.kind,JOB_PLAN_HORIZON,null); return f==null?null:{switch:null,finish:f} })();
    if(b&&(!best||b.finish<best.finish)) best={...r,...b};
  });
  if(!best) return {kind:goal.kind,impossible:true};
  const log={days:[],events:[]};
  const s=jpClone(start);
  if(best.joinTarget) jpJoinCompany(ctx,s,goal.company,log,jpFrom(ctx,first));
  if(best.switch!=null){
    while(s.day<best.switch) jpStayDay(ctx,s,best.kind,log);
    jpJoin(ctx,s,"Education",log,best.joinTarget?"your company":jpFrom(ctx,best.kind));
    jpStayUntilMet(ctx,s,"education",JOB_PLAN_HORIZON,log);
  }else jpStayUntilMet(ctx,s,best.kind,JOB_PLAN_HORIZON,log);
  if(goal.kind==="job"){
    const name=ctx.companies[goal.company].name;
    if(s.company===goal.company) jpEvent(s,log,`Ask your director to move you to ${goal.position}`);
    else jpEvent(s,log,`${s.inJob?`Quit ${CITY_TARGETS[s.inJob]} and ${goal.company===ctx.home?"rejoin":"join"}`:"Join"} ${jpA(name)} company as ${goal.position}`);
  }
  return {kind:goal.kind,finish:s.day,log,end:s,
    title:goal.kind==="job"?goal.position:"Target stats"};
}

// ----------------------------------------------------------------------
// The plan
// ----------------------------------------------------------------------
/** Returns what the job preferences ask the planner for, or null when there is nothing to plan. */
function jpGoal(prefs){
  if(prefs.target==="city"){
    const jobs=prefs.cityJob==="All"?Object.keys(CITY_TARGETS):CITY_TARGETS[prefs.cityJob]?[prefs.cityJob]:["Education"];
    return {kind:"city",jobs};
  }
  if(prefs.target==="stats"){
    const need={man:+prefs.stats?.man||0,int:+prefs.stats?.int||0,end:+prefs.stats?.end||0};
    if(!JP_STATS.some(k=>need[k]>0)) return null;
    return {kind:"stats",need,stay:!!prefs.stayRole};
  }
  if(!prefs.target) return {kind:"weeks"};
  if(prefs.target==="job"){
    const [kind,type]=String(prefs.employer||"").split(":");
    const p=kind==="company"&&window.live?.positionStats?.[`${type}|${prefs.position}`];
    if(!p) return null;
    return {kind:"job",need:{...p.req},company:type,position:prefs.position};
  }
  return null;
}
/** Returns the plan for the saved job and preferences, or null when there is nothing to plan. */
function jobPlan(list){
  const prefs=window.edJobPrefs||{}, job=window.edJobJob||{};
  const goal=typeof edJobCourseFinishes==="function"?jpGoal(prefs):null;
  if(!goal){ window.jobPlanPrincipal=null; return null }
  const key=JSON.stringify({job,prefs,goal,t:window.live?.positionStats?1:0,perk:!!$("edJobPerk")?.checked,
    c:edJobCourseFinishes(list,null).map(e=>[e.course.id,e.end,e.stats]),r:[educationTimeReduction(),educationJpFactor()]});
  if(window.jobPlanCache?.key===key){
    window.jobPlanPrincipal=window.jobPlanCache.principal;
    return window.jobPlanCache.plan;
  }
  // Reaching Principal shortens later courses, which can move the day Principal is reached, so the plan is
  // rerun with each new Principal day until it settles. It settles within a couple of passes in practice.
  let principal=null, plan=null;
  for(let i=0;i<4;i++){
    plan=jpPlanWith(list,job,goal,principal);
    const p=plan.end?.principal??null;
    if(p===principal) break;
    principal=p;
  }
  window.jobPlanPrincipal=principal;
  window.jobPlanCache={key,plan,principal};
  return plan;
}
/** Returns the plan when the Principal perk, if planned, is earned on a given day. */
function jpPlanWith(list,job,goal,principalDay){
  const courses=new Map();
  edJobCourseFinishes(list,principalDay).forEach(({day,stats})=>{
    const c=courses.get(day)||{man:0,int:0,end:0};
    JP_STATS.forEach(k=>{ c[k]+=stats[k] });
    courses.set(day,c);
  });
  const [kind,type]=String(job.employer||"").split(":");
  const startKind=jpStartKind(job);
  const companies={};
  if(kind==="company") companies[type]=jpCompany(type);
  if(goal.company) companies[goal.company]=jpCompany(goal.company);
  const ranks=Object.fromEntries(Object.keys(CITY_TARGETS).map(j=>[j,jpRanks(j)]));
  const ctx={job,courses,companies,home:kind==="company"?type:null,trains:edJobWeeklyTrains(job),
    bought:Math.min(MAX_TRAINS_BOUGHT_PER_WEEK,Math.max(0,+job.trainsBought||0)),ranks,
    homeKind:startKind==="company"||startKind==="director"?startKind:null,need:goal.need||null};
  const start={day:0,stats:{man:+job.man||0,int:+job.int||0,end:+job.end||0},settled:Math.min(10,+job.days||0),
    tenure:+job.days||0,company:kind==="company"?type:null,pos:job.position,rank:{},points:{},buying:false,inJob:null,principal:null};
  Object.keys(CITY_TARGETS).forEach(j=>{
    const r=job.cityRanks?.[j];
    if(r!=null){ start.rank[j]=Object.keys(CITY_JOBS[j]).indexOf(r); start.points[j]=+job.cityPoints?.[j]||0 }
  });
  // "Education job maxed" means the player already holds Principal; Torn keeps a city job's rank after leaving.
  if(goal.kind!=="city"&&$("edJobPerk")?.checked&&start.rank.Education!==ranks.Education.length-1){
    start.rank.Education=ranks.Education.length-1;
    start.points.Education=+job.cityPoints?.Education||0;
  }
  if(kind==="job"&&CITY_TARGETS[type]){
    start.rank[type]=Object.keys(CITY_JOBS[type]).indexOf(job.position);
    start.points[type]=+job.cityPoints?.[type]||0;
    start.inJob=type;
  }
  if(Object.values(companies).some(c=>!c.positions.length)) return {kind:goal.kind,unloaded:true};
  if(goal.kind==="weeks"){
    const log={days:[],events:[]};
    const s=jpClone(start);
    const kind=startKind==="company"?"fixed":startKind;
    while(s.day<365) jpStayDay(ctx,s,kind,log);
    return {kind:"weeks",log,end:s};
  }
  return goal.kind==="city"?jpPlanCity(ctx,start,startKind,goal.jobs):jpPlanGoal(ctx,start,startKind,goal);
}

// ----------------------------------------------------------------------
// Drawing
// ----------------------------------------------------------------------
/** Returns a day count from today as a date. */
function jpDate(day){
  const d=new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()+day);
  return d;
}
/** Returns "N days · date" for a day count, or "Today". */
function jpWhen(day){
  return day===0?"Today":`${day} day${day===1?"":"s"} · ${edJobFinishDate(day)}`;
}
/** Returns the Snapshot rows for the job plan. */
function jobPlanSnapshotHtml(list){
  const plan=jobPlan(list);
  if(!plan) return "";
  const row=(title,text)=>`<div class="edjob-stat-title">${esc(title)}</div><div class="edjob-stat-date">${esc(text)}</div>`;
  if(plan.kind==="weeks") return "";
  const goalTitle=plan.kind==="stats"?"Days until target stats":plan.kind==="job"?`Days until ready for ${window.edJobPrefs?.position||"the job"}`:null;
  if(plan.unloaded) return row(goalTitle||"Job plan","Refresh to load the company positions");
  if(plan.kind==="city"){
    const first=plan.order?.[0]||plan.jobs[0], last=plan.order?.slice(-1)[0]||plan.jobs.slice(-1)[0];
    if(plan.finish==null) return row(`Days until maxing ${CITY_TARGETS[last]}`,"Not within 10 years");
    return row(`Days until moving into ${CITY_TARGETS[first]}`,jpWhen(plan.firstMove))
      +row(`Days until maxing ${CITY_TARGETS[last]}`,jpWhen(plan.finish));
  }
  return row(goalTitle,plan.impossible?"Not within 10 years":jpWhen(plan.finish));
}
/** Draws the Job Planner column, and the warning when a fixed role cannot reach the target. */
function renderJobPlanner(list){
  const box=$("edJobPlanner");
  if(!box) return;
  const plan=jobPlan(list);
  const warn=$("ejStayWarn");
  if(warn) warn.hidden=!(plan?.impossible&&window.edJobPrefs?.stayRole&&plan.kind==="stats");
  const msg=t=>{ box.innerHTML=`<p class="edjob-jp-msg">${esc(t)}</p>` };
  if(!plan){ box.innerHTML=""; return }
  if(plan.unloaded) return msg("Refresh to load the company positions.");
  const n=v=>Math.floor(v).toLocaleString("en-US");
  const cells=st=>`<td>${n(st.man)}</td><td>${n(st.int)}</td><td>${n(st.end)}</td>`;
  const rows=[];
  if(plan.kind==="weeks"){
    plan.log.days.forEach(d=>{
      if(jpDate(d.day).getDay()===0) rows.push(`<tr class="edjob-jp-week"><td>${esc(edJobFinishDate(d.day))}</td><td>${esc(d.label)}</td>${cells(d.stats)}</tr>`);
    });
    box.innerHTML=`<table class="edjob-jp-table"><thead><tr><th>Date</th><th>Where you are</th><th>MAN</th><th>INT</th><th>END</th></tr></thead>`
      +`<tbody>${rows.join("")}</tbody></table>`;
    return;
  }
  if(plan.impossible||plan.finish==null) return msg("No way to reach the target within 10 years from where you are.");
  plan.log.events.forEach(e=>rows.push({day:e.day,order:0,html:`<tr class="edjob-jp-event"><td>${esc(edJobFinishDate(e.day))}</td><td>${esc(e.text)}</td>${cells(e.stats)}</tr>`}));
  const busy=new Set([...plan.log.events.map(e=>e.day),plan.finish]);
  plan.log.days.forEach(d=>{
    if(jpDate(d.day).getDay()!==0) return;
    for(let k=d.day-6;k<=d.day;k++) if(busy.has(k)) return;
    rows.push({day:d.day,order:1,html:`<tr class="edjob-jp-week"><td>${esc(edJobFinishDate(d.day))}</td><td>${esc(d.label)}</td>${cells(d.stats)}</tr>`});
  });
  rows.push({day:plan.finish,order:2,html:`<tr class="edjob-jp-final"><td>${esc(edJobFinishDate(plan.finish))}</td>`
    +`<td>${esc(plan.title)} reached. Wowsers!</td>${cells(plan.end.stats)}</tr>`});
  rows.sort((a,b)=>a.day-b.day||a.order-b.order);
  box.innerHTML=`<table class="edjob-jp-table"><thead><tr><th>Date</th><th>What to do</th><th>MAN</th><th>INT</th><th>END</th></tr></thead>`
    +`<tbody>${rows.map(r=>r.html).join("")}</tbody></table>`;
}
