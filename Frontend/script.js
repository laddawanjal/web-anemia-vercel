document.querySelector("#submission-form").addEventListener("submit", async (e) => {
  e.preventDefault(); // ป้องกันการ reload หน้าแบบปกติ
  const formData = new FormData(e.target); // ดึงข้อมูลจากฟอร์ม
  const data = Object.fromEntries(formData.entries()); // แปลงข้อมูลเป็น JSON
  
  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data), // ส่งข้อมูลเป็น JSON
    });

    const result = await response.json();

    if (response.ok) {
      // กรณีการลงทะเบียนสำเร็จ
      sessionStorage.setItem("phone", data.phone); // บันทึกเบอร์โทรใน SessionStorage
      alert(result.message || "ลงทะเบียนสำเร็จ!");
      window.location.href = "index4.html"; // ไปยังหน้าถัดไป
    } else if (response.status === 409) {
      // กรณีเบอร์โทรซ้ำ
      const userChoice = confirm(
        `${result.message || "เบอร์โทรนี้มีอยู่ในระบบแล้ว"}\nคุณต้องการเข้าสู่ระบบด้วยเบอร์นี้หรือไม่?`
      );

      if (userChoice) {
        // หากผู้ใช้ต้องการเข้าสู่ระบบด้วยเบอร์นี้
        sessionStorage.setItem("phone", data.phone); // บันทึกเบอร์โทรใน SessionStorage
        window.location.href = "index4.html"; // ไปยังหน้าถัดไป
      } else {
        // หากผู้ใช้ต้องการลงทะเบียนด้วยเบอร์ใหม่
        alert("โปรดใช้เบอร์โทรอื่นในการลงทะเบียน");
      }
    } else {
      // กรณีข้อผิดพลาดอื่น ๆ
      alert(result.message || "เกิดข้อผิดพลาดในการลงทะเบียน");
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
  }

  const API_URL = "http://localhost:3009"; // URL ของ Backend

});



