import type { ApiError, ErrorCode } from '@app/shared';

// Exhaustive by type: a new ErrorCode in @app/shared fails the build until it has a title here.
export const ERROR_TITLE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'ข้อมูลไม่ถูกต้อง',
  UNAUTHORIZED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  FORBIDDEN: 'ไม่มีสิทธิ์ทำรายการนี้',
  NOT_FOUND: 'ไม่พบข้อมูล หรืออุปกรณ์ถูกปิดใช้งานแล้ว',
  INVALID_STATUS: 'สถานะคำขอเปลี่ยนไปแล้ว',
  INSUFFICIENT_STOCK: 'จำนวนคงเหลือไม่พอ',
  EQUIPMENT_INACTIVE: 'อุปกรณ์ถูกปิดใช้งาน',
  VERSION_CONFLICT: 'ข้อมูลถูกแก้ไขระหว่างนี้',
  EQUIPMENT_UNAVAILABLE: 'ไม่สามารถเบิกอุปกรณ์นี้ได้ในขณะนี้',
  TOO_MANY_REQUESTS: 'ทำรายการบ่อยเกินไป กรุณาลองใหม่ภายหลัง',
  INTERNAL_ERROR: 'ระบบขัดข้อง กรุณาลองใหม่',
};

export function errorMessages(error: ApiError): string[] {
  return Array.isArray(error.message) ? error.message : [error.message];
}
