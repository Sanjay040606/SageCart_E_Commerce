const getProductStatusFromStock = (stock) => {
  if (stock === 0) return 'out_of_stock';
  if (stock <= 5) return 'low_stock';
  return 'active';
};

export const seedProductCatalog = [
  {
    name: "Apple AirPods Pro 2nd Gen",
    description:
      "Premium true wireless earbuds with active noise cancellation, adaptive transparency, and a MagSafe USB-C charging case. Ideal for clean calls, daily commutes, and seamless switching between Apple devices.",
    category: "Earphone",
    price: 499.99,
    offerPrice: 399.99,
    stock: 18,
    promoCode: "SOUND10",
    image: [
      "/product-seeds/apple_earphone_image.png"
    ]
  },
  {
    name: "Bose QuietComfort 45",
    description:
      "Comfort-first over-ear headphones with signature noise cancellation, balanced sound, and all-day battery life. A strong choice for work, travel, and long listening sessions.",
    category: "Headphone",
    price: 429.99,
    offerPrice: 329.99,
    stock: 12,
    promoCode: "QUIET15",
    image: [
      "/product-seeds/bose_headphone_image.png"
    ]
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    description:
      "Flagship smartphone with a bright AMOLED display, fast performance, pro-level cameras, and long battery life. Built for multitasking, gaming, photography, and premium everyday use.",
    category: "Smartphone",
    price: 1299.99,
    offerPrice: 1199.99,
    stock: 9,
    promoCode: "GALAXY20",
    image: [
      "/product-seeds/samsung_s23phone_image.png"
    ]
  },
  {
    name: "Garmin Venu 3",
    description:
      "Health-focused smartwatch with fitness tracking, GPS, sleep insights, and a crisp AMOLED screen. Great for users who want a polished watch for training and daily wear.",
    category: "Watch",
    price: 449.99,
    offerPrice: 389.99,
    stock: 7,
    promoCode: "WATCH10",
    image: [
      "/product-seeds/venu_watch_image.png"
    ]
  },
  {
    name: "PlayStation 5 Slim",
    description:
      "Next-gen gaming console with lightning-fast loading, smooth 4K gameplay, and a compact design. Perfect for action games, streaming, and a premium living-room setup.",
    category: "Accessories",
    price: 599.99,
    offerPrice: 529.99,
    stock: 15,
    promoCode: "GAME10",
    image: [
      "/product-seeds/playstation_image.png"
    ]
  },
  {
    name: "Canon EOS R5",
    description:
      "Professional mirrorless camera with a 45MP sensor, 8K video capture, and advanced autofocus. Designed for creators who want serious still-photo quality and video flexibility.",
    category: "Camera",
    price: 4199.99,
    offerPrice: 3899.99,
    stock: 4,
    promoCode: "CAMERA15",
    image: [
      "/product-seeds/cannon_camera_image.png"
    ]
  },
  {
    name: "MacBook Pro 16",
    description:
      "High-performance laptop with an M2 Pro chip, 16GB RAM, and a fast SSD for heavy multitasking. Great for design, video editing, coding, and premium productivity.",
    category: "Laptop",
    price: 2799.99,
    offerPrice: 2499.99,
    stock: 6,
    promoCode: "LAPTOP20",
    image: [
      "/product-seeds/macbook_image.png"
    ]
  },
  {
    name: "Sony WF-1000XM5",
    description:
      "Compact true wireless earbuds with high-resolution audio, excellent noise cancellation, and a snug fit. A premium pick for music lovers and people who take calls on the go.",
    category: "Earphone",
    price: 349.99,
    offerPrice: 299.99,
    stock: 20,
    promoCode: "",
    image: [
      "/product-seeds/sony_airbuds_image.png"
    ]
  },
  {
    name: "Samsung 4K Projector",
    description:
      "Cinema-style projector with sharp 4K output, strong brightness, and built-in sound. A flexible choice for home theater, presentations, and gaming nights.",
    category: "Accessories",
    price: 1699.99,
    offerPrice: 1499.99,
    stock: 5,
    promoCode: "BIGSCREEN10",
    image: [
      "/product-seeds/projector_image.png"
    ]
  },
  {
    name: "ASUS ROG Zephyrus G16",
    description:
      "Powerful gaming laptop with an Intel Core i9 processor, RTX 4070 graphics, 16GB RAM, and a 1TB SSD. Built for high-end gaming, streaming, and creator workloads.",
    category: "Laptop",
    price: 2199.99,
    offerPrice: 1999.99,
    stock: 8,
    promoCode: "ROG15",
    image: [
      "/product-seeds/asus_laptop_image.png"
    ]
  },
  {
    name: "JBL SoundBox 110",
    description:
      "Portable party speaker with strong bass, wireless playback, and easy carry handle design. Great for rooms, rooftops, and casual gatherings.",
    category: "Accessories",
    price: 129.99,
    offerPrice: 109.99,
    stock: 16,
    promoCode: "SOUND15",
    image: [
      "/product-seeds/jbl_soundbox_image.png"
    ]
  },
  {
    name: "Sony WH-1000XM5",
    description:
      "Premium wireless over-ear headphones with industry-leading noise cancellation, soft fit, and clean vocal clarity. Ideal for work, travel, and long focus sessions.",
    category: "Headphone",
    price: 499.99,
    offerPrice: 449.99,
    stock: 13,
    promoCode: "SONY5",
    image: [
      "/product-seeds/girl_with_headphone_image.png"
    ]
  },
  {
    name: "Apple iPhone 15 Pro",
    description:
      "Compact premium smartphone with a powerful processor, pro camera system, and titanium-style finish. Designed for fast performance and daily luxury use.",
    category: "Smartphone",
    price: 1399.99,
    offerPrice: 1299.99,
    stock: 10,
    promoCode: "IPHONE15",
    image: [
      "/product-seeds/girl_with_earphone_image.png"
    ]
  },
  {
    name: "Nintendo Switch OLED",
    description:
      "Versatile handheld console with a bright OLED display, docked TV play, and detachable controllers. Perfect for travel and family gaming.",
    category: "Accessories",
    price: 349.99,
    offerPrice: 319.99,
    stock: 14,
    promoCode: "SWITCH10",
    image: [
      "/product-seeds/md_controller_image.png"
    ]
  },
  {
    name: "Logitech G Wireless Mouse",
    description:
      "Lightweight wireless mouse tuned for quick response, long battery life, and smooth grip. A good choice for office work or casual gaming.",
    category: "Accessories",
    price: 89.99,
    offerPrice: 69.99,
    stock: 22,
    promoCode: "",
    image: [
      "/product-seeds/sm_controller_image.png"
    ]
  },
  {
    name: "Dell Inspiron 14",
    description:
      "Reliable everyday laptop with strong battery life, balanced performance, and a portable build. Best for office work, study, and daily browsing.",
    category: "Laptop",
    price: 899.99,
    offerPrice: 799.99,
    stock: 17,
    promoCode: "DELL10",
    image: [
      "/product-seeds/boy_with_laptop_image.png"
    ]
  },
  {
    name: "Boat Rockerz 450",
    description:
      "Affordable over-ear headphones with comfortable padding, foldable design, and strong battery backup. A dependable budget audio pick.",
    category: "Headphone",
    price: 59.99,
    offerPrice: 49.99,
    stock: 30,
    promoCode: "ROCKER10",
    image: [
      "/product-seeds/header_headphone_image.png"
    ]
  },
  {
    name: "Microsoft Surface Laptop",
    description:
      "Slim productivity laptop with a clean display, premium finish, and responsive keyboard. Built for professionals and students who want a lightweight machine.",
    category: "Laptop",
    price: 1299.99,
    offerPrice: 1199.99,
    stock: 9,
    promoCode: "SURFACE12",
    image: [
      "/product-seeds/header_macbook_image.png"
    ]
  },
  {
    name: "DualSense Edge Controller",
    description:
      "Premium game controller with customizable buttons, ergonomic grip, and smooth response. Ideal for console players who want extra control and comfort.",
    category: "Accessories",
    price: 199.99,
    offerPrice: 179.99,
    stock: 11,
    promoCode: "GAMEEDGE",
    image: [
      "/product-seeds/header_playstation_image.png"
    ]
  }
];

export const buildSeedProducts = (userId) =>
  seedProductCatalog.map((product, index) => {
    const stock = Math.max(0, Number(product.stock) || 0);

    return {
      userId,
      ...product,
      stock,
      status: getProductStatusFromStock(stock),
      date: Date.now() - (index * 86400000)
    };
  });
