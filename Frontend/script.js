document.querySelector("#submission-form").addEventListener("submit", async (e) => {
  e.preventDefault(); // ป้องกันการ reload หน้าแบบปกติ
  
  const formData = new FormData(e.target); // ดึงข้อมูลจากฟอร์ม
  let data = Object.fromEntries(formData.entries()); // แปลงข้อมูลเป็น JSON
  
  // ✅ ลบช่องว่าง และตรวจสอบให้แน่ใจว่าเป็นตัวเลขเท่านั้น
  data.phone = data.phone.replace(/\D/g, "").trim(); // ลบอักขระที่ไม่ใช่ตัวเลขทั้งหมด

  // ✅ ตรวจสอบว่าเบอร์โทรมี 10 หลักเท่านั้น
  if (!/^\d{10}$/.test(data.phone)) {
    alert("เบอร์โทรต้องเป็นตัวเลข 10 หลักเท่านั้น!");
    return; // หยุดการทำงาน ถ้าเบอร์โทรไม่ถูกต้อง
  }

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
      // ✅ กรณีลงทะเบียนสำเร็จ
      sessionStorage.setItem("phone", data.phone); // บันทึกเบอร์โทรใน SessionStorage
      alert(result.message || "ลงทะเบียนสำเร็จ!");
      window.location.href = "index4.html"; // ไปยังหน้าถัดไป
    } else if (response.status === 409) {
      // ✅ กรณีเบอร์โทรซ้ำ
      const userChoice = confirm(
        `${result.message || "เบอร์โทรนี้มีอยู่ในระบบแล้ว"}\nคุณต้องการเข้าสู่ระบบด้วยเบอร์นี้หรือไม่?`
      );

      if (userChoice) {
        // หากผู้ใช้ต้องการเข้าสู่ระบบด้วยเบอร์นี้
        sessionStorage.setItem("phone", data.phone);
        window.location.href = "index4.html";
      } else {
        alert("โปรดใช้เบอร์โทรอื่นในการลงทะเบียน");
      }
    } else {
      alert(result.message || "เกิดข้อผิดพลาดในการลงทะเบียน");
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
  }
});




document.addEventListener("DOMContentLoaded", () => {
  const dobInput = document.getElementById("dob");

  dobInput.addEventListener("change", () => {
      let dateValue = dobInput.value;
      if (dateValue) {
          let [year, month, day] = dateValue.split("-");
          let buddhistYear = parseInt(year) + 543; // แปลง ค.ศ. → พ.ศ.
          dobInput.value = `${buddhistYear}-${month}-${day}`; // แสดงผลเป็น พ.ศ.
      }
  });
});
