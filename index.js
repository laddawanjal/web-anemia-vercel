require('dotenv').config(); // ใช้ dotenv สำหรับโหลด Environment Variable
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const stream = require("stream");
const { google } = require("googleapis");

const app = express();
const PORT = 3009;


if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.error("Error: GOOGLE_APPLICATION_CREDENTIALS_JSON is not set in .env");
  process.exit(1); // หยุดโปรแกรมถ้าไม่มีค่า
}


// ตรวจสอบว่าต้องใช้ Local หรือ MongoDB Atlas
const mongoURI = process.env.USE_LOCAL_DB === "true"
  ? "mongodb://localhost:27017/webFormDB" // Local DB
  : process.env.MONGODB_URI; // MongoDB Atlas



// ตรวจสอบว่า JSON ถูกต้องก่อนแปลง
try {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  console.log("Google Credentials Loaded:", credentials); // ตรวจสอบค่าที่โหลด
} catch (err) {
  console.error("Error parsing GOOGLE_APPLICATION_CREDENTIALS_JSON:", err.message);
  process.exit(1); // หยุดโปรแกรมถ้า JSON ไม่ถูกต้อง
}

// ตั้งค่า Google Drive API
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/drive'],
});




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



const drive = google.drive({ version: "v3", auth }); // ✅ ใช้ auth ที่สร้างจาก GOOGLE_APPLICATION_CREDENTIALS_JSON
const folderId = "1NVQA00IaE5iWjHPoP93MltvYcQESOPj9"

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






async function generatePublicURL(fileId) {
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // รอให้สิทธิ์มีผลก่อนสร้างลิงก์
    await new Promise(resolve => setTimeout(resolve, 2000));

    const publicUrl = `https://drive.google.com/uc?id=${fileId}&export=view`;
    console.log(`✅ Public URL Created: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการสร้างลิงก์ public:', error.message);
    return null;
  }
}



// Endpoint สำหรับอัปโหลดรูปภาพ
app.post('/upload', async (req, res) => {
  try {
    const { image, phone, analysisResult } = req.body;

    if (!image || !phone) {
      return res.status(400).json({ message: "ข้อมูล image หรือ phone ไม่ครบถ้วน" });
    }

    // ค้นหาผู้ใช้ใน MongoDB
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้ในระบบ' });
    }

    // อัปโหลดไฟล์ไปยัง Google Drive
    const folderId = await getOrCreateFolder('webanemia_image');
    const fileName = `${analysisResult ? analysisResult.replace(/\s+/g, '_') : 'unknown'}_${Date.now()}.jpg`;

    const fileId = await uploadFile(folderId, image, fileName);
if (!fileId) {
  console.error("❌ Upload failed: No file ID returned.");
  return res.status(500).json({ message: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์ไปยัง Google Drive" });
}


    // สร้าง URL แบบ Public
    const webViewLink = await generatePublicURL(fileId);
    if (!webViewLink) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้าง URL ของไฟล์' });
    }

    // บันทึกข้อมูลรูปภาพใน MongoDB
    user.images.push({
      fileName,
      url: webViewLink,
    });

    await user.save();
    res.json({ message: 'อัปโหลดสำเร็จ!', webViewLink });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการประมวลผล' });
  }
});


const stream = require("stream");

async function uploadFile(base64Image, fileName) {
  try {
    // แปลง Base64 เป็น Buffer
    const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), "base64");

    // สร้าง Stream สำหรับอัปโหลดไฟล์โดยตรง
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    // ตั้งค่าข้อมูลไฟล์
    const fileMetadata = {
      name: fileName,
      parents: [folderId], // ✅ ใช้ Folder ID คงที่
    };

    // ตั้งค่าไฟล์ที่จะอัปโหลด
    const media = {
      mimeType: "image/jpeg",
      body: bufferStream,
    };

    // อัปโหลดไปยัง Google Drive
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    if (!file.data.id) {
      console.error("❌ Upload failed: No file ID returned.");
      return null;
    }

    console.log(`✅ Upload Success: ${fileName} (File ID: ${file.data.id})`);
    return file.data.id;
  } catch (error) {
    console.error("❌ Error uploading file:", error.message);
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