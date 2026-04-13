(function() {
    const IMG_BASE_URL = "https://ae-pic-a1.aliexpress-media.com/kf/";
    
    let initialFullData = null;

    const cleanProps = (str) => {
        try {
            const parsed = JSON.parse(str);
            const items = Array.isArray(parsed) ? parsed[0] : parsed;
            return Object.values(items).join(" - ");
        } catch (e) {
            return str.replace(/[\[\]\{\}\"\']/g, "").replace(/:/g, ": ").replace(/,/g, " - ").trim();
        }
    };

    async function startEngine() {
        try {
            const domUIDStr = document.querySelector(".UID")?.textContent.trim();
            if (!domUIDStr || !window.MapEngine) return;

            const result = await window.MapEngine.getFeed(domUIDStr);
            if (!result) return;

            const { config, recordIndex, data } = result;
            initialFullData = { ...data, productAffCode: "", storeAffCode: "", storeName: "" };

            if (typeof window.injectData === "function") window.injectData(initialFullData);
            
            const sizes = window.MapEngine.RECORD_SIZES;

            fetchRange(`${window.MapEngine.baseUrl}${config.links}`, recordIndex * sizes.LINKS, sizes.LINKS, "LINKS");
            
            if (initialFullData.hasSKU) {
                fetchRange(`${window.MapEngine.baseUrl}${config.sku}`, recordIndex * sizes.SKU, sizes.SKU, "SKU");
            }
            
            if (initialFullData.hasPromo) {
                fetchRange(`${window.MapEngine.baseUrl}${config.promo}`, recordIndex * sizes.PROMO, sizes.PROMO, "PROMO");
            }
            
            fetchRange(`${window.MapEngine.baseUrl}${config.chart}`, recordIndex * sizes.CHART, sizes.CHART, "CHART");

        } catch (e) { console.error(e); }
    }

    async function fetchRange(url, start, length, type) {
        try {
            const buffer = await window.MapEngine.getRange(url, start, length);
            if (!buffer) return;

            const view = new DataView(buffer);
            const decoder = new TextDecoder("utf-8");

            if (type === "LINKS") {
                const pCode = decoder.decode(new Uint8Array(buffer, 16, 14)).replace(/\0/g, '').trim();
                const sCode = decoder.decode(new Uint8Array(buffer, 30, 14)).replace(/\0/g, '').trim();
                const sName = decoder.decode(new Uint8Array(buffer, 44, 56)).replace(/\0/g, '').trim();

                if (initialFullData) {
                    initialFullData.productAffCode = pCode;
                    initialFullData.storeAffCode = sCode;
                    initialFullData.storeName = sName;
                    localStorage.setItem(`store_${initialFullData.storeId}`, JSON.stringify({name: sName, aff: sCode}));
                    if (typeof window.injectData === "function") window.injectData(initialFullData);
                }
            } else if (type === "SKU") {
                const skuList = [];
                for (let s = 0; s < 30; s++) {
                    const offset = 8 + (s * 96);
                    if (offset + 4 > buffer.byteLength) break;
                    const pDisc = view.getUint32(offset + 4, true) / 100;
                    if (pDisc === 0) continue;
                    const imgSlug = decoder.decode(new Uint8Array(buffer, offset + 14, 34)).replace(/\0/g, '').trim();
                    skuList.push({
                        skuIdx: s, 
                        priceOriginal: view.getUint32(offset, true) / 100,
                        priceDiscounted: pDisc,
                        shippingFee: view.getUint32(offset + 8, true) / 100,
                        minDelivery: view.getUint8(offset + 12),
                        maxDelivery: view.getUint8(offset + 13),
                        image: IMG_BASE_URL + imgSlug + (imgSlug.includes('.') ? "" : ".jpg"),
                        props: cleanProps(decoder.decode(new Uint8Array(buffer, offset + 48, 48)).replace(/\0/g, '').trim())
                    });
                }
                if (typeof window.renderSKUs === "function") window.renderSKUs(skuList);
            } else if (type === "PROMO" && window.injectPromo) {
                window.injectPromo({
                    expiry: view.getUint32(8, true),
                    quantity: view.getUint16(12, true),
                    code: decoder.decode(new Uint8Array(buffer, 14, 18)).replace(/\0/g, '').trim()
                });
            } else if (type === "CHART" && window.renderBinaryChart) {
                window.renderBinaryChart(buffer);
            }
        } catch (e) {}
    }

    window.updateSKUPrice = function(item) {
        window.selectedSkuIndex = item.skuIdx;
        if (initialFullData && typeof window.injectData === "function") {
            window.injectData({
                ...initialFullData,
                priceOriginal: item.priceOriginal,
                priceDiscounted: item.priceDiscounted,
                shippingFee: item.shippingFee,
                minDelivery: item.minDelivery,
                maxDelivery: item.maxDelivery
            });
        }
        const variantEl = document.querySelector(".variant-value");
        if (variantEl) variantEl.textContent = item.props;
    };

    window.resetToInitialData = function() {
        window.selectedSkuIndex = 255; 
        if (initialFullData && typeof window.injectData === "function") {
            window.injectData(initialFullData);
            const variantEl = document.querySelector(".variant-value");
            if (variantEl) variantEl.textContent = "_";
        }
    };

    startEngine();
})();
