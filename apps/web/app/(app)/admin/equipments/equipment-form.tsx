'use client';

import { useActionState, useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { validateEquipmentForm } from '@/lib/equipment-form';
import type { EquipmentFormFieldErrors } from '@/lib/equipment-form';
import { ERROR_TITLE, errorMessages } from '@/lib/error-messages';
import { EQUIPMENT_STATUS_LABEL } from '@/lib/format';
import { createEquipmentAction, updateEquipmentAction } from './actions';
import { initialEquipmentFormState } from './state';
import type { EquipmentFormValues } from './state';
import { FORM_INPUT_CLASS } from '@/lib/ui-classes';

interface Props {
  mode: 'create' | 'edit';
  initial?: { id: string; version: number; values: EquipmentFormValues };
}

function statusLabel(value: string): string {
  return value === 'ACTIVE' || value === 'INACTIVE' ? EQUIPMENT_STATUS_LABEL[value] : value;
}

function ValueList({ title, values }: { title: string; values: EquipmentFormValues }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc pl-5">
        <li>ชื่อ: {values.name}</li>
        <li>หมวดหมู่: {values.category}</li>
        <li>คงเหลือ: {values.stockQuantity}</li>
        <li>สถานะ: {statusLabel(values.status)}</li>
      </ul>
    </div>
  );
}

export function EquipmentForm({ mode, initial }: Props) {
  const [state, formAction, pending] = useActionState(
    mode === 'create' ? createEquipmentAction : updateEquipmentAction,
    initialEquipmentFormState,
  );
  const [clientErrors, setClientErrors] = useState<EquipmentFormFieldErrors>();

  const conflict = state.conflict;
  // After a conflict the form is re-keyed and starts from the LATEST values and version.
  const version = conflict ? conflict.latest.version : initial?.version;
  const defaults: EquipmentFormValues = conflict
    ? {
        name: conflict.latest.name,
        category: conflict.latest.category,
        stockQuantity: String(conflict.latest.stockQuantity),
        status: conflict.latest.status,
      }
    : (state.values ?? initial?.values ?? { name: '', category: '', stockQuantity: '0', status: 'ACTIVE' });

  const fieldErrors: EquipmentFormFieldErrors = clientErrors ?? state.fieldErrors ?? {};
  const apiError = state.error;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const checked = validateEquipmentForm({
      name: data.get('name'),
      category: data.get('category'),
      stockQuantity: data.get('stockQuantity'),
      status: data.get('status'),
    });
    if (!checked.ok) {
      // No request is sent: the same rules run again on the server.
      event.preventDefault();
      setClientErrors(checked.fieldErrors);
      return;
    }
    setClientErrors(undefined);
  }

  const describe = (field: keyof EquipmentFormFieldErrors) => (fieldErrors[field] ? `${field}-error` : undefined);
  const error = (field: keyof EquipmentFormFieldErrors) =>
    fieldErrors[field] && (
      <p id={`${field}-error`} className="mt-1 text-sm text-red-700">
        {fieldErrors[field]}
      </p>
    );

  return (
    <div className="space-y-4">
      {conflict && (
        <Alert variant="error" title={ERROR_TITLE.VERSION_CONFLICT}>
          <p className="mt-1">ข้อมูลอุปกรณ์ถูกแก้ไขระหว่างนี้ ฟอร์มด้านล่างถูกอัปเดตเป็นค่าล่าสุดแล้ว กรุณาตรวจสอบและบันทึกอีกครั้ง</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <ValueList
              title={`ค่าล่าสุดในระบบ (เวอร์ชัน ${conflict.latest.version})`}
              values={{
                name: conflict.latest.name,
                category: conflict.latest.category,
                stockQuantity: String(conflict.latest.stockQuantity),
                status: conflict.latest.status,
              }}
            />
            <ValueList title="ค่าที่คุณพยายามบันทึก" values={conflict.attempted} />
          </div>
        </Alert>
      )}

      {apiError && !conflict && (
        <Alert variant="error" title={ERROR_TITLE[apiError.code]}>
          <ul className="mt-1 list-disc pl-5">
            {errorMessages(apiError).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <form
        key={conflict ? `conflict-${conflict.latest.version}` : 'form'}
        action={formAction}
        onSubmit={onSubmit}
        noValidate
        className="space-y-4"
      >
        {mode === 'edit' && initial && (
          <>
            <input type="hidden" name="id" value={initial.id} />
            <input type="hidden" name="version" value={version} />
          </>
        )}

        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            ชื่ออุปกรณ์
          </label>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={120}
            defaultValue={defaults.name}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={describe('name')}
            className={FORM_INPUT_CLASS}
          />
          {error('name')}
        </div>

        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium">
            หมวดหมู่
          </label>
          <input
            id="category"
            name="category"
            type="text"
            maxLength={60}
            defaultValue={defaults.category}
            aria-invalid={fieldErrors.category ? true : undefined}
            aria-describedby={describe('category')}
            className={FORM_INPUT_CLASS}
          />
          {error('category')}
        </div>

        <div>
          <label htmlFor="stockQuantity" className="mb-1 block text-sm font-medium">
            จำนวนคงเหลือ
          </label>
          <input
            id="stockQuantity"
            name="stockQuantity"
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            step={1}
            defaultValue={defaults.stockQuantity}
            aria-invalid={fieldErrors.stockQuantity ? true : undefined}
            aria-describedby={describe('stockQuantity')}
            className={FORM_INPUT_CLASS}
          />
          {error('stockQuantity')}
        </div>

        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium">
            สถานะ
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaults.status}
            aria-invalid={fieldErrors.status ? true : undefined}
            aria-describedby={describe('status')}
            className={FORM_INPUT_CLASS}
          >
            <option value="ACTIVE">{EQUIPMENT_STATUS_LABEL.ACTIVE}</option>
            <option value="INACTIVE">{EQUIPMENT_STATUS_LABEL.INACTIVE}</option>
          </select>
          {error('status')}
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
      </form>
    </div>
  );
}
