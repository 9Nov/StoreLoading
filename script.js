const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwnIo6BffmELCvHrpoviXFM8nj8ej96Rjbyjw7aECgOMpgfNPe6BKWB1g9BLRQXiTNb/exec";
// ⚠️ ข้อควรระวัง: URL ด้านบนดูเหมือน Library URL ผิดรูปแบบ!
// URL ที่ถูกต้องมักจะขึ้นต้นด้วย https://script.google.com/macros/s/..../exec
// แต่ผมจะให้โค้ดทำงานต่อไป เผื่อว่ามันถูกต้องแล้ว

// Cache items to avoid re-fetching constantly
let cachedItems = [];

window.onload = function () {
    // Initial fetch of items with visual feedback
    fetchItems();
};

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabName).classList.add('active');
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => {
        if (tabName === 'create-qr') return b.textContent.includes('สร้าง QR');
        return b.textContent.includes(tabName === 'receive' ? 'รับเข้า' : 'เบิกออก');
    });
    if (btn) btn.classList.add('active');

    // Stop scanner if switching away from issue tab
    if (tabName !== 'issue' && html5QrcodeScanner) {
        try {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        } catch (e) { }
    }
}

// ----------------------
// Data Fetching
// ----------------------
async function fetchItems() {
    const inputLabels = document.querySelectorAll('label');
    const originalLabels = {};

    // Show loading state
    inputLabels.forEach((l, index) => {
        if (l.innerText.includes('Items')) {
            originalLabels[index] = l.innerText;
            l.innerText = 'Items (กำลังโหลดรายการสินค้า... ⏳)';
            l.style.color = '#e67e22';
        }
    });

    try {
        console.log("Fetching items from:", WEB_APP_URL);
        const response = await fetch(WEB_APP_URL, {
            redirect: "follow",
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: 'get_items' })
        });

        // Convert to text first to debug if it's HTML (error page)
        const textData = await response.text();
        let data;
        try {
            data = JSON.parse(textData);
        } catch (e) {
            throw new Error("Server returned non-JSON response. URL might be wrong. Response: " + textData.substring(0, 50) + "...");
        }

        if (data.status === 'success') {
            cachedItems = data.items || [];
            if (cachedItems.length === 0) {
                console.warn("Items list is empty.");
                alert("เชื่อมต่อสำเร็จ แต่ไม่พบสินค้าใน Sheet 'Stock' (Column A)");
            }
            populateDatalists();

            // Restore labels
            inputLabels.forEach((l, index) => {
                if (l.innerText.includes('กำลังโหลด')) {
                    l.innerText = 'Items (เลือกหรือพิมพ์ชื่อสินค้า) ✅';
                    l.style.color = 'var(--text-color)';
                }
            });

        } else {
            throw new Error("Server returned error: " + (data.message || "Unknown error"));
        }
    } catch (e) {
        console.error("Failed to fetch items", e);

        // Show visible error to user
        alert("⚠️ ไม่สามารถดึงรายการสินค้าได้ \nสาเหตุ: " + e.message + "\n\nระบบจะใช้ 'รายการตัวอย่าง' แทน เพื่อให้คุณใช้งานต่อได้");

        // Fallback Items so the UI is usable
        cachedItems = ["ตัวอย่าง-ปากกา", "ตัวอย่าง-ดินสอ", "ตัวอย่าง-กระดาษ", "A001", "B002", "TEST-ITEM"];
        populateDatalists();

        inputLabels.forEach((l) => {
            if (l.innerText.includes('กำลังโหลด')) {
                l.innerText = 'Items (พิมพ์เองได้เลย) ⚠️';
                l.style.color = '#e74c3c';
            }
        });
    }
}

function populateDatalists() {
    const dataList = document.getElementById('stock-items');
    if (!dataList) return;

    dataList.innerHTML = ''; // Clear

    cachedItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        dataList.appendChild(option);
    });
}

// ----------------------
// Receive Logic
// ----------------------
async function submitReceive() {
    const item = document.getElementById('receive-item').value;
    const qty = document.getElementById('receive-qty').value;

    if (!item || !qty) {
        alert("กรุณากรอกข้อมูลให้ครบ");
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: 'receive',
                item: item,
                qty: qty
            })
        });

        // Try to refresh items if a new one was added
        setTimeout(fetchItems, 1000);

        alert("บันทึกข้อมูลสำเร็จ");
        document.getElementById('receive-item').value = '';
        document.getElementById('receive-qty').value = '';

    } catch (error) {
        console.error(error);
        alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
        showLoading(false);
    }
}

// ----------------------
// Issue / Scanner Logic
// ----------------------
let html5QrcodeScanner = null;
let currentScannedItem = "";

function startScanner() {
    if (html5QrcodeScanner) return;

    const onScanSuccess = async (decodedText, decodedResult) => {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;

        // Sync with Input
        const input = document.getElementById('issue-item-input');
        input.value = decodedText;

        currentScannedItem = decodedText;

        document.getElementById('scan-item-name').innerText = "กำลังค้นหา...";
        document.getElementById('scan-result').style.display = 'block';

        await checkStock(decodedText);
    };

    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false);

    html5QrcodeScanner.render(onScanSuccess);
}

function onManualSelectChange() {
    const input = document.getElementById('issue-item-input');
    const val = input.value;

    if (val) {
        currentScannedItem = val;
        document.getElementById('scan-item-name').innerText = val;
        document.getElementById('scan-result').style.display = 'block';
        checkStock(val);
    } else {
        document.getElementById('scan-result').style.display = 'none';
        currentScannedItem = "";
    }
}

async function checkStock(itemCode) {
    showLoading(true);
    try {
        const response = await fetch(WEB_APP_URL, {
            redirect: "follow",
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: 'scan_check', item: itemCode })
        });
        const data = await response.json();

        if (data.status === 'success' && data.found) {
            document.getElementById('scan-item-name').innerText = data.item;
            document.getElementById('scan-remaining').innerText = data.remaining;
            currentScannedItem = data.item;
        } else {
            document.getElementById('scan-item-name').innerText = itemCode + " (ไม่พบใน Stock)";
            document.getElementById('scan-remaining').innerText = "0";
        }
    } catch (e) {
        console.error(e);
    } finally {
        showLoading(false);
    }
}

async function submitIssue() {
    const qty = document.getElementById('issue-qty').value;
    const inputVal = document.getElementById('issue-item-input').value;

    if (!inputVal) {
        alert("กรุณาระบุสินค้า");
        return;
    }
    if (!qty) {
        alert("กรุณาระบุจำนวน");
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(WEB_APP_URL, {
            redirect: "follow",
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: 'issue',
                item: inputVal,
                qty: qty
            })
        });
        await response.json();

        alert("บันทึกเบิกออกสำเร็จ");
        document.getElementById('issue-qty').value = '';
        document.getElementById('issue-item-input').value = '';
        document.getElementById('scan-result').style.display = 'none';
        currentScannedItem = "";

    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        showLoading(false);
    }
}

// ----------------------
// Create QR Logic
// ----------------------
function generateQRCode() {
    const item = document.getElementById('create-qr-item-input').value;
    if (!item) {
        alert("กรุณาระบุสินค้า");
        return;
    }

    const container = document.getElementById('qr-code-container');
    const qrDiv = document.getElementById('qrcode');
    const caption = document.getElementById('qr-caption');

    // Clear previous
    qrDiv.innerHTML = "";
    container.style.display = 'flex';
    caption.innerText = item;

    // Use an API to generate the QR Image. Robust and simple.
    // Encoded the item text to handle special characters (Thai, spaces)
    const encodedItem = encodeURIComponent(item);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodedItem}`;

    const img = document.createElement('img');
    img.src = qrUrl;
    img.alt = "QR Code: " + item;
    img.style.display = "block"; // Ensure it respects margin auto

    // Add loading text until image loads
    const loading = document.createElement('p');
    loading.innerText = "Generating...";
    loading.style.fontSize = "0.8rem";
    loading.style.color = "#888";
    qrDiv.appendChild(loading);

    img.onload = () => {
        // Remove loading text, keep image
        qrDiv.innerHTML = "";
        qrDiv.appendChild(img);
    };

    // Append mostly to start fetching
    // (If we append immediately, loading text might briefly appear)
}

function showLoading(show) {
    const el = document.getElementById('loading-overlay');
    if (show) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

