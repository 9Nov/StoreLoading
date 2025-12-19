// --- CONFIGURATION ---
// IMPORTANT: Replace with your actual credentials from INSTRUCTIONS.md
const API_KEY = 'YOUR_API_KEY';
const CLIENT_ID = 'YOUR_CLIENT_ID';
const SPREADSHEET_ID = '1y1YbK9KVxnr2YEKdDTdrVFFhySxhDtUv2DJtwnzSkvA';

// --- GOOGLE API & AUTHENTICATION ---
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let html5QrcodeScanner;
let scannedItemData = null; // To store data of the item after scanning

const authorizeButton = document.getElementById('authorize_button');
const mainContent = document.getElementById('main_content');
const loadingDiv = document.getElementById('loading');

/**
 * Callback after GAPI client is loaded.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: authCallback, // Callback function to handle the token response
    });
    gisInited = true;
    maybeEnableAuthButton();
}

/**
 * Initializes the GAPI client.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableAuthButton();
}

/**
 * Enables the authorization button if both GAPI and GIS are initialized.
 */
function maybeEnableAuthButton() {
    if (gapiInited && gisInited) {
        authorizeButton.disabled = false;
    }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // User is already authorized, revoke the token to sign out (for demo purposes)
         gapi.client.setToken('');
         authorizeButton.innerText = 'Authorize with Google';
         mainContent.style.display = 'none';
    }
}

/**
 * Callback that receives the access token.
 * @param {object} tokenResponse
 */
function authCallback(tokenResponse) {
    if (tokenResponse.error) {
        alert('Authentication error: ' + tokenResponse.error);
        return;
    }
    gapi.client.setToken(tokenResponse);
    authorizeButton.innerText = 'Sign Out';
    mainContent.style.display = 'block';
    // Add event listeners for forms after authentication
    document.getElementById('stock-in-form').addEventListener('submit', handleStockIn);
    document.getElementById('stock-out-form').addEventListener('submit', handleStockOut);
}

// Event Listeners
authorizeButton.addEventListener('click', handleAuthClick);

// --- APP LOGIC ---

/**
 * Shows the specified tab and hides others.
 * @param {string} tabName The ID of the tab content to show.
 */
function showTab(tabName) {
    const tabContents = document.querySelectorAll('.tab-content');
    const tabButtons = document.querySelectorAll('.tab-button');

    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    tabButtons.forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabName).classList.add('active');
    // Find the button that controls this tab and set it to active
    const activeButton = Array.from(tabButtons).find(button => button.getAttribute('onclick').includes(`'${tabName}'`));
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Special handling for the 'stock-out' tab to initialize the scanner
    if (tabName === 'stock-out') {
        startScanner();
    }
}

/**
 * Toggles the loading indicator.
 * @param {boolean} visible
 */
function toggleLoading(visible) {
    loadingDiv.style.display = visible ? 'flex' : 'none';
}

/**
 * Main handler for the "Stock In" form submission.
 * @param {Event} event
 */
async function handleStockIn(event) {
    event.preventDefault();
    toggleLoading(true);

    const itemName = document.getElementById('item-name').value.trim();
    const quantity = parseInt(document.getElementById('item-quantity').value, 10);

    if (!itemName || isNaN(quantity) || quantity <= 0) {
        alert('กรุณากรอกข้อมูลให้ถูกต้อง');
        toggleLoading(false);
        return;
    }

    try {
        const itemData = await findItemRow(itemName);
        await logStockIn(itemName, quantity);
        await updateStockSheet(itemData, itemName, quantity);

        alert('บันทึกข้อมูลเรียบร้อยแล้ว');
        document.getElementById('stock-in-form').reset();
    } catch (err) {
        console.error('Error during stock-in process:', err);
        alert(`เกิดข้อผิดพลาด: ${err.result?.error?.message || err.message}`);
    } finally {
        toggleLoading(false);
    }
}

/**
 * Finds a specific item in the "Stock" sheet.
 * @param {string} itemName The name of the item to find.
 * @returns {Promise<object|null>} An object with row data and index, or null if not found.
 */
async function findItemRow(itemName) {
    console.log(`Searching for item: ${itemName}`);
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Stock!A:E',
    });

    const rows = response.result.values;
    if (rows && rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] === itemName) {
                console.log(`Found item at row ${i + 1}`);
                return {
                    rowIndex: i + 1,
                    data: rows[i],
                };
            }
        }
    }
    console.log('Item not found.');
    return null;
}

/**
 * Logs a new "stock in" transaction to the "บันทึกรับเข้า" sheet.
 * @param {string} itemName
 * @param {number} quantity
 */
async function logStockIn(itemName, quantity) {
    console.log('Logging stock in transaction...');
    const timestamp = new Date().toLocaleString('th-TH');
    const values = [[timestamp, itemName, quantity]];

    await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'บันทึกรับเข้า!A:C',
        valueInputOption: 'USER_ENTERED',
        resource: { values },
    });
    console.log('Transaction logged.');
}


/**
 * Updates the "Stock" sheet. Adds a new row if the item doesn't exist,
 * or updates the quantity if it does.
 * @param {object|null} itemData The existing item data from findItemRow.
 * @param {string} itemName
 * @param {number} quantity
 */
async function updateStockSheet(itemData, itemName, quantity) {
    if (itemData) {
        // Item exists, update it
        console.log(`Updating existing item at row ${itemData.rowIndex}`);
        const currentQuantity = parseInt(itemData.data[2] || 0, 10);
        const newQuantity = currentQuantity + quantity;

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Stock!C${itemData.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[newQuantity]],
            },
        });
        console.log('Item quantity updated.');

    } else {
        // Item is new, append it
        console.log('Adding new item to stock sheet.');
        const newRow = [[itemName, '', quantity, 0]]; // A, B, C, D
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Stock!A:D',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: newRow,
            },
        });
        console.log('New item added.');
    }
}


async function handleStockOut(event) {
    event.preventDefault();
    toggleLoading(true);

    const withdrawQuantity = parseInt(document.getElementById('withdraw-quantity').value, 10);

    if (!scannedItemData) {
        alert('กรุณาสแกน QR Code ก่อนทำรายการ');
        toggleLoading(false);
        return;
    }

    if (isNaN(withdrawQuantity) || withdrawQuantity <= 0) {
        alert('กรุณากรอกจำนวนที่ต้องการเบิกให้ถูกต้อง');
        toggleLoading(false);
        return;
    }

    const remainingQuantity = parseInt(scannedItemData.data[4] || 0, 10); // Column E
    if (withdrawQuantity > remainingQuantity) {
        alert('ปริมาณสินค้ามีไม่พอ');
        toggleLoading(false);
        return;
    }

    try {
        const itemName = scannedItemData.data[0];
        await logStockOut(itemName, withdrawQuantity);
        await updateStockOnWithdrawal(scannedItemData, withdrawQuantity);

        alert('เบิกของเรียบร้อยแล้ว');
        document.getElementById('scan-result').style.display = 'none';
        document.getElementById('stock-out-form').reset();
        startScanner(); // Restart scanner for next item
    } catch (err) {
        console.error('Error during stock-out process:', err);
        alert(`เกิดข้อผิดพลาด: ${err.result?.error?.message || err.message}`);
    } finally {
        toggleLoading(false);
    }
}

/**
 * Logs a new "stock out" transaction to the "บันทึกเบิกออก" sheet.
 * @param {string} itemName
 * @param {number} quantity
 */
async function logStockOut(itemName, quantity) {
    console.log('Logging stock out transaction...');
    const timestamp = new Date().toLocaleString('th-TH');
    const values = [[timestamp, itemName, quantity]];

    await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'บันทึกเบิกออก!A:C',
        valueInputOption: 'USER_ENTERED',
        resource: { values },
    });
    console.log('Stock out transaction logged.');
}

/**
 * Updates the "จำนวนเบิกออกล่าสุด" in the "Stock" sheet.
 * @param {object} itemData The existing item data from findItemRow.
 * @param {number} quantity The amount being withdrawn.
 */
async function updateStockOnWithdrawal(itemData, quantity) {
    console.log(`Updating withdrawal quantity for item at row ${itemData.rowIndex}`);
    const currentWithdrawal = parseInt(itemData.data[3] || 0, 10); // Column D
    const newWithdrawal = currentWithdrawal + quantity;

    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Stock!D${itemData.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [[newWithdrawal]],
        },
    });
    console.log('Withdrawal quantity updated.');
}


function startScanner() {
    // Only initialize scanner if it doesn't exist
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
        console.log("QR Scanner Initialized");
    }

    document.getElementById('scan-result').style.display = 'none';
    const qrReaderDiv = document.getElementById('qr-reader');
    qrReaderDiv.style.display = 'block';

    html5QrcodeScanner.start(
        { facingMode: "environment" }, // use back camera
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        (errorMessage) => {
            // handle scan error, usually ignored
        }
    ).catch((err) => {
        console.log(`Unable to start scanning, error: ${err}`);
    });
}

/**
 * Callback function for when a QR code is successfully scanned.
 * @param {string} qrCodeMessage The decoded message from the QR code.
 */
async function onScanSuccess(qrCodeMessage) {
    // Stop scanning
    html5QrcodeScanner.stop().then(() => {
        console.log("QR Scanning stopped.");
    }).catch(err => console.warn("QR scanner failed to stop.", err));

    toggleLoading(true);
    document.getElementById('qr-reader').style.display = 'none';


    try {
        scannedItemData = await findItemRow(qrCodeMessage);

        if (scannedItemData) {
            document.getElementById('qr-code-text').innerText = qrCodeMessage;
            // Column E is the remaining quantity
            const remaining = scannedItemData.data[4] || 'N/A';
            document.getElementById('remaining-quantity').innerText = remaining;
            document.getElementById('scan-result').style.display = 'block';
        } else {
            alert('ไม่พบ Items ที่ต้องการค้นหา');
            startScanner(); // Restart scanner if item not found
        }
    } catch (err) {
        console.error('Error finding item from QR code:', err);
        alert(`เกิดข้อผิดพลาด: ${err.result?.error?.message || err.message}`);
        startScanner(); // Restart scanner on error
    } finally {
        toggleLoading(false);
    }
}
