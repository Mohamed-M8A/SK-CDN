const workerCode = `
class BinaryParser {
    static murmur(str, seed) {
        let h = seed ^ str.length;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
            h = h ^ (h >>> 13);
        }
        return h >>> 0;
    }

    static parseFeed(buffer, targetStoreId = null) {
        const map = new Map();
        const matchedIds = new Set();
        const view = new DataView(buffer);
        for (let i = 0; i < buffer.byteLength; i += 32) {
            const id = view.getBigUint64(i, true);
            const storeId = view.getUint32(i + 8, true);
            if (targetStoreId !== null && storeId !== targetStoreId) continue;
            if (targetStoreId !== null) matchedIds.add(id);
            const status = view.getUint8(i + 31);
            map.set(id, {
                index: i / 32,
                original: view.getUint32(i + 12, true) / 100,
                price: view.getUint32(i + 16, true) / 100,
                shipping: view.getUint32(i + 20, true) / 100,
                orders: view.getUint16(i + 24, true),
                reviews: view.getUint16(i + 26, true),
                score: view.getUint8(i + 28) / 10,
                delivery: { min: view.getUint8(i + 29), max: view.getUint8(i + 30) },
                status: { 
                    promo: (status & 0x80) !== 0, 
                    hasSKU: (status & 0x40) !== 0,
                    isGlobal: (status & 0x20) !== 0,
                    sudStatus: status & 0x1F,
                    inStock: (status >> 5) & 1 
                }
            });
        }
        return { map, matchedIds };
    }

    static parseCoreRecord(uint8, offset, decoder) {
        const view = new DataView(uint8.buffer, uint8.byteOffset + offset, 442);
        return {
            id: view.getBigUint64(0, true),
            date: view.getUint32(8, true),
            path: decoder.decode(uint8.subarray(offset + 12, offset + 92)).replace(/\\0/g, '').trim(),
            title: decoder.decode(uint8.subarray(offset + 92, offset + 292)).replace(/\\0/g, '').trim(),
            imgSlug: uint8.slice(offset + 292, offset + 442)
        };
    }
}

async function fetchRange(url, start, length) {
    try {
        const res = await fetch(url, { headers: { 'Range': \`bytes=\${start}-\${start + length - 1}\` } });
        if (res.status === 206) return await res.arrayBuffer();
    } catch (e) {}
    return null;
}

self.onmessage = async (e) => {
    const { baseUrl, coreFile, metaFile, feedFile, query, storeId, mainUID, linksFile, skuFile, promoFile, chartFile } = e.data;
    const CACHE_NAME = 'souq-cache-v1';
    const decoder = new TextDecoder();

    async function getFile(fileName, hours) {
        const url = baseUrl + fileName;
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(url);
        if (cached) {
            const date = cached.headers.get('date');
            if (date && (Date.now() - new Date(date).getTime()) < hours * 3600000) return cached;
        }
        const res = await fetch(url);
        if (res.ok) { cache.put(url, res.clone()); return res; }
        return null;
    }

    try {
        const [feedRes, metaRes] = await Promise.all([
            getFile(feedFile, 1),
            metaFile ? getFile(metaFile, 24) : Promise.resolve(null)
        ]);

        const feedBuf = await feedRes.arrayBuffer();
        const { map: feedMap, matchedIds: storeMatchedIds } = BinaryParser.parseFeed(feedBuf, storeId ? parseInt(storeId) : null);

        if (mainUID) {
            const targetID = BigInt(mainUID);
            const mainData = feedMap.get(targetID);
            if (mainData) {
                const idx = mainData.index;
                const detailPromises = [
                    fetchRange(baseUrl + linksFile, idx * 100, 100),
                    mainData.status.hasSKU ? fetchRange(baseUrl + skuFile, idx * 5468, 5468) : Promise.resolve(null),
                    mainData.status.promo ? fetchRange(baseUrl + promoFile, idx * 32, 32) : Promise.resolve(null),
                    fetchRange(baseUrl + chartFile, idx * 2932, 2932)
                ];

                const [lBuf, sBuf, pBuf, cBuf] = await Promise.all(detailPromises);
                const details = {
                    initial: {
                        ...mainData,
                        priceOriginal: mainData.original,
                        priceDiscounted: mainData.price,
                        shippingFee: mainData.shipping,
                        minDelivery: mainData.delivery.min,
                        maxDelivery: mainData.delivery.max,
                        hasSKU: mainData.status.hasSKU,
                        hasPromo: mainData.status.promo,
                        sudStatus: mainData.status.sudStatus,
                        isGlobal: mainData.status.isGlobal
                    }
                };

                if (lBuf) {
                    details.initial.productAffCode = decoder.decode(new Uint8Array(lBuf, 16, 14)).replace(/\\0/g, '').trim();
                    details.initial.storeAffCode = decoder.decode(new Uint8Array(lBuf, 30, 14)).replace(/\\0/g, '').trim();
                    details.initial.storeName = decoder.decode(new Uint8Array(lBuf, 44, 56)).replace(/\\0/g, '').trim();
                }

                if (sBuf) {
                    const skus = [];
                    const sView = new DataView(sBuf);
                    for (let s = 0; s < 30; s++) {
                        const off = 8 + (s * 182);
                        const pD = sView.getUint32(off + 4, true) / 100;
                        if (pD === 0) continue;
                        const img = decoder.decode(new Uint8Array(sBuf, off + 14, 40)).replace(/\\0/g, '').trim();
                        skus.push({
                            skuIdx: s,
                            priceOriginal: sView.getUint32(off, true) / 100,
                            priceDiscounted: pD,
                            shippingFee: sView.getUint32(off + 8, true) / 100,
                            minDelivery: sView.getUint8(off + 12),
                            maxDelivery: sView.getUint8(off + 13),
                            image: "https://ae-pic-a1.aliexpress-media.com/kf/" + img + (img.includes('.') ? "" : ".jpg"),
                            props: decoder.decode(new Uint8Array(sBuf, off + 54, 128)).replace(/\\0/g, '').trim().replace(/\\|/g, " - ")
                        });
                    }
                    details.skuList = skus;
                }

                if (pBuf) {
                    const pView = new DataView(pBuf);
                    details.promo = {
                        expiry: pView.getUint32(8, true),
                        quantity: pView.getUint16(12, true),
                        code: decoder.decode(new Uint8Array(pBuf, 14, 18)).replace(/\\0/g, '').trim()
                    };
                }
                
                if (cBuf) details.chartBuffer = cBuf;
                
                self.postMessage({ type: 'PRODUCT_DETAILS', details });
            }
        }

        let allowedIds = storeId ? storeMatchedIds : null;
        if (query && metaRes) {
            const metaBuf = await metaRes.arrayBuffer();
            const metaData = new Uint8Array(metaBuf);
            const metaView = new DataView(metaBuf);
            const searchMatchedIds = new Set();
            let hA = BinaryParser.murmur(query.toLowerCase(), 42), hB = BinaryParser.murmur(query.toLowerCase(), 99);
            let bits = [];
            for (let i = 0; i < 7; i++) bits.push((hA + i * hB) % 2048);
            for (let i = 0; i < metaData.length; i += 264) {
                let match = true;
                for (let b of bits) { if (!(metaData[i + 8 + Math.floor(b / 8)] & (1 << (b % 8)))) { match = false; break; } }
                if (match) searchMatchedIds.add(metaView.getBigUint64(i, true));
            }
            allowedIds = storeId ? new Set([...searchMatchedIds].filter(id => storeMatchedIds.has(id))) : searchMatchedIds;
        }

        const coreRes = await getFile(coreFile, 24);
        const reader = coreRes.body.getReader();
        let leftover = new Uint8Array(0);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            let combined = new Uint8Array(leftover.length + value.length);
            combined.set(leftover); combined.set(value, leftover.length);
            let records = [];
            let offset = 0;
            while (offset + 442 <= combined.length) {
                const id = new DataView(combined.buffer, combined.byteOffset + offset, 8).getBigUint64(0, true);
                if (!allowedIds || allowedIds.has(id)) records.push(BinaryParser.parseCoreRecord(combined, offset, decoder));
                offset += 442;
            }
            leftover = combined.slice(offset);
            if (records.length > 0) self.postMessage({ type: 'BATCH', batch: records, feed: feedMap });
        }
        self.postMessage({ type: 'DONE' });
    } catch (err) {
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};
\`;
