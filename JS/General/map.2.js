const MAP_CONFIG = {
    BASE_URL: "https://api.iseekprice.com/",
    IMG_BASE_URL: "https://ae-pic-a1.aliexpress-media.com/kf/",
    REGIONS: {
        "SA": { name: "السعودية", symbol: "ر.س", rate: 1, flag: "🇸🇦" },
        "AE": { name: "الإمارات", symbol: "د.إ", rate: 0.98, flag: "🇦🇪" },
        "OM": { name: "عُمان", symbol: "ر.ع", rate: 0.10, flag: "🇴🇲" },
        "MA": { name: "المغرب", symbol: "د.م", rate: 2.70, flag: "🇲🇦" },
        "DZ": { name: "الجزائر", symbol: "د.ج", rate: 36.00, flag: "🇩🇿" },
        "TN": { name: "تونس", symbol: "د.ت", rate: 0.83, flag: "🇹🇳" }
    },
    STRIDES: {
        FEED: 32,
        LINKS: 100,
        SKU: 2888,
        CHART: 2932,
        PROMO: 32
    },
    OFFSETS: {
        FEED: {
            UID: 0,
            STORE_ID: 8,
            PRICE_ORIG: 12,
            PRICE_DISC: 16,
            SHIP_FEE: 20,
            ORDERS: 24,
            REVIEWS: 26,
            SCORE: 28,
            DELIVERY_MIN: 29,
            DELIVERY_MAX: 30,
            FLAGS: 31
        },
        LINKS: {
            PRODUCT_AFF: 16,
            STORE_AFF: 30,
            STORE_NAME: 44
        },
        SKU: {
            START: 8,
            ITEM_SIZE: 96,
            PRICE_ORIG: 0,
            PRICE_DISC: 4,
            SHIP_FEE: 8,
            DEL_MIN: 12,
            DEL_MAX: 13,
            IMG_SLUG: 14,
            PROPS: 48
        },
        PROMO: {
            EXPIRY: 8,
            QTY: 12,
            CODE: 14
        },
        CHART: {
            COUNT: 8,
            DATA_START: 12,
            POINT_SIZE: 8
        }
    },
    CHART_THEME: {
        COLOR: "#ff6000",
        BG_GRADIENT: ["rgba(255, 96, 0, 0.15)", "rgba(255, 96, 0, 0)"],
        EPOCH_START: "2025-01-01"
    }
};
