export class HttpError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = options.code;
    this.publicMessage = options.publicMessage; // ข้อความที่อยากให้ user เห็น
  }
}
