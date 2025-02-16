require('dotenv').config(); // ใช้ dotenv สำหรับโหลด Environment Variable
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");

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




async function getOrCreateFolder(folderName) {
  try {
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    } else {
      const folderResponse = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
      });

      console.log('✅ สร้างโฟลเดอร์ใหม่สำเร็จ:', folderResponse.data.name);
      return folderResponse.data.id;
    }
  } catch (error) {
    console.error('❌ Error checking/creating folder:', error.message);
    return null;
  }
}



async function generatePublicURL(fileId) {
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });



    const publicUrl = `https://drive.google.com/uc?id=${fileId}&export=view`;
    console.log(`✅ Public URL Created: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการสร้างลิงก์ public:', error.message);
    return null;
  }
}



// Endpoint สำหรับอัปโหลดรูปภาพ
// API สำหรับเพิ่มรูปภาพลงใน Google Drive และเก็บ URL ใน MongoDB
app.post('/upload', async (req, res) => {
  try {
    const { image, phone, analysisResult } = req.body;

    if (!image || !phone) {
      return res.status(400).json({ message: "❌ ข้อมูลไม่ครบ" });
    }

    // ค้นหาผู้ใช้ใน MongoDB
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: '❌ ไม่พบผู้ใช้ในระบบ' });
    }

    // อัปโหลดไฟล์ไปยัง Google Drive
    const folderId = await getOrCreateFolder('webanemia_image');
    const fileId = await uploadFile(folderId, image.replace(/^data:image\/\w+;base64,/, ''));

    if (!fileId) {
      return res.status(500).json({ message: '❌ Upload failed' });
    }

    // ตั้งชื่อไฟล์ใหม่ตามผลลัพธ์การวิเคราะห์
    const newFileName = analysisResult 
      ? `${analysisResult.replace(/\s+/g, '_')}_${Date.now()}.jpg` 
      : `default_analysis_result_${Date.now()}.jpg`;

    await renameFile(fileId, newFileName);

    // สร้าง URL แบบ Public
    const webViewLink = await generatePublicURL(fileId);

    if (!webViewLink) {
      return res.status(500).json({ message: '❌ Error creating file URL' });
    }

    // บันทึกข้อมูลรูปภาพใน MongoDB
    user.images.push({
      fileName: newFileName, // ใช้ชื่อที่เปลี่ยนแล้ว
      url: webViewLink,
      uploadedAt: new Date().toISOString(),
    });

    await user.save();
    res.json({ message: '✅ อัปโหลดและตั้งชื่อสำเร็จ', webViewLink });

  } catch (error) {
    console.error('❌ Error processing request:', error.message);
    res.status(500).json({ message: '❌ Server error' });
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



    const stream = require("stream");

// ฟังก์ชันอัปโหลดไฟล์ไปยัง Google Drive
async function uploadFile(folderId, base64Data) {
  try {
    if (!base64Data) {
      console.error("❌ Base64 data is missing!");
      return null;
    }

    const initialFileName = `temp_image_${Date.now()}.jpg`;
    const base64Buffer = Buffer.from(base64Data, "base64");

    const bufferStream = new stream.PassThrough();
    bufferStream.end(base64Buffer);

    const response = await drive.files.create({
      requestBody: {
        name: initialFileName,
        mimeType: "image/jpeg",
        parents: [folderId],
      },
      media: {
        mimeType: "image/jpeg",
        body: bufferStream,
      },
    });

    console.log(`✅ อัปโหลดสำเร็จ: ${initialFileName} (File ID: ${response.data.id})`);
    return response.data.id;
  } catch (error) {
    console.error("❌ Error uploading file:", error.message);
    return null;
  }
}


    
// ฟังก์ชันเปลี่ยนชื่อไฟล์ใน Google Drive
async function renameFile(fileId, newFileName) {
  try {
    if (!fileId || !newFileName) {
      console.error("❌ ข้อมูลไม่ครบ: fileId หรือ newFileName หายไป");
      return null;
    }

    console.log(`🔄 กำลังเปลี่ยนชื่อไฟล์ (ID: ${fileId}) เป็น: ${newFileName}`);

    const response = await drive.files.update({
      fileId: fileId,
      requestBody: { name: newFileName },
    });

    console.log(`✅ เปลี่ยนชื่อไฟล์สำเร็จ: ${response.data.name}`);
    return response.data;
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อไฟล์:", error.message);
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