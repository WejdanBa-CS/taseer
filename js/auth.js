/* جلسة دخول محلية: رقم جوال سعودي يفتح تعليقات المستخدمين ومتوسط أسعارهم. */
(function () {
  const KEY = "taseer-session";

  function digits(raw) {
    return String(raw || "")
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/\D/g, "");
  }

  function normalizePhone(raw) {
    let phone = digits(raw);
    if (phone.startsWith("966") && phone.length === 12) phone = `0${phone.slice(3)}`;
    if (phone.startsWith("5") && phone.length === 9) phone = `0${phone}`;
    if (!/^05\d{8}$/.test(phone)) return "";
    return phone;
  }

  function cleanName(raw) {
    const name = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    if (name.length < 2 || name.length > 40) return "";
    if (/[<>]/.test(name)) return "";
    return name;
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "");
      const phone = normalizePhone(parsed.phone);
      const name = cleanName(parsed.name);
      if (!phone || !name) return null;
      return { name, phone, at: Number(parsed.at) || Date.now() };
    } catch (error) {
      return null;
    }
  }

  function write(session) {
    localStorage.setItem(KEY, JSON.stringify(session));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function isLoggedIn() {
    return Boolean(read());
  }

  function login(name, phone) {
    const clean = cleanName(name);
    const mobile = normalizePhone(phone);
    if (!clean) return { ok: false, message: "اكتب اسمك من حرفين إلى 40 حرف." };
    if (!mobile) return { ok: false, message: "اكتب رقم جوال سعودي يبدأ بـ 05." };
    const session = { name: clean, phone: mobile, at: Date.now() };
    write(session);
    return { ok: true, session };
  }

  function logout() {
    clear();
  }

  window.TASEER_AUTH = {
    read,
    login,
    logout,
    isLoggedIn,
    normalizePhone,
    cleanName,
  };
})();
