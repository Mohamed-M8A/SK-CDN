const MAP_ENGINE = (function() {
    const BASE_URL = "https://api.iseekprice.com/";
    const REGIONS = ["SA", "AE", "OM", "MA", "DZ", "TN"];
    
    const RECORD_SIZES = {
        FEED: 32,
        LINKS: 100,
        SKU: 2888,
        PROMO: 32,
        CHART: 2932
    };

    async function getFileMap() {
        try {
            const country = (localStorage.getItem("Cntry") || "SA").toUpperCase();
            const regionIdx = REGIONS.indexOf(country);
            if (regionIdx === -1) return null;

            const mapRes = await fetch(`${BASE_URL}map.bin?v=${Date.now()}`);
            if (!mapRes.ok) throw new Error("Map fetch failed");
            
            const mapText = await mapRes.text();
            const hashes = mapText.trim().split('\n').map(h => h.trim());

            const startIdx = 2 + (regionIdx * 5);

            return {
                country: country,
                core: hashes[0],
                meta: hashes[1],
                feed: `${country}_feed_${hashes[startIdx]}.bin`,
                promo: `${country}_promo_${hashes[startIdx + 1]}.bin`,
                sku: `${country}_sku_${hashes[startIdx + 2]}.bin`,
                chart: `${country}_fluctuation_${hashes[startIdx + 3]}.bin`,
                links: `${country}_links_${hashes[startIdx + 4]}.bin`
            };
        } catch (e) {
            console.error("MapEngine Error:", e);
            return null;
        }
    }

    async function fetchFeedData(targetUID) {
        const config = await getFileMap();
        if (!config) return null;

        const res = await fetch(`${BASE_URL}${config.feed}`);
        if (!res.ok) return null;

        const buffer = await res.arrayBuffer();
        const view = new DataView(buffer);
        const stride = RECORD_SIZES.FEED;

        for (let i = 0; i < buffer.byteLength; i += stride) {
            if (view.getBigUint64(i, true) === BigInt(targetUID)) {
                const flags = view.getUint8(i + 31);
                return {
                    config,
                    recordIndex: i / stride,
                    data: {
                        storeId: view.getUint32(i + 8, true),
                        priceOriginal: view.getUint32(i + 12, true) / 100,
                        priceDiscounted: view.getUint32(i + 16, true) / 100,
                        shippingFee: view.getUint32(i + 20, true) / 100,
                        orders: view.getUint16(i + 24, true),
                        reviews: view.getUint16(i + 26, true),
                        score: view.getUint8(i + 28) / 10,
                        minDelivery: view.getUint8(i + 29),
                        maxDelivery: view.getUint8(i + 30),
                        inStock: (flags & 0x20) !== 0,
                        hasSKU: (flags & 0x40) !== 0,
                        hasPromo: (flags & 0x80) !== 0
                    }
                };
            }
        }
        return null;
    }

    async function fetchBinaryRange(file, start, length) {
        try {
            const res = await fetch(`${BASE_URL}${file}`, {
                headers: { 'Range': `bytes=${start}-${start + length - 1}` }
            });
            if (res.status !== 206) return null;
            return await res.arrayBuffer();
        } catch (e) {
            return null;
        }
    }

    return {
        getConfig: getFileMap,
        getFeed: fetchFeedData,
        getRange: fetchBinaryRange,
        baseUrl: BASE_URL,
        RECORD_SIZES: RECORD_SIZES
    };
})();

window.MapEngine = MAP_ENGINE;
