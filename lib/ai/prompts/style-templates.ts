// Style templates for e-commerce food product images
// Each template defines 7 visual dimensions for consistent AI image generation

import type { ProductAnalysisOutput } from "@/lib/ai/schemas/product-analysis";

type StyleBackground = {
  material: string;
  color: string;
};

type StyleLighting = {
  direction: string;
  quality: string;
  colorTemp: string;
};

type StyleSubject = {
  description: string;
  coverage: string;
  state: string;
};

type StyleComposition = {
  method: string;
  angle: string;
};

type StyleProps = string[];

type StyleEffects = string[];

type StyleFullness = {
  level: string;
};

type StyleMarketingStyle = {
  colorFamily: string;
  materialPreference: string;
  coverageHint: string;
};

type StyleTemplate = {
  key: string;
  label: string;
  category: string;
  background: StyleBackground;
  lighting: StyleLighting;
  subject: StyleSubject;
  composition: StyleComposition;
  props: StyleProps;
  effects: StyleEffects;
  fullness: StyleFullness;
  marketingStyle: StyleMarketingStyle;
};

export const styleTemplates: Record<string, StyleTemplate> = {
  minimalist: {
    key: "minimalist",
    label: "极简主义风",
    category: "摄影写实",
    background: {
      material: "matte cement board / light gray micro-cement / pure white ceramic board",
      color: "off-white (#F5F5F0) or light gray (#E8EAE3), solid color without texture",
    },
    lighting: {
      direction: "large-area soft light from window side,偏向9点钟方向",
      quality: "soft light, extremely faint or near-zero shadows",
      colorTemp: "neutral-warm (4800K), keeping food natural color",
    },
    subject: {
      description: "finished bowl of noodles (white porcelain bowl) or product packaging box",
      coverage: "50~60% (centered with whitespace)",
      state: "noodles neatly coiled in center of bowl, small amount of sauce drizzled, chopsticks placed parallel on right side",
    },
    composition: {
      method: "center composition",
      angle: "45° overhead shot, emphasizing complete bowl shape",
    },
    props: [
      "pair of black matte chopsticks",
      "a green leaf (mint or perilla)",
      "light-colored linen placemat",
      "small dish of vinegar (white porcelain)",
      "minimalist metal spoon",
      "one noodle strand fallen on table (deliberate)",
      "no extra decorations",
    ],
    effects: [
      "steam (optional, minimal)",
      "sauce reflection (required, showing gloss)",
      "no splashes, no dust",
    ],
    fullness: {
      level: "clean (large whitespace, 55~65% coverage)",
    },
    marketingStyle: {
      colorFamily: "muted earth tones, low saturation",
      materialPreference: "matte, frosted, no gloss",
      coverageHint: "minimal, 5~10% of image",
    },
  },

  guochao_illustration: {
    key: "guochao_illustration",
    label: "国潮插画风",
    category: "插画艺术",
    background: {
      material: "hand-drawn illustration base (rice paper texture or vector pattern)",
      color: "vermilion red (#C23B22) with gold cloud patterns, or deep blue with gold foil",
    },
    lighting: {
      direction: "flat light (no specific direction), evenly bright",
      quality: "vector flat fill, no real shadows, color light/dark distinction",
      colorTemp: "not applicable (illustration style)",
    },
    subject: {
      description: "product packaging (illustrated) or illustrated bowl of noodles",
      coverage: "70~80%",
      state: "noodles spiraling upward, chopsticks lifting noodles, sesame scattering in air",
    },
    composition: {
      method: "center-symmetry / circular badge composition",
      angle: "flat design angle, no perspective (front view)",
    },
    props: [
      "auspicious cloud patterns",
      "simplified Yellow Crane Tower illustration",
      "river wave patterns",
      "chili oil splash illustration lines",
      "exaggerated curved noodle textures",
      "calligraphy font '热干面'",
      "brand logo gold foil seal",
    ],
    effects: [
      "spice powder scattering (required)",
      "oil droplets (optional, shown as highlight dots)",
      "no real steam",
    ],
    fullness: {
      level: "full (75~85% coverage, minimal breathing whitespace)",
    },
    marketingStyle: {
      colorFamily: "red-gold imperial palette",
      materialPreference: "gold foil stamping, lacquer texture",
      coverageHint: "moderate, 15~20%",
    },
  },

  vintage_chinese: {
    key: "vintage_chinese",
    label: "复古中国风",
    category: "插画艺术",
    background: {
      material: "aged rice paper / coarse burlap / old wooden board",
      color: "dark yellow-brown (#B87C4F) with mottled texture",
    },
    lighting: {
      direction: "side-backlight from 10 o'clock, upper-left",
      quality: "hard light with distinct shadows, soft shadow edges",
      colorTemp: "warm (3500K), nostalgic yellow tone",
    },
    subject: {
      description: "old-style coarse pottery bowl with noodles",
      coverage: "60%",
      state: "noodles piled high, topped with sesame crumbs and radish bits, chopsticks inserted diagonally",
    },
    composition: {
      method: "triangle (bowl, chopsticks, small dish)",
      angle: "30° slight overhead with depth of field",
    },
    props: [
      "bamboo-woven thermos cover",
      "old newspaper as placemat",
      "wooden chili jar",
      "old-style copper spoon",
      "scattered yellow beans",
      "brush-written price tag",
      "dish of pickled vegetables (dried radish)",
    ],
    effects: [
      "steam (required, heavy)",
      "oil droplet reflection (optional)",
      "light spots (optional, warm)",
    ],
    fullness: {
      level: "full (70~80% coverage)",
    },
    marketingStyle: {
      colorFamily: "aged bronze, patina green, faded red",
      materialPreference: "wood-carved stamp, copper patina",
      coverageHint: "moderate, 10~15%",
    },
  },

  creative_handdrawn: {
    key: "creative_handdrawn",
    label: "创意手绘/涂鸦风",
    category: "插画艺术",
    background: {
      material: "kraft paper / sketch paper texture / whiteboard marker lines",
      color: "off-white (#F5E6D3) or pale yellow with watercolor traces",
    },
    lighting: {
      direction: "natural scattered light, no clear direction",
      quality: "soft, even ignoring light/shadow to highlight hand-drawn lines",
      colorTemp: "neutral (5000K)",
    },
    subject: {
      description: "half real noodles + half hand-drawn illustration collage, or pure hand-drawn bowl",
      coverage: "80%",
      state: "noodles held by doodle-style 'big hand', dynamic tilt",
    },
    composition: {
      method: "diagonal (along noodle tilt direction)",
      angle: "45° overhead (real part) or flat front view (pure illustration)",
    },
    props: [
      "hand-drawn smiley face (noodles smiling)",
      "speech bubble '好恰!'",
      "arrow pointing to sauce packet",
      "scribbled stars and polka dots",
      "real marker pen",
      "scattered colored pencil shavings",
      "handwritten cooking steps doodle",
    ],
    effects: [
      "spice powder scattering (required, shown as dot splatters)",
      "splash droplets (optional)",
      "no real steam",
    ],
    fullness: {
      level: "very full (85%+ coverage)",
    },
    marketingStyle: {
      colorFamily: "crayon, marker, hand-lettered",
      materialPreference: "no 3D, flat hand-drawn",
      coverageHint: "moderate, 10~15%",
    },
  },

  ink_wash: {
    key: "ink_wash",
    label: "意境山水/水墨风",
    category: "概念创意",
    background: {
      material: "raw rice paper texture (digital matte)",
      color: "black-white-gray gradient, light ink wash, abundant whitespace",
    },
    lighting: {
      direction: "overhead spotlight (mimicking stage light)",
      quality: "hard light, strong contrast, but ink areas softened",
      colorTemp: "cool (5500K) or desaturated",
    },
    subject: {
      description: "black ceramic bowl with noodles, topped with scallions and white sesame forming 'ink accents'",
      coverage: "50~60%",
      state: "noodles like mountain ranges, chopsticks like tree branches",
    },
    composition: {
      method: "landscape painting three-section (foreground bowl, midground chopsticks, background whitespace)",
      angle: "45° overhead or scroll perspective",
    },
    props: [
      "calligraphy brush (ink-dipped)",
      "inkstone (used as sauce dish)",
      "dried lotus pod",
      "thread-bound book",
      "plain white porcelain cup (no handle)",
      "water surface reflection (in bowl)",
      "distant mountain silhouette (painting within painting)",
    ],
    effects: [
      "steam (required, like rising cooking smoke)",
      "sauce reflection (minimal)",
      "optional: ink splash dots",
    ],
    fullness: {
      level: "clean (50~60% coverage, abundant whitespace)",
    },
    marketingStyle: {
      colorFamily: "ink black, cinnabar red accent",
      materialPreference: "seal stamp style, no 3D",
      coverageHint: "minimal, 3~5%",
    },
  },

  infographic: {
    key: "infographic",
    label: "现代信息图表风",
    category: "概念创意",
    background: {
      material: "solid color + geometric shapes / grid lines",
      color: "white (#FFFFFF) or light gray (#F2F2F2) with brand-colored lines",
    },
    lighting: {
      direction: "none, flat design style, no real light/shadow",
      quality: "flat vector",
      colorTemp: "not applicable",
    },
    subject: {
      description: "product packaging or cross-section diagram of noodle bowl (infographic style)",
      coverage: "40~50%",
      state: "noodles decomposed into 'noodle length, sauce grams, calorie values'",
    },
    composition: {
      method: "left-right split: left side real/illustration, right side data",
      angle: "front flat shot of packaging, or overhead shot of ingredient arrangement",
    },
    props: [
      "circular data chart (fat percentage)",
      "progress bar (protein content)",
      "icons: flour, egg, salt",
      "small ruler (showing noodle thickness)",
      "thermometer icon (boiling water temp)",
      "timeline (cook 3 minutes)",
      "nutrition facts boolean table",
    ],
    effects: [
      "no real effects, use UI animation feel (optional: glowing annotation dots)",
    ],
    fullness: {
      level: "full (75~85% coverage, information-dense but tidy layout)",
    },
    marketingStyle: {
      colorFamily: "brand primary color, data visualization blue",
      materialPreference: "flat vector, no 3D",
      coverageHint: "moderate, 15~20%",
    },
  },

  c4d_3d: {
    key: "c4d_3d",
    label: "C4D/3D立体风",
    category: "概念创意",
    background: {
      material: "matte plastic / frosted metal / liquid glass texture",
      color: "gradient (deep blue to purple, or orange-red to yellow), high reflection",
    },
    lighting: {
      direction: "three-point lighting, key from upper-left, fill from front-right, rim light for edge definition",
      quality: "hard light with softbox, distinct highlight reflections",
      colorTemp: "warm (4200K) keeping food from looking cold",
    },
    subject: {
      description: "3D-modeled noodle bowl, noodles in spiral 3D shape, sauce with flowing material",
      coverage: "80%",
      state: "bowl floating in air, part of noodles flying out",
    },
    composition: {
      method: "center-symmetry + explosive breakout effect",
      angle: "low angle looking up (15°), enhancing impact",
    },
    props: [
      "floating chili slices (3D)",
      "spinning sesame seeds (3D)",
      "metallic chopsticks suspended (3D)",
      "sauce spheres (3D)",
      "environment cube map light spots",
      "digital particles",
      "brand logo 3D text",
    ],
    effects: [
      "splash droplets (required, slow-motion feel)",
      "oil droplets (required)",
      "light spots (required)",
    ],
    fullness: {
      level: "very full (90%+ coverage)",
    },
    marketingStyle: {
      colorFamily: "neon gradient, chrome metallic",
      materialPreference: "chrome, glass, holographic",
      coverageHint: "prominent, 20~25%",
    },
  },

  street_appetite: {
    key: "street_appetite",
    label: "浓郁食欲/街潮风",
    category: "摄影写实",
    background: {
      material: "black stone slab / rough cement / old metal plate",
      color: "dark gray near-black (#1A1A1A) or dark red",
    },
    lighting: {
      direction: "side-backlight from 8 o'clock, lower-right to upper-left",
      quality: "hard light, extremely dark shadows, sharp edges",
      colorTemp: "warm (4200K), emphasizing chili oil color",
    },
    subject: {
      description: "large bowl of noodles topped with spicy radish, sour beans, peanuts",
      coverage: "75%",
      state: "chopsticks lifting a big bunch of noodles, noodles taut, sauce dripping",
    },
    composition: {
      method: "chopsticks side-action dynamic (the moment of lifting from bowl)",
      angle: "30° slight overhead, chopsticks pointing toward lower-left of frame",
    },
    props: [
      "half a century egg (runny yolk cross-section)",
      "dish of fried yellow beans",
      "iced sour plum drink (condensation on glass)",
      "stainless steel seasoning jar",
      "torn sauce packet (aluminum foil)",
      "a few scattered peanuts",
      "grease-stained paper mat",
    ],
    effects: [
      "steam (required, thick)",
      "oil droplet splashes (required)",
      "sauce reflection (required)",
    ],
    fullness: {
      level: "very full (85%+ coverage)",
    },
    marketingStyle: {
      colorFamily: "dark with warm accent, chili red",
      materialPreference: "metallic, foil stamp, rough texture",
      coverageHint: "moderate, 10~15%",
    },
  },

  realistic_food_photo: {
    key: "realistic_food_photo",
    label: "真实诱人美食摄影风",
    category: "摄影写实",
    background: {
      material: "light wood grain table / old cutting board / natural stone slab",
      color: "warm oak (#C68B5E)",
    },
    lighting: {
      direction: "large window soft light from 10 o'clock",
      quality: "soft, smooth shadow transitions, rich detail",
      colorTemp: "neutral-warm (4800K), true-to-life",
    },
    subject: {
      description: "finished bowl, sesame sauce, scallions, chili oil clearly distinct",
      coverage: "60%",
      state: "noodle cross-section visible, egg yolk golden semi-cooked, steam gently rising",
    },
    composition: {
      method: "45° overhead, triangle (bowl, chopsticks, vinegar pot)",
      angle: "45° overhead",
    },
    props: [
      "garlic mortar and pestle",
      "small dish of vinegar (with reflection)",
      "pair of bamboo chopsticks",
      "two cloves of raw garlic",
      "sesame sauce jar (residue on rim)",
      "one scallion strand fallen on table",
      "napkin corner",
    ],
    effects: [
      "steam (required, natural)",
      "sauce reflection (required)",
      "optional: light spots (window light bokeh)",
    ],
    fullness: {
      level: "clean (65~75% coverage, breathing room)",
    },
    marketingStyle: {
      colorFamily: "warm earth tones, natural wood",
      materialPreference: "matte wood, subtle emboss",
      coverageHint: "minimal, 5~10%",
    },
  },

  japanese_fresh: {
    key: "japanese_fresh",
    label: "日系清新/文艺风",
    category: "摄影写实",
    background: {
      material: "light linen cloth / old wooden table (white-washed)",
      color: "beige-gray (#EFEBE5) or pale bean-paste green",
    },
    lighting: {
      direction: "window soft light, large diffusion",
      quality: "soft, almost no shadows, understated highlights",
      colorTemp: "cool (5500K), slight blue tone",
    },
    subject: {
      description: "elegant ceramic bowl with noodle soup (or mixed noodles), fewer noodles, refined garnish",
      coverage: "40%",
      state: "noodles neatly arranged, half a soft-boiled egg sitting on top, nori flakes scattered",
    },
    composition: {
      method: "center but offset to lower-right, upper-left whitespace for copy",
      angle: "90° flat lay",
    },
    props: [
      "wooden tray",
      "small dish of pickles (pickled plum)",
      "Japanese-style spoon (wooden handle)",
      "cherry blossom small dish",
      "glass of ice water",
      "cotton-linen napkin",
      "small potted plant (asparagus fern)",
    ],
    effects: [
      "steam (optional, very faint)",
      "light spots (optional, round soft bokeh)",
      "no oil droplets",
    ],
    fullness: {
      level: "clean (50~60% coverage)",
    },
    marketingStyle: {
      colorFamily: "muted pastel, sage green, dusty pink",
      materialPreference: "linen, washi paper",
      coverageHint: "minimal, 5~8%",
    },
  },

  warm_homestyle: {
    key: "warm_homestyle",
    label: "温暖家常/亲民风",
    category: "场景叙事",
    background: {
      material: "warm checkered tablecloth / ordinary family dining table (worn)",
      color: "pale cream-yellow (#FDF4E3) or light orange check",
    },
    lighting: {
      direction: "overhead + warm desk lamp (about 45° downward)",
      quality: "soft with hard edges, distinct warm-yellow lit area",
      colorTemp: "warm (3500K)",
    },
    subject: {
      description: "everyday enamel bowl or regular porcelain bowl with noodles",
      coverage: "65%",
      state: "noodles topped with a fried egg (crispy edges), chopsticks casually resting on bowl rim",
    },
    composition: {
      method: "casual snapshot feel, slightly tilted, imperfectly level",
      angle: "30° slight overhead, like sitting at the table looking at food",
    },
    props: [
      "TV remote (table edge)",
      "half cup of tea (glass)",
      "Lao Gan Ma chili sauce bottle",
      "half-peeled tangerine",
      "phone (screen lit)",
      "tissue box",
      "chopsticks with a bit of sauce on them",
    ],
    effects: [
      "steam (required, homestyle feel)",
      "sauce reflection (optional)",
      "no extra effects",
    ],
    fullness: {
      level: "full (75~85% coverage)",
    },
    marketingStyle: {
      colorFamily: "warm domestic orange, cream",
      materialPreference: "ceramic, fabric, no 3D",
      coverageHint: "minimal, 3~5%",
    },
  },

  regional_memory: {
    key: "regional_memory",
    label: "地域风情/城市记忆风",
    category: "场景叙事",
    background: {
      material: "old brick wall / faded road sign / weathered billboard texture",
      color: "brick red (#A55233) or blue-gray (#5D6B6F)",
    },
    lighting: {
      direction: "golden hour side-backlight from 5 o'clock",
      quality: "hard light, elongated shadows",
      colorTemp: "warm (4000K), slight dusk gold",
    },
    subject: {
      description: "bowl of noodles with '老汉口' lettering on bowl",
      coverage: "60%",
      state: "noodles topped with radish bits, sour beans, sesame sauce not yet mixed",
    },
    composition: {
      method: "real-scene integration: bowl placed on old bicycle rear rack or stone steps",
      angle: "45° overhead, background blurred but landmark visible",
    },
    props: [
      "old newspaper (1980s date)",
      "enamel mug",
      "bamboo steamer",
      "old grain ration coupon (as placemat)",
      "palm-leaf fan",
      "Wuhan Yangtze River Bridge model/photo",
      "dialect sticker: '蛮是那个事'",
    ],
    effects: [
      "steam (required, street-food atmosphere)",
      "oil droplets (optional)",
      "light spots (optional, simulating sunset)",
    ],
    fullness: {
      level: "full (70~80% coverage)",
    },
    marketingStyle: {
      colorFamily: "faded brick, sunset gold",
      materialPreference: "enamel, aged metal, vintage label",
      coverageHint: "moderate, 10~15%",
    },
  },

  lifestyle_scene: {
    key: "lifestyle_scene",
    label: "简约实景/生活化场景风",
    category: "场景叙事",
    background: {
      material: "cement terrace / picnic mat / ordinary kitchen counter",
      color: "light cement gray (#D1CDC5) or light beige",
    },
    lighting: {
      direction: "natural light from side (9 o'clock)",
      quality: "soft, naturally gentle shadows",
      colorTemp: "neutral (5000K)",
    },
    subject: {
      description: "noodle bowl on outdoor table or windowsill",
      coverage: "55%",
      state: "chopsticks resting on bowl, noodles half-lifted, frozen action",
    },
    composition: {
      method: "real-scene integration, using window or railing to form frame-within-frame",
      angle: "45° overhead with foreground blur",
    },
    props: [
      "glass of iced Americano",
      "canvas tote bag (book corner visible)",
      "picnic basket corner",
      "sunglasses",
      "plant leaves",
      "pack of napkins",
      "phone stand",
    ],
    effects: [
      "steam (optional)",
      "light spots (natural, required)",
      "no extra effects",
    ],
    fullness: {
      level: "clean (60~70% coverage)",
    },
    marketingStyle: {
      colorFamily: "natural earth, sage, beige",
      materialPreference: "canvas, wood, natural materials",
      coverageHint: "minimal, 3~5%",
    },
  },

  premium_product: {
    key: "premium_product",
    label: "精修产品/高端质感风",
    category: "摄影写实",
    background: {
      material: "pure black acrylic / white ceramic board / mirror surface",
      color: "pure black (#000000) or pure white (#FFFFFF), with reflection",
    },
    lighting: {
      direction: "softbox from left and right symmetric, front fill",
      quality: "soft but extremely fine, precise highlight control, no messy shadows",
      colorTemp: "neutral (5000K), saturated but not overflowing",
    },
    subject: {
      description: "product packaging (retouched) or bowl of noodles (each strand clear)",
      coverage: "70%",
      state: "noodles in perfect arc, sauce evenly distributed, scallion bits distinct",
    },
    composition: {
      method: "center, product floating feel (using reflection board)",
      angle: "45° overhead or flat front (packaging)",
    },
    props: [
      "sauce packets arranged separately",
      "gold cutlery (spoon, fork)",
      "brand card",
      "dried rose petals or premium spices",
      "marble tray",
      "perfume bottle (decorative)",
      "gold-foil logo mark",
    ],
    effects: [
      "sauce reflection (required, appetizing gloss)",
      "no steam (avoid blur)",
      "optional: extremely faint light spots",
    ],
    fullness: {
      level: "full (75% coverage, clean whitespace)",
    },
    marketingStyle: {
      colorFamily: "black/gold, white/silver luxury",
      materialPreference: "gold foil, mirror chrome, emboss",
      coverageHint: "moderate, 10~15%",
    },
  },

  festival_promo: {
    key: "festival_promo",
    label: "节日促销/大促氛围风",
    category: "促销营销",
    background: {
      material: "laser paper / sequin fabric / red gradient plastic board",
      color: "bright red (#E31B23) to gold gradient, or purple to pink",
    },
    lighting: {
      direction: "multi-point light sources, disco-like effect",
      quality: "hard light, producing starbursts and reflections",
      colorTemp: "variable, exaggerated warm/cool and colored light mixing",
    },
    subject: {
      description: "product packaging + bowl of noodles, with explosion sticker '双11必囤'",
      coverage: "80%",
      state: "noodles with small flags, packaging box open, sauce packets flying out",
    },
    composition: {
      method: "radial (light rays emanating from bowl center)",
      angle: "low angle looking up (20°), emphasizing impact",
    },
    props: [
      "gold ribbon",
      "red envelope/coupon model",
      "balloons",
      "'到手价' price tag",
      "countdown numbers (3D)",
      "shopping cart icon",
      "flamingo or festival zodiac mascot",
    ],
    effects: [
      "splash droplets (required, with golden light)",
      "light spot starbursts (required)",
      "optional: steam tinted by colored lights",
    ],
    fullness: {
      level: "very full (90%+ coverage)",
    },
    marketingStyle: {
      colorFamily: "red-gold, neon, high saturation",
      materialPreference: "chrome, holographic, glitter",
      coverageHint: "prominent, 25~30%",
    },
  },

  healthy_light: {
    key: "healthy_light",
    label: "健康/轻食代餐风",
    category: "摄影写实",
    background: {
      material: "light bamboo mat / white grid cloth / light terrazzo",
      color: "pale green (#D8E6D3) or off-white (#FDF6EC)",
    },
    lighting: {
      direction: "large-area soft light, even and shadowless",
      quality: "soft, clean and bright",
      colorTemp: "cool (5500K), refreshing feel",
    },
    subject: {
      description: "bowl of noodles (buckwheat or konjac), with lots of vegetables",
      coverage: "50%",
      state: "noodles topped with chicken breast slices, broccoli, cherry tomatoes, vinaigrette dressing",
    },
    composition: {
      method: "flat lay (90°), ingredients neatly arranged",
      angle: "90° overhead",
    },
    props: [
      "digital scale (showing calories)",
      "nutrition facts card",
      "dumbbell / yoga mat corner",
      "measuring spoons",
      "lemon slices",
      "mint leaves",
      "sports water bottle (BPA free)",
    ],
    effects: [
      "no steam (cold food feel)",
      "optional: water droplets (fresh produce)",
      "no oil droplets",
    ],
    fullness: {
      level: "clean (55~65% coverage)",
    },
    marketingStyle: {
      colorFamily: "green, white, clean blue",
      materialPreference: "flat matte, no 3D",
      coverageHint: "minimal, 5~8%",
    },
  },

  cute_cartoon: {
    key: "cute_cartoon",
    label: "憨萌卡通/童趣风",
    category: "插画艺术",
    background: {
      material: "rainbow background paper / polka dot pattern fabric",
      color: "pale yellow (#FFF0B5) with cloud stickers",
    },
    lighting: {
      direction: "even diffuse light, no shadows",
      quality: "soft, toy-like",
      colorTemp: "neutral-warm (4800K)",
    },
    subject: {
      description: "cartoon-style noodle bowl, noodles become curved smiley faces with eyes and mouth",
      coverage: "70%",
      state: "noodles dancing in bowl, sauce as blush",
    },
    composition: {
      method: "center, surrounded by small elements",
      angle: "45° overhead (real + toy hybrid)",
    },
    props: [
      "plush toy (bear) hugging noodle bowl",
      "building blocks",
      "crayon drawing",
      "lollipop",
      "colorful small flags",
      "children's tableware (with animal ears)",
      "sticker book",
    ],
    effects: [
      "spice powder scattering (colored particles)",
      "optional: light spots (heart-shaped)",
    ],
    fullness: {
      level: "very full (85%+ coverage)",
    },
    marketingStyle: {
      colorFamily: "candy colors, rainbow",
      materialPreference: "plastic, plush, no 3D",
      coverageHint: "moderate, 10~15%",
    },
  },

  baby_parenting: {
    key: "baby_parenting",
    label: "母婴亲子/宝宝辅食风",
    category: "场景叙事",
    background: {
      material: "soft cotton-linen cloth / silicone placemat",
      color: "pale pink (#F9E6EF) or pale blue (#E3F0F5)",
    },
    lighting: {
      direction: "window soft light, near diffuse",
      quality: "soft, no sharp shadows",
      colorTemp: "neutral-warm (4800K), warm and safe",
    },
    subject: {
      description: "children's divided plate with noodles (thin, cut short), with fruit/veg puree",
      coverage: "60%",
      state: "noodles shaped into cartoon forms (stars, bears), spoon with a small bite",
    },
    composition: {
      method: "flat lay, color-zoned",
      angle: "90° overhead",
    },
    props: [
      "baby spoon (silicone)",
      "teething feeder",
      "bib (waterproof)",
      "pacifier",
      "rice cereal jar",
      "fruit/veg puree pouch",
      "a baby's small hand (in frame)",
    ],
    effects: [
      "no steam (avoid hot feel)",
      "optional: soft light spots",
    ],
    fullness: {
      level: "full (75% coverage, not crowded)",
    },
    marketingStyle: {
      colorFamily: "pastel pink, baby blue, cream",
      materialPreference: "silicone, fabric, no 3D",
      coverageHint: "minimal, 3~5%",
    },
  },

  tech_geometric: {
    key: "tech_geometric",
    label: "参数化/科技几何风",
    category: "概念创意",
    background: {
      material: "grid lines / circuit board texture / brushed metal",
      color: "dark gray (#2C2F33) with neon cyan (#00FFCC)",
    },
    lighting: {
      direction: "edge light + dot-matrix light (tech feel)",
      quality: "hard light, with reflection and glow",
      colorTemp: "cool (6000K), blue tone",
    },
    subject: {
      description: "noodle bowl cut by geometric lines, noodles become hexagonal cross-sections (3D render)",
      coverage: "65%",
      state: "noodles as parametric curves, sauce as fluid simulation",
    },
    composition: {
      method: "symmetry + fragmentation/reassembly",
      angle: "45° overhead, bowl surrounded by grid",
    },
    props: [
      "holographic projection data (protein content)",
      "vernier caliper (measuring noodle diameter)",
      "circuit board",
      "oscilloscope waveform",
      "code snippet (printed on label)",
      "LED strip",
      "screws and nuts (symbolizing industrial precision)",
    ],
    effects: [
      "no steam",
      "light spots (required, with glow)",
      "splash droplets (optional, as particle system)",
    ],
    fullness: {
      level: "full (75~85% coverage)",
    },
    marketingStyle: {
      colorFamily: "neon cyan, dark gray, electric blue",
      materialPreference: "HUD, holographic, particle",
      coverageHint: "moderate, 15~20%",
    },
  },

  dynamic_video: {
    key: "dynamic_video",
    label: "动态/短视频风格",
    category: "概念创意",
    background: {
      material: "same themed background (variable), focus on dynamic",
      color: "varies by product, commonly dark to highlight food",
    },
    lighting: {
      direction: "dynamic lighting (can go from dark to bright)",
      quality: "hard + soft combined, changing with action",
      colorTemp: "warm-based, adjustable in post",
    },
    subject: {
      description: "video first frame is a bowl, then chopsticks lifting, sauce pouring, boiling water",
      coverage: "dynamic, close-up fills frame",
      state: "keyframes: 'noodles at highest lift point', 'boiling water hitting noodle cake', 'egg yolk bursting'",
    },
    composition: {
      method: "multi-shot switching: extreme close-up (sauce drip) → medium (chopsticks lifting) → wide (finished dish)",
      angle: "0° side (pouring sauce), 45° overhead (overall), 90° overhead (sprinkling)",
    },
    props: [
      "sauce packet tearing action",
      "hot water kettle pouring",
      "timer (3 minutes)",
      "hand stirring noodles",
      "adding toppings (sour beans, radish bits)",
      "slow-motion scallion and sesame sprinkle",
      "slurping sound (visualized)",
    ],
    effects: [
      "steam (required, dynamically rising)",
      "splash droplets (required, slow-motion)",
      "oil droplet reflection (required)",
      "optional: noodle bounce effect",
    ],
    fullness: {
      level: "dynamic: extreme close-up very full, wide shot full",
    },
    marketingStyle: {
      colorFamily: "varies by scene",
      materialPreference: "dynamic overlays",
      coverageHint: "varies",
    },
  },
};

export const legacyStyleMap: Record<string, string> = {
  generic_clean: "realistic_food_photo",
  premium: "premium_product",
  soft_lifestyle: "warm_homestyle",
  conversion_focused: "festival_promo",
  tech: "tech_geometric",
};

export function resolveStyleKey(styleKey: string): string {
  if (styleKey in styleTemplates) {
    return styleKey;
  }
  if (styleKey in legacyStyleMap) {
    return legacyStyleMap[styleKey];
  }
  return "realistic_food_photo";
}

export function buildStyleInstruction(styleKey: string): string {
  const resolvedKey = resolveStyleKey(styleKey);
  const t = styleTemplates[resolvedKey];
  if (!t) return "";

  let result = `=== VISUAL STYLE: ${t.label} (${t.key}) ===
This project MUST follow the ${t.label} visual style across ALL sections. Every visualPrompt you write must conform to these 7 dimensions:

1. BACKGROUND: ${t.background.material}. Color: ${t.background.color}
2. LIGHTING: Direction: ${t.lighting.direction}. Quality: ${t.lighting.quality}. Color temperature: ${t.lighting.colorTemp}
3. SUBJECT STATE: ${t.subject.description}. Coverage: ${t.subject.coverage}. State: ${t.subject.state}
4. COMPOSITION: Method: ${t.composition.method}. Camera angle: ${t.composition.angle}
5. PROPS (arrange 5-7 of these around the subject): ${t.props.join("; ")}
6. ATMOSPHERE EFFECTS: ${t.effects.join("; ")}
7. FULLNESS: ${t.fullness.level}

MARKETING ELEMENT STYLE (indirect influence):
- Color family: ${t.marketingStyle.colorFamily}
- Material preference: ${t.marketingStyle.materialPreference}
- Coverage hint: ${t.marketingStyle.coverageHint}

CRITICAL: The visualPrompt for each section MUST embed these style dimensions. The background material, lighting direction, composition angle, prop selection, and atmosphere effects must all reflect this style consistently.`;

  if (resolvedKey === "dynamic_video") {
    result +=
      "\nNOTE: This style is reserved for future video capability. Currently treat as realistic_food_photo for image generation.";
  }

  return result;
}

export function buildStyleVisualConstraint(styleKey: string): string {
  const resolvedKey = resolveStyleKey(styleKey);
  const t = styleTemplates[resolvedKey];
  if (!t) return "";

  const lowDensityStyles = [
    "minimalist",
    "japanese_fresh",
    "healthy_light",
    "lifestyle_scene",
    "baby_parenting",
    "ink_wash",
    "realistic_food_photo",
    "warm_homestyle",
    "vintage_chinese",
    "regional_memory",
  ];
  const isLowDensity = lowDensityStyles.includes(resolvedKey);

  if (isLowDensity) {
    let result = `=== STYLE VISUAL CONSTRAINT: ${t.label} (${t.key}) ===
This is a LOW-DENSITY visual style. The style's own color temperature, background, and lighting settings below are the SOURCE OF TRUTH and MUST be followed exactly. Do NOT override them with generic food-appetite dark/warm-spotlight conventions — this style's distinct mood IS its value. Overriding them would collapse every style into the same dark moody look and destroy the style differentiation.

STYLE DETAILS (follow these exactly — they define this style's identity):
BACKGROUND: ${t.background.material}. Color: ${t.background.color}
LIGHTING: ${t.lighting.direction}. Quality: ${t.lighting.quality}. Color temperature: ${t.lighting.colorTemp}
SUBJECT: ${t.subject.description}. Coverage: ${t.subject.coverage}. State: ${t.subject.state}
COMPOSITION: ${t.composition.method}. Angle: ${t.composition.angle}
PROPS: Arrange 5-7 of these items around the subject to enrich the scene: ${t.props.join("; ")}
EFFECTS: ${t.effects.join("; ")}
FULLNESS: ${t.fullness.level}

MARKETING ELEMENTS: Use ${t.marketingStyle.colorFamily} color family. Prefer ${t.marketingStyle.materialPreference} materials. Marketing coverage: ${t.marketingStyle.coverageHint}.

QUALITY STANDARD (non-negotiable): The image MUST look like premium commercial food photography — magazine quality. The product should look appetizing and desirable, styled and lit to perfection. Every element should feel intentional and polished, not generic or template-like. Appetite appeal is achieved through styling, freshness, and polish — NOT by forcing dark backgrounds or warm spotlights that contradict this style.

CREATIVE FREEDOM WITHIN STYLE BOUNDARIES: You have full creative license to compose, light, and style this image in the most visually stunning way possible — as long as you stay within this style's color temperature, background mood, lighting character, and fullness level defined above. Surprise with unique angles, interesting props, or unexpected styling that elevates this specific style. Adapt creatively based on the specific product's colors, shape, and story — no two products in the same style should look identical.

IMPORTANT: Maintain product identity and recognizability. The style defines the scene, lighting, composition, and atmosphere — NOT the product itself. Let the product's own colors and textures shine within this style's visual language.`;

    if (resolvedKey === "dynamic_video") {
      result +=
        "\nNOTE: This style is reserved for future video capability. Currently treat as realistic_food_photo for image generation.";
    }

    return result;
  }

  let result = `=== STYLE VISUAL CONSTRAINT: ${t.label} (${t.key}) ===
⚠️ FOOD APPETITE PRIORITY — ABSOLUTE OVERRIDE: For food products, appetite appeal is the #1 priority and OVERRIDES this style's color temperature, background color, and lighting direction. If this style specifies cool tones, flat/even lighting, or minimalist/cold backgrounds, you MUST ADAPT them to serve appetite appeal:
- Color temperature: ALWAYS use WARM tones (3800K-4500K) for food — golden amber on food, NEVER cool blue
- Lighting: ALWAYS use dramatic directional warm spotlight — NEVER flat/even/symmetric studio lighting for food
- Background: If this style's background is cold/minimalist, CHANGE it to warm dark tones (deep black, dark charcoal, dark wood) that make the food colors pop
- Keep the style's overall aesthetic direction (e.g., premium_product can keep its black background but MUST use warm spotlight instead of symmetric softbox)
This food appetite rule has HIGHER priority than the style rules below. When they conflict, follow the food appetite rule.

STYLE DETAILS (adapted for food appetite where needed):
BACKGROUND: ${t.background.material}. Color: ${t.background.color} — BUT if this is a food product and the background is cold/minimalist, use deep black or dark charcoal instead
LIGHTING: ${t.lighting.direction}. Quality: ${t.lighting.quality}. Color temperature: ${t.lighting.colorTemp} — BUT if this is a food product, use warm spotlight (3800K-4500K) instead of any cool/flat lighting
SUBJECT: ${t.subject.description}. Coverage: ${t.subject.coverage}. State: ${t.subject.state}
COMPOSITION: ${t.composition.method}. Angle: ${t.composition.angle}
PROPS: Include 5-7 of these items around the subject: ${t.props.join("; ")}
EFFECTS: ${t.effects.join("; ")}
FULLNESS: ${t.fullness.level}

MARKETING ELEMENTS: Use ${t.marketingStyle.colorFamily} color family. Prefer ${t.marketingStyle.materialPreference} materials. Marketing coverage: ${t.marketingStyle.coverageHint}.

IMPORTANT: Maintain product identity and recognizability while following this style. The style affects the scene, lighting, composition, and atmosphere — NOT the product itself. Food appetite appeal ALWAYS wins over style constraints for food products.`;

  if (resolvedKey === "dynamic_video") {
    result +=
      "\nNOTE: This style is reserved for future video capability. Currently treat as realistic_food_photo for image generation.";
  }

  return result;
}

/**
 * 产品材质关键词 → 背景材质呼应映射
 * 基于产品材质（陶瓷/玻璃/木质/金属/液体等）延伸背景材质细节
 */
const MATERIAL_BACKGROUND_MAP: Array<{ keywords: string[]; bgMaterial: string; visualEffect: string }> = [
  {
    keywords: ["陶瓷", "瓷", "陶", "瓦罐", "砂锅"],
    bgMaterial: "大理石台面/镜面倒影/冷感石材底座",
    visualEffect: "冷感高级，陶瓷釉面与大理石纹理相互映衬",
  },
  {
    keywords: ["玻璃", "透明", "水晶", "亚克力"],
    bgMaterial: "磨砂玻璃底板/透光亚克力/水波纹反射面",
    visualEffect: "通透感，光线穿透玻璃形成柔和折射",
  },
  {
    keywords: ["木质", "木", "纸", "纸盒", "牛皮纸", "竹"],
    bgMaterial: "原木桌板/粗麻布衬底/牛皮纸垫/竹编托盘",
    visualEffect: "自然质朴，木纹与产品材质形成同色系层次",
  },
  {
    keywords: ["金属", "铁", "铝", "锡", "不锈钢", "易拉罐"],
    bgMaterial: "拉丝金属板/亚克力反光面/工业水泥台面",
    visualEffect: "科技现代，金属光泽与冷光相互呼应",
  },
  {
    keywords: ["塑料", "PET", "包装袋", "复合膜", "铝箔"],
    bgMaterial: "哑光塑料板/亚克力台面/光滑树脂底座",
    visualEffect: "现代简洁，塑料光泽与光滑台面形成统一质感",
  },
  {
    keywords: ["液体", "酱料", "汤汁", "汁", "油", "蜂蜜", "果酱"],
    bgMaterial: "玻璃器皿/陶瓷深盘/水波纹台面/油光反射面",
    visualEffect: "通透诱人，液体光泽与反光面相互映衬",
  },
  {
    keywords: ["织物", "棉", "麻", "布", "帆布", "棉麻"],
    bgMaterial: "棉麻桌布/编织篮/藤席/粗布衬底",
    visualEffect: "温馨生活，织物纹理与产品材质形成温暖层次",
  },
];

/**
 * 产品颜色 → 背景颜色对比策略映射
 * 基于色彩学（互补色/同色系/暖冷对比）延伸背景颜色
 */
const COLOR_BACKGROUND_MAP: Array<{ keywords: string[]; strategy: string; bgColor: string; effect: string }> = [
  {
    keywords: ["红", "橙", "黄", "暖", "金"],
    strategy: "互补色对比",
    bgColor: "冷色背景（蓝灰/墨绿/深青）",
    effect: "暖色产品在冷色背景上更突出，视觉冲击力强",
  },
  {
    keywords: ["蓝", "绿", "紫", "冷", "青"],
    strategy: "暖冷对比",
    bgColor: "暖色背景（米黄/橡木/暖灰）",
    effect: "冷色产品在暖色背景上温度感强，画面有张力",
  },
  {
    keywords: ["白", "灰", "黑", "中性", "银"],
    strategy: "同色系深浅",
    bgColor: "同色系深浅背景（深灰/浅灰/纯黑/纯白）",
    effect: "层次感强，高级感，适合极简风格",
  },
  {
    keywords: ["多彩", "彩色", "缤纷", "渐变", "花"],
    strategy: "简化背景",
    bgColor: "纯色背景（白/灰/黑/米色）",
    effect: "简化背景突出多彩产品，避免视觉混乱",
  },
  {
    keywords: ["透明", "半透明", "清澈", "晶莹"],
    strategy: "深色透光",
    bgColor: "深色背景（深蓝/深紫/纯黑）+ 透光特效",
    effect: "通透感，质感突出，光线穿透形成光晕",
  },
];

/**
 * 卖点关键词 → 背景特效延伸映射
 * 基于产品核心卖点延伸背景氛围特效
 */
const SELLING_POINT_EFFECT_MAP: Array<{ keywords: string[]; effect: string; detail: string }> = [
  {
    keywords: ["原生态", "天然", "有机", "野生", "自然", "原产地", "生态"],
    effect: "晨露水珠/绿叶虚化/泥土纹理/藤蔓装饰",
    detail: "自然清新，晨露水珠点缀台面，绿叶在背景虚化形成自然氛围",
  },
  {
    keywords: ["手工", "匠心", "古法", "传统", "工艺", "手作", "非遗"],
    effect: "木纹质感/手作痕迹/暖黄光斑/工具虚化",
    detail: "匠心温度，木纹台面有使用痕迹，暖黄光斑营造手作工坊氛围",
  },
  {
    keywords: ["高端", "奢华", "进口", " premium", "尊贵", "高级", "精品"],
    effect: "金箔点缀/水晶反光/深色丝绒/暗金光晕",
    detail: "奢华高级，金箔碎片点缀台面，水晶器皿反光，深色丝绒衬底",
  },
  {
    keywords: ["健康", "低卡", "轻食", "减脂", "无糖", "低脂", "清淡"],
    effect: "清新水雾/淡绿光晕/薄荷叶虚化/水珠飞溅",
    detail: "清爽健康，清新水雾弥漫，淡绿光晕环绕，薄荷叶在背景虚化",
  },
  {
    keywords: ["热辣", "劲爆", "过瘾", "麻辣", "辣", "刺激", "火爆"],
    effect: "红色光晕/烟雾效果/火焰虚化/辣椒散落",
    detail: "热烈冲击，红色光晕从产品四周扩散，烟雾效果增加神秘感",
  },
  {
    keywords: ["鲜美", "原味", "纯粹", "鲜", "原汤", "清炖", "本味"],
    effect: "透明水光/白色蒸汽/淡蓝冷光/水波纹",
    detail: "纯净鲜美，白色蒸汽缓缓上升，透明水光反射，淡蓝冷光增加纯净感",
  },
  {
    keywords: ["浓郁", "醇厚", "香浓", "奶香", "芝士", "巧克力", "可可"],
    effect: "暖黄光晕/丝绒质感/金色光斑/奶油飞溅",
    detail: "浓郁诱人，暖黄光晕营造温暖感，丝绒质感增加醇厚感",
  },
  {
    keywords: ["新鲜", "现做", "现摘", "当季", "时令", "新鲜采摘"],
    effect: "水珠飞溅/鲜亮光斑/绿叶装饰/晨光透射",
    detail: "鲜活生动，水珠飞溅表现新鲜度，晨光透射增加生命力",
  },
  {
    keywords: ["便携", "方便", "即食", "随身", "出行", "旅行", "户外"],
    effect: "户外场景虚化/背包/旅行道具/自然光",
    detail: "生活场景，户外场景虚化作为背景，旅行道具暗示便携场景",
  },
  {
    keywords: ["礼盒", "礼袋", "送礼", "礼品", "年货", "节庆", "节日"],
    effect: "红木桌/绸缎衬布/金色装饰/暖光/礼花虚化",
    detail: "节庆氛围，红木桌与绸缎衬底，金色装饰点缀，暖光营造温馨感",
  },
];

/**
 * 在映射表中查找匹配项
 */
function findMatch<T extends { keywords: string[] }>(
  text: string,
  map: T[],
): T | null {
  const lowerText = text.toLowerCase();
  for (const item of map) {
    if (item.keywords.some((kw) => lowerText.includes(kw.toLowerCase()))) {
      return item;
    }
  }
  return null;
}

/**
 * 构建产品背景延伸约束 — 基于产品属性动态延伸背景材质、颜色、特效
 *
 * 设计原则：
 * 1. 风格优先级 > 产品延伸：延伸只补充不覆盖，风格基调不可变
 * 2. 延伸范围受限：只延伸材质细节、颜色微调、氛围特效，不改变风格类别
 * 3. 向后兼容：无产品分析或无匹配时返回空字符串，不影响现有流程
 *
 * @param analysis 产品分析结果
 * @returns 产品背景延伸约束字符串（无匹配则返回空字符串）
 */
export function buildProductBackgroundExtension(
  analysis: ProductAnalysisOutput,
): string {
  const extensions: string[] = [];

  // === 1. 材质呼应 ===
  // 基于产品材质延伸背景材质细节
  const materialMatch = findMatch(analysis.material, MATERIAL_BACKGROUND_MAP);
  if (materialMatch) {
    extensions.push(
      `BACKGROUND MATERIAL EXTENSION (材质呼应): 基于产品材质"${analysis.material}"，背景材质细节延伸为 ${materialMatch.bgMaterial}。视觉效果：${materialMatch.visualEffect}。`,
    );
  }

  // === 2. 颜色对比 ===
  // 基于产品颜色延伸背景颜色策略
  const colorMatch = findMatch(analysis.color, COLOR_BACKGROUND_MAP);
  if (colorMatch) {
    extensions.push(
      `BACKGROUND COLOR EXTENSION (颜色对比): 基于产品颜色"${analysis.color}"，采用${colorMatch.strategy}策略，背景颜色微调为 ${colorMatch.bgColor}。视觉效果：${colorMatch.effect}。`,
    );
  }

  // === 3. 卖点特效 ===
  // 基于产品核心卖点延伸背景氛围特效（取前 3 个卖点，避免特效过多）
  const sellingPointEffects: string[] = [];
  const topSellingPoints = analysis.coreSellingPoints.slice(0, 3);
  for (const sp of topSellingPoints) {
    const spMatch = findMatch(sp, SELLING_POINT_EFFECT_MAP);
    if (spMatch) {
      sellingPointEffects.push(`- 卖点"${sp}" → 特效: ${spMatch.effect}（${spMatch.detail}）`);
    }
  }
  if (sellingPointEffects.length > 0) {
    extensions.push(
      `BACKGROUND EFFECT EXTENSION (卖点特效): 基于产品核心卖点延伸背景氛围特效：\n${sellingPointEffects.join("\n")}`,
    );
  }

  if (extensions.length === 0) {
    return "";
  }

  return [
    "=== PRODUCT BACKGROUND EXTENSION (产品背景延伸 — 基于产品属性动态补充) ===",
    "IMPORTANT: 以下延伸约束是对风格模板的【补充】而非【覆盖】。风格基调（材质类型、色温方向、光影风格）不可变，只可在风格范围内微调材质细节、颜色深浅、氛围特效。",
    "",
    ...extensions,
    "",
    "APPLICATION RULES (应用规则):",
    "1. 风格模板的背景材质/颜色优先级最高，产品延伸只在其范围内微调",
    "2. 若产品延伸与风格模板冲突，以风格模板为准",
    "3. 材质呼应：在风格背景材质基础上，增加产品材质呼应的细节道具或台面材质",
    "4. 颜色对比：在风格背景颜色范围内，微调深浅以形成与产品颜色的对比关系",
    "5. 卖点特效：在风格氛围效果基础上，叠加与卖点呼应的氛围特效（蒸汽/光晕/水珠等）",
    "6. 每张图的 visualPrompt 必须体现至少 1 项产品背景延伸（材质/颜色/特效任选）",
    "=== END PRODUCT BACKGROUND EXTENSION ===",
  ].join("\n");
}
