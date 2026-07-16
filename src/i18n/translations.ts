export type Language = "pt" | "en" | "es" | "it" | "de" | "fr";

export const languageLabels: Record<Language, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
  it: "Italiano",
  de: "Deutsch",
  fr: "Français",
};

export const languageFlags: Record<Language, string> = {
  pt: "🇧🇷",
  en: "🇺🇸",
  es: "🇪🇸",
  it: "🇮🇹",
  de: "🇩🇪",
  fr: "🇫🇷",
};

type TranslationKeys = {
  nav: {
    about: string;
    fleet: string;
    howItWorks: string;
    whyZeus: string;
    contact: string;
    book: string;
    myBookings: string;
  };
  hero: {
    title: string;
    titleHighlight: string;
    subtitle: string;
    exploreFleet: string;
    contactUs: string;
  };
  about: {
    title: string;
    titleHighlight: string;
    description: string;
    tagline: string;
    feat1: string;
    feat2: string;
    feat3: string;
    feat4: string;
  };
  fleet: {
    sectionTag: string;
    title: string;
    titleHighlight: string;
    all: string;
    passengers: string;
    book: string;
    noResults: string;
    whatsappMsg: (name: string) => string;
    superSport: string;
    sport: string;
    suvPremium: string;
    suvFullSize: string;
    suv: string;
    suvCompact: string;
    minivan: string;
  };
  howItWorks: {
    title: string;
    subtitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    quote: string;
    bookNow: string;
  };
  deals: {
    title: string;
    titleHighlight: string;
    subtitle: string;
    discount5: string;
    discount10: string;
  };
  whyZeus: {
    title: string;
    titleHighlight: string;
    benefit1Title: string;
    benefit1Desc: string;
    benefit2Title: string;
    benefit2Desc: string;
    benefit3Title: string;
    benefit3Desc: string;
    benefit4Title: string;
    benefit4Desc: string;
  };
  requirements: {
    title: string;
    titleHighlight: string;
    subtitle: string;
    item1: string;
    item2: string;
    item3: string;
    footer: string;
  };
  testimonials: {
    title: string;
    titleHighlight: string;
    t1Name: string;
    t1Text: string;
    t2Name: string;
    t2Text: string;
    t3Name: string;
    t3Text: string;
    t4Name: string;
    t4Text: string;
    t5Name: string;
    t5Text: string;
    t6Name: string;
    t6Text: string;
  };
  footer: {
    tagline: string;
    whatsapp: string;
    rights: string;
  };
  vehicles: {
    [key: string]: { subtitle: string; features: string[] };
  };
};

export const translations: Record<Language, TranslationKeys> = {
  pt: {
    nav: {
      about: "Sobre Nós",
      fleet: "Frota",
      howItWorks: "Como Funciona",
      whyZeus: "Por que a GoDrive?",
      contact: "Contato",
      book: "Reservar",
      myBookings: "Minhas Reservas",
    },
    hero: {
      title: "Sua próxima viagem começa ",
      titleHighlight: "aqui.",
      subtitle: "Uma frota preparada, atendimento próximo e a leveza de chegar mais longe do seu jeito.",
      exploreFleet: "Explorar a Frota",
      contactUs: "Fale Conosco",
    },
    about: {
      title: "Quem ",
      titleHighlight: "Somos",
      description: "A GoDrive é referência em locação de veículos premium para brasileiros em Orlando. Oferecemos uma experiência de mobilidade de alto nível, com atendimento personalizado, frota selecionada e o melhor custo-benefício do mercado. porque serviço premium não precisa custar caro.",
      tagline: "Serviço premium com o melhor custo-benefício de Orlando.",
      feat1: "Atendimento 100% em português",
      feat2: "Veículos selecionados e revisados",
      feat3: "Processo simples e ágil",
      feat4: "Suporte durante toda a viagem",
    },
    fleet: {
      sectionTag: "Frota GoDrive",
      title: "Encontre o modelo perfeito",
      titleHighlight: "para sua viagem",
      all: "Todos",
      passengers: "Passageiros:",
      book: "Reservar",
      noResults: "Nenhum veículo encontrado com os filtros selecionados.",
      whatsappMsg: (name) => `Olá! Tenho interesse no ${name}. Gostaria de saber sobre disponibilidade e valores.`,
      superSport: "Super Esportivo",
      sport: "Esportivo",
      suvPremium: "SUV Premium",
      suvFullSize: "SUV Full Size",
      suv: "SUV",
      suvCompact: "SUV Compacto",
      minivan: "Minivan",
    },
    howItWorks: {
      title: "Aluguel de carro em Orlando",
      subtitle: "Mais fácil do que você imagina",
      step1Title: "Escolha o Carro",
      step1Desc: "Explore nossa frota e selecione o modelo ideal para sua viagem.",
      step2Title: "Reserve Antes da Viagem",
      step2Desc: "Entre em contato, confirme datas e garanta seu veículo.",
      step3Title: "Retire no Aeroporto e Dirija",
      step3Desc: "Chegou em Orlando? Seu carro já está esperando.",
      quote: '"Sua viagem fica muito mais confortável com carro próprio."',
      bookNow: "Reserve Agora",
    },
    deals: {
      title: "Condições ",
      titleHighlight: "Especiais",
      subtitle: "Quanto mais tempo com a GoDrive, mais vantagem para você.",
      discount5: "2 a 5 dias de locação",
      discount10: "Reservas acima de 10 diárias",
    },
    whyZeus: {
      title: "Por que escolher a ",
      titleHighlight: "GoDrive?",
      benefit1Title: "Veículos selecionados",
      benefit1Desc: "Cada carro da nossa frota é escolhido a dedo para garantir qualidade e conforto.",
      benefit2Title: "Atendimento em português",
      benefit2Desc: "Fale com quem entende você. Sem barreiras, sem complicação.",
      benefit3Title: "Processo simples e ágil",
      benefit3Desc: "Reserve online, retire no aeroporto. Sem burocracia.",
      benefit4Title: "Suporte durante toda a viagem",
      benefit4Desc: "Estamos disponíveis do início ao fim da sua experiência.",
    },
    requirements: {
      title: "O que você precisa para ",
      titleHighlight: "dirigir nos EUA?",
      subtitle: "É mais simples do que você imagina",
      item1: "CNH brasileira válida",
      item2: "Passaporte",
      item3: "Cartão de crédito",
      footer: "Com esses documentos, você já pode dirigir em Orlando e alugar seu carro normalmente.",
    },
    testimonials: {
      title: "Quem aluga, ",
      titleHighlight: "recomenda",
      t1Name: "Ricardo M.",
      t1Text: "Experiência incrível! O carro estava impecável e o atendimento em português fez toda diferença. Super recomendo a GoDrive!",
      t2Name: "Fernanda S.",
      t2Text: "Alugamos um Escalade para a família e foi perfeito. Processo super simples, sem burocracia. Voltaremos com certeza!",
      t3Name: "Carlos A.",
      t3Text: "Realizei o sonho de dirigir um Corvette em Orlando. A GoDrive tornou tudo fácil e seguro. Nota 10!",
      t4Name: "Juliana P.",
      t4Text: "O atendimento do Bruno foi coisa de outro mundo! Ele cuidou de tudo com uma atenção absurda, desde a reserva até a entrega do carro. Superou todas as expectativas!",
      t5Name: "Marcos T.",
      t5Text: "Já aluguei carro em Orlando várias vezes, mas nunca tive um atendimento como o do Bruno. Ele é extremamente dedicado e faz questão de garantir que tudo seja perfeito. Nota 1000!",
      t6Name: "Ana Carolina R.",
      t6Text: "O Bruno transformou nossa experiência de aluguel de carro em algo especial. Ele nos deu dicas incríveis sobre Orlando e o carro estava impecável. Atendimento fora da curva!",
    },
    footer: {
      tagline: "GoDrive. Concierge premium para brasileiros em Orlando.",
      whatsapp: "Fale Conosco no WhatsApp",
      rights: "© 2026 GoDrive. Todos os direitos reservados.",
    },
    vehicles: {
      "Corvette Stingray C8": { subtitle: "Performance e estilo em cada detalhe", features: ["Motor V8", "Conversível", "Piloto automático", "Painel digital", "CarPlay"] },
      "Mustang Conversível": { subtitle: "Dirija Orlando com exclusividade", features: ["Conversível", "Piloto automático", "Teto Solar Panorâmico", "Painel digital", "CarPlay"] },
      "Cadillac Escalade": { subtitle: "Luxo com máxima sofisticação", features: ["Interior em couro de alto padrão", "Teto Solar Panorâmico", "Câmbio automático", "CarPlay"] },
      "BMW X5 M Sport": { subtitle: "SUV premium com praticidade", features: ["Interior em couro premium", "Teto Solar Panorâmico", "Câmbio automático", "CarPlay"] },
      "Chevrolet Suburban": { subtitle: "Grande ideal para famílias e grupos", features: ["Espaço interno amplo", "Teto Solar Panorâmico", "Câmbio automático", "CarPlay"] },
      "Dodge Durango": { subtitle: "Espaçoso com conforto e desempenho", features: ["Interior em couro premium", "Teto Solar", "Câmbio automático", "CarPlay"] },
      "Kia Sorento": { subtitle: "Equilibrado com conforto e economia", features: ["Espaço interno versátil", "Teto Solar Panorâmico", "Câmbio automático", "CarPlay"] },
      "Kia Sportage": { subtitle: "Praticidade e economia", features: ["Teto Solar Panorâmico", "Espaço interno versátil", "Câmbio automático", "CarPlay"] },
      "Mitsubishi Outlander": { subtitle: "Praticidade e economia", features: ["Teto Solar Panorâmico", "Espaço interno versátil", "Câmbio automático", "CarPlay"] },
      "Volkswagen Tiguan": { subtitle: "Versátil com ótimo espaço interno", features: ["Amplo espaço interno", "Câmbio automático", "CarPlay"] },
      "Chrysler Pacifica": { subtitle: "Ideal para grupos grandes", features: ["Máximo espaço interno", "Câmbio automático", "CarPlay"] },
      "Lexus NX": { subtitle: "SUV premium com design sofisticado", features: ["Interior em couro", "Teto Solar", "Câmbio automático", "CarPlay"] },
      "Audi Q7": { subtitle: "Luxo, espaço e tecnologia de ponta", features: ["7 passageiros", "Interior em couro premium", "Teto Solar Panorâmico", "Câmbio automático", "CarPlay"] },
      "Volvo XC60": { subtitle: "Segurança e elegância escandinava", features: ["Interior em couro", "Teto Solar Panorâmico", "Câmbio automático", "CarPlay"] },
      "Mustang Conversível Branco": { subtitle: "Dirija Orlando com exclusividade", features: ["Conversível", "Piloto automático", "Painel digital", "CarPlay"] },
      "Volkswagen Tiguan Branco": { subtitle: "Versátil com ótimo espaço interno", features: ["Amplo espaço interno", "Câmbio automático", "CarPlay"] },
      "Nissan Kicks": { subtitle: "Compacto, econômico e prático", features: ["Econômico", "Espaço interno versátil", "Câmbio automático", "CarPlay"] },
      "Volkswagen Atlas": { subtitle: "Espaço máximo para famílias grandes", features: ["7 passageiros", "Amplo espaço interno", "Câmbio automático", "CarPlay"] },
      "Mercedes-Benz GLA": { subtitle: "Compacto premium com DNA Mercedes", features: ["Interior em couro", "Design premium", "Câmbio automático", "CarPlay"] },
    },
  },
  en: {
    nav: {
      about: "About Us",
      fleet: "Fleet",
      howItWorks: "How It Works",
      whyZeus: "Why GoDrive?",
      contact: "Contact",
      book: "Book Now",
      myBookings: "My Bookings",
    },
    hero: {
      title: "Your next trip starts ",
      titleHighlight: "here.",
      subtitle: "A ready fleet, close service, and the ease of going further, your way.",
      exploreFleet: "Explore the Fleet",
      contactUs: "Contact Us",
    },
    about: {
      title: "Who ",
      titleHighlight: "We Are",
      description: "GoDrive is a reference in premium vehicle rental for Brazilians in Orlando. We offer a high-level mobility experience with personalized service, a curated fleet, and the best value for money in the market. because premium service doesn't have to cost a fortune.",
      tagline: "Premium service with Orlando's best value.",
      feat1: "100% Portuguese-speaking service",
      feat2: "Selected and inspected vehicles",
      feat3: "Simple and fast process",
      feat4: "Support throughout the trip",
    },
    fleet: {
      sectionTag: "GoDrive Fleet",
      title: "Find the perfect model",
      titleHighlight: "for your trip",
      all: "All",
      passengers: "Passengers:",
      book: "Book Now",
      noResults: "No vehicles found with the selected filters.",
      whatsappMsg: (name) => `Hi! I'm interested in the ${name}. I'd like to know about availability and pricing.`,
      superSport: "Super Sport",
      sport: "Sport",
      suvPremium: "SUV Premium",
      suvFullSize: "SUV Full Size",
      suv: "SUV",
      suvCompact: "Compact SUV",
      minivan: "Minivan",
    },
    howItWorks: {
      title: "Car rental in Orlando",
      subtitle: "Easier than you think",
      step1Title: "Choose the Car",
      step1Desc: "Explore our fleet and select the ideal model for your trip.",
      step2Title: "Book Before Your Trip",
      step2Desc: "Get in touch, confirm dates, and secure your vehicle.",
      step3Title: "Pick Up at the Airport & Drive",
      step3Desc: "Arrived in Orlando? Your car is already waiting.",
      quote: '"Your trip is so much more comfortable with your own car."',
      bookNow: "Book Now",
    },
    deals: {
      title: "Special ",
      titleHighlight: "Deals",
      subtitle: "The longer you stay with GoDrive, the more you save.",
      discount5: "2 to 5 rental days",
      discount10: "Bookings over 10 days",
    },
    whyZeus: {
      title: "Why choose ",
      titleHighlight: "GoDrive?",
      benefit1Title: "Selected vehicles",
      benefit1Desc: "Every car in our fleet is handpicked to ensure quality and comfort.",
      benefit2Title: "Portuguese-speaking service",
      benefit2Desc: "Talk to someone who understands you. No barriers, no hassle.",
      benefit3Title: "Simple and fast process",
      benefit3Desc: "Book online, pick up at the airport. No bureaucracy.",
      benefit4Title: "Support throughout the trip",
      benefit4Desc: "We're available from start to finish of your experience.",
    },
    requirements: {
      title: "What do you need to ",
      titleHighlight: "drive in the USA?",
      subtitle: "It's simpler than you think",
      item1: "Valid driver's license",
      item2: "Passport",
      item3: "Credit card",
      footer: "With these documents, you can drive in Orlando and rent your car normally.",
    },
    testimonials: {
      title: "Those who rent, ",
      titleHighlight: "recommend",
      t1Name: "Ricardo M.",
      t1Text: "Incredible experience! The car was impeccable and the Portuguese-speaking service made all the difference. Highly recommend GoDrive!",
      t2Name: "Fernanda S.",
      t2Text: "We rented an Escalade for the family and it was perfect. Super simple process, no bureaucracy. We'll definitely be back!",
      t3Name: "Carlos A.",
      t3Text: "I fulfilled my dream of driving a Corvette in Orlando. GoDrive made everything easy and safe. 10/10!",
      t4Name: "Juliana P.",
      t4Text: "Bruno's service was out of this world! He took care of everything with incredible attention, from the reservation to the car delivery. Exceeded all expectations!",
      t5Name: "Marcos T.",
      t5Text: "I've rented cars in Orlando many times, but never had service like Bruno's. He's extremely dedicated and makes sure everything is perfect. 1000/10!",
      t6Name: "Ana Carolina R.",
      t6Text: "Bruno transformed our car rental experience into something special. He gave us amazing tips about Orlando and the car was impeccable. Outstanding service!",
    },
    footer: {
      tagline: "GoDrive. Premium concierge for Brazilians in Orlando.",
      whatsapp: "Contact Us on WhatsApp",
      rights: "© 2026 GoDrive. All rights reserved.",
    },
    vehicles: {
      "Corvette Stingray C8": { subtitle: "Performance and style in every detail", features: ["V8 Engine", "Convertible", "Cruise control", "Digital dashboard", "CarPlay"] },
      "Mustang Conversível": { subtitle: "Drive Orlando with exclusivity", features: ["Convertible", "Cruise control", "Panoramic sunroof", "Digital dashboard", "CarPlay"] },
      "Cadillac Escalade": { subtitle: "Luxury with maximum sophistication", features: ["Premium leather interior", "Panoramic sunroof", "Automatic transmission", "CarPlay"] },
      "BMW X5 M Sport": { subtitle: "Premium SUV with practicality", features: ["Premium leather interior", "Panoramic sunroof", "Automatic transmission", "CarPlay"] },
      "Chevrolet Suburban": { subtitle: "Ideal for families and groups", features: ["Spacious interior", "Panoramic sunroof", "Automatic transmission", "CarPlay"] },
      "Dodge Durango": { subtitle: "Spacious with comfort and performance", features: ["Premium leather interior", "Sunroof", "Automatic transmission", "CarPlay"] },
      "Kia Sorento": { subtitle: "Balanced with comfort and economy", features: ["Versatile interior", "Panoramic sunroof", "Automatic transmission", "CarPlay"] },
      "Kia Sportage": { subtitle: "Practicality and economy", features: ["Panoramic sunroof", "Versatile interior", "Automatic transmission", "CarPlay"] },
      "Mitsubishi Outlander": { subtitle: "Practicality and economy", features: ["Panoramic sunroof", "Versatile interior", "Automatic transmission", "CarPlay"] },
      "Volkswagen Tiguan": { subtitle: "Versatile with great interior space", features: ["Spacious interior", "Automatic transmission", "CarPlay"] },
      "Chrysler Pacifica": { subtitle: "Ideal for large groups", features: ["Maximum interior space", "Automatic transmission", "CarPlay"] },
      "Lexus NX": { subtitle: "Premium SUV with sophisticated design", features: ["Leather interior", "Sunroof", "Automatic transmission", "CarPlay"] },
      "Audi Q7": { subtitle: "Luxury, space and cutting-edge technology", features: ["7 passengers", "Premium leather interior", "Panoramic sunroof", "Automatic transmission", "CarPlay"] },
      "Volvo XC60": { subtitle: "Scandinavian safety and elegance", features: ["Leather interior", "Panoramic sunroof", "Automatic transmission", "CarPlay"] },
      "Mustang Conversível Branco": { subtitle: "Drive Orlando with exclusivity", features: ["Convertible", "Cruise control", "Digital dashboard", "CarPlay"] },
      "Volkswagen Tiguan Branco": { subtitle: "Versatile with great interior space", features: ["Spacious interior", "Automatic transmission", "CarPlay"] },
      "Nissan Kicks": { subtitle: "Compact, economical and practical", features: ["Fuel efficient", "Versatile interior", "Automatic transmission", "CarPlay"] },
      "Volkswagen Atlas": { subtitle: "Maximum space for large families", features: ["7 passengers", "Spacious interior", "Automatic transmission", "CarPlay"] },
      "Mercedes-Benz GLA": { subtitle: "Compact premium with Mercedes DNA", features: ["Leather interior", "Premium design", "Automatic transmission", "CarPlay"] },
    },
  },
  es: {
    nav: {
      about: "Sobre Nosotros",
      fleet: "Flota",
      howItWorks: "Cómo Funciona",
      whyZeus: "¿Por qué GoDrive?",
      contact: "Contacto",
      book: "Reservar",
      myBookings: "Mis Reservas",
    },
    hero: {
      title: "Tu próximo viaje comienza ",
      titleHighlight: "aquí.",
      subtitle: "Comodidad, espacio y practicidad para cada tipo de viaje.",
      exploreFleet: "Explorar la Flota",
      contactUs: "Contáctenos",
    },
    about: {
      title: "Quiénes ",
      titleHighlight: "Somos",
      description: "GoDrive es referencia en alquiler de vehículos premium para brasileños en Orlando. Ofrecemos una experiencia de movilidad de alto nivel, con atención personalizada, flota seleccionada y la mejor relación calidad-precio del mercado. porque el servicio premium no tiene que ser caro.",
      tagline: "Servicio premium con la mejor relación calidad-precio de Orlando.",
      feat1: "Atención 100% en portugués",
      feat2: "Vehículos seleccionados y revisados",
      feat3: "Proceso simple y ágil",
      feat4: "Soporte durante todo el viaje",
    },
    fleet: {
      sectionTag: "Flota GoDrive",
      title: "Encuentra el modelo perfecto",
      titleHighlight: "para tu viaje",
      all: "Todos",
      passengers: "Pasajeros:",
      book: "Reservar",
      noResults: "No se encontraron vehículos con los filtros seleccionados.",
      whatsappMsg: (name) => `¡Hola! Me interesa el ${name}. Me gustaría saber sobre disponibilidad y precios.`,
      superSport: "Super Deportivo",
      sport: "Deportivo",
      suvPremium: "SUV Premium",
      suvFullSize: "SUV Full Size",
      suv: "SUV",
      suvCompact: "SUV Compacto",
      minivan: "Minivan",
    },
    howItWorks: {
      title: "Alquiler de auto en Orlando",
      subtitle: "Más fácil de lo que imaginas",
      step1Title: "Elige el Auto",
      step1Desc: "Explora nuestra flota y selecciona el modelo ideal para tu viaje.",
      step2Title: "Reserva Antes del Viaje",
      step2Desc: "Ponte en contacto, confirma fechas y asegura tu vehículo.",
      step3Title: "Recoge en el Aeropuerto y Conduce",
      step3Desc: "¿Llegaste a Orlando? Tu auto ya te está esperando.",
      quote: '"Tu viaje es mucho más cómodo con auto propio."',
      bookNow: "Reserva Ahora",
    },
    deals: {
      title: "Condiciones ",
      titleHighlight: "Especiales",
      subtitle: "Cuanto más tiempo con GoDrive, más ahorras.",
      discount5: "2 a 5 días de alquiler",
      discount10: "Reservas de más de 10 días",
    },
    whyZeus: {
      title: "¿Por qué elegir ",
      titleHighlight: "GoDrive?",
      benefit1Title: "Vehículos seleccionados",
      benefit1Desc: "Cada auto de nuestra flota es elegido cuidadosamente para garantizar calidad y confort.",
      benefit2Title: "Atención en portugués",
      benefit2Desc: "Habla con quien te entiende. Sin barreras, sin complicaciones.",
      benefit3Title: "Proceso simple y ágil",
      benefit3Desc: "Reserva online, recoge en el aeropuerto. Sin burocracia.",
      benefit4Title: "Soporte durante todo el viaje",
      benefit4Desc: "Estamos disponibles de principio a fin de tu experiencia.",
    },
    requirements: {
      title: "¿Qué necesitas para ",
      titleHighlight: "conducir en EE.UU.?",
      subtitle: "Es más simple de lo que imaginas",
      item1: "Licencia de conducir válida",
      item2: "Pasaporte",
      item3: "Tarjeta de crédito",
      footer: "Con estos documentos, ya puedes conducir en Orlando y alquilar tu auto normalmente.",
    },
    testimonials: {
      title: "Quien alquila, ",
      titleHighlight: "recomienda",
      t1Name: "Ricardo M.",
      t1Text: "¡Experiencia increíble! El auto estaba impecable y la atención en portugués hizo toda la diferencia. ¡Super recomiendo GoDrive!",
      t2Name: "Fernanda S.",
      t2Text: "Alquilamos un Escalade para la familia y fue perfecto. Proceso super simple, sin burocracia. ¡Volveremos seguro!",
      t3Name: "Carlos A.",
      t3Text: "Cumplí el sueño de conducir un Corvette en Orlando. GoDrive hizo todo fácil y seguro. ¡Nota 10!",
      t4Name: "Juliana P.",
      t4Text: "¡La atención de Bruno fue de otro mundo! Se encargó de todo con una atención increíble, desde la reserva hasta la entrega del auto. ¡Superó todas las expectativas!",
      t5Name: "Marcos T.",
      t5Text: "Ya alquilé autos en Orlando varias veces, pero nunca tuve una atención como la de Bruno. Es extremadamente dedicado y se asegura de que todo sea perfecto. ¡Nota 1000!",
      t6Name: "Ana Carolina R.",
      t6Text: "Bruno transformó nuestra experiencia de alquiler en algo especial. Nos dio consejos increíbles sobre Orlando y el auto estaba impecable. ¡Servicio fuera de serie!",
    },
    footer: {
      tagline: "GoDrive. Concierge premium para brasileños en Orlando.",
      whatsapp: "Contáctenos por WhatsApp",
      rights: "© 2026 GoDrive. Todos los derechos reservados.",
    },
    vehicles: {
      "Corvette Stingray C8": { subtitle: "Rendimiento y estilo en cada detalle", features: ["Motor V8", "Convertible", "Piloto automático", "Panel digital", "CarPlay"] },
      "Mustang Conversível": { subtitle: "Conduce Orlando con exclusividad", features: ["Convertible", "Piloto automático", "Techo solar panorámico", "Panel digital", "CarPlay"] },
      "Cadillac Escalade": { subtitle: "Lujo con máxima sofisticación", features: ["Interior en cuero premium", "Techo solar panorámico", "Transmisión automática", "CarPlay"] },
      "BMW X5 M Sport": { subtitle: "SUV premium con practicidad", features: ["Interior en cuero premium", "Techo solar panorámico", "Transmisión automática", "CarPlay"] },
      "Chevrolet Suburban": { subtitle: "Ideal para familias y grupos", features: ["Amplio espacio interior", "Techo solar panorámico", "Transmisión automática", "CarPlay"] },
      "Dodge Durango": { subtitle: "Espacioso con confort y rendimiento", features: ["Interior en cuero premium", "Techo solar", "Transmisión automática", "CarPlay"] },
      "Kia Sorento": { subtitle: "Equilibrado con confort y economía", features: ["Espacio interior versátil", "Techo solar panorámico", "Transmisión automática", "CarPlay"] },
      "Kia Sportage": { subtitle: "Practicidad y economía", features: ["Techo solar panorámico", "Espacio interior versátil", "Transmisión automática", "CarPlay"] },
      "Mitsubishi Outlander": { subtitle: "Practicidad y economía", features: ["Techo solar panorámico", "Espacio interior versátil", "Transmisión automática", "CarPlay"] },
      "Volkswagen Tiguan": { subtitle: "Versátil con gran espacio interior", features: ["Amplio espacio interior", "Transmisión automática", "CarPlay"] },
      "Chrysler Pacifica": { subtitle: "Ideal para grupos grandes", features: ["Máximo espacio interior", "Transmisión automática", "CarPlay"] },
      "Lexus NX": { subtitle: "SUV premium con diseño sofisticado", features: ["Interior en cuero", "Techo solar", "Transmisión automática", "CarPlay"] },
      "Audi Q7": { subtitle: "Lujo, espacio y tecnología de punta", features: ["7 pasajeros", "Interior en cuero premium", "Techo solar panorámico", "Transmisión automática", "CarPlay"] },
      "Volvo XC60": { subtitle: "Seguridad y elegancia escandinava", features: ["Interior en cuero", "Techo solar panorámico", "Transmisión automática", "CarPlay"] },
      "Mustang Conversível Branco": { subtitle: "Conduce Orlando con exclusividad", features: ["Convertible", "Piloto automático", "Panel digital", "CarPlay"] },
      "Volkswagen Tiguan Branco": { subtitle: "Versátil con gran espacio interior", features: ["Amplio espacio interior", "Transmisión automática", "CarPlay"] },
      "Nissan Kicks": { subtitle: "Compacto, económico y práctico", features: ["Económico", "Espacio interior versátil", "Transmisión automática", "CarPlay"] },
      "Volkswagen Atlas": { subtitle: "Espacio máximo para familias grandes", features: ["7 pasajeros", "Amplio espacio interior", "Transmisión automática", "CarPlay"] },
      "Mercedes-Benz GLA": { subtitle: "Compacto premium con ADN Mercedes", features: ["Interior en cuero", "Diseño premium", "Transmisión automática", "CarPlay"] },
    },
  },
  it: {
    nav: {
      about: "Chi Siamo",
      fleet: "Flotta",
      howItWorks: "Come Funziona",
      whyZeus: "Perché GoDrive?",
      contact: "Contatto",
      book: "Prenota",
      myBookings: "Le Mie Prenotazioni",
    },
    hero: {
      title: "Il tuo prossimo viaggio inizia ",
      titleHighlight: "qui.",
      subtitle: "Comfort, spazio e praticità per ogni tipo di viaggio.",
      exploreFleet: "Esplora la Flotta",
      contactUs: "Contattaci",
    },
    about: {
      title: "Chi ",
      titleHighlight: "Siamo",
      description: "GoDrive è un riferimento nel noleggio di veicoli premium per brasiliani a Orlando. Offriamo un'esperienza di mobilità di alto livello, con servizio personalizzato, flotta selezionata e il miglior rapporto qualità-prezzo sul mercato. perché il servizio premium non deve costare una fortuna.",
      tagline: "Servizio premium con il miglior rapporto qualità-prezzo di Orlando.",
      feat1: "Servizio 100% in portoghese",
      feat2: "Veicoli selezionati e revisionati",
      feat3: "Processo semplice e veloce",
      feat4: "Supporto durante tutto il viaggio",
    },
    fleet: {
      sectionTag: "Flotta GoDrive",
      title: "Trova il modello perfetto",
      titleHighlight: "per il tuo viaggio",
      all: "Tutti",
      passengers: "Passeggeri:",
      book: "Prenota",
      noResults: "Nessun veicolo trovato con i filtri selezionati.",
      whatsappMsg: (name) => `Ciao! Sono interessato alla ${name}. Vorrei sapere disponibilità e prezzi.`,
      superSport: "Super Sportiva",
      sport: "Sportiva",
      suvPremium: "SUV Premium",
      suvFullSize: "SUV Full Size",
      suv: "SUV",
      suvCompact: "SUV Compatto",
      minivan: "Minivan",
    },
    howItWorks: {
      title: "Noleggio auto a Orlando",
      subtitle: "Più facile di quanto pensi",
      step1Title: "Scegli l'Auto",
      step1Desc: "Esplora la nostra flotta e seleziona il modello ideale per il tuo viaggio.",
      step2Title: "Prenota Prima del Viaggio",
      step2Desc: "Contattaci, conferma le date e assicurati il veicolo.",
      step3Title: "Ritira in Aeroporto e Guida",
      step3Desc: "Sei arrivato a Orlando? La tua auto ti sta già aspettando.",
      quote: '"Il tuo viaggio è molto più comodo con un\'auto propria."',
      bookNow: "Prenota Ora",
    },
    deals: {
      title: "Condizioni ",
      titleHighlight: "Speciali",
      subtitle: "Più tempo con GoDrive, più risparmi.",
      discount5: "2 a 5 giorni di noleggio",
      discount10: "Prenotazioni oltre 10 giorni",
    },
    whyZeus: {
      title: "Perché scegliere ",
      titleHighlight: "GoDrive?",
      benefit1Title: "Veicoli selezionati",
      benefit1Desc: "Ogni auto della nostra flotta è scelta con cura per garantire qualità e comfort.",
      benefit2Title: "Servizio in portoghese",
      benefit2Desc: "Parla con chi ti capisce. Senza barriere, senza complicazioni.",
      benefit3Title: "Processo semplice e veloce",
      benefit3Desc: "Prenota online, ritira in aeroporto. Senza burocrazia.",
      benefit4Title: "Supporto durante tutto il viaggio",
      benefit4Desc: "Siamo disponibili dall'inizio alla fine della tua esperienza.",
    },
    requirements: {
      title: "Di cosa hai bisogno per ",
      titleHighlight: "guidare negli USA?",
      subtitle: "È più semplice di quanto pensi",
      item1: "Patente di guida valida",
      item2: "Passaporto",
      item3: "Carta di credito",
      footer: "Con questi documenti, puoi guidare a Orlando e noleggiare la tua auto normalmente.",
    },
    testimonials: {
      title: "Chi noleggia, ",
      titleHighlight: "raccomanda",
      t1Name: "Ricardo M.",
      t1Text: "Esperienza incredibile! L'auto era impeccabile e il servizio in portoghese ha fatto tutta la differenza. Super consiglio GoDrive!",
      t2Name: "Fernanda S.",
      t2Text: "Abbiamo noleggiato un Escalade per la famiglia ed è stato perfetto. Processo semplicissimo, senza burocrazia. Torneremo sicuramente!",
      t3Name: "Carlos A.",
      t3Text: "Ho realizzato il sogno di guidare una Corvette a Orlando. GoDrive ha reso tutto facile e sicuro. Voto 10!",
      t4Name: "Juliana P.",
      t4Text: "Il servizio di Bruno è stato fuori dal mondo! Si è occupato di tutto con un'attenzione incredibile, dalla prenotazione alla consegna dell'auto. Ha superato ogni aspettativa!",
      t5Name: "Marcos T.",
      t5Text: "Ho noleggiato auto a Orlando molte volte, ma non ho mai avuto un servizio come quello di Bruno. È estremamente dedicato e si assicura che tutto sia perfetto. Voto 1000!",
      t6Name: "Ana Carolina R.",
      t6Text: "Bruno ha trasformato la nostra esperienza di noleggio in qualcosa di speciale. Ci ha dato consigli incredibili su Orlando e l'auto era impeccabile. Servizio straordinario!",
    },
    footer: {
      tagline: "GoDrive. Concierge premium per brasiliani a Orlando.",
      whatsapp: "Contattaci su WhatsApp",
      rights: "© 2026 GoDrive. Tutti i diritti riservati.",
    },
    vehicles: {
      "Corvette Stingray C8": { subtitle: "Prestazioni e stile in ogni dettaglio", features: ["Motore V8", "Convertibile", "Cruise control", "Cruscotto digitale", "CarPlay"] },
      "Mustang Conversível": { subtitle: "Guida Orlando con esclusività", features: ["Convertibile", "Cruise control", "Tetto panoramico", "Cruscotto digitale", "CarPlay"] },
      "Cadillac Escalade": { subtitle: "Lusso con massima raffinatezza", features: ["Interni in pelle premium", "Tetto panoramico", "Cambio automatico", "CarPlay"] },
      "BMW X5 M Sport": { subtitle: "SUV premium con praticità", features: ["Interni in pelle premium", "Tetto panoramico", "Cambio automatico", "CarPlay"] },
      "Chevrolet Suburban": { subtitle: "Ideale per famiglie e gruppi", features: ["Ampio spazio interno", "Tetto panoramico", "Cambio automatico", "CarPlay"] },
      "Dodge Durango": { subtitle: "Spazioso con comfort e prestazioni", features: ["Interni in pelle premium", "Tetto apribile", "Cambio automatico", "CarPlay"] },
      "Kia Sorento": { subtitle: "Equilibrato con comfort ed economia", features: ["Spazio interno versatile", "Tetto panoramico", "Cambio automatico", "CarPlay"] },
      "Kia Sportage": { subtitle: "Praticità ed economia", features: ["Tetto panoramico", "Spazio interno versatile", "Cambio automatico", "CarPlay"] },
      "Mitsubishi Outlander": { subtitle: "Praticità ed economia", features: ["Tetto panoramico", "Spazio interno versatile", "Cambio automatico", "CarPlay"] },
      "Volkswagen Tiguan": { subtitle: "Versatile con ottimo spazio interno", features: ["Ampio spazio interno", "Cambio automatico", "CarPlay"] },
      "Chrysler Pacifica": { subtitle: "Ideale per gruppi grandi", features: ["Massimo spazio interno", "Cambio automatico", "CarPlay"] },
      "Lexus NX": { subtitle: "SUV premium dal design sofisticato", features: ["Interni in pelle", "Tetto apribile", "Cambio automatico", "CarPlay"] },
      "Audi Q7": { subtitle: "Lusso, spazio e tecnologia all'avanguardia", features: ["7 passeggeri", "Interni in pelle premium", "Tetto panoramico", "Cambio automatico", "CarPlay"] },
      "Volvo XC60": { subtitle: "Sicurezza ed eleganza scandinava", features: ["Interni in pelle", "Tetto panoramico", "Cambio automatico", "CarPlay"] },
      "Mustang Conversível Branco": { subtitle: "Guida Orlando con esclusività", features: ["Convertibile", "Cruise control", "Cruscotto digitale", "CarPlay"] },
      "Volkswagen Tiguan Branco": { subtitle: "Versatile con ottimo spazio interno", features: ["Ampio spazio interno", "Cambio automatico", "CarPlay"] },
      "Nissan Kicks": { subtitle: "Compatto, economico e pratico", features: ["Economico", "Spazio interno versatile", "Cambio automatico", "CarPlay"] },
      "Volkswagen Atlas": { subtitle: "Massimo spazio per famiglie numerose", features: ["7 passeggeri", "Ampio spazio interno", "Cambio automatico", "CarPlay"] },
      "Mercedes-Benz GLA": { subtitle: "Compatto premium con DNA Mercedes", features: ["Interni in pelle", "Design premium", "Cambio automatico", "CarPlay"] },
    },
  },
  de: {
    nav: {
      about: "Über Uns",
      fleet: "Flotte",
      howItWorks: "So Funktioniert's",
      whyZeus: "Warum GoDrive?",
      contact: "Kontakt",
      book: "Buchen",
      myBookings: "Meine Buchungen",
    },
    hero: {
      title: "Ihre nächste Reise beginnt ",
      titleHighlight: "hier.",
      subtitle: "Komfort, Platz und Bequemlichkeit für jede Art von Reise.",
      exploreFleet: "Flotte Entdecken",
      contactUs: "Kontaktieren Sie Uns",
    },
    about: {
      title: "Wer wir ",
      titleHighlight: "sind",
      description: "GoDrive ist eine Referenz im Premium-Fahrzeugverleih für Brasilianer in Orlando. Wir bieten ein erstklassiges Mobilitätserlebnis mit persönlichem Service, einer ausgewählten Flotte und dem besten Preis-Leistungs-Verhältnis auf dem Markt. denn Premium-Service muss nicht teuer sein.",
      tagline: "Premium-Service mit dem besten Preis-Leistungs-Verhältnis in Orlando.",
      feat1: "100% portugiesischsprachiger Service",
      feat2: "Ausgewählte und geprüfte Fahrzeuge",
      feat3: "Einfacher und schneller Prozess",
      feat4: "Support während der gesamten Reise",
    },
    fleet: {
      sectionTag: "GoDrive Flotte",
      title: "Finden Sie das perfekte Modell",
      titleHighlight: "für Ihre Reise",
      all: "Alle",
      passengers: "Passagiere:",
      book: "Buchen",
      noResults: "Keine Fahrzeuge mit den ausgewählten Filtern gefunden.",
      whatsappMsg: (name) => `Hallo! Ich interessiere mich für den ${name}. Ich möchte Verfügbarkeit und Preise erfahren.`,
      superSport: "Super Sportwagen",
      sport: "Sportwagen",
      suvPremium: "SUV Premium",
      suvFullSize: "SUV Full Size",
      suv: "SUV",
      suvCompact: "Kompakt-SUV",
      minivan: "Minivan",
    },
    howItWorks: {
      title: "Autovermietung in Orlando",
      subtitle: "Einfacher als Sie denken",
      step1Title: "Wählen Sie das Auto",
      step1Desc: "Entdecken Sie unsere Flotte und wählen Sie das ideale Modell für Ihre Reise.",
      step2Title: "Buchen Sie Vor der Reise",
      step2Desc: "Kontaktieren Sie uns, bestätigen Sie Termine und sichern Sie Ihr Fahrzeug.",
      step3Title: "Abholung am Flughafen & Losfahren",
      step3Desc: "In Orlando angekommen? Ihr Auto wartet bereits auf Sie.",
      quote: '"Ihre Reise ist viel komfortabler mit einem eigenen Auto."',
      bookNow: "Jetzt Buchen",
    },
    deals: {
      title: "Sonder",
      titleHighlight: "konditionen",
      subtitle: "Je länger bei GoDrive, desto mehr sparen Sie.",
      discount5: "2 bis 5 Miettage",
      discount10: "Buchungen über 10 Tage",
    },
    whyZeus: {
      title: "Warum ",
      titleHighlight: "GoDrive wählen?",
      benefit1Title: "Ausgewählte Fahrzeuge",
      benefit1Desc: "Jedes Auto unserer Flotte wird sorgfältig ausgewählt, um Qualität und Komfort zu gewährleisten.",
      benefit2Title: "Portugiesischsprachiger Service",
      benefit2Desc: "Sprechen Sie mit jemandem, der Sie versteht. Ohne Barrieren, ohne Komplikationen.",
      benefit3Title: "Einfacher und schneller Prozess",
      benefit3Desc: "Online buchen, am Flughafen abholen. Ohne Bürokratie.",
      benefit4Title: "Support während der gesamten Reise",
      benefit4Desc: "Wir sind von Anfang bis Ende Ihres Erlebnisses verfügbar.",
    },
    requirements: {
      title: "Was brauchen Sie um in den ",
      titleHighlight: "USA zu fahren?",
      subtitle: "Es ist einfacher als Sie denken",
      item1: "Gültiger Führerschein",
      item2: "Reisepass",
      item3: "Kreditkarte",
      footer: "Mit diesen Dokumenten können Sie in Orlando fahren und Ihr Auto normal mieten.",
    },
    testimonials: {
      title: "Wer mietet, ",
      titleHighlight: "empfiehlt",
      t1Name: "Ricardo M.",
      t1Text: "Unglaubliche Erfahrung! Das Auto war makellos und der portugiesischsprachige Service hat den Unterschied gemacht. Sehr empfehlenswert!",
      t2Name: "Fernanda S.",
      t2Text: "Wir haben einen Escalade für die Familie gemietet und es war perfekt. Super einfacher Prozess, keine Bürokratie. Wir kommen bestimmt wieder!",
      t3Name: "Carlos A.",
      t3Text: "Ich habe meinen Traum erfüllt, eine Corvette in Orlando zu fahren. GoDrive hat alles einfach und sicher gemacht. Note 10!",
      t4Name: "Juliana P.",
      t4Text: "Brunos Service war von einer anderen Welt! Er kümmerte sich um alles mit unglaublicher Aufmerksamkeit, von der Reservierung bis zur Fahrzeugübergabe. Alle Erwartungen übertroffen!",
      t5Name: "Marcos T.",
      t5Text: "Ich habe schon oft Autos in Orlando gemietet, aber nie einen Service wie den von Bruno erlebt. Er ist extrem engagiert und sorgt dafür, dass alles perfekt ist. Note 1000!",
      t6Name: "Ana Carolina R.",
      t6Text: "Bruno hat unser Mietwagen-Erlebnis in etwas Besonderes verwandelt. Er gab uns tolle Tipps zu Orlando und das Auto war makellos. Außergewöhnlicher Service!",
    },
    footer: {
      tagline: "GoDrive. Premium-Concierge für Brasilianer in Orlando.",
      whatsapp: "Kontaktieren Sie Uns auf WhatsApp",
      rights: "© 2026 GoDrive. Alle Rechte vorbehalten.",
    },
    vehicles: {
      "Corvette Stingray C8": { subtitle: "Leistung und Stil in jedem Detail", features: ["V8-Motor", "Cabriolet", "Tempomat", "Digitales Cockpit", "CarPlay"] },
      "Mustang Conversível": { subtitle: "Fahren Sie Orlando mit Exklusivität", features: ["Cabriolet", "Tempomat", "Panorama-Schiebedach", "Digitales Cockpit", "CarPlay"] },
      "Cadillac Escalade": { subtitle: "Luxus mit höchster Raffinesse", features: ["Premium-Lederausstattung", "Panorama-Schiebedach", "Automatikgetriebe", "CarPlay"] },
      "BMW X5 M Sport": { subtitle: "Premium SUV mit Praktikabilität", features: ["Premium-Lederausstattung", "Panorama-Schiebedach", "Automatikgetriebe", "CarPlay"] },
      "Chevrolet Suburban": { subtitle: "Ideal für Familien und Gruppen", features: ["Geräumiger Innenraum", "Panorama-Schiebedach", "Automatikgetriebe", "CarPlay"] },
      "Dodge Durango": { subtitle: "Geräumig mit Komfort und Leistung", features: ["Premium-Lederausstattung", "Schiebedach", "Automatikgetriebe", "CarPlay"] },
      "Kia Sorento": { subtitle: "Ausgewogen mit Komfort und Sparsamkeit", features: ["Vielseitiger Innenraum", "Panorama-Schiebedach", "Automatikgetriebe", "CarPlay"] },
      "Kia Sportage": { subtitle: "Praktikabilität und Sparsamkeit", features: ["Panorama-Schiebedach", "Vielseitiger Innenraum", "Automatikgetriebe", "CarPlay"] },
      "Mitsubishi Outlander": { subtitle: "Praktikabilität und Sparsamkeit", features: ["Panorama-Schiebedach", "Vielseitiger Innenraum", "Automatikgetriebe", "CarPlay"] },
      "Volkswagen Tiguan": { subtitle: "Vielseitig mit tollem Innenraum", features: ["Geräumiger Innenraum", "Automatikgetriebe", "CarPlay"] },
      "Chrysler Pacifica": { subtitle: "Ideal für große Gruppen", features: ["Maximaler Innenraum", "Automatikgetriebe", "CarPlay"] },
      "Lexus NX": { subtitle: "Premium-SUV mit anspruchsvollem Design", features: ["Lederausstattung", "Schiebedach", "Automatikgetriebe", "CarPlay"] },
      "Audi Q7": { subtitle: "Luxus, Platz und modernste Technologie", features: ["7 Passagiere", "Premium-Lederausstattung", "Panorama-Schiebedach", "Automatikgetriebe", "CarPlay"] },
      "Volvo XC60": { subtitle: "Skandinavische Sicherheit und Eleganz", features: ["Lederausstattung", "Panorama-Schiebedach", "Automatikgetriebe", "CarPlay"] },
      "Mustang Conversível Branco": { subtitle: "Fahren Sie Orlando mit Exklusivität", features: ["Cabriolet", "Tempomat", "Digitales Cockpit", "CarPlay"] },
      "Volkswagen Tiguan Branco": { subtitle: "Vielseitig mit tollem Innenraum", features: ["Geräumiger Innenraum", "Automatikgetriebe", "CarPlay"] },
      "Nissan Kicks": { subtitle: "Kompakt, sparsam und praktisch", features: ["Sparsam", "Vielseitiger Innenraum", "Automatikgetriebe", "CarPlay"] },
      "Volkswagen Atlas": { subtitle: "Maximaler Platz für große Familien", features: ["7 Passagiere", "Geräumiger Innenraum", "Automatikgetriebe", "CarPlay"] },
      "Mercedes-Benz GLA": { subtitle: "Kompakter Premium mit Mercedes-DNA", features: ["Lederausstattung", "Premium-Design", "Automatikgetriebe", "CarPlay"] },
    },
  },
  fr: {
    nav: {
      about: "À Propos",
      fleet: "Flotte",
      howItWorks: "Comment Ça Marche",
      whyZeus: "Pourquoi GoDrive ?",
      contact: "Contact",
      book: "Réserver",
      myBookings: "Mes Réservations",
    },
    hero: {
      title: "Votre prochain voyage commence ",
      titleHighlight: "ici.",
      subtitle: "Confort, espace et praticité pour chaque type de voyage.",
      exploreFleet: "Explorer la Flotte",
      contactUs: "Contactez-Nous",
    },
    about: {
      title: "Qui ",
      titleHighlight: "Sommes-Nous",
      description: "GoDrive est une référence en location de véhicules premium pour les Brésiliens à Orlando. Nous offrons une expérience de mobilité haut de gamme, avec un service personnalisé, une flotte sélectionnée et le meilleur rapport qualité-prix du marché. car le service premium ne doit pas coûter cher.",
      tagline: "Service premium avec le meilleur rapport qualité-prix d'Orlando.",
      feat1: "Service 100% en portugais",
      feat2: "Véhicules sélectionnés et révisés",
      feat3: "Processus simple et rapide",
      feat4: "Support pendant tout le voyage",
    },
    fleet: {
      sectionTag: "Flotte GoDrive",
      title: "Trouvez le modèle parfait",
      titleHighlight: "pour votre voyage",
      all: "Tous",
      passengers: "Passagers :",
      book: "Réserver",
      noResults: "Aucun véhicule trouvé avec les filtres sélectionnés.",
      whatsappMsg: (name) => `Bonjour ! Je suis intéressé par la ${name}. J'aimerais connaître la disponibilité et les prix.`,
      superSport: "Super Sportive",
      sport: "Sportive",
      suvPremium: "SUV Premium",
      suvFullSize: "SUV Full Size",
      suv: "SUV",
      suvCompact: "SUV Compact",
      minivan: "Minivan",
    },
    howItWorks: {
      title: "Location de voiture à Orlando",
      subtitle: "Plus facile que vous ne le pensez",
      step1Title: "Choisissez la Voiture",
      step1Desc: "Explorez notre flotte et sélectionnez le modèle idéal pour votre voyage.",
      step2Title: "Réservez Avant le Voyage",
      step2Desc: "Contactez-nous, confirmez les dates et assurez votre véhicule.",
      step3Title: "Récupérez à l'Aéroport et Conduisez",
      step3Desc: "Arrivé à Orlando ? Votre voiture vous attend déjà.",
      quote: '"Votre voyage est bien plus confortable avec votre propre voiture."',
      bookNow: "Réservez Maintenant",
    },
    deals: {
      title: "Conditions ",
      titleHighlight: "Spéciales",
      subtitle: "Plus longtemps avec GoDrive, plus vous économisez.",
      discount5: "2 à 5 jours de location",
      discount10: "Réservations de plus de 10 jours",
    },
    whyZeus: {
      title: "Pourquoi choisir ",
      titleHighlight: "GoDrive ?",
      benefit1Title: "Véhicules sélectionnés",
      benefit1Desc: "Chaque voiture de notre flotte est soigneusement choisie pour garantir qualité et confort.",
      benefit2Title: "Service en portugais",
      benefit2Desc: "Parlez avec quelqu'un qui vous comprend. Sans barrières, sans complications.",
      benefit3Title: "Processus simple et rapide",
      benefit3Desc: "Réservez en ligne, récupérez à l'aéroport. Sans bureaucratie.",
      benefit4Title: "Support pendant tout le voyage",
      benefit4Desc: "Nous sommes disponibles du début à la fin de votre expérience.",
    },
    requirements: {
      title: "De quoi avez-vous besoin pour ",
      titleHighlight: "conduire aux USA ?",
      subtitle: "C'est plus simple que vous ne le pensez",
      item1: "Permis de conduire valide",
      item2: "Passeport",
      item3: "Carte de crédit",
      footer: "Avec ces documents, vous pouvez conduire à Orlando et louer votre voiture normalement.",
    },
    testimonials: {
      title: "Qui loue, ",
      titleHighlight: "recommande",
      t1Name: "Ricardo M.",
      t1Text: "Expérience incroyable ! La voiture était impeccable et le service en portugais a fait toute la différence. Je recommande vivement GoDrive !",
      t2Name: "Fernanda S.",
      t2Text: "Nous avons loué un Escalade pour la famille et c'était parfait. Processus super simple, sans bureaucratie. Nous reviendrons certainement !",
      t3Name: "Carlos A.",
      t3Text: "J'ai réalisé mon rêve de conduire une Corvette à Orlando. GoDrive a rendu tout facile et sûr. Note 10 !",
      t4Name: "Juliana P.",
      t4Text: "Le service de Bruno était hors du commun ! Il s'est occupé de tout avec une attention incroyable, de la réservation à la livraison de la voiture. Toutes les attentes dépassées !",
      t5Name: "Marcos T.",
      t5Text: "J'ai loué des voitures à Orlando plusieurs fois, mais je n'ai jamais eu un service comme celui de Bruno. Il est extrêmement dévoué et veille à ce que tout soit parfait. Note 1000 !",
      t6Name: "Ana Carolina R.",
      t6Text: "Bruno a transformé notre expérience de location en quelque chose de spécial. Il nous a donné des conseils incroyables sur Orlando et la voiture était impeccable. Service exceptionnel !",
    },
    footer: {
      tagline: "GoDrive. Concierge premium pour les Brésiliens à Orlando.",
      whatsapp: "Contactez-Nous sur WhatsApp",
      rights: "© 2026 GoDrive. Tous droits réservés.",
    },
    vehicles: {
      "Corvette Stingray C8": { subtitle: "Performance et style dans chaque détail", features: ["Moteur V8", "Cabriolet", "Régulateur de vitesse", "Tableau de bord numérique", "CarPlay"] },
      "Mustang Conversível": { subtitle: "Conduisez Orlando avec exclusivité", features: ["Cabriolet", "Régulateur de vitesse", "Toit panoramique", "Tableau de bord numérique", "CarPlay"] },
      "Cadillac Escalade": { subtitle: "Luxe avec sophistication maximale", features: ["Intérieur cuir premium", "Toit panoramique", "Transmission automatique", "CarPlay"] },
      "BMW X5 M Sport": { subtitle: "SUV premium avec praticité", features: ["Intérieur cuir premium", "Toit panoramique", "Transmission automatique", "CarPlay"] },
      "Chevrolet Suburban": { subtitle: "Idéal pour familles et groupes", features: ["Intérieur spacieux", "Toit panoramique", "Transmission automatique", "CarPlay"] },
      "Dodge Durango": { subtitle: "Spacieux avec confort et performance", features: ["Intérieur cuir premium", "Toit ouvrant", "Transmission automatique", "CarPlay"] },
      "Kia Sorento": { subtitle: "Équilibré avec confort et économie", features: ["Intérieur polyvalent", "Toit panoramique", "Transmission automatique", "CarPlay"] },
      "Kia Sportage": { subtitle: "Praticité et économie", features: ["Toit panoramique", "Intérieur polyvalent", "Transmission automatique", "CarPlay"] },
      "Mitsubishi Outlander": { subtitle: "Praticité et économie", features: ["Toit panoramique", "Intérieur polyvalent", "Transmission automatique", "CarPlay"] },
      "Volkswagen Tiguan": { subtitle: "Polyvalent avec excellent espace intérieur", features: ["Intérieur spacieux", "Transmission automatique", "CarPlay"] },
      "Chrysler Pacifica": { subtitle: "Idéal pour grands groupes", features: ["Espace intérieur maximum", "Transmission automatique", "CarPlay"] },
      "Lexus NX": { subtitle: "SUV premium au design sophistiqué", features: ["Intérieur cuir", "Toit ouvrant", "Transmission automatique", "CarPlay"] },
      "Audi Q7": { subtitle: "Luxe, espace et technologie de pointe", features: ["7 passagers", "Intérieur cuir premium", "Toit panoramique", "Transmission automatique", "CarPlay"] },
      "Volvo XC60": { subtitle: "Sécurité et élégance scandinave", features: ["Intérieur cuir", "Toit panoramique", "Transmission automatique", "CarPlay"] },
      "Mustang Conversível Branco": { subtitle: "Conduisez Orlando avec exclusivité", features: ["Cabriolet", "Régulateur de vitesse", "Tableau de bord numérique", "CarPlay"] },
      "Volkswagen Tiguan Branco": { subtitle: "Polyvalent avec excellent espace intérieur", features: ["Intérieur spacieux", "Transmission automatique", "CarPlay"] },
      "Nissan Kicks": { subtitle: "Compact, économique et pratique", features: ["Économique", "Intérieur polyvalent", "Transmission automatique", "CarPlay"] },
      "Volkswagen Atlas": { subtitle: "Espace maximum pour grandes familles", features: ["7 passagers", "Intérieur spacieux", "Transmission automatique", "CarPlay"] },
      "Mercedes-Benz GLA": { subtitle: "Compact premium avec ADN Mercedes", features: ["Intérieur cuir", "Design premium", "Transmission automatique", "CarPlay"] },
    },
  },
};
