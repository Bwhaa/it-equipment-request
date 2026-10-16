import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from '../auth/dto/login.dto';
import { EquipmentQueryDto } from '../equipments/dto/equipment-query.dto';
import { UpdateEquipmentDto } from '../equipments/dto/update-equipment.dto';
import { MAX_PAGE, PageQueryDto } from './pagination';

async function errorsOf<T extends object>(type: new () => T, plain: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(type, plain));
  return errors.map((error) => error.property);
}

describe('page', () => {
  it('accepts MAX_PAGE (100000)', async () => {
    expect(MAX_PAGE).toBe(100000);
    expect(await errorsOf(PageQueryDto, { page: '100000' })).toEqual([]);
  });

  it.each(['100001', '1e21', '99999999999', '2147483647'])('rejects page=%s', async (page) => {
    expect(await errorsOf(PageQueryDto, { page })).toEqual(['page']);
  });
});

describe('UpdateEquipmentDto.version', () => {
  it('accepts 2147483647', async () => {
    expect(await errorsOf(UpdateEquipmentDto, { version: 2147483647, name: 'x' })).toEqual([]);
  });

  it.each([2147483648, 1e21, 99999999999999999999])('rejects %p', async (version) => {
    expect(await errorsOf(UpdateEquipmentDto, { version, name: 'x' })).toEqual(['version']);
  });
});

describe('LoginDto', () => {
  const valid = { email: 'admin@company.com', password: 'Admin@123' };

  it.each([128])('accepts a password of %i characters', async (length) => {
    expect(await errorsOf(LoginDto, { ...valid, password: 'x'.repeat(length) })).toEqual([]);
  });

  it.each([129, 5])('rejects a password of %i characters', async (length) => {
    expect(await errorsOf(LoginDto, { ...valid, password: 'x'.repeat(length) })).toEqual(['password']);
  });

  it('trims and lowercases the email', () => {
    expect(plainToInstance(LoginDto, { ...valid, email: ' Admin@Company.com ' }).email).toBe('admin@company.com');
  });

  it('leaves a non-string email alone so @IsEmail rejects it', async () => {
    expect(plainToInstance(LoginDto, { ...valid, email: 42 }).email).toBe(42);
    expect(await errorsOf(LoginDto, { ...valid, email: 42 })).toEqual(['email']);
  });
});

describe('EquipmentQueryDto.category', () => {
  it('is trimmed', () => {
    expect(plainToInstance(EquipmentQueryDto, { category: ' Display ' }).category).toBe('Display');
  });

  it('still rejects more than 60 characters after trimming', async () => {
    expect(await errorsOf(EquipmentQueryDto, { category: 'c'.repeat(61) })).toEqual(['category']);
  });
});
