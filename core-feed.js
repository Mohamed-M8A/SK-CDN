/**
 * إعدادات وثوابت النظام
 */
const CONFIG = {
    allPostsLimit: 50,
    batchSize: 10,
    bannedCategories: ["مقالات", "إعلانات"],
    placeholderImg: "https://via.placeholder.com/320x320/ffffff/ffffff.png",
    feedUrl: "https://souq-alkul.blogspot.com/feeds/posts/default?alt=json"
};

let allPosts = [];
let productFeed = [];
let displayedPosts = new Set();
let displayPointer = 0;
let currentStartIndex = 1;

const nodes = {
    productFeed: document.getElementById("product-posts"),
    loadMoreBtn: document.getElementById("load-more"),
    loader: document.getElementById("loader")
};

/***********************
 * 🚀 أدوات قياس الأداء
 ***********************/
const PerformanceMonitor = {
    start: 0,
    end: 0,
    measure: function(label) {
        this.end = performance.now();
        console.log(`%c [Performance] ${label}: ${(this.end - this.start).toFixed(2)}ms`, "color: #00ff00; font-weight: bold;");
    },
    markStart: function() { this.start = performance.now(); }
};

/***********************
 * معالجة البيانات (Logic)
 ***********************/
function computeProductFeed(posts) {
    return posts.sort((a, b) => new Date(b.published.$t) - new Date(a.published.$t));
}

function getCurrencySymbol() {
    const countrySymbols = { SA: "ر.س", AE: "د.إ", OM: "ر.ع", MA: "د.م", DZ: "د.ج", TN: "د.ت" };
    const country = localStorage.getItem("Cntry") || "SA";
    return countrySymbols[country] || "ر.س";
}

async function fetchAllPosts() {
    nodes.loader.style.display = "block";
    if (nodes.loadMoreBtn) nodes.loadMoreBtn.style.display = "none";

    // 1. محاولة التحميل من الكاش (الرام)
    const cached = sessionStorage.getItem("cachedPosts");
    if (cached) {
        console.info("📦 استعادة البيانات من Cache...");
        allPosts = JSON.parse(cached);
        processAndDisplay();
        nodes.loader.style.display = "none";
        return;
    }

    // 2. التحميل من الشبكة مع قياس السرعة
    PerformanceMonitor.markStart();
    const url = `${CONFIG.feedUrl}&start-index=${currentStartIndex}&max-results=${CONFIG.allPostsLimit}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        PerformanceMonitor.measure("Fetch from Network (وصول الفيد للرام)");

        const posts = data.feed.entry || [];
        allPosts = allPosts.concat(posts);
        sessionStorage.setItem("cachedPosts", JSON.stringify(allPosts));
        
        processAndDisplay();
        currentStartIndex += CONFIG.allPostsLimit;
    } catch (err) {
        console.error("Fetch Error:", err);
    } finally {
        nodes.loader.style.display = "none";
    }
}

function processAndDisplay() {
    productFeed = computeProductFeed(allPosts);
    displayPointer = 0;
    displayBatch();
}

/***********************
 * العرض والرندرة (UI)
 ***********************/
function displayBatch() {
    PerformanceMonitor.markStart(); // بدء قياس الرندرة
    
    const batchHTML = [];
    let count = 0;

    while (count < CONFIG.batchSize && displayPointer < productFeed.length) {
        const post = productFeed[displayPointer];
        const categories = getPostCategories(post);
        
        // فحص الفئات الممنوعة
        if (categories.some(cat => CONFIG.bannedCategories.includes(cat))) {
            displayPointer++;
            continue;
        }

        const url = getPostUrl(post);
        if (url && !displayedPosts.has(url)) {
            displayedPosts.add(url);
            batchHTML.push(generatePostHTML(post, displayPointer >= CONFIG.batchSize));
            count++;
        }
        displayPointer++;
    }

    if (batchHTML.length > 0) {
        nodes.productFeed.insertAdjacentHTML("beforeend", batchHTML.join(""));
        sessionStorage.setItem("displayedPosts", JSON.stringify([...displayedPosts]));
        lazyLoadImages();
        PerformanceMonitor.measure("DOM Rendering (سرعة الرندرة)");
    }
}

/***********************
 * مستخرجات البيانات (Extractors)
 ***********************/
function getPostCategories(post) {
    return post.category?.map(c => c.term) || ["غير مصنف"];
}

function getPostUrl(post) {
    return post.link.find(l => l.rel === "alternate")?.href;
}

function getPostTitle(post) {
    const content = post.content?.$t || "";
    const match = content.match(/<h2[^>]*class=["']product-title["'][^>]*>([^<]+)<\/h2>/);
    return match ? match[1] : post.title?.$t || "بدون عنوان";
}

function getPostPrice(post) {
    const content = post.content?.$t || "";
    const jsonMatch = content.match(/<script[^>]+id=["']product-data["'][^>]*>([\s\S]*?)<\/script>/);
    if (!jsonMatch) return null;

    try {
        const data = JSON.parse(jsonMatch[1]);
        const country = localStorage.getItem("Cntry") || "SA";
        const cData = data.countries?.[country];
        if (!cData) return null;

        return {
            discounted: parseFloat(cData["price-discounted"]),
            original: parseFloat(cData["price-original"]),
            shipping: `${cData["shipping-max-days"] || 0}-${cData["shipping-min-days"] || 0}`
        };
    } catch { return null; }
}

function generatePostHTML(post, isLazy) {
    const url = getPostUrl(post);
    const title = getPostTitle(post);
    const price = getPostPrice(post);
    const currency = getCurrencySymbol();
    const image = getPostImage(post);

    const priceHtml = price ? `
        <div class="price-display">
            <span class="discounted-price">${price.discounted.toFixed(2)} ${currency}</span>
            ${price.original > price.discounted ? `<span class="original-price">${price.original.toFixed(2)} ${currency}</span>` : ""}
        </div>` : "";

    const imgTag = isLazy 
        ? `<img class="post-image lazy-img" src="${CONFIG.placeholderImg}" data-src="${image}" alt="${title}" loading="lazy">`
        : `<img class="post-image" src="${image}" alt="${title}" loading="lazy">`;

    return `
        <div class="post-card">
            <a href="${url}" target="_blank">
                <div class="image-container">${imgTag}</div>
                <div class="post-content">
                    <h3 class="post-title">${title}</h3>
                    ${priceHtml}
                </div>
            </a>
        </div>`;
}

// وظائف مساعدة للصورة والـ Lazy Load
function getPostImage(post) {
    const imgMatch = post.content?.$t.match(/<img[^>]+src=["']([^"']+)["']/i);
    return imgMatch ? imgMatch[1].replace(/\/s\d+/, "/s320") : CONFIG.placeholderImg;
}

function lazyLoadImages() {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove("lazy-img");
                obs.unobserve(img);
            }
        });
    }, { rootMargin: "100px" });
    document.querySelectorAll(".lazy-img").forEach(img => observer.observe(img));
}

/***********************
 * المستمعات (Events)
 ***********************/
window.addEventListener("scroll", () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        if (displayPointer < productFeed.length) displayBatch();
    }
});

if (nodes.loadMoreBtn) {
    nodes.loadMoreBtn.onclick = fetchAllPosts;
}

window.onload = () => {
    sessionStorage.removeItem("displayedPosts");
    fetchAllPosts();
};
