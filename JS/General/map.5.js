const MAP_CONFIG = {
    BASE_URL: "https://api.iseekprice.com/",
    DOMAIN: "https://www.iseekprice.com/",
    IMG_BASE_URL: "https://ae-pic-a1.aliexpress-media.com/kf/",
    PLACEHOLDER: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg_6M_oCTDClXnX0p4KvvHzgjw7X2tBBFzkDp6b057jVwL4KPDL3tscGqe6dKNbLJVbmRDQXlnB3Wbcezf54eTD09j6vLsA7LBsXIEaFX6_Ztqx6e41nWilu1WV4rJjC5AThnbe_vOC-PYH1AMWv0WYgR-QxGp4njSptfwlmmTPBqLMRGzMt0dSElde/s600/%D8%AA%D9%88%D9%81%D9%8A%D8%B1.jpg",
    REGIONS: {
        "SA": { symbol: "ر.س" },
        "AE": { symbol: "د.إ" },
        "OM": { symbol: "ر.ع" },
        "MA": { symbol: "د.م" },
        "DZ": { symbol: "د.ج" },
        "TN": { symbol: "د.ت" }
    },
    STRIDES: {
        CORE: 442,
        FEED: 32,
        LINKS: 100,
        SKU: 5468,
        PROMO: 32,
        CHART: 2932
    },
    OFFSETS: {
        CORE: { ID: 0, PATH: 12, TITLE: 92, IMG: 292 },
        FEED: { ID: 0, STORE: 8, ORIG: 12, DISC: 16, SHIP: 20, ORDERS: 24, SCORE: 28, MIN: 29, MAX: 30, STATUS: 31 },
        LINKS: { P_AFF: 16, S_AFF: 30, S_NAME: 44 },
        SKU: { SLOT_START: 8, SLOT_SIZE: 182, ORIG: 0, DISC: 4, SHIP: 8, MIN: 12, MAX: 13, IMG: 14, PROPS: 54 },
        PROMO: { EXPIRY: 8, QTY: 12, CODE: 14 }
    }
};

window.MAP_ENGINE = {
    getRegion() {
        const code = (localStorage.getItem("Cntry") || "SA").toUpperCase();
        return MAP_CONFIG.REGIONS[code] || MAP_CONFIG.REGIONS["SA"];
    },
    toBase64URL(bytes) {
        let lastIndex = bytes.length - 1;
        while (lastIndex >= 0 && bytes[lastIndex] === 0) lastIndex--;
        const cleanBytes = bytes.slice(0, lastIndex + 1);
        return btoa(String.fromCharCode(...cleanBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
};
