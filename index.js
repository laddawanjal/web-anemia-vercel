require('dotenv').config(); // ใช้ dotenv สำหรับโหลด Environment Variable
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");

const app = express();
const PORT = 3009;
require('dotenv').config(); // โหลดไฟล์ .env

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.error("Error: GOOGLE_APPLICATION_CREDENTIALS_JSON is not set in .env");
  process.exit(1); // หยุดโปรแกรมถ้าไม่มีค่า
}


// ตรวจสอบว่าต้องใช้ Local หรือ MongoDB Atlas
const mongoURI = process.env.USE_LOCAL_DB === "true"
  ? "mongodb://localhost:27017/webFormDB" // Local DB
  : process.env.MONGODB_URI; // MongoDB Atlas

// เชื่อมต่อ MongoDB (ลบ useUnifiedTopology)
mongoose.connect(mongoURI, { useNewUrlParser: true })
  .then(() => console.log(` Connected to MongoDB: ${mongoURI}`))
  .catch(err => console.error(" Error connecting to MongoDB:", err));


// ตรวจสอบว่า JSON ถูกต้องก่อนแปลง
try {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  console.log("Google Credentials Loaded:", credentials); // ตรวจสอบค่าที่โหลด
} catch (err) {
  console.error("Error parsing GOOGLE_APPLICATION_CREDENTIALS_JSON:", err.message);
  process.exit(1); // หยุดโปรแกรมถ้า JSON ไม่ถูกต้อง
}

// ดึงค่าจาก .env
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
});
console.log("Google Credentials Loaded Successfully");

require('dotenv').config(); // โหลด .env



console.log("MongoDB URI:", mongoURI); // ตรวจสอบ URI

console.log("MongoDB URI:", process.env.MONGODB_URI);
console.log("Google JSON Credentials:", process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.error("Error: GOOGLE_APPLICATION_CREDENTIALS_JSON is not defined in .env");
    process.exit(1);
}

// เชื่อมต่อ MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Error connecting to MongoDB:", err));


app.get('/favicon.ico', (req, res) => res.status(204).end());



const userSchema = new mongoose.Schema({
  id: String,
  name: String,
  gender: String,
  dob: String,
  nationality: String,
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true, // ✅ ลบช่องว่างอัตโนมัติ
    match: [/^\d{10}$/, "เบอร์โทรต้องมี 10 หลักเท่านั้น"], // ✅ ตรวจสอบอีกครั้งว่าเป็นตัวเลข 10 หลัก
  },
  images: [
    {
      fileName: String,
      url: String,
      uploadedAt: String,
    },
  ],
});

const User = mongoose.model("User", userSchema);



// Middleware//
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/Frontend")));

// Google Drive API Setup
  // ข้อมูลรับรองสำหรับเชื่อมต่อ Google API
// ดึงค่าจาก .env

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

  
const REDIRECT_URL = 'https://developers.google.com/oauthplayground';


const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({ version: "v3", auth: oauth2Client });

// Generate ID Function
const generateId = async () => {
  const latestUser = await User.findOne().sort({ _id: -1 });
  const latestId = latestUser ? latestUser.id : "vn0000";
  const newId = `vn${(parseInt(latestId.slice(2)) + 1).toString().padStart(4, "0")}`;//
  return newId;
};

// API Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/Frontend/index1.html"));
});

app.post("/api/submit", async (req, res) => {
  try {
    const { phone, name, gender, dob, nationality } = req.body;

    if (!phone || !name || !gender || !dob || !nationality) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    // ตรวจสอบว่าเบอร์โทรนี้มีอยู่ใน MongoDB แล้วหรือไม่
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ message: "เบอร์โทรนี้มีอยู่ในระบบแล้ว" }); // สถานะ 409: Conflict
    }

    // สร้าง ID ใหม่
    const newId = await generateId();

    // สร้างผู้ใช้ใหม่และบันทึกลงใน MongoDB
    const newUser = new User({
      id: newId,
      name,
      gender,
      dob,
      nationality,
      phone,
      images: [], // ค่าเริ่มต้น
    });

    await newUser.save();
    res.status(201).json({ message: "บันทึกข้อมูลสำเร็จ", id: newId }); // สถานะ 201: Created
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
  }
});

app.post("/api/check-phone", async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });

    if (user) {
      res.json({ message: "พบข้อมูลเบอร์โทรในระบบแล้ว" });
    } else {
      res.status(404).json({ message: "เบอร์โทรนี้ยังไม่มีในระบบ กรุณาลงทะเบียนใหม่" });
    }
  } catch (error) {
    console.error("Error checking phone number:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล" });
  }
});

app.post("/api/get-user", async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });

    if (user) {
      res.json({ user });
    } else {
      res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
  }
});

// API สำหรับเพิ่มรูปภาพลงใน Google Drive และเก็บ URL ใน MongoDB
app.post('/upload', async (req, res) => {
  try {
    const { image, phone, analysisResult } = req.body;

    if (!image || !phone) { // เอา analysisResult ออกจากเงื่อนไข
      return res.status(400).json({ message: "ข้อมูล image หรือ phone ไม่ครบถ้วน" });
  }
  
    // ค้นหาผู้ใช้ใน MongoDB
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้ในระบบ' });
    }

    // อัปโหลดไฟล์ไปยัง Google Drive
    const folderId = await getOrCreateFolder('webanemia_image');
    const uniqueSuffix = Date.now(); // ใช้ timestamp เพื่อลดโอกาสซ้ำ
    const fileName = `${analysisResult.replace(/\s+/g, '_')}_${uniqueSuffix}.jpg`;

    const fileId = await uploadFile(folderId, image.replace(/^data:image\/\w+;base64,/, ''), fileName);

    if (!fileId) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ 2' });
    }

    // สร้าง URL แบบ Public สำหรับไฟล์
    const webViewLink = await generatePublicURL(fileId);

    if (!webViewLink) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้าง URL ของไฟล์' });
    }

    // บันทึกข้อมูลใน MongoDB
    user.images.push({
      fileName, // ใช้ชื่อที่ตั้งไว้
      url: webViewLink,
    });

    await user.save();
    res.json({ message: 'อัปโหลดและตั้งชื่อสำเร็จ', webViewLink });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการประมวลผล' });
  }
});

// ฟังก์ชันสำหรับตรวจสอบว่ามีโฟลเดอร์อยู่แล้วหรือไม่ ถ้าไม่มีจะสร้างใหม่
async function getOrCreateFolder(folderName) {
  try {
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (response.data.files.length > 0) {
      console.log('พบโฟลเดอร์:', response.data.files[0]);
      return response.data.files[0].id;
    } else {
      const folderResponse = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
      });
      console.log('สร้างโฟลเดอร์ใหม่สำเร็จ:', folderResponse.data);
      return folderResponse.data.id;
    }
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการตรวจสอบหรือสร้างโฟลเดอร์:', error.message);
  }
}

async function generatePublicURL(fileId) {
  try {
    // ตั้งค่าการอนุญาตให้ไฟล์เข้าถึงได้แบบสาธารณะ
    await drive.permissions.create({
      fileId: fileId, // ใช้ fileId ที่ได้รับจากการอัปโหลด
      requestBody: {
        role: 'reader', // สิทธิ์อ่านอย่างเดียว
        type: 'anyone', // ใครก็ได้สามารถเข้าถึง
      },
    });

    // สร้าง URL สำหรับแสดงผลโดยตรง
    const publicUrl = `https://drive.google.com/uc?id=${fileId}&export=view`; // ใช้ URL ที่แสดงภาพโดยตรง
    console.log('สร้างลิงก์แบบ public สำเร็จ:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการสร้างลิงก์ public:', error.message);
    return null;
  }
}

// Endpoint สำหรับอัปโหลดรูปภาพ
app.post('/upload', async (req, res) => {
  try {
    const { image, phone, analysisResult } = req.body;

    if (!image || !phone || !analysisResult) {
      return res.status(400).json({ message: "ข้อมูล image, phone หรือ analysisResult ไม่ครบถ้วน" });
    }

    // ค้นหาผู้ใช้ใน MongoDB
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้ในระบบ' });
    }

    // อัปโหลดไฟล์ไปยัง Google Drive
    const folderId = await getOrCreateFolder('webanemia_image');
    const tempFileName = `temp_${Date.now()}.jpg`; // ชื่อไฟล์ชั่วคราว
    const fileId = await uploadFile(folderId, image.replace(/^data:image\/\w+;base64,/, ''), tempFileName);

    if (!fileId) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ 1' });
    }

    // เปลี่ยนชื่อไฟล์ใน Google Drive
    const newFileName = `${analysisResult.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
    await renameFile(fileId, newFileName);

    // สร้าง URL แบบ Public
    const webViewLink = await generatePublicURL(fileId);
    if (!webViewLink) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้าง URL ของไฟล์' });
    }

    // บันทึกข้อมูลใน MongoDB
    user.images.push({
      fileName: newFileName,
      url: webViewLink,
    });

    await user.save();
    res.json({ message: 'อัปโหลดและเปลี่ยนชื่อสำเร็จ!', webViewLink });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการประมวลผล' });
  }
});

async function uploadFile(folderId, base64Data, fileName) {
  try {
      const tempFilePath = path.join(__dirname, fileName);
      fs.writeFileSync(tempFilePath, base64Data, 'base64');

      const response = await drive.files.create({
          requestBody: {
              name: fileName,
              mimeType: 'image/jpeg',
              parents: [folderId],
          },
          media: {
              mimeType: 'image/jpeg',
              body: fs.createReadStream(tempFilePath),
          },
      });

      fs.unlinkSync(tempFilePath);
      return response.data.id;
  } catch (error) {
      console.error('Error uploading file:', error.message);
      return null;
  }
}

async function renameFile(fileId, newFileName) {
  try {
    const response = await drive.files.update({
      fileId: fileId,
      requestBody: { name: newFileName },
    });
    console.log("เปลี่ยนชื่อไฟล์สำเร็จ:", response.data);
    return response.data;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการเปลี่ยนชื่อไฟล์:", error.message);
    return null;
  }
}


app.get("/api/get-user", async (req, res) => {
  try {
      const { phone } = req.query;
      const user = await User.findOne({ phone });

      if (user) {
          res.json(user);
      } else {
          res.status(404).json({ message: "ไม่พบผู้ใช้" });
      }
  } catch (error) {
      console.error("Error fetching user data:", error);
      res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
  }
});

app.post("/api/update-user", async (req, res) => {
  try {
      const { phone, name, gender, dob, nationality } = req.body;

      const updatedUser = await User.findOneAndUpdate(
          { phone }, // ค้นหาจากเบอร์โทร
          { $set: { name, gender, dob, nationality } }, // อัปเดตข้อมูล
          { new: true } // คืนค่าผลลัพธ์ที่อัปเดต
      );

      if (updatedUser) {
          res.json({ message: "อัปเดตข้อมูลสำเร็จ!", updatedUser });
      } else {
          res.status(404).json({ message: "ไม่พบผู้ใช้" });
      }
  } catch (error) {
      console.error("Error updating user data:", error);
      res.status(500).json({ message: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล" });
  }
});

app.delete("/api/delete-user", async (req, res) => {
  try {
      const phone = req.query.phone; // รับค่า phone จาก query parameter

      if (!phone) {
          return res.status(400).json({ message: "กรุณาระบุเบอร์โทรศัพท์" });
      }

      const user = await User.findOneAndDelete({ phone: phone }); // ค้นหาและลบ

      if (user) {
          res.json({ message: "ลบบัญชีสำเร็จ!" });
      } else {
          res.status(404).json({ message: "ไม่พบผู้ใช้" });
      }
  } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "เกิดข้อผิดพลาดในการลบบัญชี" });
  }
});


// เสิร์ฟไฟล์ Static
app.use(express.static(path.join(__dirname, 'public')));



// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app