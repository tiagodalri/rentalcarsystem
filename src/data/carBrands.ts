// Source: github.com/filippofilip95/car-logos-dataset (CDN via jsDelivr)
// Optimized PNG per brand slug. CORS-friendly.

export const CAR_LOGO_CDN = "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset/logos/optimized";

export const carLogoUrl = (slug: string) => `${CAR_LOGO_CDN}/${slug}.png`;

// Display-name overrides for acronyms / brand styling
const OVERRIDES: Record<string, string> = {
  bmw: "BMW",
  "bmw-m": "BMW M",
  amc: "AMC",
  gmc: "GMC",
  mg: "MG",
  byd: "BYD",
  fpv: "FPV",
  hsv: "HSV",
  ds: "DS",
  ac: "AC",
  abt: "ABT",
  ktm: "KTM",
  ssc: "SSC",
  tvr: "TVR",
  uaz: "UAZ",
  ud: "UD",
  vlf: "VLF",
  zaz: "ZAZ",
  gaz: "GAZ",
  ih: "IH",
  jac: "JAC",
  jmc: "JMC",
  faw: "FAW",
  "faw-jiefang": "FAW Jiefang",
  fso: "FSO",
  bac: "BAC",
  daf: "DAF",
  dkw: "DKW",
  dmc: "DMC",
  erf: "ERF",
  man: "MAN",
  maz: "MAZ",
  mk: "MK",
  osca: "OSCA",
  pgo: "PGO",
  ruf: "RUF",
  sev: "SEV",
  "ic-bus": "IC Bus",
  "lynk-and-co": "Lynk & Co",
  "rolls-royce": "Rolls-Royce",
  "mercedes-benz": "Mercedes-Benz",
  "mercedes-amg": "Mercedes-AMG",
  "alfa-romeo": "Alfa Romeo",
  "aston-martin": "Aston Martin",
  "land-rover": "Land Rover",
  "great-wall": "Great Wall",
  "general-motors": "General Motors",
  "de-tomaso": "De Tomaso",
  "nissan-gt-r": "Nissan GT-R",
  "nissan-nismo": "Nissan Nismo",
  "audi-sport": "Audi Sport",
  "chevrolet-corvette": "Chevrolet Corvette",
  "dodge-viper": "Dodge Viper",
  "ford-mustang": "Ford Mustang",
  "toyota-alphard": "Toyota Alphard",
  "toyota-century": "Toyota Century",
  "toyota-crown": "Toyota Crown",
  "renault-samsung": "Renault Samsung",
  "saic-motor": "SAIC Motor",
  "gac-group": "GAC Group",
  "baic-motor": "BAIC Motor",
  "force-motors": "Force Motors",
  "hindustan-motors": "Hindustan Motors",
  "detroit-electric": "Detroit Electric",
  "devel-sixteen": "Devel Sixteen",
  "faraday-future": "Faraday Future",
  "w-motors": "W Motors",
  "li-auto": "Li Auto",
  "zarooq-motors": "Zarooq Motors",
};

const titleCase = (s: string) =>
  s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export const brandNameFromSlug = (slug: string) => OVERRIDES[slug] ?? titleCase(slug);

// Full slug list from the dataset
export const CAR_BRAND_SLUGS: string[] = ["9ff","abadal","abarth","abbott-detroit","abt","ac","acura","aiways","aixam","alfa-romeo","alpina","alpine","alta","alvis","amc","apollo","arash","arcfox","ariel","aro","arrinera","arrival","artega","ascari","askam","aspark","aston-martin","atalanta","auburn","audi","audi-sport","austin","autobacs","autobianchi","axon","bac","baic-motor","baojun","beiben","bentley","berkeley","berliet","bertone","bestune","bharatbenz","bitter","bizzarrini","bmw","bmw-m","borgward","bowler","brabus","brammo","brilliance","bristol","brooke","bufori","bugatti","buick","byd","byton","cadillac","camc","canoo","caparo","carlsson","caterham","changan","changfeng","chery","chevrolet","chevrolet-corvette","chrysler","cisitalia","citroen","cizeta","cole","corre-la-licorne","cupra","dacia","daewoo","daf","daihatsu","daimler","dartz","datsun","david-brown","dayun","de-tomaso","delage","desoto","detroit-electric","devel-sixteen","diatto","dina","dkw","dmc","dodge","dodge-viper","dongfeng","donkervoort","drako","ds","duesenberg","eagle","edag","edsel","eicher","elemental","elfin","elva","englon","erf","eterniti","exeed","facel-vega","faraday-future","faw","faw-jiefang","ferrari","fiat","fioravanti","fisker","foden","force-motors","ford","ford-mustang","foton","fpv","franklin","freightliner","fso","gac-group","gardner-douglas","gaz","geely","general-motors","genesis","geo","geometry","gilbern","gillet","ginetta","gmc","golden-dragon","gonow","great-wall","grinnall","gumpert","hafei","haima","haval","hawtai","hennessey","higer","hillman","hindustan-motors","hino","hiphi","hispano-suiza","holden","hommell","honda","hongqi","hongyan","horch","hsv","hudson","hummer","hupmobile","hyundai","ic-bus","ih","ikco","infiniti","innocenti","intermeccanica","international","irizar","isdera","iso","isuzu","iveco","jac","jaguar","jawa","jba-motors","jeep","jensen","jetour","jetta","jmc","kaiser","kamaz","karlmann-king","karma","keating","kenworth","kia","king-long","koenigsegg","ktm","lada","lagonda","lamborghini","lancia","land-rover","landwind","laraki","leapmotor","levc","lexus","leyland","li-auto","lifan","ligier","lincoln","lister","lloyd","lobini","lordstown","lotus","lucid","luxgen","lynk-and-co","mack","mahindra","man","mansory","marcos","marlin","maserati","mastretta","maxus","maybach","maz","mazda","mazzanti","mclaren","melkus","mercedes-amg","mercedes-benz","mercury","merkur","mev","mg","microcar","mini","mitsubishi","mitsuoka","mk","morgan","morris","mosler","navistar","nevs","nikola","nio","nissan","nissan-gt-r","nissan-nismo","noble","oldsmobile","oltcit","omoda","opel","osca","paccar","packard","pagani","panhard","panoz","pegaso","perodua","peterbilt","peugeot","pgo","pierce-arrow","pininfarina","plymouth","polestar","pontiac","porsche","praga","premier","prodrive","proton","qoros","radical","ram","rambler","ranz","renault","renault-samsung","rezvani","riley","rimac","rinspeed","rivian","roewe","rolls-royce","ronart","rossion","rover","ruf","saab","saic-motor","saipa","saleen","saturn","scania","scion","seat","setra","sev","shacman","simca","singer","singulato","sinotruk","sisu","skoda","smart","soueast","spania-gta","spirra","spyker","ssangyong","ssc","sterling","studebaker","stutz","subaru","suffolk","suzuki","talbot","tata","tatra","tauro","techart","tesla","toyota","toyota-alphard","toyota-century","toyota-crown","tramontana","trion","triumph","troller","tucker","tvr","uaz","ud","ultima","vandenbrink","vauxhall","vector","vencer","venturi","venucia","vinfast","vlf","volkswagen","volvo","w-motors","wanderer","wartburg","weltmeister","western-star","westfield","wey","wiesmann","willys-overland","workhorse","wuling","xpeng","yulon","yutong","zarooq-motors","zastava","zaz","zeekr","zenos","zenvo","zhongtong","zinoro","zotye"];

export type CarBrand = { slug: string; name: string; logoUrl: string };

export const CAR_BRANDS: CarBrand[] = CAR_BRAND_SLUGS.map((slug) => ({
  slug,
  name: brandNameFromSlug(slug),
  logoUrl: carLogoUrl(slug),
}));

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function findBrandByName(name: string): CarBrand | undefined {
  const q = norm(name.trim());
  if (!q) return undefined;
  return CAR_BRANDS.find((b) => norm(b.name) === q) ?? CAR_BRANDS.find((b) => b.slug === q);
}

export function searchBrands(query: string, limit = 12): CarBrand[] {
  const q = norm(query.trim());
  if (!q) return CAR_BRANDS.slice(0, limit);
  const starts: CarBrand[] = [];
  const contains: CarBrand[] = [];
  for (const b of CAR_BRANDS) {
    const n = norm(b.name);
    if (n.startsWith(q)) starts.push(b);
    else if (n.includes(q)) contains.push(b);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
