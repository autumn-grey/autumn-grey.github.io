// ======================================================================
// DATA  ·  Stock table, benefit metadata, tag lists, game constants
// ======================================================================
const STOCKS = [
["ASS","Alcoholics Synonymous",1000000,"item",7,"Six-Pack of Alcohol",1],
["BAG","Big Al's Gun Shop",3000000,"item",7,"Ammunition Pack",1],
["CBD","Herbal Releaf Co.",350000,"nerve",7,null,50],
["CNC","Crude & Co",7500000,"cash",31,null,80000000],
["EVL","Evil Ducks Candy Corp",100000,"happy",7,null,1000],
["EWM","Eaglewood Mercenary",1000000,"item",7,"Box of Grenades",1],
["FHG","Feathery Hotels Group",2000000,"item",7,"Feathery Hotel Coupon",1],
["GRN","Grain",500000,"cash",31,null,4000000],
["HRG","Home Retail Group",10000000,"other",31,"Random Property",0],
["IOU","Insured On Us",3000000,"cash",31,null,12000000],
["LAG","Legal Authorities Group",750000,"item",7,"Lawyer's Business Card",1],
["LSC","Lucky Shot Casino",500000,"item",7,"Lottery Voucher",1],
["MCS","Mc Smoogle Corp",350000,"energy",7,null,100],
["MUN","Munster Beverage Corp.",5000000,"item",7,"Six-Pack of Energy Drink",1],
["PRN","Performance Ribaldry",1000000,"item",7,"Erotic DVD",1],
["PTS","PointLess",10000000,"points",7,null,100],
["SYM","Symbiotic Ltd.",500000,"item",7,"Drug Pack",1],
["TCC","Torn City Clothing",7500000,"item",31,"Clothing Cache",1],
["TCT","The Torn City Times",100000,"cash",31,null,1000000],
["THS","Torn City Health Service",150000,"item",7,"Box of Medical Supplies",1],
["TMI","TC Music Industries",6000000,"cash",31,null,25000000],
["TSB","Torn & Shanghai Banking",3000000,"cash",31,null,50000000],
["TCI","Torn City Investments",1500000,"bankbonus",0,null,10],
["TCP","TC Media Productions",1000000,"unresolved",0,"Company Sales Boost",0],
["TCM","Torn City Motors",1000000,"unresolved",0,"Racing Skill Boost",0],
["TGP","Tell Group Plc.",2500000,"unresolved",0,"Company Advertising Boost",0],
["IIL","I Industries Ltd.",1000000,"virus",1,"Coding Time Reduction",0],
["WLT","Wind Lines Travel",9000000,"unresolved",0,"Private Jet Access",0],
["SYS","Syscore MFG",3000000,"unresolved",0,"Advanced Firewall",0],
["ELT","Empty Lunchbox Traders",5000000,"other",365,"Home Upgrade Discount",0],
["MSG","Messaging Inc.",300000,"cash",31,"Free Classified Advertising",250000],
["WSU","West Side University",1000000,"unresolved",0,"Education Course Time Reduction",0],
["LOS","Lo Squalo Waste",7500000,"unresolved",0,"Mission Reward Bonus",0],
["YAZ","Yazoo",1000000,"cash",1,"Free Banner Advertising",500000],
["IST","International School TC",100000,"unresolved",0,"Free Education Courses",0]
];
const UNDEFINED_ROI_TICKERS = ["WSU","TCM","WLT","IST","BAG","LOS","TCP","TGP","SYS"];
// These stocks provide a single benefit block only, with no purchasable increments.
const SINGLE_BLOCK_TICKERS = ["ELT","IIL","IST","LOS","MSG","SYS","TCP","TGP","TCI","TCM","WSU","WLT","YAZ"];
// Benefits whose value only applies if the user actually uses that feature.
const SITUATIONAL_TICKERS = ["YAZ","EVL","TCP","TGP","SYS","MSG","BAG","TCM","ELT","IIL"];
// Benefits considered not worth the investment.
const AWFUL_TICKERS = ["IST"];
// Fixed benefit descriptions for stocks whose payout isn't a plain item/cash amount.
// [main line, optional second line]
// Private Island upgrade costs. ELT's benefit is a 10% discount on these
// (it does not discount the property purchase price itself).
const PI_UPGRADE_COSTS = {
  "Superior Interior":250000000,"Extra Large Vault":215000000,"Medical Facility":17000000,
  "Airstrip":75000000,"Private Yacht":895000000,"Hot Tub":17000,"Sauna":12000,
  "Large Pool":500000,"Open Bar":9000,"Shooting Range":250000
};
const PI_UPGRADE_TOTAL = Object.values(PI_UPGRADE_COSTS).reduce((a,b)=>a+b,0);
const SPECIAL_BENEFITS = {
  ELT:["10% Property Upgrade Discount",`saves $${Math.round(PI_UPGRADE_TOTAL*0.10).toLocaleString("en-US")} per PI`],
  HRG:["1 x Random Property"],
  IIL:["50% Virus Coding Time Reduction"],
  IST:["Free Education Courses"],
  LOS:["25% Mission Credits & Money Boost"],
  MSG:["Free Classified Advertising","ad costs -$250,000"],
  SYS:["Advanced Firewall"],
  TCP:["Company Sales Boost"],
  TGP:["Company Advertising Boost"],
  TCC:["1 x Random Cosmetics Cache"],
  TCI:["10% City Bank Interest Bonus"],
  TCM:["10% Racing Skill Boost"],
  WSU:["10% Education Course Time Reduction"],
  WLT:["Private Jet Access"],
  YAZ:["Free Banner Advertising","ad costs -$500,000 p/day"]
};
const BOOSTER_TYPES = ["happy","energy","nerve"];
// Free-text notes shown in the Notes column. [main line, optional second line]
const STOCK_NOTES = {
  BAG:["A special ammo pack based on currently equipped primary weapon."],
  TCP:["¯\\_(ツ)_/¯"],
  TCM:["Skrt 🚗💨"],
  TGP:["¯\\_(ツ)_/¯"],
  WLT:["-50% Travel Time","Immune to Detective Agency 'Watchlist' travel extension"],
  SYS:["Untraceable bounties, company vault protection, virus programming defence"],
  LOS:["Someone calculate the $ value of mission credits for me pls, I gave up."]
};
// ======================================================================
// CLASSIFICATION  ·  Which tags, tints and payout kind a stock gets
// ======================================================================
// Benefit-kind tags. MSG/YAZ use the "cash" type but represent avoided costs
// rather than a payout, so they're excluded from the money tag.
const NOT_A_PAYOUT = ["MSG","YAZ"];
// Tickers whose payout tag can't be inferred from their benefit type.
const PAYOUT_OVERRIDES = {PTS:"money",HRG:"items"};
function payoutKind(ticker,type){
  if(PAYOUT_OVERRIDES[ticker]) return PAYOUT_OVERRIDES[ticker];
  if(type==="cash" && !NOT_A_PAYOUT.includes(ticker)) return "money";
  if(type==="item") return "items";
  return null;
}
// Education course costs (Torn wiki). Used to value IST's free-courses benefit.
// Education course lengths in weeks (Torn wiki). Used to value WSU's time reduction.
const COURSE_WEEKS={
edu_biology_introduction_to_biochemistry:1,edu_biology_evolution:2,edu_biology_intermediate_biochemistry:4,
edu_biology_advanced_biochemistry:4,edu_biology_fundamentals_of_neurobiology:3,
edu_biology_chromosomes_and_gene_functions:2,edu_biology_forensic_science:4,edu_biology_anatomy:3,
edu_biology_intravenous_therapy:3,edu_biology_bachelor_of_biology:5,
edu_business_management_introduction_to_business:1,edu_business_management_statistics:2,
edu_business_management_communication:2,edu_business_management_marketing:3,
edu_business_management_corporate_finance:2,edu_business_management_corporate_strategy:4,
edu_business_management_pricing_strategy:4,edu_business_management_logistics:2,
edu_business_management_product_management:3,edu_business_management_business_ethics:3,
edu_business_management_human_resource_management:3,edu_business_management_e_commerce:3,
edu_business_management_bachelor_of_commerce:5,edu_combat_training_introduction_to_combat:1,
edu_combat_training_military_psychology:2,edu_combat_training_study_of_war_and_technology:2,
edu_combat_training_study_of_society_and_warfare:4,edu_combat_training_study_of_machine_guns:2,
edu_combat_training_study_of_submachine_guns:2,edu_combat_training_study_of_pistols:2,
edu_combat_training_study_of_rifles:2,edu_combat_training_study_of_heavy_artillery:2,
edu_combat_training_study_of_shotguns:2,edu_combat_training_bachelor_of_military_arts_and_science:7,
edu_computer_science_introduction_to_computing:1,edu_computer_science_web_design_and_development:1,
edu_computer_science_intermediate_programming:2,edu_computer_science_algorithms_and_advanced_programming:3,
edu_computer_science_web_security_and_penetration_testing:1,
edu_computer_science_automated_data_mining_processing:2,edu_computer_science_networking:2,
edu_computer_science_computer_security_and_defense:4,edu_computer_science_computer_repair:2,
edu_computer_science_fundamentals_of_computer_architecture:2,edu_computer_science_overclocking:1,
edu_computer_science_advanced_overclocking:1,edu_computer_science_software_engineering:3,
edu_computer_science_quantum_computing:2,edu_computer_science_natural_language_engineering:3,
edu_computer_science_bachelor_of_computer_science:7,edu_general_studies_introduction_to_general_studies:1,
edu_general_studies_driving_license:2,edu_general_studies_astronomy:1,edu_general_studies_mechanical_arts:2,
edu_general_studies_general_mechanics:2,edu_general_studies_basic_english:2,
edu_general_studies_creative_writing:2,edu_general_studies_general_science:3,
edu_general_studies_survival_skills:2,edu_general_studies_newtonian_physics:2,
edu_general_studies_ivory_crafting:3,edu_general_studies_bachelor_of_general_studies:7,
edu_health_fitness_introduction_to_health_and_fitness:1,edu_health_fitness_aerobics:2,
edu_health_fitness_acrobatics:2,edu_health_fitness_power_lifting:2,edu_health_fitness_yoga:2,
edu_health_fitness_swimming:2,edu_health_fitness_marathon_training:4,edu_health_fitness_sailing:3,
edu_health_fitness_bachelor_of_health_sciences:5,edu_history_introduction_to_history:1,
edu_history_aims_methods_in_archaeology:2,edu_history_ancient_japanese_history:3,
edu_history_medieval_history:4,edu_history_medieval_archaeology:3,edu_history_south_asian_archaeology:3,
edu_history_egyptian_archaeology:3,edu_history_bachelor_of_history:6,edu_law_introduction_to_law:1,
edu_law_public_law:2,edu_law_common_law:3,edu_law_property_law:2,edu_law_criminal_law:2,
edu_law_administrative_law:2,edu_law_commercial_and_consumer_law:2,edu_law_family_law:2,edu_law_labor_law:2,
edu_law_social_and_economic_law:3,edu_law_use_of_force_in_international_law:3,
edu_law_international_human_rights:3,edu_law_media_law:3,edu_law_revenue_law:2,edu_law_bachelor_of_law:6,
edu_mathematics_introduction_to_mathematics:1,edu_mathematics_essential_foundation_mathematics:3,
edu_mathematics_intermediate_mathematics:3,edu_mathematics_geometry:3,edu_mathematics_geometry_2:3,
edu_mathematics_algebra:2,edu_mathematics_probability:3,edu_mathematics_trigonometry:3,
edu_mathematics_calculus:4,edu_mathematics_discrete_mathematics:4,edu_mathematics_bachelor_of_mathematics:6,
edu_psychology_introduction_to_psychology:1,edu_psychology_memory_and_decision:2,
edu_psychology_brain_and_behaviour:3,edu_psychology_quantitative_methods_in_psychology:3,
edu_psychology_applied_decision_methods:4,edu_psychology_attention_and_awareness:4,
edu_psychology_interpersonal_dynamics:1,edu_psychology_bachelor_of_psychological_sciences:7,
edu_self_defense_introduction_to_self_defense:1,edu_self_defense_judo:3,edu_self_defense_kick_boxing:2,
edu_self_defense_krav_maga:4,edu_self_defense_jujitsu:2,edu_self_defense_tae_kwon_do:2,
edu_self_defense_muay_thai:3,edu_self_defense_bachelor_of_self_defense:5,
edu_sports_science_introduction_to_sports_science:1,edu_sports_science_strength_and_conditioning:3,
edu_sports_science_physiological_testing:3,edu_sports_science_human_movement_analysis:2,
edu_sports_science_bio_mechanical_determinants_of_skill:3,edu_sports_science_sports_medicine:4,
edu_sports_science_nutritional_science:3,edu_sports_science_analysis_and_performance:3,
edu_sports_science_sports_administration:1,edu_sports_science_bachelor_of_sports_science:6};
const COURSE_COSTS={
edu_biology_introduction_to_biochemistry:200,edu_biology_evolution:2000,
edu_biology_intermediate_biochemistry:2500,edu_biology_advanced_biochemistry:2750,
edu_biology_fundamentals_of_neurobiology:2800,edu_biology_chromosomes_and_gene_functions:900,
edu_biology_forensic_science:3000,edu_biology_anatomy:3500,edu_biology_intravenous_therapy:3500,
edu_biology_bachelor_of_biology:5000,edu_business_management_introduction_to_business:200,
edu_business_management_statistics:500,edu_business_management_communication:600,
edu_business_management_marketing:800,edu_business_management_corporate_finance:500,
edu_business_management_corporate_strategy:1000,edu_business_management_pricing_strategy:800,
edu_business_management_logistics:500,edu_business_management_product_management:750,
edu_business_management_business_ethics:600,edu_business_management_human_resource_management:750,
edu_business_management_e_commerce:800,edu_business_management_bachelor_of_commerce:5000,
edu_combat_training_introduction_to_combat:200,edu_combat_training_military_psychology:1200,
edu_combat_training_study_of_war_and_technology:1250,edu_combat_training_study_of_society_and_warfare:1300,
edu_combat_training_study_of_machine_guns:3500,edu_combat_training_study_of_submachine_guns:3500,
edu_combat_training_study_of_pistols:3500,edu_combat_training_study_of_rifles:3500,
edu_combat_training_study_of_heavy_artillery:3500,edu_combat_training_study_of_shotguns:3500,
edu_combat_training_bachelor_of_military_arts_and_science:5000,
edu_computer_science_introduction_to_computing:200,edu_computer_science_web_design_and_development:300,
edu_computer_science_intermediate_programming:800,
edu_computer_science_algorithms_and_advanced_programming:1200,
edu_computer_science_web_security_and_penetration_testing:1000,
edu_computer_science_automated_data_mining_processing:1000,edu_computer_science_networking:900,
edu_computer_science_computer_security_and_defense:3200,edu_computer_science_computer_repair:850,
edu_computer_science_fundamentals_of_computer_architecture:1500,edu_computer_science_overclocking:500,
edu_computer_science_advanced_overclocking:500,edu_computer_science_software_engineering:2200,
edu_computer_science_quantum_computing:1950,edu_computer_science_natural_language_engineering:2350,
edu_computer_science_bachelor_of_computer_science:5000,edu_general_studies_introduction_to_general_studies:200,
edu_general_studies_driving_license:1500,edu_general_studies_astronomy:500,
edu_general_studies_mechanical_arts:600,edu_general_studies_general_mechanics:1500,
edu_general_studies_basic_english:890,edu_general_studies_creative_writing:895,
edu_general_studies_general_science:1200,edu_general_studies_survival_skills:725,
edu_general_studies_newtonian_physics:2500,edu_general_studies_ivory_crafting:3500,
edu_general_studies_bachelor_of_general_studies:5000,edu_health_fitness_introduction_to_health_and_fitness:200,
edu_health_fitness_aerobics:900,edu_health_fitness_acrobatics:1000,edu_health_fitness_power_lifting:1150,
edu_health_fitness_yoga:1200,edu_health_fitness_swimming:1500,edu_health_fitness_marathon_training:2000,
edu_health_fitness_sailing:3500,edu_health_fitness_bachelor_of_health_sciences:5000,
edu_history_introduction_to_history:200,edu_history_aims_methods_in_archaeology:500,
edu_history_ancient_japanese_history:950,edu_history_medieval_history:950,edu_history_medieval_archaeology:850,
edu_history_south_asian_archaeology:850,edu_history_egyptian_archaeology:850,
edu_history_bachelor_of_history:5000,edu_law_introduction_to_law:200,edu_law_public_law:1500,
edu_law_common_law:2000,edu_law_property_law:2000,edu_law_criminal_law:1000,edu_law_administrative_law:1500,
edu_law_commercial_and_consumer_law:900,edu_law_family_law:850,edu_law_labor_law:1050,
edu_law_social_and_economic_law:1780,edu_law_use_of_force_in_international_law:2490,
edu_law_international_human_rights:2925,edu_law_media_law:2350,edu_law_revenue_law:3200,
edu_law_bachelor_of_law:5000,edu_mathematics_introduction_to_mathematics:200,
edu_mathematics_essential_foundation_mathematics:1000,edu_mathematics_intermediate_mathematics:1100,
edu_mathematics_geometry:1150,edu_mathematics_geometry_2:1100,edu_mathematics_algebra:500,
edu_mathematics_probability:980,edu_mathematics_trigonometry:1000,edu_mathematics_calculus:800,
edu_mathematics_discrete_mathematics:1250,edu_mathematics_bachelor_of_mathematics:5000,
edu_psychology_introduction_to_psychology:200,edu_psychology_memory_and_decision:900,
edu_psychology_brain_and_behaviour:1100,edu_psychology_quantitative_methods_in_psychology:1150,
edu_psychology_applied_decision_methods:1500,edu_psychology_attention_and_awareness:2330,
edu_psychology_interpersonal_dynamics:1000,edu_psychology_bachelor_of_psychological_sciences:5000,
edu_self_defense_introduction_to_self_defense:200,edu_self_defense_judo:1000,edu_self_defense_kick_boxing:1500,
edu_self_defense_krav_maga:2500,edu_self_defense_jujitsu:1800,edu_self_defense_tae_kwon_do:2000,
edu_self_defense_muay_thai:3500,edu_self_defense_bachelor_of_self_defense:5000,
edu_sports_science_introduction_to_sports_science:200,edu_sports_science_strength_and_conditioning:1150,
edu_sports_science_physiological_testing:1200,edu_sports_science_human_movement_analysis:1500,
edu_sports_science_bio_mechanical_determinants_of_skill:1750,edu_sports_science_sports_medicine:2250,
edu_sports_science_nutritional_science:2500,edu_sports_science_analysis_and_performance:2880,
edu_sports_science_sports_administration:400,edu_sports_science_bachelor_of_sports_science:5000};
// Virus base coding times (days) and the Computer Science course that unlocks each.
const VIRUSES = [
  {name:"Simple Virus",baseDays:10,unlock:"edu_computer_science_introduction_to_computing"},
  {name:"Polymorphic Virus",baseDays:25,unlock:"edu_computer_science_intermediate_programming"},
  {name:"Tunneling Virus",baseDays:40,unlock:"edu_computer_science_intermediate_programming"},
  {name:"Armored Virus",baseDays:60,unlock:"edu_computer_science_algorithms_and_advanced_programming"},
  {name:"Stealth Virus",baseDays:100,unlock:"edu_computer_science_algorithms_and_advanced_programming"},
  {name:"Firewalk Virus",baseDays:120,unlock:"edu_computer_science_algorithms_and_advanced_programming"}
];
// Coding-time reductions from Computer Science courses (additive with each other).
const CODING_TIME_REDUCTIONS = [
  {id:"edu_computer_science_software_engineering",pct:0.20},
  {id:"edu_computer_science_natural_language_engineering",pct:0.10}
];
const CLOTHING_CACHE_ITEMS = ["Gentleman Cache","Elegant Cache","Elderly Cache","Denim Cache","Wannabe Cache","Naughty Cache","Cutesy Cache","Injury Cache"];
const PROPERTY_PRICES = {
  "Trailer":5000,"Apartment":25000,"Semi-Detached House":75000,"Detached House":300000,
  "Beach House":500000,"Chalet":750000,"Villa":1250000,"Penthouse":2000000,"Mansion":3000000,
  "Ranch":15000000,"Palace":65000000,"Castle":200000000,"Private Island":500000000
};
// Estate agents buy a property back for 75% of its purchase price, which is
// what a property handed to you is actually worth in cash.
const PROPERTY_SELLBACK = 0.75;
// The Law course that takes 10% off a property's purchase price.
const PROPERTY_LAW_COURSE = "edu_law_property_law";
const BANK_TERMS = {7:"1w",14:"2w",30:"1m",60:"2m",90:"3m"};
// Human label for a bank term length, used by both the bank rows and TCI.
function bankTermLabel(days){
  const d=+days;
  if(d%30===0&&d>=30) return (d/30)+" month"+(d/30===1?"":"s");
  return d+" days";
}
// Live figures from Torn's own reference lists. The hardcoded tables below
// stay as fallbacks, so the app still works before a refresh or on a key
// without the torn selections. Anything the API supplies simply wins.
window.live={benefitReq:null,propertyPrices:null,courseDays:null,courseCosts:null,
             courseInfo:null,notes:[]};
// Shares needed for one benefit block, live where known.
function blockShares(ticker,fallback){
  const v=window.live.benefitReq&&window.live.benefitReq[ticker];
  return (v>0)?v:fallback;
}
function propertyPriceTable(){ return window.live.propertyPrices||PROPERTY_PRICES }
function propertyPrice(name){
  const t=propertyPriceTable();
  return (t[name]>0)?t[name]:PROPERTY_PRICES[name];
}
function courseDaysFor(id){
  const v=window.live.courseDays&&window.live.courseDays[id];
  return (v>0)?v:(COURSE_WEEKS[id]||0)*7;
}
function courseCostFor(id){
  const v=window.live.courseCosts&&window.live.courseCosts[id];
  return (v>0)?v:(COURSE_COSTS[id]||0);
}
let prices={}, items=[], rates={}, lastUpdated={stocks:null,items:null,bank:null,user:null}, rows=[];
