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
  Medical:[[0,300,0],[100,600,150],[175,1000,275],[300,1500,500],[600,2500,1000],[1300,5000,2000],[2600,10000,4000]],
  Army:[[2,2,2],[50,15,20],[120,35,50],[325,60,115],[700,160,300],[1300,360,595],[2550,490,900],[4150,600,1100],[7500,1350,2530],[10000,2000,4000]],
  Casino:[[2,2,2],[35,50,120],[60,115,325],[360,595,1300],[490,900,2550],[755,1100,4150]],
  Grocer:[[2,2,2],[30,15,50],[50,35,120],[120,60,225],[250,200,500]]
};
/** The city jobs a player can target, and the name each is shown under. */
const CITY_TARGETS={Education:"Education",Law:"Law",Medical:"Medicine"};
/** The furthest ahead the planner looks, in days. */
const JOB_PLAN_HORIZON=3650;
/** The fewest days worth going back to a company for: the 10 days the settled-in bonus takes to build up. */
const JOB_PLAN_MIN_COMPANY_STAY=10;
/** The days a new recruit waits before receiving trains. */
const JOB_PLAN_RECRUIT_DAYS=3;
/** The points a player starts a city job with the first time they join it. */
const JOB_PLAN_FIRST_POINTS=5;
const JP_STATS=["man","int","end"];
/** A goal no stat ever reaches, so a company stay picks whichever position pays the most overall. */
const JP_NO_LIMIT={man:Infinity,int:Infinity,end:Infinity};
/** The passive perk each city job's top rank keeps after leaving, in the same wording as course perks. */
const CITY_TOP_PERKS={
  Education:"Gain a 10% passive decrease in completion time for all future education courses",
  Law:"Gain a 5% increase to crime exp & skill progression",
  Medical:"Gain the ability to revive someone for 75 energy"
};

/** Each city job's specials (wiki Job page), with the rank that unlocks each. */
const CITY_JOB_SPECIALS={
  Army:[["Private","Strength boost for army points"],["Sergeant","Steal a weapon for 10 army points"],
    ["Lieutenant","Defence boost for army points"],["General","Spy on a player's battle stats for 10 army points and $5,000"]],
  Casino:[["Dealer","Collect tips: money for 1 Casino point"],["Gaming Consultant","Pocket tokens: 25 Casino Tokens for 1 Casino point"],
    ["Revenue Manager","Steal cash: money for 1 Casino point"],["Casino President","Count cards: money for 10 Casino points and $100,000"]],
  Education:[["Recess Supervisor","100 Manual Labour per 10 Education points"],["Elementary Teacher","100 Endurance per 10 Education points"],
    ["Professor","100 Intelligence per 10 Education points"],["Principal","10% passive decrease in completion time for all future education courses"]],
  Grocer:[["Bagboy","Steal cash for 1 Grocer point"],["Price Labeler","Steal a bag of candy for 2 Grocer points"],
    ["Cashier","Steal a bottle of alcohol for 5 Grocer points"],["Manager","Steal an energy drink for 25 Grocer points"]],
  Law:[["Law Student","3 nerve for 5 Law points"],["Paralegal","Money for 100 Law points"],
    ["Trial Lawyer","Get someone out of jail for 15 Law points"],["Federal Judge","5% crime exp & skill gain (passive)"]],
  Medical:[["Houseman","Steal a small first aid kit for 2 Medical points"],["Senior Houseman","Steal a first aid kit for 4 Medical points"],
    ["GP","Steal morphine for 7 Medical points"],["Brain Surgeon","Revive someone for 75 energy (passive)"]]
};
/** Returns the name a city job is shown under. */
function jpJobName(job){
  return CITY_TARGETS[job]||job;
}

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
  return {...s,stats:{...s.stats},rank:{...s.rank},points:{...s.points},tops:{...s.tops}};
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
  if(log) log.events.push({day:s.day,text,stats:{...s.stats},seq:log.seq=(log.seq||0)+1});
}
/** Closes a day after payday, recording where the player stands. */
function jpEndDay(s,log,label){
  if(log) log.days.push({day:s.day,stats:{...s.stats},label,company:s.company,pos:s.pos,inJob:s.inJob,
    rank:s.inJob?s.rank[s.inJob]:null});
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
      // Joining a company and taking a position happen together, so they read as one action.
      const joined=!pos&&log?.events.at(-1);
      if(joined&&joined.day===s.day&&/join/i.test(joined.text)&&/company$/.test(joined.text)) joined.text+=` as ${best.name}`;
      else jpEvent(s,log,`Ask your director to move you to ${best.name}`);
      pos=best;
      s.pos=best.name;
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
/** The Education job special that buys each work stat (100 for 10 points), and the rank index that unlocks it. */
const JP_STAT_SPECIALS={man:["Manual Labour","Recess Supervisor",0],int:["Intelligence","Professor",4],end:["Endurance","Elementary Teacher",2]};
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
      s.stats[k]+=100;
      s.points[job]-=10;
      if(log) log.buys.push({day:s.day,stat:k,stats:{...s.stats},seq:log.seq=(log.seq||0)+1});
    }
  }
  jpEndDay(s,log,`${ranks[top].name} (${jpJobName(job)})`);
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
  jpEvent(s,log,`${from?`Quit ${from} and ${returning?"rejoin":"join"}`:returning?"Rejoin":"Join"} ${jpJobName(job)} as ${ranks[s.rank[job]].name}`);
  return true;
}
/** Works one day climbing a city job, and returns true once its top rank is reached. */
function jpClimbDay(ctx,s,job,log){
  const ranks=ctx.ranks[job], top=ranks.length-1;
  jpCourses(ctx,s);
  let r=s.rank[job];
  for(;;){
    while(r<top&&s.points[job]>=5*(r+1)&&jpMeets(s.stats,ranks[r+1].req)){
      s.points[job]-=5*(r+1);
      r++;
      s.rank[job]=r;
      jpEvent(s,log,`Spend ${5*r} ${jpJobName(job)} points to become ${ranks[r].name}`);
    }
    // Points beyond the next promotion's cost buy the stat holding it back, using the specials this rank has
    // unlocked. Later promotions are paid from what each rank earns, so only the next one needs keeping.
    if(job!=="Education"||r>=top||s.points[job]-10<5*(r+1)) break;
    const req=ranks[r+1].req;
    const k=JP_STATS.filter(x=>JP_STAT_SPECIALS[x][2]<=r&&s.stats[x]<req[x])
      .sort((a,b)=>(req[b]-s.stats[b])-(req[a]-s.stats[a]))[0];
    if(!k) break;
    s.stats[k]+=100;
    s.points[job]-=10;
    if(log) log.buys.push({day:s.day,stat:k,stats:{...s.stats},seq:log.seq=(log.seq||0)+1});
  }
  if(r===top){
    if(job==="Education"&&s.principal==null) s.principal=s.day;
    if(s.tops[job]==null) s.tops[job]=s.day;
    return true;
  }
  JP_STATS.forEach(k=>{ s.stats[k]+=ranks[r].gain[k] });
  s.points[job]+=r+1;
  jpEndDay(s,log,`${ranks[r].name} (${jpJobName(job)})`);
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
// With the role fixed, the player stays in their current position until the first city job; going back to a
// company later still picks whichever position suits them best.
function jpPlanCity(ctx,start,startKind,jobs,stay){
  if(stay&&startKind==="company") startKind="fixed";
  let best=null;
  jpOrders(jobs).forEach(order=>{
    const r=jpCityRoute(ctx,start,order,startKind);
    if(r&&(!best||r.finish<best.finish)) best={...r,order};
  });
  if(!best) return {kind:"city",jobs};
  const log={days:[],events:[],buys:[]};
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
  const log={days:[],events:[],buys:[]};
  const s=jpClone(start);
  if(best.joinTarget) jpJoinCompany(ctx,s,goal.company,log,jpFrom(ctx,first));
  if(best.switch!=null){
    while(s.day<best.switch) jpStayDay(ctx,s,best.kind,log);
    jpJoin(ctx,s,"Education",log,best.joinTarget?"your company":jpFrom(ctx,best.kind));
    jpStayUntilMet(ctx,s,"education",JOB_PLAN_HORIZON,log);
  }else jpStayUntilMet(ctx,s,best.kind,JOB_PLAN_HORIZON,log);
  if(goal.kind==="job"){
    const name=ctx.companies[goal.company].name;
    if(s.company===goal.company){ if(s.pos!==goal.position) jpEvent(s,log,`Ask your director to move you to ${goal.position}`) }
    else jpEvent(s,log,`${s.inJob?`Quit ${CITY_TARGETS[s.inJob]} and ${goal.company===ctx.home?"rejoin":"join"}`:"Join"} ${jpA(name)} company as ${goal.position}`);
  }
  return {kind:goal.kind,finish:s.day,log,end:s,
    title:goal.kind==="job"?goal.position:"Target stats"};
}

// ----------------------------------------------------------------------
// After the target
// ----------------------------------------------------------------------
/** Works one day after the target is reached: climbing a city job, earning in a company, or carrying on as before. */
function jpAfterDay(ctx,s,kind,log){
  if(kind.startsWith("climb:")){
    const job=kind.slice(6);
    ctx.need=null;
    if(s.rank[job]<ctx.ranks[job].length-1&&!jpClimbDay(ctx,s,job,log)) return;
    jpTopDay(ctx,s,log,job);
    return;
  }
  ctx.need=kind==="company"?JP_NO_LIMIT:null;
  jpStayDay(ctx,s,kind,log);
}
/** Returns what the player is leaving at the end of a plan, for the action text. */
function jpLeaving(ctx,s){
  if(s.inJob) return jpJobName(s.inJob);
  return s.company?"your company":null;
}
/**
 * Simulates on from the end of the plan until a given day, moving to the preferred employer first.
 * Kept on the plan so On This Day can look as far ahead as it likes without redoing the work.
 */
function jpContinueTo(plan,day){
  if(!plan.ctx||!plan.end) return null;
  const ctx=plan.ctx;
  if(!plan.cont){
    const s=jpClone(plan.end);
    const c=plan.cont={s,days:[],events:[],buys:[],kind:plan.afterKind};
    const [kind,key]=String(plan.prefer||"").split(":");
    if(kind==="company"&&ctx.companies[key]){
      if(s.company!==key||s.inJob) jpJoinCompany(ctx,s,key,c,jpLeaving(ctx,s));
      c.kind="company";
    }else if(kind==="job"&&ctx.ranks[key]){
      if(jpJoin(ctx,s,key,c,s.inJob===key?null:jpLeaving(ctx,s))) c.kind="climb:"+key;
    }
  }
  const c=plan.cont;
  while(c.s.day<=Math.min(day,JOB_PLAN_HORIZON)) jpAfterDay(ctx,c.s,c.kind,c);
  return c;
}
/** Returns where the player stands at the end of a given day: stats, job, and the city job tops reached. */
function jpStandingOn(plan,day){
  const last=plan.log.days.at(-1);
  let days=plan.log.days;
  if(!last||day>last.day){
    const c=jpContinueTo(plan,day);
    if(c) days=days.concat(c.days);
  }
  let found=null;
  for(const d of days){ if(d.day<=day) found=d; else break }
  const tops=(plan.cont?.s||plan.end).tops||{};
  return {entry:found||days[0]||null,tops:Object.fromEntries(Object.entries(tops).filter(([,d])=>d<=day))};
}

// ----------------------------------------------------------------------
// The plan
// ----------------------------------------------------------------------
/** Returns what the job preferences ask the planner for, or null when there is nothing to plan. */
function jpGoal(prefs){
  if(prefs.target==="city"){
    const jobs=prefs.cityJob==="All"?Object.keys(CITY_TARGETS):CITY_TARGETS[prefs.cityJob]?[prefs.cityJob]:["Education"];
    return {kind:"city",jobs,stay:!!prefs.stayRole,prefer:prefs.prefer||null};
  }
  if(prefs.target==="stats"){
    const need={man:+prefs.stats?.man||0,int:+prefs.stats?.int||0,end:+prefs.stats?.end||0};
    if(!JP_STATS.some(k=>need[k]>0)) return null;
    return {kind:"stats",need,stay:!!prefs.stayRole,prefer:prefs.prefer||null};
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
  const key=JSON.stringify({job,prefs:{...prefs,onDay:null},goal,t:window.live?.positionStats?1:0,perk:!!$("edJobPerk")?.checked,
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
  const [preferKind,preferKey]=String(goal.prefer||"").split(":");
  if(preferKind==="company"&&!companies[preferKey]) companies[preferKey]=jpCompany(preferKey);
  const ranks=Object.fromEntries(Object.keys(CITY_JOBS).map(j=>[j,jpRanks(j)]));
  const ctx={job,courses,companies,home:kind==="company"?type:null,trains:edJobWeeklyTrains(job),
    bought:Math.min(MAX_TRAINS_BOUGHT_PER_WEEK,Math.max(0,+job.trainsBought||0)),ranks,
    homeKind:startKind==="company"||startKind==="director"?startKind:null,need:goal.need||null};
  const start={day:0,stats:{man:+job.man||0,int:+job.int||0,end:+job.end||0},settled:Math.min(10,+job.days||0),
    tenure:+job.days||0,company:kind==="company"?type:null,pos:job.position,rank:{},points:{},inJob:null,principal:null,tops:{}};
  Object.keys(CITY_JOBS).forEach(j=>{
    const r=job.cityRanks?.[j];
    if(r!=null){ start.rank[j]=Object.keys(CITY_JOBS[j]).indexOf(r); start.points[j]=+job.cityPoints?.[j]||0 }
  });
  // "Education job maxed" means the player already holds Principal; Torn keeps a city job's rank after leaving.
  if(goal.kind!=="city"&&$("edJobPerk")?.checked&&start.rank.Education!==ranks.Education.length-1){
    start.rank.Education=ranks.Education.length-1;
    start.points.Education=+job.cityPoints?.Education||0;
  }
  if(kind==="job"&&CITY_JOBS[type]?.[job.position]){
    start.rank[type]=Object.keys(CITY_JOBS[type]).indexOf(job.position);
    start.points[type]=+job.cityPoints?.[type]||0;
    if(CITY_TARGETS[type]) start.inJob=type;
  }
  Object.keys(start.rank).forEach(j=>{ if(start.rank[j]===ranks[j].length-1) start.tops[j]=0 });
  if(Object.values(companies).some(c=>!c.positions.length)) return {kind:goal.kind,unloaded:true};
  const steady=startKind==="company"?"fixed":startKind;
  if(goal.kind==="weeks"){
    const log={days:[],events:[],buys:[]};
    const s=jpClone(start);
    while(s.day<365) jpStayDay(ctx,s,steady,log);
    return {kind:"weeks",log,end:s,ctx,afterKind:steady};
  }
  const plan=goal.kind==="city"?jpPlanCity(ctx,start,startKind,goal.jobs,goal.stay):jpPlanGoal(ctx,start,startKind,goal);
  if(plan.end){
    // Without a preferred employer the player carries on where the plan left them.
    const s=plan.end;
    plan.afterKind=s.inJob?"climb:"+s.inJob:s.company?(s.company===ctx.home&&startKind==="director"?"director":"fixed"):"none";
    plan.ctx=ctx;
    plan.prefer=goal.prefer||null;
  }
  return plan;
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
  plan.log.events.forEach(e=>rows.push({day:e.day,order:0,seq:e.seq,html:`<tr class="edjob-jp-event"><td>${esc(edJobFinishDate(e.day))}</td><td>${esc(e.text)}</td>${cells(e.stats)}</tr>`}));
  // Each purchase is shown on the day the points for it arrive; several of one stat on the same day share a row.
  const buys=new Map();
  plan.log.buys.forEach(b=>{
    const key=`${b.day}|${b.stat}`;
    const g=buys.get(key)||{day:b.day,stat:b.stat,count:0,seq:b.seq};
    g.count++;
    g.stats=b.stats;
    buys.set(key,g);
  });
  buys.forEach(g=>{
    const text=`Buy ${(100*g.count).toLocaleString("en-US")} ${JP_STAT_SPECIALS[g.stat][0]} (${10*g.count} Education Points)`;
    rows.push({day:g.day,order:0,seq:g.seq,html:`<tr class="edjob-jp-event"><td>${esc(edJobFinishDate(g.day))}</td><td>${esc(text)}</td>${cells(g.stats)}</tr>`});
  });
  const busy=new Set([...plan.log.events.map(e=>e.day),...plan.log.buys.map(b=>b.day),plan.finish]);
  plan.log.days.forEach(d=>{
    if(jpDate(d.day).getDay()!==0) return;
    for(let k=d.day-6;k<=d.day;k++) if(busy.has(k)) return;
    rows.push({day:d.day,order:1,html:`<tr class="edjob-jp-week"><td>${esc(edJobFinishDate(d.day))}</td><td>${esc(d.label)}</td>${cells(d.stats)}</tr>`});
  });
  rows.push({day:plan.finish,order:2,html:`<tr class="edjob-jp-final"><td>${esc(edJobFinishDate(plan.finish))}</td>`
    +`<td>${esc(plan.title)} reached. Wowsers!</td>${cells(plan.end.stats)}</tr>`});
  (jpContinueTo(plan,plan.finish)?.events||[]).filter(e=>e.day===plan.finish).forEach(e=>
    rows.push({day:e.day,order:3,seq:e.seq,html:`<tr class="edjob-jp-event"><td>${esc(edJobFinishDate(e.day))}</td><td>${esc(e.text)}</td>${cells(e.stats)}</tr>`}));
  rows.sort((a,b)=>a.day-b.day||a.order-b.order||(a.seq||0)-(b.seq||0));
  box.innerHTML=`<table class="edjob-jp-table"><thead><tr><th>Date</th><th>What to do</th><th>MAN</th><th>INT</th><th>END</th></tr></thead>`
    +`<tbody>${rows.map(r=>r.html).join("")}</tbody></table>`;
}

// ----------------------------------------------------------------------
// On This Day
// ----------------------------------------------------------------------
/** The four battle stats, in the order perks list them. */
const JP_BATTLE_STATS=["Strength","Speed","Defence","Dexterity"];
/** Returns a perk value without needless decimals. */
function jpPerkNumber(v){
  return Number.isInteger(v)?String(v):String(+v.toFixed(2));
}
/** Returns a list joined with commas and a final ampersand. */
function jpAndList(list){
  return list.length>1?`${list.slice(0,-1).join(", ")} & ${list.at(-1)}`:list[0]||"";
}
/**
 * Returns perk lines with like perks summed: passive and gym bonuses per battle stat, accuracy bonuses
 * grouped by size, and any other "Gain N% something" added up when the something matches.
 * Anything without a number to add is listed once as written.
 */
function jpPerkSummary(texts){
  const sums=new Map(), accuracy=new Map(), plain=[];
  const add=(key,label,value,unit,order)=>{
    const e=sums.get(key)||{label,value:0,unit,order};
    e.value+=value;
    sums.set(key,e);
  };
  const statName=w=>({strength:"Strength",speed:"Speed",defense:"Defence",defence:"Defence",dexterity:"Dexterity"})[w.trim()];
  texts.forEach(raw=>{
    const t=String(raw||"").trim();
    if(!t) return;
    const l=t.toLowerCase();
    let m;
    if((m=l.match(/([\d.]+)% passive bonus to (.+)$/))){
      m[2].split(/,| and /).map(statName).filter(Boolean).forEach(n=>
        add("passive|"+n,`Passive ${n}`,+m[1],"%",JP_BATTLE_STATS.indexOf(n)));
      return;
    }
    if((m=l.match(/([\d.]+)% (?:bonus|boost) (?:to|in) all gym gains/))){
      JP_BATTLE_STATS.forEach((n,i)=>add("gym|"+n,`${n} Gym Gains`,+m[1],"%",10+i));
      return;
    }
    if((m=l.match(/([\d.]+)% bonus to (strength|speed|defen[cs]e|dexterity) gains in the gym/))){
      const n=statName(m[2]);
      add("gym|"+n,`${n} Gym Gains`,+m[1],"%",10+JP_BATTLE_STATS.indexOf(n));
      return;
    }
    if((m=t.match(/\+?([\d.]+) accuracy increase with (.+)$/i))){
      const v=(+m[1]).toFixed(2);
      if(!accuracy.has(v)) accuracy.set(v,new Set());
      accuracy.get(v).add(m[2].trim());
      return;
    }
    // Two bonuses in one line cannot be split reliably, so they are listed as written.
    if((l.match(/%/g)||[]).length<2&&(
       (m=t.match(/^gain (?:an? )?(?:further )?\+?([\d.]+)(%?) (.+)$/i))||(m=t.match(/^gain an? bonus of ([\d.]+)(%) (.+)$/i)))){
      const subject=m[3].replace(/^(?:bonus|boost|increase) (?:to|in|of) /i,"").replace(/^(?:bonus|to) /i,"").trim();
      const key=`${m[2]}|${subject.toLowerCase()}`;
      add(key,subject.charAt(0).toUpperCase()+subject.slice(1),+m[1],m[2],100);
      return;
    }
    if(!plain.includes(t)) plain.push(t);
  });
  const line=e=>`+${jpPerkNumber(e.value)}${e.unit} ${e.label}`;
  const ordered=[...sums.values()].sort((a,b)=>a.order-b.order);
  const accuracyLines=[...accuracy.entries()].map(([v,set])=>`+${v} Accuracy for ${jpAndList([...set].sort((a,b)=>a.localeCompare(b)))}`);
  return ordered.filter(e=>e.order<100).map(line).concat(accuracyLines,ordered.filter(e=>e.order>=100).map(line),plain);
}
/** Returns the day count from today to a yyyy-mm-dd date, or null for anything unreadable. */
function jpDaysUntil(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||""));
  if(!m) return null;
  const today=new Date();
  today.setHours(0,0,0,0);
  return Math.round((new Date(+m[1],m[2]-1,+m[3])-today)/86400000);
}
/** Draws the On This Day panel: where the plan leaves the player on the chosen date. */
function renderOnThisDay(list){
  const box=$("edJobOnDay"), input=$("ejOnDay");
  if(!box||!input) return;
  const prefs=window.edJobPrefs||{};
  if(document.activeElement!==input) input.value=prefs.onDay||edJobFinishDate(0);
  const say=t=>{ box.innerHTML=`<p class="edjob-jp-msg">${esc(t)}</p>` };
  const day=jpDaysUntil(input.value);
  if(day==null) return say("Choose a date.");
  if(day<0) return say("Choose today or a date ahead.");
  if(day>JOB_PLAN_HORIZON) return say("Choose a date within the next 10 years.");
  const plan=jobPlan(list);
  if(!plan?.log) return say(plan?.unloaded?"Refresh to load the company positions.":"There is no plan to look ahead with yet.");
  const {entry,tops}=jpStandingOn(plan,day);
  if(!entry) return say("There is no plan to look ahead with yet.");
  const n=v=>Math.floor(v).toLocaleString("en-US");
  const section=(title,body)=>`<div class="edjob-stat-title">${esc(title)}</div>${body}`;
  // Job and company
  let job="No job", specials=[], specialsNote="";
  if(entry.inJob){
    job=`${jpRanks(entry.inJob)[entry.rank]?.name||""} · ${jpJobName(entry.inJob)}`;
    specials=(CITY_JOB_SPECIALS[entry.inJob]||[]).map(([rank,effect])=>({name:rank,effect,unlock:rank}));
  }
  else if(entry.company){
    const type=(window.live?.companyTypes||[]).find(c=>String(c.id)===String(entry.company));
    job=`${entry.pos||"Position not known"} · ${type?.name||"Company"}`;
    specials=(type?.specials||[]).map(x=>({name:x.name,effect:x.effect,unlock:`${x.rating}★`}));
    // A company list saved before specials were kept has none to show until the next refresh.
    if(type&&!Array.isArray(type.specials)) specialsNote="Refresh all API data to load this company's perks.";
  }
  // Courses completed by the date, grouped by subject
  const finished=new Set(list.filter(c=>c.done).map(c=>c.id));
  edJobCourseFinishes(list).forEach(e=>{ if(e.day<=day) finished.add(e.course.id) });
  const done=list.filter(c=>finished.has(c.id));
  const faculties=[...new Set(list.map(c=>c.faculty))].map(f=>{
    const all=list.filter(c=>c.faculty===f), got=done.filter(c=>c.faculty===f);
    const full=got.length===all.length;
    return got.length?`<div class="ejod-fac"><span class="ejod-fac-name${full?" full":""}">${esc(f)}${full?" ✓":""}</span> <span class="ejod-count">${got.length}/${all.length}</span>`
      +`<div class="ejod-list">${esc(got.map(c=>c.name).join(", "))}</div></div>`:"";
  }).join("");
  // Perks from those courses and from city job tops kept after leaving
  const perks=jpPerkSummary(done.map(c=>c.perk).concat(Object.keys(tops).map(j=>CITY_TOP_PERKS[j]).filter(Boolean)));
  box.innerHTML=section("Work stats",`<div class="ejod-stats"><span>MAN <strong>${n(entry.stats.man)}</strong></span>`
      +`<span>INT <strong>${n(entry.stats.int)}</strong></span><span>END <strong>${n(entry.stats.end)}</strong></span></div>`)
    +section("Job",`<div class="ejod-job">${esc(job)}</div>`
      +(specials.length?`<ul class="ejod-specials">${specials.map(x=>x.name===x.unlock
        ?`<li><span class="ejod-count">${esc(x.unlock)}:</span> ${esc(x.effect)}</li>`
        :`<li><strong>${esc(x.name)}</strong> <span class="ejod-count">${esc(x.unlock)}</span>: ${esc(x.effect)}</li>`).join("")}</ul>`
        :specialsNote?`<p class="edjob-jp-msg">${esc(specialsNote)}</p>`:""))
    +section("Education",done.length?`<div class="ejod-count">${done.length} of ${list.length} courses</div>${faculties}`:`<div class="edjob-jp-msg">No courses completed</div>`)
    +section("Perks",perks.length?`<div class="ejod-perks">${perks.map(p=>`<span>${esc(p)}</span>`).join(`<span class="ejod-sep"> | </span>`)}</div>`
      :`<div class="edjob-jp-msg">No perks yet</div>`);
}
