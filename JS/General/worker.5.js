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

    static parseCoreRecord(uint8, offset, view, decoder) {
        return {
            id: view.getBigUint64(offset, true),
            date: view.getUint32(offset + 8, true),
            path: decoder.decode(uint8.subarray(offset + 12, offset + 92)).replace(/\\0/g, '').trim(),
            title: decoder.decode(uint8.subarray(offset + 92, offset + 292)).replace(/\\0/g, '').trim(),
            imgSlug: uint8.slice(offset + 292, offset + 442)
        };
    }

    static parseFeed(buffer, targetStoreId = null) {
        const map = new Map();
        const storeMatchedIds = new Set();
        const view = new DataView(buffer);
        for (let i = 0; i < buffer.byteLength; i += 32) {
            const id = view.getBigUint64(i, true);
            const storeId = view.getUint32(i + 8, true);
            const status = view.getUint8(i + 31);
            if (targetStoreId !== null && storeId !== targetStoreId) continue;
            if (targetStoreId !== null) storeMatchedIds.add(id);
            map.set(id, {
                original: view.getUint32(i + 12, true) / 100,
                price: view.getUint32(i + 16, true) / 100,
                orders: view.getUint16(i + 24, true),
                score: view.getUint8(i + 28) / 10,
                delivery: { min: view.getUint8(i + 29), max: view.getUint8(i + 30) },
                status: {
                    promo: (status >> 7) & 1,
                    inStock: (status >> 5) & 1
                }
            });
        }
        return { feedMap: map, matchedIds: storeMatchedIds };
    }
}

self.onmessage = async (e) => {
    const { baseUrl, coreFile, metaFile, feedFile, query, storeId } = e.data;
    const decoder = new TextDecoder();

    try {
        const [feedRes, metaRes] = await Promise.all([
            fetch(baseUrl + feedFile),
            metaFile ? fetch(baseUrl + metaFile) : Promise.resolve(null)
        ]);

        const feedBuf = await feedRes.arrayBuffer();
        const feedResult = BinaryParser.parseFeed(feedBuf, storeId ? parseInt(storeId) : null);
        const feedMap = feedResult.feedMap;
        
        let allowedIds = null;
        if (storeId) {
            allowedIds = feedResult.matchedIds;
        } else if (query && metaRes) {
            const metaBuf = await metaRes.arrayBuffer();
            const metaData = new Uint8Array(metaBuf);
            const metaView = new DataView(metaBuf);
            allowedIds = new Set();
            let hA = BinaryParser.murmur(query.toLowerCase(), 42);
            let hB = BinaryParser.murmur(query.toLowerCase(), 99);
            let bits = [];
            for (let i = 0; i < 7; i++) bits.push((hA + i * hB) % 2048);
            
            for (let i = 0; i < metaData.length; i += 264) {
                let match = true;
                for (let b of bits) {
                    if (!(metaData[i + 8 + Math.floor(b / 8)] & (1 << (b % 8)))) { match = false; break; }
                }
                if (match) allowedIds.add(metaView.getBigUint64(i, true));
            }
        }

        const coreRes = await fetch(baseUrl + coreFile);
        const reader = coreRes.body.getReader();
        let buffer = new Uint8Array(0);
        let allProcessedCore = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            let newBuffer = new Uint8Array(buffer.length + value.length);
            newBuffer.set(buffer);
            newBuffer.set(value, buffer.length);
            buffer = newBuffer;

            const recordsInChunk = [];
            let offset = 0;

            while (offset + 442 <= buffer.length) {
                const view = new DataView(buffer.buffer, offset, 442);
                const id = view.getBigUint64(0, true);

                if (!allowedIds || allowedIds.has(id)) {
                    const record = BinaryParser.parseCoreRecord(buffer, offset, view, decoder);
                    recordsInChunk.push(record);
                    allProcessedCore.push(record);
                }
                offset += 442;
            }

            buffer = buffer.slice(offset);

            if (recordsInChunk.length > 0) {
                self.postMessage({ 
                    type: 'BATCH', 
                    batch: recordsInChunk, 
                    feed: feedMap 
                });
            }
        }

        self.postMessage({ 
            type: 'DONE', 
            core: allProcessedCore, 
            feed: feedMap 
        });

    } catch (err) {
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};
`;
