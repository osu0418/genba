// 電話番号の欄：数字を打つと、その場でハイフンを入れる（0766-59-4017 のように）
// 市外局番の長さ（03 / 076 / 0766 など）の違いは、電話番号の決まりを知っている道具に任せる
(() => {
  const fields = document.querySelectorAll('#addForm [name="inTel"], #addForm [name="outTel"]');

  function format(value) {
    const digits = String(value || "")
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[^0-9]/g, "");
    if (!digits) return "";
    if (typeof libphonenumber === "undefined") return value;
    return new libphonenumber.AsYouType("JP").input(digits);
  }

  fields.forEach(f => {
    f.addEventListener("input", e => {
      // 消しているときは、ハイフンを足し直さない（消せなくなるため）
      if (e.inputType && e.inputType.startsWith("delete")) return;
      f.value = format(f.value);
    });
    f.addEventListener("blur", () => { f.value = format(f.value); });
  });
})();
