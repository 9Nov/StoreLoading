# วิธีการตั้งค่า Google Sheets API Credentials สำหรับ Web App

เอกสารนี้จะแนะนำขั้นตอนการสร้างข้อมูลที่จำเป็น 3 ส่วนเพื่อใช้เชื่อมต่อเว็บแอปพลิเคชันกับ Google Sheet ของคุณ:

1.  **Spreadsheet ID**: รหัสเฉพาะของไฟล์ Google Sheet ที่คุณต้องการใช้
2.  **API Key**: ใช้สำหรับอ่านข้อมูลสาธารณะจาก Google Sheet (ในโปรเจกต์นี้ใช้เพื่ออ่านข้อมูล "คงเหลือ")
3.  **OAuth 2.0 Client ID**: ใช้สำหรับขออนุญาตผู้ใช้ (ตัวคุณเอง) ในการแก้ไขข้อมูลใน Google Sheet (เช่น การบันทึกข้อมูลรับเข้า/เบิกออก)

---

### ส่วนที่ 1: การหา Spreadsheet ID

1.  เปิดไฟล์ Google Sheet ที่คุณต้องการใช้งาน
2.  ดูที่ URL ในแถบที่อยู่ของเบราว์เซอร์
3.  คัดลอก (Copy) รหัสที่อยู่ระหว่าง `/d/` และ `/edit`
    *   **ตัวอย่าง URL:** `https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SPREADSHEET_ID/edit#gid=0`
    *   **Spreadsheet ID ของคุณคือ:** `THIS_IS_YOUR_SPREADSHEET_ID`

---

### ส่วนที่ 2: การตั้งค่าโปรเจกต์บน Google Cloud

1.  ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2.  **สร้างโปรเจกต์ใหม่ (New Project)**:
    *   คลิกที่เมนูเลือกโปรเจกต์ (บริเวณด้านบนซ้าย) แล้วเลือก "New Project"
    *   ตั้งชื่อโปรเจกต์ตามต้องการ (เช่น "Stock App") แล้วคลิก "Create"
3.  **เปิดใช้งาน APIs ที่จำเป็น**:
    *   จากเมนูด้านข้าง (Navigation menu), ไปที่ `APIs & Services > Library`
    *   ค้นหา "Google Sheets API" แล้วคลิก "Enable"
    *   ค้นหา "Google Drive API" แล้วคลิก "Enable" (จำเป็นสำหรับการยืนยันตัวตน)

---

### ส่วนที่ 3: การสร้าง API Key

1.  จากเมนูด้านข้าง, ไปที่ `APIs & Services > Credentials`
2.  คลิกที่ `+ CREATE CREDENTIALS` แล้วเลือก `API key`
3.  ระบบจะสร้าง API Key ให้คุณ ให้คัดลอกเก็บไว้
    *   **สำคัญ**: เพื่อความปลอดภัย ควรจำกัดการใช้งาน API Key โดยการคลิกที่ชื่อ Key ที่เพิ่งสร้าง > เลือก `Restrict key` > ในส่วน `API restrictions` ให้เลือก `Google Sheets API` เท่านั้น

---

### ส่วนที่ 4: การสร้าง OAuth 2.0 Client ID

1.  ที่หน้า `Credentials` เดิม, คลิกที่ `+ CREATE CREDENTIALS` แล้วเลือก `OAuth client ID`
2.  **ตั้งค่าหน้าจอขอความยินยอม (Configure consent screen)** (หากยังไม่เคยตั้งค่า):
    *   เลือก `External` และคลิก `Create`
    *   **App name**: ตั้งชื่อแอป (เช่น "Stock Management App")
    *   **User support email**: เลือกอีเมลของคุณ
    *   **Developer contact information**: ใส่อีเมลของคุณอีกครั้ง แล้วคลิก `SAVE AND CONTINUE` (ข้ามขั้นตอนอื่นไปก่อนได้)
    *   เมื่อเสร็จแล้ว กลับไปที่หน้า `Credentials`
3.  **สร้าง Client ID**:
    *   **Application type**: เลือก `Web application`
    *   **Name**: ตั้งชื่อ (ใช้ชื่อเดิมได้)
    *   ในส่วน `Authorized JavaScript origins`, คลิก `+ ADD URI` แล้วเพิ่ม URL ต่อไปนี้ (สำหรับใช้ทดสอบบนเครื่อง):
        *   `http://localhost`
        *   `http://localhost:8080` (หรือ Port อื่นๆ ที่คุณอาจจะใช้)
        *   `http://127.0.0.1`
        *   `http://127.0.0.1:8080`
        *   **หมายเหตุ**: หากคุณนำเว็บแอปไปใช้งานจริงบนโดเมนอื่น จะต้องกลับมาเพิ่ม URL ของโดเมนนั้นที่นี่ด้วย
    *   คลิก `CREATE`
4.  ระบบจะแสดง **Your Client ID** ขึ้นมา ให้คัดลอกเก็บไว้

---

### ส่วนที่ 5: วิธีการรันแอปพลิเคชัน (How to Run the Application)

**สำคัญ:** เพื่อให้ Google Authentication ทำงานได้อย่างถูกต้อง คุณ **ไม่สามารถ** เปิดไฟล์ `index.html` โดยการดับเบิลคลิกได้ เนื่องจากระบบความปลอดภัยของ Google จะบล็อกการล็อกอินจาก URL ที่ขึ้นต้นด้วย `file://`

คุณจำเป็นต้องรันเว็บเซิร์ฟเวอร์จำลองบนเครื่องของคุณก่อน โดยทำตามขั้นตอนง่ายๆ ดังนี้:

1.  **เปิด Terminal หรือ Command Prompt** ขึ้นมา
2.  **เข้าไปยังโฟลเดอร์ของโปรเจกต์นี้** ที่มีไฟล์ `index.html` อยู่
3.  **รันคำสั่ง:**
    ```bash
    python -m http.server 8080
    ```
    *(หากคำสั่งนี้ไม่ทำงาน ลองใช้ `python3 -m http.server 8080`)*
4.  **เปิดเว็บเบราว์เซอร์** (เช่น Chrome) แล้วเข้าไปที่ URL:
    ```
    http://localhost:8080
    ```
5.  ตอนนี้คุณจะเห็นหน้าเว็บแอป และสามารถกดปุ่ม "Authorize with Google" เพื่อล็อกอินได้แล้วครับ

---

### สรุป

เมื่อทำครบทุกขั้นตอนแล้ว คุณจะได้ข้อมูลสำคัญ 3 อย่าง:
1.  **SPREADSHEET_ID**: (จากส่วนที่ 1)
2.  **API_KEY**: (จากส่วนที่ 3)
3.  **CLIENT_ID**: (จากส่วนที่ 4)

ให้นำข้อมูลทั้ง 3 ส่วนนี้ไปใส่ในไฟล์ `script.js` ตามที่ระบุไว้ในโค้ด
